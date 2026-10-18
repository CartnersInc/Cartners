// Seed data for the mock server: two groups so switching can be tested.
// Times are relative to when the data was seeded.

import spending4b from "./sampleSpending.json";

export function seedDb(now = Date.now()) {
  const iso = (ms) => new Date(ms).toISOString();
  const M = 60e3, H = 3600e3, D = 864e5;

  const alex = spending4b.members.find((m) => m.id === "m_alex");
  const members4b = spending4b.members;
  const potluckMembers = [
    alex,
    { id: "m_priya", name: "Priya", pay_links: {} },
    { id: "m_dana", name: "Dana", pay_links: { venmo: "https://venmo.com/u/dana-demo" } },
    { id: "m_leo", name: "Leo", pay_links: { paypal: "https://paypal.me/leodemo" } },
  ];

  let n = 0;
  const item = (gid, name, quantity, requestedBy, agoMs, extra = {}) => ({
    id: `it_${gid}_${++n}`,
    name,
    quantity,
    note: extra.note || "",
    store: extra.store || null,
    needed_by: extra.needed_by || null,
    requested_by: requestedBy,
    created_at: iso(now - agoMs),
    status: extra.status || "open",
    run_id: extra.run_id || null,
    bought_by: extra.bought_by || null,
    bought_at: extra.bought_at || null,
    version: 1,
  });

  // The potluck group already has a trip in progress, so switching to it shows the banner.
  const potluckRun = {
    id: "run_potluck_1",
    shopper_id: "m_dana",
    store: "Safeway",
    window_minutes: 10,
    started_at: iso(now - 3 * M),
    closes_at: iso(now + 7 * M),
    status: "active",
    finished_at: null,
  };

  return {
    schema: 1,
    groups: [
      { id: "g_4b", name: "Unit 4B" },
      { id: "g_potluck", name: "Friday potluck crew" },
    ],
    data: {
      g_4b: {
        members: members4b,
        last_store: "QFC",
        run: null,
        runs: [],
        items: [
          item("g_4b", "Eggs", 1, "m_priya", 5 * H, { note: "A dozen, large" }),
          item("g_4b", "Oat milk", 2, "m_sam", 2 * H, { note: "Unsweetened" }),
          item("g_4b", "Paper towels", 1, "m_alex", 26 * H),
          item("g_4b", "Sriracha", 1, "m_sam", 2 * H),
          item("g_4b", "Spinach", 1, "m_priya", 5 * H, { store: "Trader Joe's" }),
          item("g_4b", "Dish soap", 1, "m_priya", 5 * H),
          item("g_4b", "Bananas", 6, "m_alex", 30 * H, { status: "bought", bought_by: "m_alex", bought_at: iso(now - 20 * H) }),
        ],
        spending: structuredClone(spending4b),
      },
      g_potluck: {
        members: potluckMembers,
        last_store: "Safeway",
        run: potluckRun,
        runs: [],
        items: [
          item("g_potluck", "Paper plates", 1, "m_priya", 30 * M, { run_id: potluckRun.id }),
          item("g_potluck", "Tortilla chips", 3, "m_leo", 20 * M, { run_id: potluckRun.id }),
          item("g_potluck", "Lemonade", 2, "m_dana", 10 * M, { run_id: potluckRun.id }),
          item("g_potluck", "Ice", 2, "m_leo", 1 * M, { run_id: potluckRun.id, note: "Bags" }),
        ],
        spending: {
          household: { id: "g_potluck", name: "Friday potluck crew" },
          runs: [],
          expenses: [
            {
              id: "exp_p1",
              created_at: iso(now - 6 * D),
              store: "Costco",
              run_id: null,
              total_cents: 6420,
              payer_id: "m_dana",
              mode: "pooled",
              status: "recorded",
              participant_ids: ["m_alex", "m_priya", "m_dana", "m_leo"],
              exceptions: [],
              allocations: null,
              review_reason: null,
            },
          ],
          payments: [],
          balances: [],
          summary: { split_total_cents: 0, pooled_total_cents: 6420, needs_review_count: 0 },
        },
      },
    },
    keys: {},
  };
}
