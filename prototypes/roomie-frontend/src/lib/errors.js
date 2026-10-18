// An error from an API request.
// - retryable: safe to resend the same request with the same idempotency key.
// - offline: no response arrived at all (network down or server unreachable).
// - data: the response body, e.g. the current item or run on a 409 conflict.
export class ApiError extends Error {
  constructor(message, { status = null, retryable = false, offline = false, data = null } = {}) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.retryable = retryable;
    this.offline = offline;
    this.data = data;
  }
}
