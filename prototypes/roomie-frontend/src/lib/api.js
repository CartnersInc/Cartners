// API client for the whole app.
//
// VITE_DATA_SOURCE=api talks to the real server. Anything else uses the in-browser
// mock (src/mock), which is shared across tabs through localStorage so two tabs
// behave like two phones.
//
// Every write sends an Idempotency-Key. Retrying the same request reuses the key, so
// a retry after a timeout can't create a duplicate. The server answers 201 for a new
// record and 200 when it recognizes a replayed key.

import { ApiError } from "./errors.js";
import { getMemberId } from "./session.js";
import { mockServer } from "../mock/mockServer.js";

export const dataSource = import.meta.env.VITE_DATA_SOURCE === "api" ? "api" : "fixture";
const BASE = import.meta.env.VITE_API_BASE || "";
const TIMEOUT_MS = 10000;

export function newIdempotencyKey() {
  if (globalThis.crypto?.randomUUID) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

async function request(method, path, body, idempotencyKey) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  let res;
  try {
    res = await fetch(BASE + path, {
      method,
      headers: {
        "Content-Type": "application/json",
        "X-Member-Id": getMemberId(),
        ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
  } catch {
    const msg = method === "GET"
      ? "Can't reach the server right now."
      : "Couldn't reach the server, so we can't tell if this saved. Try again; it won't be saved twice.";
    throw new ApiError(msg, { retryable: true, offline: true });
  } finally {
    clearTimeout(timer);
  }

  let data = null;
  try { data = await res.json(); } catch { /* empty or non-JSON body */ }

  if (res.ok) return { data, replayed: method !== "GET" && res.status === 200 };
  if (res.status === 409) {
    throw new ApiError(data?.error || "Someone else changed this first.", { status: 409, data });
  }
  if (res.status >= 500 || res.status === 429) {
    throw new ApiError("The server couldn't handle this right now. Try again; it won't be saved twice.", { status: res.status, retryable: true, data });
  }
  throw new ApiError(data?.error || `The server rejected this request (${res.status}).`, { status: res.status, data });
}

const g = (groupId) => `/api/groups/${encodeURIComponent(groupId)}`;

const liveApi = {
  listGroups: () => request("GET", "/api/groups").then((r) => r.data.groups),
  getSnapshot: (groupId) => request("GET", `${g(groupId)}/snapshot`).then((r) => r.data),
  addItem: (groupId, payload, key) => request("POST", `${g(groupId)}/items`, payload, key),
  updateItem: (groupId, itemId, payload, key) => request("PATCH", `${g(groupId)}/items/${encodeURIComponent(itemId)}`, payload, key),
  startRun: (groupId, payload, key) => request("POST", `${g(groupId)}/runs`, payload, key),
  finishRun: (groupId, runId, payload, key) => request("POST", `${g(groupId)}/runs/${encodeURIComponent(runId)}/finish`, payload, key),
  getSpending: (groupId) => request("GET", `${g(groupId)}/spending`).then((r) => r.data),
  createExpense: (groupId, payload, key) => request("POST", `${g(groupId)}/expenses`, payload, key),
  recordPayment: (groupId, payload, key) => request("POST", `${g(groupId)}/payments`, payload, key),
};

export const api = dataSource === "api" ? liveApi : mockServer;
