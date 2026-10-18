import 'dotenv/config';
import { setTimeout as sleep } from 'node:timers/promises';
import { pathToFileURL } from 'node:url';
import { Photon, ApiError } from '@photon-ai/api';
import { handleMessage } from './agent.js';
import { loadConfig } from './config.js';
import { createCartnersApi } from './cartners-api.js';
import { createStateStore } from './state.js';

export async function runAgent({ config = loadConfig(), photon, api, state, logger = console } = {}) {
  const client = photon || new Photon({ headers: { Authorization: `Bearer ${config.apiKey}` } });
  const cartners = api || createCartnersApi({ baseUrl: config.cartnersApiUrl });
  const store = state || await createStateStore(config.stateFile);
  if (!store.pollSince) {
    store.pollSince = new Date(Date.now() - 15_000).toISOString();
    await store.save();
  }
  logger.info('Cartners Photon agent is listening for household messages.');

  while (true) {
    try {
      const since = new Date(Date.parse(store.pollSince) - 10_000).toISOString();
      let pageToken;
      do {
        const page = await client.projects.listMessages({
          path: { id: config.projectId },
          query: {
            createdSince: since,
            direction: 'received',
            order: 'asc',
            pageSize: 100,
            platform: config.platform,
            ...(pageToken ? { pageToken } : {}),
          },
        });
        for (const message of page.items) {
          if (store.hasProcessed(message.id)) continue;
          await handleMessage({ message, config, api: cartners, photon: client, state: store });
          await store.markProcessed(message.id, message.createdAt);
        }
        pageToken = page.nextPageToken;
      } while (pageToken);

      store.pollSince = new Date(Date.now() - 10_000).toISOString();
      await store.save();
    } catch (error) {
      if (error instanceof ApiError) logger.error(`Photon request failed (${error.status}, ${error.requestId || 'no request id'}).`);
      else logger.error(error instanceof Error ? error.message : 'The agent could not process a message.');
    }
    await sleep(config.pollMs);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runAgent().catch((error) => {
    console.error(error instanceof Error ? error.message : 'Could not start Cartners Photon agent.');
    process.exitCode = 1;
  });
}
