export function createCartnersApi({ baseUrl, token = '', fetchImpl = globalThis.fetch }) {
  const root = baseUrl.replace(/\/$/, '');
  async function request(method, path, body) {
    const response = await fetchImpl(`${root}${path}`, {
      method,
      headers: {
        Accept: 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
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
      error.payload = payload;
      throw error;
    }
    return payload;
  }
  return {
    getWorkspace: (workspaceId) => request('GET', `/api/workspace?workspaceId=${encodeURIComponent(workspaceId)}`),
    suggest: (body) => request('POST', '/api/suggestions', body),
    confirmDraft: (body) => request('POST', '/api/drafts/confirm', body),
    addItem: (body) => request('POST', '/api/items', body),
    patchTrip: (body) => request('PATCH', '/api/trip', body),
  };
}
