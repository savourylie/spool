import { readFile } from "node:fs/promises";

import { describe, expect, it, vi } from "vitest";

import {
  PROVIDER_CONTRACTS,
  classifyPublicError,
  createSafeEvidenceRecord,
  createSafeReporter,
  main,
  parseArgs,
  parseSSEText,
  presentAuthorizationSafely,
  runContractProbe,
} from "./subscription-ai-contract-probe.mjs";

const TEST_PROMPT = "Reply with the single word ready.";

function jwt(claims) {
  const header = Buffer.from(JSON.stringify({ alg: "none", typ: "JWT" })).toString(
    "base64url",
  );
  const payload = Buffer.from(JSON.stringify(claims)).toString("base64url");
  return `${header}.${payload}.test-signature`;
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function sse(events, status = 200) {
  return new Response(
    events.map((event) => `data: ${JSON.stringify(event)}\n\n`).join(""),
    {
      status,
      headers: { "content-type": "text/event-stream" },
    },
  );
}

function output({ text = "ready", tool } = {}) {
  return {
    output: [
      ...(tool ? [{ type: `${tool}_call`, status: "completed" }] : []),
      {
        type: "message",
        content: [{ type: "output_text", text }],
      },
    ],
  };
}

function requestJson(body) {
  const text = body instanceof Uint8Array ? new TextDecoder().decode(body) : body;
  return JSON.parse(text);
}

function makeReporter() {
  const lines = [];
  return {
    lines,
    report: createSafeReporter((line) => lines.push(line)),
    records() {
      return lines.map((line) => JSON.parse(line));
    },
  };
}

describe("provider contracts", () => {
  it("pins the exact researched endpoints, public clients, models, and tools", () => {
    expect(PROVIDER_CONTRACTS.chatgpt).toMatchObject({
      issuer: "https://auth.openai.com",
      clientId: "app_EMoamEEZ73f0CkXaXp7hrann",
      deviceCodeEndpoint:
        "https://auth.openai.com/api/accounts/deviceauth/usercode",
      deviceTokenEndpoint:
        "https://auth.openai.com/api/accounts/deviceauth/token",
      tokenEndpoint: "https://auth.openai.com/oauth/token",
      inferenceEndpoint: "https://chatgpt.com/backend-api/codex/responses",
      model: "gpt-5.5",
      nativeSearchTool: "web_search",
    });

    expect(PROVIDER_CONTRACTS.xai).toMatchObject({
      issuer: "https://auth.x.ai",
      clientId: "b1a00492-073a-47ea-816f-4c329264a828",
      deviceCodeEndpoint: "https://auth.x.ai/oauth2/device/code",
      tokenEndpoint: "https://auth.x.ai/oauth2/token",
      inferenceEndpoint: "https://api.x.ai/v1/responses",
      model: "grok-4.5",
      nativeSearchTool: "x_search",
      scopes:
        "openid profile email offline_access grok-cli:access api:access",
    });
  });
});

describe("parseArgs", () => {
  it("accepts exactly one supported provider", () => {
    expect(parseArgs(["--provider", "chatgpt"])).toEqual({
      provider: "chatgpt",
    });
    expect(parseArgs(["--provider=xai"])).toEqual({ provider: "xai" });
    expect(
      parseArgs(["--provider", "xai", "--expect-error", "quota"]),
    ).toEqual({ provider: "xai", expectedError: "quota" });
    expect(
      parseArgs([
        "--provider",
        "chatgpt",
        "--evidence-file",
        "/tmp/chatgpt-evidence.json",
      ]),
    ).toEqual({
      provider: "chatgpt",
      evidenceFile: "/tmp/chatgpt-evidence.json",
    });
    expect(
      parseArgs(["--provider", "chatgpt", "--revoke-check"]),
    ).toEqual({ provider: "chatgpt", revokeCheck: true });
    expect(
      parseArgs(["--provider", "chatgpt", "--check-headers"]),
    ).toEqual({ provider: "chatgpt", headerCheck: true });
  });

  it("rejects missing, unknown, or extra arguments", () => {
    expect(() => parseArgs([])).toThrow("--provider");
    expect(() => parseArgs(["--provider", "openai"])).toThrow(
      "chatgpt or xai",
    );
    expect(() => parseArgs(["--provider", "xai", "--dump-token"])).toThrow(
      "Unknown argument",
    );
    expect(() =>
      parseArgs(["--provider", "xai", "--expect-error", "upstream"]),
    ).toThrow("quota or entitlement");
    expect(() =>
      parseArgs([
        "--provider",
        "xai",
        "--expect-error",
        "quota",
        "--revoke-check",
      ]),
    ).toThrow("cannot be combined");
    expect(() =>
      parseArgs(["--provider", "xai", "--evidence-file"]),
    ).toThrow("evidence");
    expect(() =>
      parseArgs([
        "--provider",
        "xai",
        "--expect-error",
        "quota",
        "--check-headers",
      ]),
    ).toThrow("cannot be combined");
  });
});

describe("safe reporting", () => {
  it("emits only the four public fields and drops arbitrary raw details", () => {
    const secret = "test-access-token-never-log";
    const reporter = makeReporter();

    reporter.report({
      operation: "chatgpt.generation",
      status: "fail",
      latencyMs: 12.9,
      errorCategory: "quota",
      rawBody: { access_token: secret },
      prompt: TEST_PROMPT,
      generatedContent: secret,
    });

    expect(reporter.records()).toEqual([
      {
        operation: "chatgpt.generation",
        status: "fail",
        latency_ms: 12,
        error_category: "quota",
      },
    ]);
    expect(reporter.lines.join("\n")).not.toContain(secret);
    expect(reporter.lines.join("\n")).not.toContain(TEST_PROMPT);
  });

  it("replaces unrecognized operation/status/category strings", () => {
    const reporter = makeReporter();
    reporter.report({
      operation: "Bearer test-access-token",
      status: "test-refresh-token",
      latencyMs: Number.NaN,
      errorCategory: "authorization: test-id-token",
    });

    expect(reporter.records()).toEqual([
      {
        operation: "unknown",
        status: "fail",
        latency_ms: 0,
        error_category: "upstream",
      },
    ]);
  });

  it("retains an allowlisted expected category on a passing error probe", () => {
    const reporter = makeReporter();
    reporter.report({
      operation: "xai.expected_quota_error",
      status: "pass",
      latencyMs: 4,
      errorCategory: "quota",
    });

    expect(reporter.records()[0]).toEqual({
      operation: "xai.expected_quota_error",
      status: "pass",
      latency_ms: 4,
      error_category: "quota",
    });
  });
});

describe("device authorization presentation", () => {
  it("opens only the static URI and sends the human code to a transient dialog over stdin", async () => {
    const run = vi.fn(async () => {});
    const userCode = "TEST-CODE";
    const completeUri =
      "https://accounts.x.ai/device?user_code=TEST-CODE";

    await presentAuthorizationSafely({
      verificationUri: "https://accounts.x.ai/device",
      verificationUriComplete: completeUri,
      userCode,
      platform: "darwin",
      run,
    });

    expect(run).toHaveBeenCalledTimes(2);
    expect(run.mock.calls[0]).toEqual([
      "open",
      ["https://accounts.x.ai/device"],
    ]);
    expect(run.mock.calls[1][0]).toBe("osascript");
    expect(run.mock.calls[1][1]).toEqual(["-"]);
    expect(run.mock.calls[1][2]).toContain(userCode);
    expect(JSON.stringify(run.mock.calls.map(([, args]) => args))).not.toContain(
      userCode,
    );
    expect(JSON.stringify(run.mock.calls.map(([, args]) => args))).not.toContain(
      completeUri,
    );
  });
});

describe("sanitized evidence capture", () => {
  it("allowlists non-secret observations and drops every upstream-controlled value", () => {
    const secret = "test-token-must-never-reach-evidence";
    const record = createSafeEvidenceRecord({
      provider: "chatgpt",
      observedAt: "2026-07-13T10:00:00.000Z",
      result: {
        ok: true,
        observations: {
          accountIdentifierClaim: "chatgpt_account_id",
          observedIssuer: "https://auth.openai.com",
          issuerMatchesContract: true,
          deviceIntervalSeconds: 5,
          deviceExpiresInSeconds: 300,
          pollingOutcomesObserved: [
            "authorization_pending",
            `unsafe-${secret}`,
          ],
          accessTokenLifetimeSeconds: 3600.9,
          grantedScopes: `openid profile evil:${secret} offline_access`,
          refreshTokenRotated: true,
          accessTokenReplaced: true,
          requiredHeaders: ["Authorization", `X-Secret-${secret}`],
          optionalHeaders: ["originator", `X-Secret-${secret}`],
          requiredHeaderValues: [`X-Secret-${secret}`],
          optionalHeaderValues: [
            "Accept",
            "User-Agent",
            `X-Secret-${secret}`,
          ],
          expectedErrorObserved: "quota",
          revocationVerified: true,
          accessToken: secret,
          rawProviderPayload: { content: secret },
        },
      },
    });

    expect(record).toMatchObject({
      schema_version: 1,
      provider: "chatgpt",
      observed_at: "2026-07-13T10:00:00.000Z",
      contract: {
        issuer: "https://auth.openai.com",
        model: "gpt-5.5",
        native_search_tool: "web_search",
      },
      observations: {
        run_ok: true,
        account_identifier_claim: "chatgpt_account_id",
        observed_issuer: "https://auth.openai.com",
        issuer_matches_contract: true,
        device_interval_seconds: 5,
        device_expires_in_seconds: 300,
        polling_outcomes_observed: ["authorization_pending"],
        access_token_lifetime_seconds: 3600,
        granted_scopes: ["openid", "profile", "offline_access"],
        refresh_token_rotated: true,
        access_token_replaced: true,
        required_headers: ["Authorization"],
        optional_headers: ["originator"],
        required_header_values: [],
        optional_header_values: ["Accept", "User-Agent"],
        expected_error_observed: "quota",
        revocation_verified: true,
      },
    });
    expect(JSON.stringify(record)).not.toContain(secret);
    expect(JSON.stringify(record)).not.toContain(TEST_PROMPT);
  });

  it("writes the safe record through an exclusive evidence-writer seam", async () => {
    const result = {
      ok: true,
      observations: {
        accountIdentifierClaim: "sub",
        accessTokenLifetimeSeconds: 1800,
        grantedScopes: "openid api:access",
        refreshTokenRotated: true,
      },
    };
    const runProbe = vi.fn(async () => result);
    const writeEvidence = vi.fn(async () => {});
    const reporter = makeReporter();

    const exitCode = await main(
      ["--provider", "xai", "--evidence-file", "/tmp/xai-evidence.json"],
      {
        runProbe,
        writeEvidence,
        report: reporter.report,
        now: () => 100,
        observedAt: "2026-07-13T11:00:00.000Z",
      },
    );

    expect(exitCode).toBe(0);
    expect(runProbe).toHaveBeenCalledOnce();
    expect(runProbe.mock.calls[0][0]).not.toHaveProperty("evidenceFile");
    expect(writeEvidence).toHaveBeenCalledWith(
      "/tmp/xai-evidence.json",
      expect.objectContaining({
        provider: "xai",
        observed_at: "2026-07-13T11:00:00.000Z",
      }),
    );
    expect(reporter.records().at(-1)).toMatchObject({
      operation: "xai.evidence_record",
      status: "pass",
      error_category: null,
    });
  });
});

describe("public error classification", () => {
  it.each([
    [{ status: 401, code: "invalid_client" }, "entitlement"],
    [{ status: 401, code: "unauthorized_client" }, "entitlement"],
    [{ status: 401 }, "reauth_required"],
    [{ status: 403, code: "model_not_found" }, "entitlement"],
    [{ status: 404, code: "model_not_found" }, "entitlement"],
    [{ status: 429, code: "insufficient_quota" }, "quota"],
    [{ status: 429, code: "rate_limit_exceeded" }, "rate_limit"],
    [{ status: 503 }, "upstream"],
    [{ name: "AbortError" }, "timeout"],
    [{ name: "TimeoutError" }, "timeout"],
    [{ name: "SyntaxError" }, "invalid_response"],
  ])("maps %o to %s", (input, expected) => {
    expect(classifyPublicError(input)).toBe(expected);
  });
});

describe("SSE parsing", () => {
  it("collects output deltas and requires a terminal event", () => {
    const body = [
      'data: {"type":"response.output_text.delta","delta":"rea"}',
      "",
      'data: {"type":"response.output_text.delta","delta":"dy"}',
      "",
      'data: {"type":"response.completed","response":{"id":"safe"}}',
      "",
    ].join("\n");

    expect(parseSSEText(body)).toEqual({ sawDelta: true, completed: true });
  });

  it("rejects malformed frames and unterminated streams", () => {
    expect(() => parseSSEText("data: not-json\n\n")).toThrow(
      "invalid SSE",
    );
    expect(() =>
      parseSSEText(
        'data: {"type":"response.output_text.delta","delta":"partial"}\n\n',
      ),
    ).toThrow("terminal");
  });

  it.each([
    [
      { type: "error", code: "model_not_found", message: "not exposed" },
      "entitlement",
    ],
    [
      {
        type: "response.failed",
        response: {
          error: { code: "insufficient_quota", message: "not exposed" },
        },
      },
      "quota",
    ],
  ])("classifies the official %s SSE error shape", (event, expected) => {
    let caught;
    try {
      parseSSEText(`data: ${JSON.stringify(event)}\n\n`);
    } catch (error) {
      caught = error;
    }

    expect(classifyPublicError(caught)).toBe(expected);
  });
});

describe("runContractProbe", () => {
  it("checks the ChatGPT device flow, generation, SSE, refresh, and web_search without leaking secrets", async () => {
    const accountId = "test-chatgpt-account-id";
    const accessToken = jwt({
      iss: "https://auth.openai.com",
      chatgpt_account_id: accountId,
    });
    const refreshToken = "test-chatgpt-refresh-token";
    const deviceAuthId = "test-chatgpt-device-auth-id";
    const userCode = "TEST-CODE";
    const calls = [];
    let pollCount = 0;

    const fetchImpl = vi.fn(async (url, init = {}) => {
      calls.push({
        url: String(url),
        init,
        wireHeaders: new Request(String(url), init).headers,
      });

      if (String(url).endsWith("/deviceauth/usercode")) {
        return json({
          device_auth_id: deviceAuthId,
          user_code: userCode,
          interval: "1",
          expires_in: 300,
        });
      }
      if (String(url).endsWith("/deviceauth/token")) {
        pollCount += 1;
        if (pollCount === 1) {
          return new Response("still pending", {
            status: 403,
            headers: { "content-type": "text/plain" },
          });
        }
        return json({
          authorization_code: "test-authorization-code",
          code_verifier: "test-code-verifier",
        });
      }
      if (String(url).endsWith("/oauth/token")) {
        const form = new URLSearchParams(init.body);
        if (form.get("grant_type") === "refresh_token") {
          return json({
            access_token: "test-chatgpt-refreshed-access-token",
            refresh_token: "test-chatgpt-rotated-refresh-token",
            id_token: jwt({ chatgpt_account_id: accountId }),
            expires_in: 3600,
          });
        }
        return json({
          access_token: accessToken,
          refresh_token: refreshToken,
          id_token: jwt({
            iss: "https://auth.openai.com",
            email: "beta@example.invalid",
          }),
          expires_in: 3600,
          scope: "openid profile email offline_access",
        });
      }
      if (String(url).endsWith("/codex/responses")) {
        const headers = new Headers(init.headers);
        if (!headers.has("Authorization")) {
          return json({ error: { code: "missing_authorization" } }, 401);
        }
        if (!headers.has("Content-Type")) {
          return json({ error: { code: "missing_content_type" } }, 400);
        }
        if (!headers.has("ChatGPT-Account-Id")) {
          return json({ error: { code: "missing_account_header" } }, 403);
        }
        const body = requestJson(init.body);
        if (body.stream) {
          return sse([
            { type: "response.output_text.delta", delta: "ready" },
            { type: "response.completed", response: { id: "safe" } },
          ]);
        }
        return json(
          output({
            text: body.tools ? "search-ready" : "ready",
            tool: body.tools?.[0]?.type,
          }),
        );
      }
      throw new Error(`Unexpected URL: ${url}`);
    });

    const reporter = makeReporter();
    const presentAuthorization = vi.fn(async () => {});
    const sleep = vi.fn(async () => {});
    const result = await runContractProbe({
      provider: "chatgpt",
      headerCheck: true,
      fetchImpl,
      report: reporter.report,
      presentAuthorization,
      sleep,
      prompt: TEST_PROMPT,
    });

    expect(result.ok).toBe(true);
    expect(result.observations).toMatchObject({
      model: "gpt-5.5",
      observedIssuer: "https://auth.openai.com",
      issuerMatchesContract: true,
      deviceIntervalSeconds: 1,
      deviceExpiresInSeconds: 300,
      pollingOutcomesObserved: ["authorization_pending"],
      accountIdentifierClaim: "chatgpt_account_id",
      accessTokenLifetimeSeconds: 3600,
      refreshTokenRotated: true,
      accessTokenReplaced: true,
      nativeSearchTool: "web_search",
      requiredHeaders: [
        "Authorization",
        "Content-Type",
        "ChatGPT-Account-Id",
      ],
      optionalHeaders: ["originator", "session-id"],
      requiredHeaderValues: [],
      optionalHeaderValues: ["Accept", "User-Agent"],
    });
    expect(presentAuthorization).toHaveBeenCalledWith({
      provider: "chatgpt",
      verificationUri: "https://auth.openai.com/codex/device",
      userCode,
    });
    expect(sleep).toHaveBeenCalledTimes(1);
    expect(sleep).toHaveBeenCalledWith(4000);

    const responseCalls = calls.filter(({ url }) =>
      url.endsWith("/codex/responses"),
    );
    expect(responseCalls).toHaveLength(11);
    for (const { init } of responseCalls) {
      const body = requestJson(init.body);
      expect(body.model).toBe("gpt-5.5");
      expect(body.max_output_tokens).toBe(512);
      expect(body.reasoning).toEqual({ effort: "low" });
      expect(body.store).toBe(false);
    }
    const baselineHeaders = new Headers(responseCalls[0].init.headers);
    expect(baselineHeaders.get("authorization")).toBe(`Bearer ${accessToken}`);
    expect(baselineHeaders.get("User-Agent")).toBe("spool-contract-probe/0.1");
    expect(baselineHeaders.get("ChatGPT-Account-Id")).toBe(accountId);
    expect(baselineHeaders.get("originator")).toBe("spool-contract-probe");
    expect(baselineHeaders.get("session-id")).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
    const omittedHeaderCalls = responseCalls.slice(1, 8);
    expect(
      omittedHeaderCalls.map(({ init }) => {
        const headers = new Headers(init.headers);
        const omitted = [
          "Authorization",
          "Content-Type",
          "ChatGPT-Account-Id",
          "originator",
          "session-id",
        ].find((header) => !headers.has(header));
        if (omitted) return `omitted:${omitted}`;
        if (headers.get("Accept") === "*/*") return "substituted:Accept";
        if (
          headers.get("User-Agent") ===
          "spool-contract-probe-control/0.1"
        ) {
          return "substituted:User-Agent";
        }
        return "no-control";
      }),
    ).toEqual([
      "omitted:Authorization",
      "omitted:Content-Type",
      "substituted:Accept",
      "substituted:User-Agent",
      "omitted:ChatGPT-Account-Id",
      "omitted:originator",
      "omitted:session-id",
    ]);
    expect(omittedHeaderCalls[1].wireHeaders.has("Content-Type")).toBe(
      false,
    );
    const refreshedCalls = responseCalls.filter(
      ({ init }) =>
        new Headers(init.headers).get("authorization") ===
        "Bearer test-chatgpt-refreshed-access-token",
    );
    expect(refreshedCalls).toHaveLength(2);
    const searchCall = responseCalls.find(
      ({ init }) => requestJson(init.body).tools !== undefined,
    );
    const searchBody = requestJson(searchCall.init.body);
    expect(searchBody.tools).toEqual([{ type: "web_search" }]);
    expect(searchBody.tool_choice).toBe("required");
    expect(searchBody.input[0].content[0].text).toContain("search tool");
    expect(searchBody.input[0].content[0].text).not.toBe(TEST_PROMPT);
    expect(
      new Headers(calls[0].init.headers).get("User-Agent"),
    ).toBe("spool-contract-probe/0.1");

    expect(reporter.records()).toEqual([
      expect.objectContaining({
        operation: "chatgpt.device_flow",
        status: "pass",
      }),
      expect.objectContaining({
        operation: "chatgpt.generation",
        status: "pass",
      }),
      expect.objectContaining({
        operation: "chatgpt.header_contract",
        status: "pass",
      }),
      expect.objectContaining({
        operation: "chatgpt.streaming",
        status: "pass",
      }),
      expect.objectContaining({
        operation: "chatgpt.refresh",
        status: "pass",
      }),
      expect.objectContaining({
        operation: "chatgpt.native_search",
        status: "pass",
      }),
    ]);

    const publicOutput = reporter.lines.join("\n");
    for (const forbidden of [
      accessToken,
      refreshToken,
      accountId,
      deviceAuthId,
      userCode,
      TEST_PROMPT,
      "ready",
    ]) {
      expect(publicOutput).not.toContain(forbidden);
    }
  });

  it("checks xAI RFC 8628 polling, rotating refresh, grok-4.5, and x_search", async () => {
    const accessToken = "test-xai-access-token";
    const refreshToken = "test-xai-refresh-token";
    const accountId = "test-xai-account-id";
    const calls = [];
    let pollCount = 0;

    const fetchImpl = vi.fn(async (url, init = {}) => {
      calls.push({ url: String(url), init });

      if (String(url).endsWith("/device/code")) {
        return json({
          device_code: "test-xai-device-code",
          user_code: "XAI-CODE",
          verification_uri: "https://accounts.x.ai/device",
          verification_uri_complete: "https://accounts.x.ai/device?code=safe",
          expires_in: 300,
          interval: 1,
        });
      }
      if (String(url).endsWith("/oauth2/token")) {
        const form = new URLSearchParams(init.body);
        if (
          form.get("grant_type") ===
          "urn:ietf:params:oauth:grant-type:device_code"
        ) {
          pollCount += 1;
          if (pollCount === 1) {
            return json({ error: "slow_down" }, 400);
          }
          return json({
            access_token: accessToken,
            refresh_token: refreshToken,
            id_token: jwt({ iss: "https://auth.x.ai", sub: accountId }),
            expires_in: 1800,
            scope:
              "openid profile email offline_access grok-cli:access api:access",
          });
        }
        return json({
          access_token: "test-xai-refreshed-access-token",
          refresh_token: "test-xai-rotated-refresh-token",
          id_token: jwt({ sub: accountId }),
          expires_in: 1800,
        });
      }
      if (String(url).endsWith("/v1/responses")) {
        const body = requestJson(init.body);
        if (body.stream) {
          return sse([
            { type: "response.output_text.delta", delta: "ready" },
            { type: "response.completed", response: { id: "safe" } },
          ]);
        }
        return json(
          output({
            text: body.tools ? "search-ready" : "ready",
            tool: body.tools?.[0]?.type,
          }),
        );
      }
      throw new Error(`Unexpected URL: ${url}`);
    });

    const reporter = makeReporter();
    const sleep = vi.fn(async () => {});
    const result = await runContractProbe({
      provider: "xai",
      fetchImpl,
      report: reporter.report,
      presentAuthorization: vi.fn(async () => {}),
      sleep,
      prompt: TEST_PROMPT,
    });

    expect(result.ok).toBe(true);
    expect(result.observations).toMatchObject({
      model: "grok-4.5",
      observedIssuer: "https://auth.x.ai",
      issuerMatchesContract: true,
      deviceIntervalSeconds: 1,
      deviceExpiresInSeconds: 300,
      pollingOutcomesObserved: ["slow_down"],
      accountIdentifierClaim: "sub",
      accessTokenLifetimeSeconds: 1800,
      refreshTokenRotated: true,
      accessTokenReplaced: true,
      nativeSearchTool: "x_search",
    });
    expect(sleep).toHaveBeenCalledTimes(1);
    expect(sleep).toHaveBeenCalledWith(9000);

    const responseCalls = calls.filter(({ url }) =>
      url.endsWith("/v1/responses"),
    );
    expect(responseCalls).toHaveLength(4);
    for (const { init } of responseCalls) {
      const body = requestJson(init.body);
      expect(body.model).toBe("grok-4.5");
      expect(body.max_output_tokens).toBe(512);
      expect(body.reasoning).toEqual({ effort: "low" });
      expect(new Headers(init.headers).get("User-Agent")).toBe(
        "spool-contract-probe/0.1",
      );
    }
    expect(new Headers(responseCalls[0].init.headers).get("authorization")).toBe(
      `Bearer ${accessToken}`,
    );
    expect(new Headers(responseCalls[1].init.headers).get("authorization")).toBe(
      `Bearer ${accessToken}`,
    );
    expect(new Headers(responseCalls[2].init.headers).get("authorization")).toBe(
      "Bearer test-xai-refreshed-access-token",
    );
    expect(new Headers(responseCalls[3].init.headers).get("authorization")).toBe(
      "Bearer test-xai-refreshed-access-token",
    );
    const searchBody = requestJson(responseCalls[3].init.body);
    expect(searchBody.tools).toEqual([{ type: "x_search" }]);
    expect(searchBody.tool_choice).toBe("required");
    expect(searchBody.input[0].content[0].text).toContain("search tool");
    expect(searchBody.input[0].content[0].text).not.toBe(TEST_PROMPT);
    expect(reporter.records().map(({ status }) => status)).toEqual([
      "pass",
      "pass",
      "pass",
      "pass",
      "pass",
    ]);
  });

  it("fails closed when the curated model is unavailable and never tries another endpoint or model", async () => {
    const accountId = "test-chatgpt-account-id";
    const seenBodies = [];
    const fetchImpl = vi.fn(async (url, init = {}) => {
      if (String(url).endsWith("/deviceauth/usercode")) {
        return json({
          device_auth_id: "test-device-auth-id",
          user_code: "TEST-CODE",
          interval: "1",
        });
      }
      if (String(url).endsWith("/deviceauth/token")) {
        return json({
          authorization_code: "test-code",
          code_verifier: "test-verifier",
        });
      }
      if (String(url).endsWith("/oauth/token")) {
        return json({
          access_token: "test-access-token",
          refresh_token: "test-refresh-token",
          id_token: jwt({ chatgpt_account_id: accountId }),
          expires_in: 3600,
        });
      }
      if (String(url).endsWith("/codex/responses")) {
        seenBodies.push(requestJson(init.body));
        return json({ error: { code: "model_not_found" } }, 404);
      }
      throw new Error(`Unexpected fallback URL: ${url}`);
    });
    const reporter = makeReporter();

    const result = await runContractProbe({
      provider: "chatgpt",
      fetchImpl,
      report: reporter.report,
      presentAuthorization: vi.fn(async () => {}),
      sleep: vi.fn(async () => {}),
      prompt: TEST_PROMPT,
    });

    expect(result.ok).toBe(false);
    expect(fetchImpl).toHaveBeenCalledTimes(4);
    expect(seenBodies).toHaveLength(1);
    expect(seenBodies[0].model).toBe("gpt-5.5");
    expect(reporter.records().at(-1)).toMatchObject({
      operation: "chatgpt.generation",
      status: "fail",
      error_category: "entitlement",
    });
  });

  it("passes an opt-in quota probe only when the prepared account returns the quota category", async () => {
    const accountId = "test-xai-account-id";
    const fetchImpl = vi.fn(async (url, init = {}) => {
      if (String(url).endsWith("/device/code")) {
        return json({
          device_code: "test-xai-device-code",
          user_code: "XAI-CODE",
          verification_uri: "https://accounts.x.ai/device",
          expires_in: 300,
          interval: 1,
        });
      }
      if (String(url).endsWith("/oauth2/token")) {
        return json({
          access_token: "test-xai-access-token",
          refresh_token: "test-xai-refresh-token",
          id_token: jwt({ sub: accountId }),
          expires_in: 1800,
        });
      }
      if (String(url).endsWith("/v1/responses")) {
        expect(requestJson(init.body).model).toBe("grok-4.5");
        return json({ error: { code: "weekly_limit_exhausted" } }, 429);
      }
      throw new Error(`Unexpected fallback URL: ${url}`);
    });
    const reporter = makeReporter();

    const result = await runContractProbe({
      provider: "xai",
      expectedError: "quota",
      fetchImpl,
      report: reporter.report,
      presentAuthorization: vi.fn(async () => {}),
      sleep: vi.fn(async () => {}),
      prompt: TEST_PROMPT,
    });

    expect(result).toMatchObject({
      ok: true,
      observations: { expectedErrorObserved: "quota" },
    });
    expect(fetchImpl).toHaveBeenCalledTimes(3);
    expect(reporter.records().at(-1)).toEqual(
      expect.objectContaining({
        operation: "xai.expected_quota_error",
        status: "pass",
        error_category: "quota",
      }),
    );
  });

  it("keeps credentials in the same process for opt-in revocation generation and refresh checks", async () => {
    const accountId = "test-xai-account-id";
    let refreshed = false;
    let revoked = false;
    const fetchImpl = vi.fn(async (url, init = {}) => {
      if (String(url).endsWith("/device/code")) {
        return json({
          device_code: "test-xai-device-code",
          user_code: "XAI-CODE",
          verification_uri: "https://accounts.x.ai/device",
          expires_in: 300,
          interval: 1,
        });
      }
      if (String(url).endsWith("/oauth2/token")) {
        const form = new URLSearchParams(init.body);
        if (
          form.get("grant_type") ===
          "urn:ietf:params:oauth:grant-type:device_code"
        ) {
          return json({
            access_token: "test-xai-access-token",
            refresh_token: "test-xai-refresh-token",
            id_token: jwt({ sub: accountId }),
            expires_in: 1800,
          });
        }
        if (revoked) {
          return json({ error: "invalid_grant" }, 401);
        }
        refreshed = true;
        return json({
          access_token: "test-xai-refreshed-access-token",
          refresh_token: "test-xai-rotated-refresh-token",
          id_token: jwt({ sub: accountId }),
          expires_in: 1800,
        });
      }
      if (String(url).endsWith("/v1/responses")) {
        if (revoked) return json({ error: { code: "token_revoked" } }, 401);
        const body = requestJson(init.body);
        if (body.stream) {
          return sse([
            { type: "response.output_text.delta", delta: "ready" },
            { type: "response.completed", response: { id: "safe" } },
          ]);
        }
        return json(
          output({
            text: "ready",
            tool: body.tools?.[0]?.type,
          }),
        );
      }
      throw new Error(`Unexpected URL: ${url}`);
    });
    const reporter = makeReporter();
    const waitForRevocation = vi.fn(async () => {
      expect(refreshed).toBe(true);
      revoked = true;
    });

    const result = await runContractProbe({
      provider: "xai",
      revokeCheck: true,
      fetchImpl,
      report: reporter.report,
      presentAuthorization: vi.fn(async () => {}),
      waitForRevocation,
      sleep: vi.fn(async () => {}),
      prompt: TEST_PROMPT,
    });

    expect(result).toMatchObject({
      ok: true,
      observations: { revocationVerified: true },
    });
    expect(waitForRevocation).toHaveBeenCalledWith({ provider: "xai" });
    expect(reporter.records().slice(-2)).toEqual([
      expect.objectContaining({
        operation: "xai.revoked_generation",
        status: "pass",
        error_category: "reauth_required",
      }),
      expect.objectContaining({
        operation: "xai.revoked_refresh",
        status: "pass",
        error_category: "reauth_required",
      }),
    ]);
  });

  it("permits only exclusive sanitized evidence writes and embeds no token-cache persistence", async () => {
    const source = await readFile(
      new URL("./subscription-ai-contract-probe.mjs", import.meta.url),
      "utf8",
    );

    expect(source).toMatch(
      /import \{ writeFile \} from ["']node:fs\/promises["']/,
    );
    expect(source).not.toMatch(/readFile|appendFile|createWriteStream/);
    expect(source).toMatch(/flag: ["']wx["']/);
    expect(source).toMatch(/mode: 0o600/);
    expect(source).not.toMatch(/pbcopy/);
    expect(source).not.toMatch(/auth\.json|localStorage|sessionStorage/);
    expect(source).not.toMatch(
      /OPENAI_API_KEY|XAI_API_KEY|LLM_API_KEY|https:\/\/api\.openai\.com\/v1/,
    );
    expect(source).not.toMatch(/opencode|kilocode/i);
  });
});
