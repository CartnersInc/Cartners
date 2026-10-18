// A stand-in for the backend, used until the real endpoints are connected.
//
// Data lives in localStorage, so every tab on the same origin shares it. Open two
// tabs, pick a different person in each, and they behave like two phones polling one
// server.
//
// IMPORTANT: claiming items, allocation math, and balances in this file play the role
// of the SERVER. Components never import this file directly.

import { ApiError } from "../lib/errors.js";
import { getMemberId } from "../lib/session.js";
import { seedDb } from "./fixtures.js";

const STORAGE_KEY = "roomie-mock-db-v1";
const WINDOWS = [0, 5, 10, 15];

// Dev controls, per tab.
//   offline:        every request fails as if there's no connection
//   failNext:       "network" (write never arrives) or "lost-response" (saved, reply lost)
//   loseNextStart:  someone else starts a trip a moment before your next "Start trip"
//   serverSkewMs:   pretend the server clock is ahead of this device
export const mockControls = { offline: false, failNext: null, loseNextStart: false, latencyMs: 300, serverSkewMs: 0 };

let memoryDb = null; // fallback when localStorage is unavailable
function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* fall through */ }
  if (memoryDb) return structuredClone(memoryDb);
  const db = seedDb();
  save(db);
  return db;
}
function save(db) {
  memoryDb = structuredClone(db);
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(db)); } catch { /* memory only */ }
}
export function resetMock() {
  save(seedDb());
  mockControls.failNext = null;
  mockControls.loseNextStart = false;
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const serverNow = () => Date.now() + mockControls.serverSkewMs;
const iso = (ms) => new Date(ms).toISOString();
const uid = (prefix) => `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
const READ_OFFLINE = "Can't reach the server right now.";
const WRITE_OFFLINE = "Couldn't reach the server, so we can't tell if this saved. Try again; it won't be saved twice.";

function groupFor(db, groupId) {
  const g = db.data[groupId];
  if (!g) throw new ApiError("That group doesn't exist.", { status: 404 });
  if (!g.members.some((m) => m.id === getMemberId())) throw new ApiError("You're not a member of this group.", { status: 403 });
  return g;
}
const nameIn = (g, id) => g.members.find((m) => m.id === id)?.name || "Someone";

async function read(fn) {
  await wait(mockControls.latencyMs);
  if (mockControls.offline) throw new ApiError(READ_OFFLINE, { retryable: true, offline: true });
  return fn(load());
}

// Idempotent write. A replayed key with the same body returns the original response.
async function write(scope, key, payload, apply) {
  await wait(mockControls.latencyMs);
  if (mockControls.offline) throw new ApiError(WRITE_OFFLINE, { retryable: true, offline: true });
  if (!key) throw new ApiError("Missing idempotency key.", { status: 400 });

  const db = load();
  const fingerprint = JSON.stringify([scope, payload]);
  const seen = db.keys[key];
  if (seen) {
    if (seen.fingerprint !== fingerprint) throw new ApiError("This save conflicts with an earlier one. Refresh and try again.", { status: 409 });
    return { data: structuredClone(seen.response), replayed: true };
  }
  if (mockControls.failNext === "network") {
    mockControls.failNext = null;
    throw new ApiError(WRITE_OFFLINE, { retryable: true, offline: true });
  }

  const response = apply(db); // throws ApiError without saving anything
  db.keys[key] = { fingerprint, response };
  save(db);

  if (mockControls.failNext === "lost-response") {
    mockControls.failNext = null;
    throw new ApiError(WRITE_OFFLINE, { retryable: true, offline: true });
  }
  return { data: structuredClone(response), replayed: false };
}

/* ---------------- Items and trips ---------------- */
function cleanItemFields(p, { partial }) {
  const out = {};
  if (!partial || "name" in p) {
    const name = String(p.name ?? "").trim();
    if (!name) throw new ApiError("Give the item a name.", { status: 422 });
    if (name.length > 60) throw new ApiError("Keep the name under 60 characters.", { status: 422 });
    out.name = name;
  }
  if (!partial || "quantity" in p) {
    const q = p.quantity ?? 1;
    if (!Number.isInteger(q) || q < 1 || q > 99) throw new ApiError("Quantity must be a whole number from 1 to 99.", { status: 422 });
    out.quantity = q;
  }
  if ("note" in p) out.note = String(p.note ?? "").trim().slice(0, 140);
  if ("store" in p) out.store = String(p.store ?? "").trim().slice(0, 40) || null;
  if ("needed_by" in p) {
    if (p.needed_by && !/^\d{4}-\d{2}-\d{2}$/.test(p.needed_by)) throw new ApiError("Use a real date.", { status: 422 });
    out.needed_by = p.needed_by || null;
  }
  return out;
}

// The shopper couldn't get an item at this store (not carried or out of stock), so it
// leaves the current trip and waits for the next one. `punted` records where it wasn't
// found so the next shopper knows. Punting can be undone while the same trip is active.
function puntItem(g, item, punt) {
  const run = g.run;
  if (punt) {
    if (!run || item.run_id !== run.id) throw new ApiError("That item isn't on the current trip.", { status: 422 });
    if (item.status !== "open") throw new ApiError("That item is already bought.", { status: 422 });
    if (run.shopper_id !== getMemberId()) throw new ApiError(`Only ${nameIn(g, run.shopper_id)} can move items off this trip.`, { status: 403 });
    item.run_id = null;
    item.punted = { by: getMemberId(), at: iso(serverNow()), store: run.store, run_id: run.id };
  } else {
    if (!item.punted) return;
    if (!run || item.punted.run_id !== run.id || run.shopper_id !== getMemberId()) {
      throw new ApiError("Only the shopper can put this back, while the same trip is active.", { status: 422 });
    }
    item.run_id = run.id;
    item.punted = null;
  }
}

/* ---------------- Spending (server-side math) ---------------- */
function allocate(expense, g) {
  if (expense.mode === "pooled") return { status: "recorded", allocations: null, review_reason: null };
  const unknown = expense.exceptions.filter((e) => e.amount_cents == null);
  if (unknown.length) {
    const names = unknown.map((e) => e.description || `${nameIn(g, e.member_id)}'s item`);
    return { status: "needs_review", allocations: null, review_reason: `The amount for ${names.join(", ")} is missing.` };
  }
  const personal = {};
  for (const e of expense.exceptions) personal[e.member_id] = (personal[e.member_id] || 0) + e.amount_cents;
  const shared = expense.total_cents - Object.values(personal).reduce((a, b) => a + b, 0);
  const ids = expense.participant_ids;
  const each = Math.floor(shared / ids.length);
  const leftover = shared - each * ids.length;
  const pennyTo = ids.includes(expense.payer_id) ? expense.payer_id : ids[0];
  return {
    status: "recorded",
    review_reason: null,
    allocations: ids.map((id) => ({ member_id: id, amount_cents: each + (personal[id] || 0) + (id === pennyTo ? leftover : 0) })),
  };
}

