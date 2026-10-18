const CONFIRM = /^(?:yes|yes please|add|add it|add these|add this|put it in|put it in the cart|add to cart|sounds good|let's do it)[.! ]*$/i;
const DISMISS = /^(?:no|no thanks|not now|skip|cancel|forget it)[.! ]*$/i;
const HELP = /^(?:hi|hello|hey|yo|what'?s up|what(?:'?s| is) going on|help|who are you|what (?:is this|do (?:u|you) do)|text cartners.*|hello (?:photon|proton)|are you (?:there|working))[.!? ]*$/i;
const SPECTRUM_ECHO = /photon spectrum is connected|you said:/i;
const START_RUN = /\b(?:going to|heading to|on my way to|leaving for|stop(?:ping)? by|i(?:'?m| am) (?:at|going to)|what do you(?: guys| all)? need|need anything|anybody need|anyone need|last call)\b/i;
const STORE_HINT = /\b(?:the store|the grocery store|qfc|safeway|kroger|whole foods|trader joe'?s?|costco|target|aldi|h-?e-?b)\b/i;
const NAMED_RUN = /\b(?:is|are) going to (?:the )?(?:store|grocery store)\b/i;
const FINISH_RUN = /\b(?:done shopping|i(?:'?m| am) done|leaving (?:now|the store)|heading (?:home|back)|at checkout|checking out|got everything|closing the run)\b/i;
const CANCEL_RUN = /\b(?:not going(?: anymore)?|false alarm|cancel(?:led)? the (?:run|trip)|never mind the store)\b/i;
const LIST_STATUS = /\b(?:what(?:'?s| is) on (?:the |our |my )?(?:shopping )?(?:list|cart)|show (?:the |our )?(?:list|cart)|what do we (?:need|have))\b/i;
const NEED_PREFIX = /^(?:(?:please )?(?:can you )?(?:(?:i|we) )?(?:need|want|grab|get|add)(?: some)?\s+)/i;
const MEALISH = /\b(?:tacos?|dinner|recipe|meal|cook|eat|for \d+|something (?:quick|easy|fun)|vegetarian|vegan)\b/i;
const FOOD_REQUEST = /\b(?:what should we eat|what do you want to eat|what are we eating|dinner idea|meal idea|recipe idea|suggest (?:a |some )?(?:meal|recipe|dinner)|plan dinner|plan (?:this|our|the|my) week|week of meals|grocery list|groceries for)\b/i;

export function helpReply(kind = 'family') {
  if (kind === 'roommates' || kind === 'friends') {
    return [
      'I’m Cartners in this roommate thread — not a family grocery chat.',
      'Someone grabbing groceries? Text “going to QFC — what do you guys need?” I’ll start a 10-minute run.',
      '“Need milk” adds it to this run. Afterward, split the receipt in Cartners and settle with Venmo, Zelle, or Cash App. Opening a link never marks a debt paid.',
      '“What’s on the list?” anytime. “Done shopping” when you leave. Meal ideas still need “add it” before they hit the cart.',
    ].join('\n\n');
  }
  return [
    'I’m Cartners in this family thread.',
    'Mom or dad heading to the store? Text “going to the store — what does everyone need?” I’ll start a 10-minute run.',
    'Everyone else can text “need milk” and it lands on the list. “Tacos for four” is a meal draft; reply “add it” to confirm. “Plan this week” saves dinners, not groceries.',
    '“What’s on the list?” anytime. “Done shopping” when you’re leaving.',
  ].join('\n\n');
}

export const HELP_REPLY = helpReply('family');

export function liveItems(workspace) {
  return (workspace?.items || []).filter((item) => !item.removed && !item.bought);
}

export function actorName(workspace, actorId) {
  return workspace?.actors?.find((actor) => actor.id === actorId)?.name || 'Someone';
}

export function activeTrip(workspace) {
  const trip = workspace?.trip;
  if (!trip?.claimedBy) return null;
  if (['finished', 'released', 'completed', 'idle'].includes(trip.state)) return null;
  return trip;
}

export function windowOpen(trip, nowMs) {
  if (!trip?.requestDeadlineAt) return false;
  return nowMs < Date.parse(trip.requestDeadlineAt);
}

export function minutesLeft(trip, nowMs) {
  if (!trip?.requestDeadlineAt) return 0;
  return Math.max(0, Math.ceil((Date.parse(trip.requestDeadlineAt) - nowMs) / 60000));
}

export function parseStoreName(text) {
  const match = String(text || '').replace(/\u2019/g, "'").match(/\b(?:going to|heading to|on my way to|leaving for|stop(?:ping)? by|shopping at|i(?:'?m| am) (?:at|going to))\s+(.+?)(?:\s*[,—\-–.]|\s+what\b|$)/i);
  if (!match) return 'the grocery store';
  const store = match[1].replace(/^(?:the\s+)?store\b/i, 'the grocery store').replace(/[?,.!;]+$/, '').trim();
  if (!store || /^the grocery store$/i.test(store)) return 'the grocery store';
  return store.slice(0, 80);
}

export function parseWindowMinutes(text) {
  const match = String(text || '').match(/\b(\d+)\s*(?:min|mins|minutes)\b/i);
  const value = match ? Number(match[1]) : 10;
  if (value <= 5) return 5;
  if (value >= 15) return 15;
  return 10;
}

export function parseNeedItems(text) {
  const clean = String(text || '').trim();
  const rest = clean.replace(NEED_PREFIX, '').replace(/[.!?]+$/, '').trim();
  if (!rest || /^(?:anything|something|it|this|these|that)$/i.test(rest)) return [];
  return rest.split(/\s*(?:,| and |\s+and\s+)\s*/i).map((part) => part.replace(/^(?:some|a|an)\s+/i, '').trim()).filter((part) => part.length > 1 && part.length <= 80);
}

export function classifyHousehold(text, { hasPendingDraft = false } = {}) {
  const clean = String(text || '').replace(/\u2019/g, "'").trim();
  if (!clean) return { type: 'ignore' };
  if (SPECTRUM_ECHO.test(clean)) return { type: 'ignore' };
  if (hasPendingDraft && CONFIRM.test(clean)) return { type: 'confirm' };
  if (hasPendingDraft && DISMISS.test(clean)) return { type: 'dismiss' };
  if (FINISH_RUN.test(clean)) return { type: 'finish_run' };
  if (CANCEL_RUN.test(clean)) return { type: 'cancel_run' };
  if ((START_RUN.test(clean) && (STORE_HINT.test(clean) || /what do you|need anything|anybody need|anyone need|last call|going to|heading to|on my way/i.test(clean))) || NAMED_RUN.test(clean)) {
    return { type: 'start_run', storeName: parseStoreName(clean), requestWindowMinutes: parseWindowMinutes(clean) };
  }
  if (LIST_STATUS.test(clean)) return { type: 'list' };
  if (HELP.test(clean)) return { type: 'help' };
  if (NEED_PREFIX.test(clean) && !MEALISH.test(clean)) {
    const items = parseNeedItems(clean);
    if (items.length) return { type: 'need_items', items };
  }
  if (FOOD_REQUEST.test(clean) || MEALISH.test(clean)) return { type: 'suggest' };
  return { type: 'ignore' };
}

export function formatItemLine(item) {
  const qty = Number.isInteger(item.quantity) ? String(item.quantity) : String(item.quantity);
  const unit = item.unit === 'count' ? '' : ` ${item.unit}`;
  return `${qty}${unit} ${item.name}`.trim();
}

export function formatCart(workspace) {
  const items = liveItems(workspace);
  if (!items.length) return 'The shared list is empty.';
  const lines = items.slice(0, 12).map((item) => `• ${formatItemLine(item)}`);
  const extra = items.length > 12 ? `\n• and ${items.length - 12} more` : '';
  return `On the shared list:\n${lines.join('\n')}${extra}`;
}

export function formatRunStatus(workspace, nowMs = Date.now()) {
  const trip = activeTrip(workspace);
  const cart = formatCart(workspace);
  if (!trip) return `${cart}\n\nNo one is shopping right now. Text “going to the store — what do you need?” to start a run.`;
  const shopper = actorName(workspace, trip.claimedBy);
  if (windowOpen(trip, nowMs)) {
    return `${shopper} is heading to ${trip.storeName}. You’ve got about ${minutesLeft(trip, nowMs)} min to add requests.\n\n${cart}\n\nText “need milk” to add something, or “done shopping” when they leave.`;
  }
  return `${shopper} is at ${trip.storeName}. The request window is closed; new texts wait for the next run.\n\n${cart}`;
}

export function formatRunStarted(workspace, actorId, nowMs = Date.now()) {
  const trip = activeTrip(workspace);
  const shopper = actorName(workspace, actorId);
  const cart = formatCart(workspace);
  const minutes = trip ? minutesLeft(trip, nowMs) : 10;
  const store = trip?.storeName || 'the grocery store';
  if (liveItems(workspace).length === 0) {
    return `${shopper} is going to ${store}. The list is empty — you’ve got about ${minutes} min. Text “need milk and eggs” and I’ll put it on this run.`;
  }
  return `${shopper} is going to ${store}. You’ve got about ${minutes} min.\n\n${cart}\n\nText what you need. I’ll add it to this run.`;
}

export function formatAdded(names, workspace, nowMs = Date.now()) {
  const added = names.join(', ');
  const trip = activeTrip(workspace);
  if (trip && windowOpen(trip, nowMs)) {
    return `Added ${added} to this ${trip.storeName} run. ${formatCart(workspace)}`;
  }
  if (trip) return `Added ${added}. The current run’s window is closed, so this waits for the next trip.\n\n${formatCart(workspace)}`;
  return `Added ${added} to the shared list. Nobody is shopping yet — someone can text “going to the store.”\n\n${formatCart(workspace)}`;
}
