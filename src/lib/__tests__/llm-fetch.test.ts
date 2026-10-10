import { afterEach, describe, expect, it, vi } from "vitest";

import { REQUEST_TIMEOUT_HEADER, timeoutFetch } from "../llm-fetch";

afterEach(() => {
  vi.restoreAllMocks();
});

function hangUntilAborted(_input: unknown, init?: RequestInit) {
  return new Promise<Response>((_resolve, reject) => {
    init?.signal?.addEventListener("abort", () => reject(init.signal?.reason));
  });
}

/** A response whose body arrives later and, like real fetch, dies if the request is aborted. */
function slowBody(_input: unknown, init?: RequestInit) {
  const body = new ReadableStream<Uint8Array>({
    async start(controller) {
      init?.signal?.addEventListener("abort", () => controller.error(init.signal?.reason));
      await new Promise((resolve) => setTimeout(resolve, 60));
      if (init?.signal?.aborted) return;
      controller.enqueue(new TextEncoder().encode("late"));
      controller.close();
    },
  });
  return Promise.resolve(new Response(body));
}

describe("timeoutFetch", () => {
  it("aborts an attempt whose response headers arrive after the timeout", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(hangUntilAborted);

    const error = await timeoutFetch("https://llm.example.test", {
      headers: { [REQUEST_TIMEOUT_HEADER]: "20" },
    }).catch((caught: unknown) => caught);

    expect((error as Error).name).toBe("TimeoutError");
  });

  it("lets a response body keep streaming after its headers arrived in time", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(slowBody);

    const response = await timeoutFetch("https://llm.example.test", {
      headers: { [REQUEST_TIMEOUT_HEADER]: "20" },
    });

    expect(await response.text()).toBe("late");
  });

  it("strips the timeout header and forwards the other headers", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("ok"));

    await timeoutFetch("https://llm.example.test", {
      headers: { [REQUEST_TIMEOUT_HEADER]: "1000", authorization: "Bearer key" },
    });

    const sent = new Headers(fetchSpy.mock.calls[0][1]?.headers);
    expect([sent.get(REQUEST_TIMEOUT_HEADER), sent.get("authorization")]).toEqual([null, "Bearer key"]);
  });

  it("still honors the caller's abort signal", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(hangUntilAborted);
    const caller = new AbortController();

    const pending = timeoutFetch("https://llm.example.test", {
      headers: { [REQUEST_TIMEOUT_HEADER]: "5000" },
      signal: caller.signal,
    }).catch((caught: unknown) => caught);
    caller.abort(new DOMException("stopped", "AbortError"));

    expect(((await pending) as Error).name).toBe("AbortError");
  });
});
