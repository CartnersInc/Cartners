import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

export async function createStateStore(path) {
  let state = { pollSince: null, processedIds: [], pendingBySpace: {} };
  try {
    state = { ...state, ...JSON.parse(await readFile(path, 'utf8')) };
  } catch (error) {
    if (error.code !== 'ENOENT') throw new Error(`Could not read Photon state file: ${error.message}`);
  }
  const processed = new Set(state.processedIds);
  return {
    get pendingBySpace() { return state.pendingBySpace; },
    hasProcessed(id) { return processed.has(id); },
    async markProcessed(id, messageDate) {
      processed.add(id);
      state.processedIds = [...processed].slice(-1000);
      if (messageDate && (!state.pollSince || messageDate > state.pollSince)) state.pollSince = messageDate;
      await this.save();
    },
    get pollSince() { return state.pollSince; },
    set pollSince(value) { state.pollSince = value; },
    async save() {
      await mkdir(dirname(path), { recursive: true });
      const temporary = `${path}.tmp`;
      await writeFile(temporary, JSON.stringify({ ...state, processedIds: [...processed].slice(-1000) }, null, 2), { mode: 0o600 });
      await rename(temporary, path);
    },
  };
}
