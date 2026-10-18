import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { Spectrum } from 'spectrum-ts';
import { imessage } from 'spectrum-ts/providers/imessage';
import { formatConfirmed, formatDraft, makeRequestId } from './agent.js';
import { createCartnersApi } from './cartners-api.js';
import { createStateStore } from './state.js';
import {
  HELP_REPLY,
  activeTrip,
  actorName,
  classifyHousehold,
  formatAdded,
  formatRunStarted,
  formatRunStatus,
  helpReply,
  windowOpen,
} from './scenario.js';
import { expandPhoneMap, expandPhoneSet, matchPhoneMap, matchPhoneSet } from './phone.js';

export { HELP_REPLY, helpReply };

function optional(env, key) {
  return env[key]?.trim() || '';
}

export function loadSpectrumConfig(env = process.env) {
  const projectId = optional(env, 'SPECTRUM_PROJECT_ID') || optional(env, 'PHOTON_PROJECT_ID');
  const projectSecret = optional(env, 'SPECTRUM_PROJECT_SECRET');
  if (!projectId) throw new Error('Set SPECTRUM_PROJECT_ID in photon-agent/.env.');
  if (!projectSecret) throw new Error('Set SPECTRUM_PROJECT_SECRET in photon-agent/.env.');
  const allowed = optional(env, 'PHOTON_ALLOWED_SENDERS');
  const allowedSenders = expandPhoneSet(allowed.split(',').map((value) => value.trim()).filter(Boolean));
  let actorBySender = new Map();
  const rawActors = optional(env, 'CARTNERS_ACTOR_BY_SENDER');
  if (rawActors) {
    const parsed = JSON.parse(rawActors);
    actorBySender = expandPhoneMap(Object.entries(parsed));
  }
  return {
    projectId,
    projectSecret,
    allowedSenders,
    actorBySender,
    cartnersApiUrl: optional(env, 'CARTNERS_API_URL') || 'http://127.0.0.1:8000',
    workspaceId: optional(env, 'CARTNERS_WORKSPACE_ID') || 'demo-family',
    sessionToken: optional(env, 'CARTNERS_SESSION_TOKEN'),
    householdKind: optional(env, 'CARTNERS_HOUSEHOLD_KIND'),
    imessageLine: optional(env, 'CARTNERS_IMESSAGE_LINE') || optional(env, 'PHOTON_AGENT_HANDLE') || '+14156055508',
    stateFile: optional(env, 'PHOTON_STATE_FILE') || '.runtime/state.json',
  };
}

export function senderId(message) {
  const candidates = [
    message.sender?.phoneNumber,
    message.sender?.phone,
    message.sender?.id,
    message.sentBy?.handle,
    message.sentBy?.id,
    message.author?.phoneNumber,
  ];
  return String(candidates.find(Boolean) || '').trim().toLowerCase();
}

export function inboundText(message) {
  if (message.content?.type === 'text') return String(message.content.text || '').trim();
  if (typeof message.content?.text === 'string') return message.content.text.trim();
  return '';
}

function today() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

function actorFor(config, sender) {
  return matchPhoneMap(config.actorBySender, sender);
}