function recomputeBalances(g) {
  const sp = g.spending;
  const owed = {};
  const add = (from, to, c) => { if (from !== to) owed[`${from}|${to}`] = (owed[`${from}|${to}`] || 0) + c; };
  for (const e of sp.expenses) {
    if (e.mode !== "split" || e.status !== "recorded" || !e.allocations) continue;
    for (const a of e.allocations) add(a.member_id, e.payer_id, a.amount_cents);
  }
  for (const p of sp.payments) add(p.to_member_id, p.from_member_id, p.amount_cents);
  const ids = g.members.map((m) => m.id);
  sp.balances = [];
  for (let i = 0; i < ids.length; i++) {
    for (let j = i + 1; j < ids.length; j++) {
      const a = ids[i], b = ids[j];
      const net = (owed[`${a}|${b}`] || 0) - (owed[`${b}|${a}`] || 0);
      if (net > 0) sp.balances.push({ from_member_id: a, to_member_id: b, amount_cents: net });
      if (net < 0) sp.balances.push({ from_member_id: b, to_member_id: a, amount_cents: -net });
    }
  }
  sp.summary = {
    split_total_cents: sp.expenses.filter((e) => e.mode === "split" && e.status === "recorded").reduce((a, e) => a + e.total_cents, 0),
    pooled_total_cents: sp.expenses.filter((e) => e.mode === "pooled").reduce((a, e) => a + e.total_cents, 0),
    needs_review_count: sp.expenses.filter((e) => e.status === "needs_review").length,
  };
}

function spendingRuns(g) {
  const fromTrips = [...(g.run ? [g.run] : []), ...g.runs].map((r) => ({ id: r.id, store: r.store, started_by: r.shopper_id, started_at: r.started_at }));
  const seen = new Set(fromTrips.map((r) => r.id));
  return [...fromTrips, ...(g.spending.runs || []).filter((r) => !seen.has(r.id))];
}

