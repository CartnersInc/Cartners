import { createHash, randomUUID } from 'node:crypto';

const CONFIRM = /^(?:yes|yes please|add|add it|add these|add this|put it in|put it in the cart|add to cart|sounds good|let's do it)[.! ]*$/i;
const DISMISS = /^(?:no|no thanks|not now|skip|cancel|forget it)[.! ]*$/i;
const FOOD_REQUEST = /\b(?:what should we eat|what do you want to eat|what are we eating|what can we eat|what to eat|what should i cook|what should we cook|dinner idea|meal idea|recipe idea|suggest (?:a |some )?(?:meal|recipe|dinner)|plan dinner|grocery list|groceries for|need groceries|shopping list)\b/i;
const FOOD_CONTEXT = /\b(?:eat|cook|dinner|meal|recipe|food|grocery|groceries|shopping|cart|snack|ingredient|add|need|buy)\b/i;
const DIRECT_MENTION = /(?:^|\s)@?cartners\b/i;

export function classifyMessage(text, hasPendingDraft) {
  const clean = String(text || '').replace(DIRECT_MENTION, '').trim();
  if (!clean) return 'ignore';
  if (hasPendingDraft && CONFIRM.test(clean)) return 'confirm';
  if (hasPendingDraft && DISMISS.test(clean)) return 'dismiss';
  const mentioned = DIRECT_MENTION.test(String(text || ''));
  if (FOOD_REQUEST.test(clean) || (mentioned && (hasPendingDraft || FOOD_CONTEXT.test(clean)))) return 'suggest';
  return 'ignore';
}

function formatQuantity(quantity, unit) {
  const number = Number.isInteger(quantity) ? String(quantity) : String(Number(quantity.toFixed(1)));
  const unitLabel = unit === 'count' ? '' : unit === 'can' ? `${quantity === 1 ? 'can' : 'cans'} ` : unit === 'pack' ? `${quantity === 1 ? 'pack' : 'packs'} ` : `${unit} `;
  return `${number} ${unitLabel}`;
}

export function formatDraft(draft) {
  const label = draft.sourceMode === 'sample' ? 'Sample idea' : 'Cartners idea';
  if (draft.kind === 'clarification') return `${label}: ${draft.question}\n\nReply with the change you want and I’ll adjust it.`;

  const isMeal = draft.kind === 'recommendation';
  const content = isMeal ? draft.recommendation : null;
  const entries = isMeal ? content?.ingredients || [] : draft.items || [];
  const byId = new Map(entries.map((item) => [item.id, item]));
  const preview = isMeal ? content?.listPreview || [] : draft.listPreview || [];
  const changes = preview.flatMap((change) => {
    const item = byId.get(change.ingredientId);
    if (!item) return [];
    if (change.action === 'keep') return [`already have ${item.name}`];
    if (change.action === 'review') return [`check ${item.name}`];
    const quantity = change.deltaQuantity ?? item.quantity;
    return [`${change.action === 'increase' ? 'top up' : 'get'} ${formatQuantity(quantity, item.unit)}${item.name}`];
  });

  const lines = [label];
  if (isMeal) {
    lines.push(`${content.title} · about ${content.prepMinutesApprox} min · serves ${content.servings}`);
    if (content.fitReason) lines.push(content.fitReason);
  } else {
    lines.push('Here’s a grocery list for that:');
  }
  if (changes.length) lines.push(`Cart preview: ${changes.join('; ')}.`);
  if (draft.sampleNotice && draft.sourceMode === 'sample') lines.push('This is sample data.');
  lines.push('Nothing has been added yet. Reply “add it” to confirm, or tell me what to change.');
  return lines.join('\n\n');
}

export function formatConfirmed(result, draft) {
  const label = draft.kind === 'recommendation' ? draft.recommendation?.title : 'the grocery list';
  const summary = result.changeSummary ? ` ${result.changeSummary}` : '';
  return `Added ${label} to the shared cart.${summary} You can undo it in Cartners.`;
}

export function makeRequestId(messageId, action = 'suggest') {
  // Stable across Photon delivery retries so a replay cannot create a second write.
  const hex = createHash('sha256').update(`${action}:${messageId}`).digest('hex').slice(0, 32).split('');
  hex[12] = '4';
  hex[16] = 'a';
  const value = hex.join('');
  return `${value.slice(0, 8)}-${value.slice(8, 12)}-${value.slice(12, 16)}-${value.slice(16, 20)}-${value.slice(20)}`;
}

export async function handleMessage({ message, config, api, photon, state }) {
  const text = message.content?.type === 'text' && message.content.format === 'plain'
    ? message.content.text.trim()
    : '';
  const sender = message.sentBy?.handle?.toLowerCase();
  const pending = state.pendingBySpace[message.space.id];

  if (message.platform !== config.platform || message.status !== 'received'
    || message.sentBy?.kind !== 'human' || message.receivedBy?.kind !== 'agent'
    || message.receivedBy?.handle !== config.agentHandle || !config.allowedSenders.has(sender)
    || !text) return false;

  const cleanText = text.replace(DIRECT_MENTION, '').trim();
  const intent = classifyMessage(text, Boolean(pending));
  if (intent === 'ignore') return false;

  const reply = async (body, action) => photon.projects.sendMessage({
    path: { id: config.projectId },
    headers: { 'idempotency-key': `cartners:${message.id}:${action}` },
    body: {
      spaceId: message.space.id,
      senderId: message.receivedBy.id,
      parentMessageId: message.id,
      content: { type: 'text', format: 'plain', text: body },
    },
  });

  if (pending?.sourceMessageId === message.id) {
    await reply(formatDraft(pending.draft), 'suggest');
    return true;
  }

  if (intent === 'dismiss') {
    delete state.pendingBySpace[message.space.id];
    await state.save();
    await reply('No problem. I left the cart as it was.', 'dismiss');
    return true;
  }

  if (intent === 'confirm') {
    try {
      const result = await api.confirmDraft({
        workspaceId: config.workspaceId,
        actorId: config.actorBySender.get(sender),
        requestId: pending.confirmRequestId,
        draftId: pending.draft.draftId,
        expectedListRevision: pending.draft.listRevision,
        target: 'cart',
      });
      delete state.pendingBySpace[message.space.id];
      await state.save();
      await reply(formatConfirmed(result, pending.draft), 'confirm');
    } catch (error) {
      if (error.status === 409) {
        delete state.pendingBySpace[message.space.id];
        await state.save();
        await reply('The shared cart changed while we were deciding, so I kept it safe. Ask me again and I’ll refresh the suggestion.', 'stale');
      } else {
        throw error;
      }
    }
    return true;
  }

  const actorId = config.actorBySender.get(sender);
  const requestId = makeRequestId(message.id, 'suggest');
  const draft = await api.suggest({
    workspaceId: config.workspaceId,
    actorId,
    requestId,
    message: cleanText || text,
    ...(pending?.draft?.draftId ? { previousDraftId: pending.draft.draftId } : {}),
  });
  state.pendingBySpace[message.space.id] = {
    draft,
    sourceMessageId: message.id,
    confirmRequestId: randomUUID(),
  };
  await state.save();
  await reply(formatDraft(draft), 'suggest');
  return true;
}
