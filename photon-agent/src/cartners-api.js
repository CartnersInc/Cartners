export function createCartnersApi({ baseUrl, fetchImpl = globalThis.fetch }) {
  const root = baseUrl.replace(/\/$/, '');
  async function post(path, body) {
    const response = await fetchImpl(`${root}${path}`, {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(25_000),
    });
    let payload;
    try { payload = await response.json(); } catch {
      const error = new Error('Cartners backend returned a non-JSON response.');
      error.status = response.status;
      throw error;
    }
    if (!response.ok) {
      const error = new Error(payload.error?.message || 'Cartners could not complete that request.');
      error.status = response.status;
      error.code = payload.error?.code;
      throw error;
    }
    return payload;
  }
  return {
    suggest: (body) => post('/api/suggestions', body),
    confirmDraft: (body) => post('/api/drafts/confirm', body),
  };
}