/* ---------------- Public mock API ---------------- */
export const mockServer = {
  listGroups: () => read((db) => db.groups
    .filter((grp) => db.data[grp.id].members.some((m) => m.id === getMemberId()))
    .map((grp) => ({ ...grp, member_count: db.data[grp.id].members.length }))),

  getSnapshot: (groupId) => read((db) => {
    const g = groupFor(db, groupId);
    const grp = db.groups.find((x) => x.id === groupId);
    return structuredClone({
      server_time: iso(serverNow()),
      group: { id: grp.id, name: grp.name },
      members: g.members,
      items: g.items.filter((i) => i.status !== "deleted"),
      run: g.run,
      last_store: g.last_store,
    });
  }),

  addItem: (groupId, payload, key) => write(["addItem", groupId], key, payload, (db) => {
    const g = groupFor(db, groupId);
    const fields = cleanItemFields(payload, { partial: false });
    const now = serverNow();
    const joinsRun = g.run && now < Date.parse(g.run.closes_at);
    const item = {
      id: uid("it"),
      note: "", store: null, needed_by: null,
      ...fields,
      requested_by: getMemberId(),
      created_at: iso(now),
      status: "open",
      run_id: joinsRun ? g.run.id : null,
      bought_by: null,
      bought_at: null,
      punted: null,
      version: 1,
    };
    g.items.push(item);
    return { item };
  }),

  updateItem: (groupId, itemId, payload, key) => write(["updateItem", groupId, itemId], key, payload, (db) => {
    const g = groupFor(db, groupId);
    const item = g.items.find((i) => i.id === itemId);
    if (!item) throw new ApiError("That item was removed.", { status: 404 });
    if (payload.version !== item.version) {
      throw new ApiError("Someone changed this item while you were editing.", { status: 409, data: { item: structuredClone(item) } });
    }
    const changes = payload.changes || {};
    if ("punted" in changes) puntItem(g, item, changes.punted);
    Object.assign(item, cleanItemFields(changes, { partial: true }));
    if ("bought" in changes) {
      item.status = changes.bought ? "bought" : "open";
      item.bought_by = changes.bought ? getMemberId() : null;
      item.bought_at = changes.bought ? iso(serverNow()) : null;
      if (changes.bought) item.punted = null;
      // Unchecking something from a finished trip puts it back on the list.
      if (!changes.bought && item.run_id && (!g.run || g.run.id !== item.run_id)) item.run_id = null;
    }
    item.version += 1;
    return { item };
  }),

  async startRun(groupId, payload, key) {
    if (mockControls.loseNextStart && !mockControls.offline) {
      // Simulate a roommate's "Start trip" landing a moment before ours.
      mockControls.loseNextStart = false;
      const db = load();
      const g = db.data[groupId];
      const other = g?.members.find((m) => m.id !== getMemberId());
      if (g && !g.run && other) {
        const now = serverNow();
        g.run = { id: uid("run"), shopper_id: other.id, store: payload.store || g.last_store || "QFC", window_minutes: 10, started_at: iso(now), closes_at: iso(now + 10 * 60e3), status: "active", finished_at: null };
        g.items.forEach((i) => { if (i.status === "open" && !i.run_id) i.run_id = g.run.id; });
        save(db);
      }
    }
    return write(["startRun", groupId], key, payload, (db) => {
      const g = groupFor(db, groupId);
      if (g.run) {
        throw new ApiError(`${nameIn(g, g.run.shopper_id)} is already shopping at ${g.run.store}.`, { status: 409, data: { run: structuredClone(g.run) } });
      }
      const store = String(payload.store ?? "").trim() || g.last_store;
      if (!store) throw new ApiError("Where are you going?", { status: 422 });
      const windowMinutes = payload.window_minutes ?? 10;
      if (!WINDOWS.includes(windowMinutes)) throw new ApiError("Pick no window, 5, 10, or 15 minutes.", { status: 422 });
      const now = serverNow();
      const run = { id: uid("run"), shopper_id: getMemberId(), store, window_minutes: windowMinutes, started_at: iso(now), closes_at: iso(now + windowMinutes * 60e3), status: "active", finished_at: null };
      let claimed = 0;
      g.items.forEach((i) => { if (i.status === "open" && !i.run_id) { i.run_id = run.id; i.version += 1; claimed++; } });
      g.run = run;
      g.last_store = store;
      return { run, claimed_count: claimed };
    });
  },

  finishRun: (groupId, runId, payload, key) => write(["finishRun", groupId, runId], key, payload, (db) => {
    const g = groupFor(db, groupId);
    if (!g.run || g.run.id !== runId) throw new ApiError("This trip has already ended.", { status: 409, data: { run: g.run } });
    if (g.run.shopper_id !== getMemberId()) throw new ApiError(`Only ${nameIn(g, g.run.shopper_id)} can finish this trip.`, { status: 403 });
    let kept = 0, bought = 0;
    g.items.forEach((i) => {
      if (i.run_id !== runId) return;
      if (i.status === "open") { i.run_id = null; i.version += 1; kept++; } else bought++;
    });
    const run = { ...g.run, status: "finished", finished_at: iso(serverNow()) };
    g.runs.unshift(run);
    g.run = null;
    return { run, kept_count: kept, bought_count: bought };
  }),

  getSpending: (groupId) => read((db) => {
    const g = groupFor(db, groupId);
    const grp = db.groups.find((x) => x.id === groupId);
    return structuredClone({ ...g.spending, household: { id: grp.id, name: grp.name }, members: g.members, runs: spendingRuns(g) });
  }),

  createExpense: (groupId, p, key) => write(["createExpense", groupId], key, p, (db) => {
    const g = groupFor(db, groupId);
    const ids = g.members.map((m) => m.id);
    if (!p.store?.trim()) throw new ApiError("Add the store name.", { status: 422 });
    if (!Number.isInteger(p.total_cents) || p.total_cents <= 0) throw new ApiError("The total must be more than $0.00.", { status: 422 });
    if (!ids.includes(p.payer_id)) throw new ApiError("Choose who paid.", { status: 422 });
    if (!["split", "pooled"].includes(p.mode)) throw new ApiError("Choose split or pooled.", { status: 422 });
    if (!Array.isArray(p.participant_ids) || !p.participant_ids.length || p.participant_ids.some((id) => !ids.includes(id))) {
      throw new ApiError("Choose at least one person this receipt is for.", { status: 422 });
    }
    if (p.run_id && !spendingRuns(g).some((r) => r.id === p.run_id)) throw new ApiError("That store run no longer exists.", { status: 422 });
    const exceptions = p.mode === "split" ? p.exceptions || [] : [];
    for (const e of exceptions) {
      if (!p.participant_ids.includes(e.member_id)) throw new ApiError(`${nameIn(g, e.member_id)} has a personal item but isn't on this receipt.`, { status: 422 });
      if (e.amount_cents != null && (!Number.isInteger(e.amount_cents) || e.amount_cents < 0)) throw new ApiError("Personal item amounts can't be negative.", { status: 422 });
    }
    if (exceptions.reduce((a, e) => a + (e.amount_cents || 0), 0) > p.total_cents) throw new ApiError("Personal items add up to more than the receipt total.", { status: 422 });

    const expense = {
      id: uid("exp"),
      created_at: iso(serverNow()),
      store: p.store.trim(),
      run_id: p.run_id || null,
      total_cents: p.total_cents,
      payer_id: p.payer_id,
      mode: p.mode,
      participant_ids: [...p.participant_ids],
      exceptions: exceptions.map((e) => ({ member_id: e.member_id, description: e.description || "", amount_cents: e.amount_cents })),
    };
    Object.assign(expense, allocate(expense, g));
    g.spending.expenses.unshift(expense);
    recomputeBalances(g);
    return { expense, balances: g.spending.balances };
  }),

  recordPayment: (groupId, p, key) => write(["recordPayment", groupId], key, p, (db) => {
    const g = groupFor(db, groupId);
    const ids = g.members.map((m) => m.id);
    if (!ids.includes(p.from_member_id) || !ids.includes(p.to_member_id) || p.from_member_id === p.to_member_id) {
      throw new ApiError("Choose who paid whom.", { status: 422 });
    }
    if (!Number.isInteger(p.amount_cents) || p.amount_cents <= 0) throw new ApiError("The payment must be more than $0.00.", { status: 422 });
    const payment = { id: uid("pay"), ...p, recorded_at: iso(serverNow()) };
    g.spending.payments.unshift(payment);
    recomputeBalances(g);
    return { payment, balances: g.spending.balances };
  }),
};