export async function handleSpectrumMessage({ space, message, config, api, state, logger = console }) {
  if (message.direction === 'outbound') return false;
  const text = inboundText(message);
  if (!text) return false;
  const sender = senderId(message);
  if (sender && !matchPhoneSet(config.allowedSenders, sender) && !matchPhoneMap(config.actorBySender, sender)) {
    logger.info(`Ignored a message from an unregistered sender.`);
    return false;
  }
  const pending = state.pendingBySpace[space.id];
  const intent = classifyHousehold(text, { hasPendingDraft: Boolean(pending) });
  logger.info(`iMessage ${intent.type}: ${text.slice(0, 80)}`);
  const reply = async (body) => {
    if (typeof message.reply === 'function') await message.reply(body);
    else await space.send(body);
  };
  const actorId = actorFor(config, sender);

  if (intent.type === 'ignore') return false;
  if (intent.type === 'help' || !api) {
    if (state.pendingBySpace[space.id]) {
      delete state.pendingBySpace[space.id];
      await state.save();
    }
    await reply(helpReply(config.householdKind || (config.workspaceId.includes('roommate') ? 'roommates' : 'family'), config.imessageLine));
    return true;
  }
  if (!actorId) {
    await reply('This number isn’t on the household yet, so I won’t change the shared list. Ask someone in Cartners to add you.');
    return true;
  }

  try {
    if (intent.type === 'dismiss') {
      delete state.pendingBySpace[space.id];
      await state.save();
      await reply('No problem. I left the cart as it was.');
      return true;
    }
    if (intent.type === 'confirm') {
      if (!pending) {
        await reply('Nothing is waiting to add. Tell me a meal or grocery list first.');
        return true;
      }
      const result = await api.confirmDraft({
        workspaceId: config.workspaceId,
        actorId,
        requestId: pending.confirmRequestId,
        draftId: pending.draft.draftId,
        expectedListRevision: pending.draft.listRevision,
        target: pending.draft.kind === 'weekly_plan' ? 'plans' : 'cart',
      });
      delete state.pendingBySpace[space.id];
      await state.save();
      await reply(formatConfirmed(result, pending.draft));
      return true;
    }

    if (intent.type === 'list') {
      delete state.pendingBySpace[space.id];
      await state.save();
      const workspace = await api.getWorkspace(config.workspaceId);
      await reply(formatRunStatus(workspace));
      return true;
    }

    if (intent.type === 'start_run') {
      delete state.pendingBySpace[space.id];
      await state.save();
      let workspace = await api.getWorkspace(config.workspaceId);
      const existing = activeTrip(workspace);
      if (existing) {
        if (!windowOpen(existing) && existing.claimedBy === actorId) {
          workspace = (await api.patchTrip({
            workspaceId: config.workspaceId,
            actorId,
            requestId: makeRequestId(message.id || randomUUID(), 'trip-finish-stale'),
            expectedTripVersion: existing.version,
            action: 'finish',
          })).workspace;
        } else if (!windowOpen(existing)) {
          await reply(`${actorName(workspace, existing.claimedBy)}’s ${existing.storeName} run is still open, but it isn’t taking new texts. They should send “done shopping”, then you can start a new run.`);
          return true;
        } else {
          await reply(formatRunStatus(workspace));
          return true;
        }
      }
      try {
        const result = await api.patchTrip({
          workspaceId: config.workspaceId,
          actorId,
          requestId: makeRequestId(message.id || randomUUID(), 'trip-start'),
          expectedTripVersion: workspace.trip?.version ?? 0,
          action: 'start',
          storeName: intent.storeName,
          requestWindowMinutes: intent.requestWindowMinutes,
        });
        await reply(formatRunStarted(result.workspace, actorId));
      } catch (error) {
        if (error.code === 'TRIP_CLAIMED' && error.payload?.workspace) {
          await reply(formatRunStatus(error.payload.workspace));
          return true;
        }
        throw error;
      }
      return true;
    }

    if (intent.type === 'finish_run' || intent.type === 'cancel_run') {
      const workspace = await api.getWorkspace(config.workspaceId);
      const trip = activeTrip(workspace);
      if (!trip) {
        await reply('No one is on a store run. The list is still here when someone heads out.');
        return true;
      }
      if (trip.claimedBy !== actorId) {
        await reply(`Only ${actorName(workspace, trip.claimedBy)} can end this ${trip.storeName} run.`);
        return true;
      }
      const result = await api.patchTrip({
        workspaceId: config.workspaceId,
        actorId,
        requestId: makeRequestId(message.id || randomUUID(), intent.type),
        expectedTripVersion: trip.version,
        action: intent.type === 'cancel_run' ? 'release' : 'finish',
      });
      await reply(intent.type === 'cancel_run'
        ? 'Okay, I released the run. The list is still there for the next trip.'
        : `Run finished. Unbought items stay on the list for next time.\n\n${formatRunStatus(result.workspace)}`);
      return true;
    }

    if (intent.type === 'need_items') {
      delete state.pendingBySpace[space.id];
      await state.save();
      let workspace;
      const added = [];
      for (const [index, name] of intent.items.entries()) {
        const result = await api.addItem({
          workspaceId: config.workspaceId,
          actorId,
          requestId: makeRequestId(`${message.id || randomUUID()}:${index}`, 'item'),
          name,
        });
        workspace = result.workspace;
        added.push(name);
      }
      await reply(formatAdded(added, workspace));
      return true;
    }

    const refinement = /\b(make it|instead|without|quicker|swap|change it|more|less)\b/i.test(text);
    const suggestBody = {
      workspaceId: config.workspaceId,
      actorId,
      requestId: makeRequestId(message.id || randomUUID(), 'suggest'),
      message: text,
      planDate: today(),
      ...(refinement && pending?.draft?.draftId ? { previousDraftId: pending.draft.draftId } : {}),
    };
    let draft;
    try {
      draft = await api.suggest(suggestBody);
    } catch (error) {
      if (error.code === 'DRAFT_NOT_FOUND' && suggestBody.previousDraftId) {
        delete suggestBody.previousDraftId;
        draft = await api.suggest({ ...suggestBody, requestId: makeRequestId(message.id || randomUUID(), 'suggest-retry') });
      } else {
        throw error;
      }
    }
    state.pendingBySpace[space.id] = {
      draft,
      sourceMessageId: message.id,
      confirmRequestId: randomUUID(),
    };
    await state.save();
    await reply(formatDraft(draft));
    return true;
  } catch (error) {
    logger.error(error instanceof Error ? error.message : 'Cartners could not complete that request.');
    const detail = error instanceof Error ? error.message : '';
    if (error.status === 401 || error.code === 'HOUSEHOLD_ACCESS') {
      await reply('This iMessage line isn’t signed into that Cartners household. Set CARTNERS_SESSION_TOKEN and CARTNERS_WORKSPACE_ID in photon-agent/.env, then restart the agent.');
    } else if (error.code === 'DRAFT_NOT_FOUND') {
      delete state.pendingBySpace[space.id];
      await state.save();
      await reply('That meal idea expired. Ask again, or text “what’s on the list?” for the cart.');
    } else {
      await reply(detail && detail.length < 180
        ? `Cartners couldn’t do that (${detail}). The iMessage line is up — try “what’s on the list?” or open the website.`
        : 'I couldn’t reach the shared Cartners list. The iMessage line is up; try again in a moment, or open the website.');
    }
    return true;
  }
}

export async function runSpectrumAgent({ config = loadSpectrumConfig(), logger = console } = {}) {
  const api = createCartnersApi({ baseUrl: config.cartnersApiUrl, token: config.sessionToken });
  const state = await createStateStore(config.stateFile);
  const app = await Spectrum({
    projectId: config.projectId,
    projectSecret: config.projectSecret,
    providers: [imessage.config()],
  });
  logger.info('Cartners Spectrum agent is listening for iMessage.');
  for await (const [space, message] of app.messages) {
    try {
      await handleSpectrumMessage({ space, message, config, api, state, logger });
    } catch (error) {
      logger.error(error instanceof Error ? error.message : 'The agent could not process a message.');
    }
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runSpectrumAgent().catch((error) => {
    console.error(error instanceof Error ? error.message : 'Could not start Cartners Spectrum agent.');
    process.exitCode = 1;
  });
}
