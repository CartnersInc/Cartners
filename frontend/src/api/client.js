export class ApiError extends Error {
  constructor(message, { status = 0, code = 'UNAVAILABLE', payload = null } = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.payload = payload;
  }
}

function failureMessage(payload, status) {
  if (payload?.error?.message) return payload.error.message;
  if (status === 404) return 'The hosted API is behind this app, so that save is missing. Payment handles can stay on this device until Render is redeployed.';
  if (typeof payload?.detail === 'string' && payload.detail) return payload.detail;
  return 'The request failed. Please try again.';
}

export function createApi({ baseUrl = '', fetchImpl = globalThis.fetch, getToken = () => null } = {}) {
  return {
    async request(path, { method = 'GET', body, formData, signal, timeoutMs = 40000 } = {}) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), timeoutMs);
      const abort = () => controller.abort();
      if (signal?.aborted) controller.abort();
      signal?.addEventListener('abort', abort, { once: true });
      try {
        const response = await fetchImpl(`${baseUrl.replace(/\/$/, '')}${path}`, {
          method, signal: controller.signal,
          headers: { Accept: 'application/json', ...(getToken() ? { Authorization: `Bearer ${getToken()}` } : {}), ...(formData || body === undefined ? {} : { 'Content-Type': 'application/json' }) },
          ...(formData ? { body: formData } : body === undefined ? {} : { body: JSON.stringify(body) }),
        });
        let payload;
        try { payload = await response.json(); } catch {
          throw new ApiError('Cartners reached a webpage instead of its backend. AI and shared updates need the backend to be deployed and connected.', { status: response.status, code: 'INVALID_RESPONSE' });
        }
        if (!response.ok) {
          throw new ApiError(failureMessage(payload, response.status), {
            status: response.status, code: payload.error?.code || (response.status === 404 ? 'NOT_FOUND' : 'REQUEST_FAILED'), payload,
          });
        }
        return payload;
      } catch (error) {
        if (error instanceof ApiError) throw error;
        if (signal?.aborted) throw error;
        throw new ApiError(controller.signal.aborted
          ? 'The request took too long. Your input is still here; try again.'
          : 'Cannot reach the backend. Check the connection and try again.');
      } finally {
        clearTimeout(timeout);
        signal?.removeEventListener('abort', abort);
      }
    },
  };
}

const stringArray = value => Array.isArray(value) && value.every(item => typeof item === 'string');
export function isWorkspace(value, expectedId) {
  return value?.schemaVersion === 2 && value.workspaceId === expectedId
    && Array.isArray(value.actors) && value.actors.length > 0 && value.actors.every(actor => typeof actor.id === 'string' && typeof actor.name === 'string')
    && Array.isArray(value.groups) && value.groups.every(group => typeof group.workspaceId === 'string' && typeof group.name === 'string')
    && Array.isArray(value.items) && Array.isArray(value.plans) && Number.isInteger(value.listRevision)
    && Number.isInteger(value.preferences?.servings) && stringArray(value.preferences.restrictions);
}
export function isDraft(value, workspaceId) {
  if (!value || !value.draftId || value.workspaceId !== workspaceId || !['sample', 'live_ai'].includes(value.sourceMode)) return false;
  if (value.kind === 'clarification') return typeof value.question === 'string';
  if (!Number.isInteger(value.listRevision)) return false;
  if (value.kind === 'weekly_plan') {
    const days = value.days;
    return Array.isArray(days) && days.length === 7 && days.every(day =>
      typeof day.planDate === 'string'
      && typeof day.recommendation?.title === 'string'
      && Number.isInteger(day.recommendation.servings)
      && Array.isArray(day.recommendation.ingredients)
      && day.recommendation.ingredients.every(item => typeof item.id === 'string' && typeof item.name === 'string' && typeof item.unit === 'string' && Number.isFinite(item.quantity) && item.quantity > 0)
    );
  }
  const items = value.kind === 'recommendation' ? value.recommendation?.ingredients : value.kind === 'grocery_list' ? value.items : null;
  const preview = value.kind === 'recommendation' ? value.recommendation?.listPreview : value.listPreview;
  if (!Array.isArray(items) || items.length > 30 || !items.every(item => typeof item.id === 'string' && typeof item.name === 'string' && typeof item.unit === 'string' && Number.isFinite(item.quantity) && item.quantity > 0) || !Array.isArray(preview)) return false;
  if (value.kind === 'recommendation') return typeof value.recommendation.title === 'string' && Number.isInteger(value.recommendation.servings) && stringArray(value.recommendation.steps);
  return true;
}
