import { expandPhoneMap, expandPhoneSet, matchPhoneMap } from './phone.js';

function required(env, key) {
  const value = env[key]?.trim();
  if (!value) throw new Error(`Set ${key} in photon-agent/.env.`);
  return value;
}

export function loadConfig(env = process.env) {
  const allowedSenders = expandPhoneSet(required(env, 'PHOTON_ALLOWED_SENDERS')
    .split(',').map((value) => value.trim()).filter(Boolean));
  let actorIds;
  try { actorIds = JSON.parse(required(env, 'CARTNERS_ACTOR_BY_SENDER')); } catch {
    throw new Error('CARTNERS_ACTOR_BY_SENDER must be a JSON object mapping each allowed sender to a Cartners actor ID.');
  }
  if (!actorIds || typeof actorIds !== 'object' || Array.isArray(actorIds)) {
    throw new Error('CARTNERS_ACTOR_BY_SENDER must be a JSON object.');
  }
  const actorBySender = expandPhoneMap(Object.entries(actorIds));
  for (const sender of required(env, 'PHOTON_ALLOWED_SENDERS').split(',').map((value) => value.trim()).filter(Boolean)) {
    if (!matchPhoneMap(actorBySender, sender)) throw new Error(`Add a Cartners actor ID for each allowed sender in CARTNERS_ACTOR_BY_SENDER.`);
  }
  return {
    projectId: required(env, 'PHOTON_PROJECT_ID'),
    apiKey: required(env, 'PHOTON_API_KEY'),
    agentHandle: required(env, 'PHOTON_AGENT_HANDLE').toLowerCase(),
    platform: env.PHOTON_PLATFORM?.trim() || 'imessage',
    allowedSenders,
    actorBySender,
    cartnersApiUrl: (env.CARTNERS_API_URL || 'http://127.0.0.1:8000').trim(),
    workspaceId: required(env, 'CARTNERS_WORKSPACE_ID'),
    stateFile: env.PHOTON_STATE_FILE?.trim() || '.runtime/state.json',
    pollMs: Number(env.PHOTON_POLL_MS || 2000),
  };
}
