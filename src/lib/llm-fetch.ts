/**
 * Per-attempt request timeout for AI provider calls.
 *
 * The SDKs this layer replaced limited how long each attempt waited for the
 * response to start: once headers arrived, a stream could run for as long as
 * it kept sending, and retries got a fresh budget. AI SDK's own `timeout`
 * caps the whole call instead, retries and streaming included. So the adapter
 * sends its timeout in REQUEST_TIMEOUT_HEADER, and every provider uses
 * `timeoutFetch`, which applies it per attempt and strips the header.
 */

export const REQUEST_TIMEOUT_HEADER = "x-spool-timeout-ms";

export const timeoutFetch: typeof fetch = async (input, init) => {
  const headers = new Headers(init?.headers);
  const timeoutMs = Number(headers.get(REQUEST_TIMEOUT_HEADER));
  headers.delete(REQUEST_TIMEOUT_HEADER);

  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    return globalThis.fetch(input, { ...init, headers });
  }

  const controller = new AbortController();
  const timer = setTimeout(
    () =>
      controller.abort(
        new DOMException(`Request timed out after ${timeoutMs}ms`, "TimeoutError"),
      ),
    timeoutMs,
  );
  const signal = init?.signal
    ? AbortSignal.any([init.signal, controller.signal])
    : controller.signal;

  try {
    return await globalThis.fetch(input, { ...init, headers, signal });
  } finally {
    clearTimeout(timer);
  }
};
