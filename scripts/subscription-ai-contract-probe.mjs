#!/usr/bin/env node

import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

const MAX_RESPONSE_BYTES = 1_000_000;
const REQUEST_TIMEOUT_MS = 30_000;
const DEFAULT_DEVICE_EXPIRES_SECONDS = 300;
const DEFAULT_DEVICE_INTERVAL_SECONDS = 5;
const DEVICE_POLL_SAFETY_MARGIN_MS = 3_000;
const FIXED_PROMPT = "Reply with the single word ready.";
const FIXED_SEARCH_PROMPT =
  "Use the provided search tool to find one recent public mention of Threads, then answer in one short sentence.";
const PROBE_USER_AGENT = "spool-contract-probe/0.1";
const HEADER_CONTRACT_CHECKS = Object.freeze({
  chatgpt: Object.freeze([
    { header: "Authorization", strategy: "omit" },
    { header: "Content-Type", strategy: "omit" },
    { header: "Accept", strategy: "substitute", value: "*/*" },
    {
      header: "User-Agent",
      strategy: "substitute",
      value: "spool-contract-probe-control/0.1",
    },
    { header: "ChatGPT-Account-Id", strategy: "omit" },
    { header: "originator", strategy: "omit" },
    { header: "session-id", strategy: "omit" },
  ]),
  xai: Object.freeze([
    { header: "Authorization", strategy: "omit" },
    { header: "Content-Type", strategy: "omit" },
    { header: "Accept", strategy: "substitute", value: "*/*" },
    {
      header: "User-Agent",
      strategy: "substitute",
      value: "spool-contract-probe-control/0.1",
    },
  ]),
});

export const PROVIDER_CONTRACTS = Object.freeze({
  chatgpt: Object.freeze({
    issuer: "https://auth.openai.com",
    clientId: "app_EMoamEEZ73f0CkXaXp7hrann",
    deviceCodeEndpoint:
      "https://auth.openai.com/api/accounts/deviceauth/usercode",
    deviceTokenEndpoint:
      "https://auth.openai.com/api/accounts/deviceauth/token",
    tokenEndpoint: "https://auth.openai.com/oauth/token",
    verificationUri: "https://auth.openai.com/codex/device",
    inferenceEndpoint: "https://chatgpt.com/backend-api/codex/responses",
    scopes: "openid profile email offline_access",
    model: "gpt-5.5",
    nativeSearchTool: "web_search",
  }),
  xai: Object.freeze({
    issuer: "https://auth.x.ai",
    clientId: "b1a00492-073a-47ea-816f-4c329264a828",
    deviceCodeEndpoint: "https://auth.x.ai/oauth2/device/code",
    deviceTokenEndpoint: "https://auth.x.ai/oauth2/token",
    tokenEndpoint: "https://auth.x.ai/oauth2/token",
    inferenceEndpoint: "https://api.x.ai/v1/responses",
    scopes:
      "openid profile email offline_access grok-cli:access api:access",
    model: "grok-4.5",
    nativeSearchTool: "x_search",
  }),
});

const SAFE_OPERATIONS = new Set(
  Object.keys(PROVIDER_CONTRACTS).flatMap((provider) => [
    `${provider}.device_flow`,
    `${provider}.generation`,
    `${provider}.header_contract`,
    `${provider}.streaming`,
    `${provider}.refresh`,
    `${provider}.native_search`,
    `${provider}.expected_quota_error`,
    `${provider}.expected_entitlement_error`,
    `${provider}.revoked_generation`,
    `${provider}.revoked_refresh`,
    `${provider}.evidence_record`,
  ]),
);
const SAFE_STATUSES = new Set(["pass", "fail", "skipped"]);
const SAFE_ERROR_CATEGORIES = new Set([
  "reauth_required",
  "entitlement",
  "quota",
  "rate_limit",
  "timeout",
  "upstream",
  "invalid_response",
]);

class ProbeFailure extends Error {
  constructor({ status, code, category } = {}) {
    super("probe operation failed");
    this.name = "ProbeFailure";
    this.status = status;
    this.code = code;
    this.category = category;
  }
}

export function parseArgs(argv) {
  let provider;
  let expectedError;
  let evidenceFile;
  let headerCheck = false;
  let revokeCheck = false;

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--provider") {
      if (provider !== undefined || index + 1 >= argv.length) {
        throw new Error("Pass --provider chatgpt or xai");
      }
      provider = argv[index + 1];
      index += 1;
      continue;
    }
    if (argument.startsWith("--provider=")) {
      if (provider !== undefined) {
        throw new Error("Pass --provider only once");
      }
      provider = argument.slice("--provider=".length);
      continue;
    }
    if (argument === "--expect-error") {
      if (expectedError !== undefined || index + 1 >= argv.length) {
        throw new Error("Pass --expect-error quota or entitlement");
      }
      expectedError = argv[index + 1];
      index += 1;
      continue;
    }
    if (argument === "--revoke-check") {
      if (revokeCheck) throw new Error("Pass --revoke-check only once");
      revokeCheck = true;
      continue;
    }
    if (argument === "--check-headers") {
      if (headerCheck) throw new Error("Pass --check-headers only once");
      headerCheck = true;
      continue;
    }
    if (argument === "--evidence-file") {
      if (evidenceFile !== undefined || index + 1 >= argv.length) {
        throw new Error("Pass --evidence-file once with a new file path");
      }
      evidenceFile = argv[index + 1];
      if (
        !evidenceFile ||
        evidenceFile.startsWith("--") ||
        evidenceFile.length > 4096
      ) {
        throw new Error("Pass --evidence-file with a valid file path");
      }
      index += 1;
      continue;
    }
    throw new Error(`Unknown argument: ${argument}`);
  }

  if (provider === undefined) {
    throw new Error("Pass --provider chatgpt or xai");
  }
  if (!Object.hasOwn(PROVIDER_CONTRACTS, provider)) {
    throw new Error("Provider must be chatgpt or xai");
  }
  if (
    expectedError !== undefined &&
    !["quota", "entitlement"].includes(expectedError)
  ) {
    throw new Error("Expected error must be quota or entitlement");
  }
  if (expectedError !== undefined && revokeCheck) {
    throw new Error("--expect-error and --revoke-check cannot be combined");
  }
  if (expectedError !== undefined && headerCheck) {
    throw new Error("--expect-error and --check-headers cannot be combined");
  }

  return {
    provider,
    ...(expectedError === undefined ? {} : { expectedError }),
    ...(evidenceFile === undefined ? {} : { evidenceFile }),
    ...(headerCheck ? { headerCheck: true } : {}),
    ...(revokeCheck ? { revokeCheck: true } : {}),
  };
}

export function createSafeReporter(write) {
  return (record) => {
    const operation = SAFE_OPERATIONS.has(record?.operation)
      ? record.operation
      : "unknown";
    const status = SAFE_STATUSES.has(record?.status) ? record.status : "fail";
    const numericLatency = Number(record?.latencyMs);
    const latency = Number.isFinite(numericLatency)
      ? Math.max(0, Math.floor(numericLatency))
      : 0;
    const hasSafeCategory = SAFE_ERROR_CATEGORIES.has(record?.errorCategory);
    const errorCategory =
      status === "pass"
        ? hasSafeCategory
          ? record.errorCategory
          : null
        : hasSafeCategory
          ? record.errorCategory
          : "upstream";

    write(
      `${JSON.stringify({
        operation,
        status,
        latency_ms: latency,
        error_category: errorCategory,
      })}\n`,
    );
  };
}

function safeObservedAt(value) {
  if (
    typeof value === "string" &&
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value) &&
    Number.isFinite(Date.parse(value))
  ) {
    return value;
  }
  return null;
}

function safeLifetimeSeconds(value) {
  const seconds = Number(value);
  if (!Number.isFinite(seconds) || seconds <= 0 || seconds > 31_536_000) {
    return null;
  }
  return Math.floor(seconds);
}

export function createSafeEvidenceRecord({ provider, result, observedAt }) {
  if (!Object.hasOwn(PROVIDER_CONTRACTS, provider)) {
    throw new Error("Provider must be chatgpt or xai");
  }
  const contract = PROVIDER_CONTRACTS[provider];
  const observations = result?.observations ?? {};
  const requestedScopes = contract.scopes.split(" ");
  const grantedScopeSet = new Set(
    typeof observations.grantedScopes === "string"
      ? observations.grantedScopes.split(/\s+/)
      : [],
  );
  const allowedClaims =
    provider === "chatgpt"
      ? new Set([
          "chatgpt_account_id",
          "https://api.openai.com/auth.chatgpt_account_id",
          "organizations[0].id",
        ])
      : new Set(["sub"]);
  const requestedHeaders =
    provider === "chatgpt"
      ? [
          "Authorization",
          "Content-Type",
          "Accept",
          "User-Agent",
          "ChatGPT-Account-Id",
          "originator",
          "session-id",
        ]
      : ["Authorization", "Content-Type", "Accept", "User-Agent"];
  const safePollingOutcomes = new Set([
    "authorization_pending",
    "slow_down",
    "access_denied",
    "authorization_denied",
    "expired_token",
    "timeout",
  ]);

  return {
    schema_version: 1,
    provider,
    observed_at: safeObservedAt(observedAt),
    contract: {
      issuer: contract.issuer,
      device_code_endpoint: contract.deviceCodeEndpoint,
      device_token_endpoint: contract.deviceTokenEndpoint,
      token_endpoint: contract.tokenEndpoint,
      inference_endpoint: contract.inferenceEndpoint,
      public_client_id: contract.clientId,
      requested_scopes: requestedScopes,
      requested_headers: requestedHeaders,
      model: contract.model,
      native_search_tool: contract.nativeSearchTool,
    },
    observations: {
      run_ok: result?.ok === true,
      account_identifier_claim: allowedClaims.has(
        observations.accountIdentifierClaim,
      )
        ? observations.accountIdentifierClaim
        : null,
      observed_issuer:
        observations.observedIssuer === contract.issuer
          ? contract.issuer
          : null,
      issuer_matches_contract:
        typeof observations.issuerMatchesContract === "boolean"
          ? observations.issuerMatchesContract
          : null,
      device_interval_seconds: safeLifetimeSeconds(
        observations.deviceIntervalSeconds,
      ),
      device_expires_in_seconds: safeLifetimeSeconds(
        observations.deviceExpiresInSeconds,
      ),
      polling_outcomes_observed: Array.isArray(
        observations.pollingOutcomesObserved,
      )
        ? [...new Set(observations.pollingOutcomesObserved)].filter((outcome) =>
            safePollingOutcomes.has(outcome),
          )
        : [],
      access_token_lifetime_seconds: safeLifetimeSeconds(
        observations.accessTokenLifetimeSeconds,
      ),
      granted_scopes: requestedScopes.filter((scope) =>
        grantedScopeSet.has(scope),
      ),
      refresh_token_rotated:
        typeof observations.refreshTokenRotated === "boolean"
          ? observations.refreshTokenRotated
          : null,
      access_token_replaced:
        typeof observations.accessTokenReplaced === "boolean"
          ? observations.accessTokenReplaced
          : null,
      required_headers: requestedHeaders.filter((header) =>
        Array.isArray(observations.requiredHeaders)
          ? observations.requiredHeaders.includes(header)
          : false,
      ),
      optional_headers: requestedHeaders.filter((header) =>
        Array.isArray(observations.optionalHeaders)
          ? observations.optionalHeaders.includes(header)
          : false,
      ),
      required_header_values: requestedHeaders.filter((header) =>
        Array.isArray(observations.requiredHeaderValues)
          ? observations.requiredHeaderValues.includes(header)
          : false,
      ),
      optional_header_values: requestedHeaders.filter((header) =>
        Array.isArray(observations.optionalHeaderValues)
          ? observations.optionalHeaderValues.includes(header)
          : false,
      ),
      expected_error_observed: ["quota", "entitlement"].includes(
        observations.expectedErrorObserved,
      )
        ? observations.expectedErrorObserved
        : null,
      revocation_verified:
        typeof observations.revocationVerified === "boolean"
          ? observations.revocationVerified
          : null,
    },
  };
}

async function defaultEvidenceWriter(path, record) {
  await writeFile(path, `${JSON.stringify(record, null, 2)}\n`, {
    encoding: "utf8",
    flag: "wx",
    mode: 0o600,
  });
}

function normalizedCode(input) {
  if (typeof input !== "string") return "";
  const code = input.toLowerCase();
  return /^[a-z0-9_.:-]{1,80}$/.test(code) ? code : "";
}

export function classifyPublicError(input = {}) {
  if (SAFE_ERROR_CATEGORIES.has(input.category)) return input.category;

  const status = Number(input.status);
  const hasNumericStatus = Number.isFinite(status);
  const code = normalizedCode(input.code ?? input.type);
  const name = typeof input.name === "string" ? input.name : "";

  if (["AbortError", "TimeoutError"].includes(name) || code.includes("timeout")) {
    return "timeout";
  }
  if (name === "SyntaxError") return "invalid_response";
  if (["invalid_client", "unauthorized_client"].includes(code)) {
    return "entitlement";
  }
  if (status === 401 || code.includes("invalid_grant") || code.includes("revoked")) {
    return "reauth_required";
  }
  const isEntitlementCode =
    /(entitlement|model|tool|scope|workspace|subscription|plan)/.test(code);
  if (
    isEntitlementCode &&
    (!hasNumericStatus || [400, 403, 404].includes(status))
  ) {
    return "entitlement";
  }
  const isQuotaCode =
    /(quota|insufficient|exhausted|usage_limit|weekly_limit)/.test(code);
  if (isQuotaCode && (!hasNumericStatus || status === 429)) {
    return "quota";
  }
  if (status === 429) return "rate_limit";
  if (name === "TypeError" || status >= 500) return "upstream";
  if (status >= 400 && status < 500) return "upstream";
  return "upstream";
}

export function parseSSEText(body) {
  if (Buffer.byteLength(body, "utf8") > MAX_RESPONSE_BYTES) {
    throw new ProbeFailure({ category: "invalid_response" });
  }

  let sawDelta = false;
  let completed = false;
  const events = body.split(/\r?\n\r?\n/);

  for (const rawEvent of events) {
    if (!rawEvent.trim()) continue;
    const data = rawEvent
      .split(/\r?\n/)
      .filter((line) => line.startsWith("data:"))
      .map((line) => line.slice(5).trimStart())
      .join("\n");
    if (!data || data === "[DONE]") continue;

    let event;
    try {
      event = JSON.parse(data);
    } catch {
      throw new SyntaxError("invalid SSE");
    }

    if (
      event?.type === "response.output_text.delta" &&
      typeof event.delta === "string" &&
      event.delta.length > 0
    ) {
      sawDelta = true;
    }
    if (event?.type === "response.completed" || event?.type === "response.done") {
      completed = true;
    }
    if (event?.type === "error" || event?.type === "response.failed") {
      const error =
        event.type === "error" ? event : event?.response?.error;
      throw new ProbeFailure({
        status: error?.status,
        code: error?.code ?? error?.type,
      });
    }
  }

  if (!sawDelta || !completed) {
    throw new SyntaxError("SSE stream is missing a delta or terminal event");
  }
  return { sawDelta, completed };
}

async function readLimitedText(response) {
  if (!response.body) return "";

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let size = 0;
  let text = "";

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > MAX_RESPONSE_BYTES) {
      await reader.cancel();
      throw new ProbeFailure({ category: "invalid_response" });
    }
    text += decoder.decode(value, { stream: true });
  }
  text += decoder.decode();
  return text;
}

async function readJson(response) {
  const text = await readLimitedText(response);
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    throw new SyntaxError("invalid JSON response");
  }
}

function publicErrorCode(data) {
  return normalizedCode(
    data?.error?.code ??
      data?.error?.type ??
      (typeof data?.error === "string" ? data.error : undefined) ??
      data?.code ??
      data?.type,
  );
}

function throwForResponse(response, data) {
  throw new ProbeFailure({
    status: response.status,
    code: publicErrorCode(data),
  });
}

function positiveSeconds(value, fallback) {
  const seconds = Number(value);
  return Number.isFinite(seconds) && seconds > 0 ? seconds : fallback;
}

function requestSignal() {
  return AbortSignal.timeout(REQUEST_TIMEOUT_MS);
}

async function startDeviceAuthorization(provider, contract, fetchImpl) {
  const response =
    provider === "chatgpt"
      ? await fetchImpl(contract.deviceCodeEndpoint, {
          method: "POST",
          signal: requestSignal(),
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
            "User-Agent": PROBE_USER_AGENT,
          },
          body: JSON.stringify({ client_id: contract.clientId }),
        })
      : await fetchImpl(contract.deviceCodeEndpoint, {
          method: "POST",
          signal: requestSignal(),
          headers: {
            Accept: "application/json",
            "Content-Type": "application/x-www-form-urlencoded",
            "User-Agent": PROBE_USER_AGENT,
          },
          body: new URLSearchParams({
            client_id: contract.clientId,
            scope: contract.scopes,
          }).toString(),
        });
  const data = await readJson(response);
  if (!response.ok) throwForResponse(response, data);

  if (provider === "chatgpt") {
    if (!data.device_auth_id || !data.user_code) {
      throw new ProbeFailure({ category: "invalid_response" });
    }
    return {
      deviceCode: data.device_auth_id,
      userCode: data.user_code,
      verificationUri: contract.verificationUri,
      verificationUriComplete: undefined,
      intervalSeconds: positiveSeconds(
        data.interval,
        DEFAULT_DEVICE_INTERVAL_SECONDS,
      ),
      expiresInSeconds: positiveSeconds(
        data.expires_in,
        DEFAULT_DEVICE_EXPIRES_SECONDS,
      ),
    };
  }

  if (!data.device_code || !data.user_code || !data.verification_uri) {
    throw new ProbeFailure({ category: "invalid_response" });
  }
  return {
    deviceCode: data.device_code,
    userCode: data.user_code,
    verificationUri: data.verification_uri,
    verificationUriComplete: data.verification_uri_complete,
    intervalSeconds: positiveSeconds(data.interval, DEFAULT_DEVICE_INTERVAL_SECONDS),
    expiresInSeconds: positiveSeconds(
      data.expires_in,
      DEFAULT_DEVICE_EXPIRES_SECONDS,
    ),
  };
}

async function pollDeviceAuthorization({
  provider,
  contract,
  device,
  fetchImpl,
  sleep,
  now,
  observePollingOutcome = () => {},
}) {
  const deadline = now() + device.expiresInSeconds * 1000;
  let intervalMs = device.intervalSeconds * 1000;

  while (now() < deadline) {
    const response =
      provider === "chatgpt"
        ? await fetchImpl(contract.deviceTokenEndpoint, {
            method: "POST",
            signal: requestSignal(),
            headers: {
              Accept: "application/json",
              "Content-Type": "application/json",
              "User-Agent": PROBE_USER_AGENT,
            },
            body: JSON.stringify({
              device_auth_id: device.deviceCode,
              user_code: device.userCode,
            }),
          })
        : await fetchImpl(contract.deviceTokenEndpoint, {
            method: "POST",
            signal: requestSignal(),
            headers: {
              Accept: "application/json",
              "Content-Type": "application/x-www-form-urlencoded",
              "User-Agent": PROBE_USER_AGENT,
            },
            body: new URLSearchParams({
              grant_type: "urn:ietf:params:oauth:grant-type:device_code",
              client_id: contract.clientId,
              device_code: device.deviceCode,
            }).toString(),
          });
    if (
      provider === "chatgpt" &&
      [403, 404].includes(response.status)
    ) {
      await response.body?.cancel().catch(() => {});
      observePollingOutcome("authorization_pending");
      await sleep(
        Math.min(
          intervalMs + DEVICE_POLL_SAFETY_MARGIN_MS,
          Math.max(0, deadline - now()),
        ),
      );
      continue;
    }

    const data = await readJson(response);

    if (response.ok) return data;

    const code = publicErrorCode(data);
    const pending = code === "authorization_pending";
    if (pending) {
      observePollingOutcome("authorization_pending");
      await sleep(
        Math.min(
          intervalMs + DEVICE_POLL_SAFETY_MARGIN_MS,
          Math.max(0, deadline - now()),
        ),
      );
      continue;
    }
    if (code === "slow_down") {
      observePollingOutcome("slow_down");
      intervalMs += 5_000;
      await sleep(
        Math.min(
          intervalMs + DEVICE_POLL_SAFETY_MARGIN_MS,
          Math.max(0, deadline - now()),
        ),
      );
      continue;
    }
    if (
      ["access_denied", "authorization_denied", "expired_token"].includes(code)
    ) {
      observePollingOutcome(code);
      throw new ProbeFailure({ category: "reauth_required" });
    }
    throwForResponse(response, data);
  }

  observePollingOutcome("timeout");
  throw new ProbeFailure({ category: "timeout" });
}

async function exchangeChatGPTDeviceGrant(contract, grant, fetchImpl) {
  if (!grant.authorization_code || !grant.code_verifier) {
    throw new ProbeFailure({ category: "invalid_response" });
  }
  const response = await fetchImpl(contract.tokenEndpoint, {
    method: "POST",
    signal: requestSignal(),
    headers: {
      Accept: "application/json",
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": PROBE_USER_AGENT,
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code: grant.authorization_code,
      redirect_uri: `${contract.issuer}/deviceauth/callback`,
      client_id: contract.clientId,
      code_verifier: grant.code_verifier,
    }).toString(),
  });
  const data = await readJson(response);
  if (!response.ok) throwForResponse(response, data);
  return data;
}

function parseJwtClaims(token) {
  if (typeof token !== "string") return undefined;
  const parts = token.split(".");
  if (parts.length !== 3) return undefined;
  try {
    return JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8"));
  } catch {
    return undefined;
  }
}

function extractAccountIdentifier(provider, claims) {
  if (provider === "chatgpt") {
    if (typeof claims?.chatgpt_account_id === "string") {
      return {
        accountId: claims.chatgpt_account_id,
        accountIdentifierClaim: "chatgpt_account_id",
      };
    }
    if (
      typeof claims?.["https://api.openai.com/auth"]?.chatgpt_account_id ===
      "string"
    ) {
      return {
        accountId:
          claims["https://api.openai.com/auth"].chatgpt_account_id,
        accountIdentifierClaim:
          "https://api.openai.com/auth.chatgpt_account_id",
      };
    }
    if (typeof claims?.organizations?.[0]?.id === "string") {
      return {
        accountId: claims.organizations[0].id,
        accountIdentifierClaim: "organizations[0].id",
      };
    }
  }
  if (provider === "xai" && typeof claims?.sub === "string") {
    return { accountId: claims.sub, accountIdentifierClaim: "sub" };
  }
  return undefined;
}

function normalizeSession(provider, tokenData) {
  if (
    typeof tokenData?.access_token !== "string" ||
    typeof tokenData?.refresh_token !== "string"
  ) {
    throw new ProbeFailure({ category: "invalid_response" });
  }

  const claimCandidates = [tokenData.id_token, tokenData.access_token]
    .map(parseJwtClaims)
    .filter(Boolean);
  const accountIdentifier = claimCandidates
    .map((claims) => extractAccountIdentifier(provider, claims))
    .find(Boolean);
  const observedIssuer = claimCandidates.find(
    (claims) => typeof claims?.iss === "string",
  )?.iss;

  if (!accountIdentifier) {
    throw new ProbeFailure({ category: "invalid_response" });
  }

  return {
    accessToken: tokenData.access_token,
    refreshToken: tokenData.refresh_token,
    idToken: tokenData.id_token,
    accountId: accountIdentifier.accountId,
    accountIdentifierClaim: accountIdentifier.accountIdentifierClaim,
    observedIssuer,
    issuerMatchesContract:
      observedIssuer === PROVIDER_CONTRACTS[provider].issuer,
    accessTokenLifetimeSeconds: positiveSeconds(tokenData.expires_in, 0),
    scopes: typeof tokenData.scope === "string" ? tokenData.scope : "",
  };
}

function responseHeaders(
  provider,
  session,
  stream,
  omittedHeaders = [],
  substitutedHeaders = {},
) {
  const headers = new Headers({
    Accept: stream ? "text/event-stream" : "application/json",
    Authorization: `Bearer ${session.accessToken}`,
    "Content-Type": "application/json",
    "User-Agent": PROBE_USER_AGENT,
  });
  if (provider === "chatgpt") {
    headers.set("ChatGPT-Account-Id", session.accountId);
    headers.set("originator", "spool-contract-probe");
    headers.set("session-id", session.probeSessionId);
  }
  for (const header of omittedHeaders) headers.delete(header);
  for (const [header, value] of Object.entries(substitutedHeaders)) {
    headers.set(header, value);
  }
  return headers;
}

function hasOutputText(data) {
  return (
    Array.isArray(data?.output) &&
    data.output.some(
      (item) =>
        item?.type === "message" &&
        Array.isArray(item.content) &&
        item.content.some(
          (content) =>
            content?.type === "output_text" &&
            typeof content.text === "string" &&
            content.text.length > 0,
        ),
    )
  );
}

function hasNativeToolEvidence(data, tool) {
  if (!Array.isArray(data?.output)) return false;
  return data.output.some(
    (item) =>
      item?.type === `${tool}_call` ||
      (item?.type === "tool_call" && item?.name === tool),
  );
}

async function callResponses({
  provider,
  contract,
  session,
  fetchImpl,
  prompt,
  stream = false,
  tool,
  omittedHeaders,
  substitutedHeaders,
}) {
  const body = {
    model: contract.model,
    input: [
      {
        role: "user",
        content: [
          { type: "input_text", text: tool ? FIXED_SEARCH_PROMPT : prompt },
        ],
      },
    ],
    max_output_tokens: 512,
    reasoning: { effort: "low" },
    store: false,
    ...(stream ? { stream: true } : {}),
    ...(tool
      ? { tools: [{ type: tool }], tool_choice: "required" }
      : {}),
  };
  const serializedBody = JSON.stringify(body);
  const response = await fetchImpl(contract.inferenceEndpoint, {
    method: "POST",
    signal: requestSignal(),
    headers: responseHeaders(
      provider,
      session,
      stream,
      omittedHeaders,
      substitutedHeaders,
    ),
    body: omittedHeaders?.includes("Content-Type")
      ? new TextEncoder().encode(serializedBody)
      : serializedBody,
  });
  const text = await readLimitedText(response);

  if (!response.ok) {
    let data = {};
    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      data = {};
    }
    throwForResponse(response, data);
  }

  if (stream) {
    parseSSEText(text);
    return;
  }

  let data;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    throw new SyntaxError("invalid JSON response");
  }
  if (!hasOutputText(data) || (tool && !hasNativeToolEvidence(data, tool))) {
    throw new ProbeFailure({ category: "invalid_response" });
  }
}

async function inspectRequiredHeaders({
  provider,
  contract,
  session,
  fetchImpl,
  prompt,
}) {
  const requiredHeaders = [];
  const optionalHeaders = [];
  const requiredHeaderValues = [];
  const optionalHeaderValues = [];

  for (const check of HEADER_CONTRACT_CHECKS[provider]) {
    const required =
      check.strategy === "omit" ? requiredHeaders : requiredHeaderValues;
    const optional =
      check.strategy === "omit" ? optionalHeaders : optionalHeaderValues;
    try {
      await callResponses({
        provider,
        contract,
        session,
        fetchImpl,
        prompt,
        omittedHeaders: check.strategy === "omit" ? [check.header] : [],
        substitutedHeaders:
          check.strategy === "substitute"
            ? { [check.header]: check.value }
            : {},
      });
      optional.push(check.header);
    } catch (error) {
      if ([400, 401, 403, 404, 415, 422].includes(Number(error?.status))) {
        required.push(check.header);
        continue;
      }
      throw error;
    }
  }

  return {
    requiredHeaders,
    optionalHeaders,
    requiredHeaderValues,
    optionalHeaderValues,
  };
}

async function refreshSession(provider, contract, session, fetchImpl) {
  const response = await fetchImpl(contract.tokenEndpoint, {
    method: "POST",
    signal: requestSignal(),
    headers: {
      Accept: "application/json",
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": PROBE_USER_AGENT,
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: session.refreshToken,
      client_id: contract.clientId,
    }).toString(),
  });
  const data = await readJson(response);
  if (!response.ok) throwForResponse(response, data);
  if (typeof data.access_token !== "string") {
    throw new ProbeFailure({ category: "invalid_response" });
  }

  const nextRefreshToken =
    typeof data.refresh_token === "string" ? data.refresh_token : session.refreshToken;
  if (provider === "xai" && nextRefreshToken === session.refreshToken) {
    throw new ProbeFailure({ category: "invalid_response" });
  }

  return {
    ...session,
    accessToken: data.access_token,
    refreshToken: nextRefreshToken,
    idToken: data.id_token ?? session.idToken,
    accessTokenLifetimeSeconds: positiveSeconds(
      data.expires_in,
      session.accessTokenLifetimeSeconds,
    ),
    refreshTokenRotated: nextRefreshToken !== session.refreshToken,
    accessTokenReplaced: data.access_token !== session.accessToken,
  };
}

async function runChild(command, args, input) {
  await new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: [input === undefined ? "ignore" : "pipe", "ignore", "ignore"],
    });
    child.once("error", reject);
    child.once("exit", (code) => {
      if (code === 0) resolve();
      else reject(new ProbeFailure({ category: "upstream" }));
    });
    if (input !== undefined) child.stdin.end(input);
  });
}

function appleScriptString(value) {
  return `"${value
    .replaceAll("\\", "\\\\")
    .replaceAll('"', '\\"')
    .replaceAll("\r", "\\r")
    .replaceAll("\n", "\\n")}"`;
}

export async function presentAuthorizationSafely({
  verificationUri,
  userCode,
  platform = process.platform,
  run = runChild,
}) {
  let parsedUri;
  try {
    parsedUri = new URL(verificationUri);
  } catch {
    throw new ProbeFailure({ category: "invalid_response" });
  }
  if (
    parsedUri.protocol !== "https:" ||
    parsedUri.username ||
    parsedUri.password ||
    parsedUri.search ||
    parsedUri.hash ||
    !/^[A-Za-z0-9._~-]{4,128}$/.test(userCode)
  ) {
    throw new ProbeFailure({ category: "invalid_response" });
  }

  if (platform === "darwin") {
    await run("open", [parsedUri.href]);
    const dialogText = appleScriptString(
      `Enter this short-lived code in the provider page:\n\n${userCode}`,
    );
    await run(
      "osascript",
      ["-"],
      `display dialog ${dialogText} buttons {"Continue"} default button "Continue" with icon note`,
    );
    return;
  }
  if (platform === "linux") {
    await run("xdg-open", [parsedUri.href]);
    await run(
      "zenity",
      ["--text-info", "--title=Subscription provider authorization"],
      `Enter this short-lived code in the provider page:\n\n${userCode}\n`,
    );
    return;
  }
  throw new ProbeFailure({ category: "upstream" });
}

async function defaultRevocationWaiter({ provider }) {
  if (process.platform !== "darwin") {
    throw new ProbeFailure({ category: "upstream" });
  }
  await runChild("osascript", [
    "-e",
    `display dialog "Revoke the ${provider} probe session upstream, then continue." buttons {"Continue"} default button "Continue"`,
  ]);
}

async function expectPublicFailure(expectedCategory, action) {
  try {
    await action();
  } catch (error) {
    const category = classifyPublicError(error);
    if (category === expectedCategory) return;
    throw error;
  }
  throw new ProbeFailure({ category: "invalid_response" });
}

async function runReportedOperation({
  operation,
  report,
  now,
  action,
  successErrorCategory,
}) {
  const startedAt = now();
  try {
    const value = await action();
    report({
      operation,
      status: "pass",
      latencyMs: now() - startedAt,
      errorCategory: successErrorCategory ?? null,
    });
    return value;
  } catch (error) {
    report({
      operation,
      status: "fail",
      latencyMs: now() - startedAt,
      errorCategory: classifyPublicError(error),
    });
    throw error;
  }
}

export async function runContractProbe({
  provider,
  expectedError,
  headerCheck = false,
  revokeCheck = false,
  fetchImpl = fetch,
  report,
  presentAuthorization = presentAuthorizationSafely,
  waitForRevocation = defaultRevocationWaiter,
  sleep = (milliseconds) =>
    new Promise((resolve) => setTimeout(resolve, milliseconds)),
  now = () => Date.now(),
  prompt = FIXED_PROMPT,
}) {
  if (!Object.hasOwn(PROVIDER_CONTRACTS, provider)) {
    throw new Error("Provider must be chatgpt or xai");
  }
  if (typeof report !== "function") {
    throw new Error("A safe report function is required");
  }

  const contract = PROVIDER_CONTRACTS[provider];
  const observations = {
    model: contract.model,
    nativeSearchTool: contract.nativeSearchTool,
  };
  const probeSessionId = randomUUID();
  let session;

  try {
    session = await runReportedOperation({
      operation: `${provider}.device_flow`,
      report,
      now,
      action: async () => {
        const device = await startDeviceAuthorization(
          provider,
          contract,
          fetchImpl,
        );
        observations.deviceIntervalSeconds = device.intervalSeconds;
        observations.deviceExpiresInSeconds = device.expiresInSeconds;
        observations.pollingOutcomesObserved = [];
        await presentAuthorization({
          provider,
          verificationUri: device.verificationUri,
          verificationUriComplete: device.verificationUriComplete,
          userCode: device.userCode,
        });
        const grant = await pollDeviceAuthorization({
          provider,
          contract,
          device,
          fetchImpl,
          sleep,
          now,
          observePollingOutcome: (outcome) => {
            if (!observations.pollingOutcomesObserved.includes(outcome)) {
              observations.pollingOutcomesObserved.push(outcome);
            }
          },
        });
        const tokenData =
          provider === "chatgpt"
            ? await exchangeChatGPTDeviceGrant(contract, grant, fetchImpl)
            : grant;
        return {
          ...normalizeSession(provider, tokenData),
          probeSessionId,
        };
      },
    });

    observations.accountIdentifierClaim = session.accountIdentifierClaim;
    observations.observedIssuer = session.observedIssuer;
    observations.issuerMatchesContract = session.issuerMatchesContract;
    observations.accessTokenLifetimeSeconds = session.accessTokenLifetimeSeconds;
    observations.grantedScopes = session.scopes;

    if (expectedError !== undefined) {
      await runReportedOperation({
        operation: `${provider}.expected_${expectedError}_error`,
        report,
        now,
        successErrorCategory: expectedError,
        action: () =>
          expectPublicFailure(expectedError, () =>
            callResponses({
              provider,
              contract,
              session,
              fetchImpl,
              prompt,
            }),
          ),
      });
      observations.expectedErrorObserved = expectedError;
      return { ok: true, observations };
    }

    await runReportedOperation({
      operation: `${provider}.generation`,
      report,
      now,
      action: () =>
        callResponses({
          provider,
          contract,
          session,
          fetchImpl,
          prompt,
        }),
    });

    if (headerCheck) {
      const headerObservations = await runReportedOperation({
        operation: `${provider}.header_contract`,
        report,
        now,
        action: () =>
          inspectRequiredHeaders({
            provider,
            contract,
            session,
            fetchImpl,
            prompt,
          }),
      });
      observations.requiredHeaders = headerObservations.requiredHeaders;
      observations.optionalHeaders = headerObservations.optionalHeaders;
      observations.requiredHeaderValues =
        headerObservations.requiredHeaderValues;
      observations.optionalHeaderValues =
        headerObservations.optionalHeaderValues;
    }

    await runReportedOperation({
      operation: `${provider}.streaming`,
      report,
      now,
      action: () =>
        callResponses({
          provider,
          contract,
          session,
          fetchImpl,
          prompt,
          stream: true,
        }),
    });

    session = await runReportedOperation({
      operation: `${provider}.refresh`,
      report,
      now,
      action: async () => {
        const refreshed = await refreshSession(
          provider,
          contract,
          session,
          fetchImpl,
        );
        await callResponses({
          provider,
          contract,
          session: refreshed,
          fetchImpl,
          prompt,
        });
        return refreshed;
      },
    });
    observations.refreshTokenRotated = session.refreshTokenRotated;
    observations.accessTokenReplaced = session.accessTokenReplaced;

    await runReportedOperation({
      operation: `${provider}.native_search`,
      report,
      now,
      action: () =>
        callResponses({
          provider,
          contract,
          session,
          fetchImpl,
          prompt,
          tool: contract.nativeSearchTool,
        }),
    });

    if (revokeCheck) {
      await waitForRevocation({ provider });
      await runReportedOperation({
        operation: `${provider}.revoked_generation`,
        report,
        now,
        successErrorCategory: "reauth_required",
        action: () =>
          expectPublicFailure("reauth_required", () =>
            callResponses({
              provider,
              contract,
              session,
              fetchImpl,
              prompt,
            }),
          ),
      });
      await runReportedOperation({
        operation: `${provider}.revoked_refresh`,
        report,
        now,
        successErrorCategory: "reauth_required",
        action: () =>
          expectPublicFailure("reauth_required", () =>
            refreshSession(provider, contract, session, fetchImpl),
          ),
      });
      observations.revocationVerified = true;
    }

    return { ok: true, observations };
  } catch {
    return { ok: false, observations };
  } finally {
    session = undefined;
  }
}

export async function main(argv, dependencies = {}) {
  let parsed;
  try {
    parsed = parseArgs(argv);
  } catch {
    return 2;
  }

  const {
    runProbe = runContractProbe,
    writeEvidence = defaultEvidenceWriter,
    observedAt = new Date().toISOString(),
    ...probeDependencies
  } = dependencies;
  const report =
    probeDependencies.report ??
    createSafeReporter((line) => {
      process.stdout.write(line);
    });
  const { evidenceFile, ...probeArgs } = parsed;
  const result = await runProbe({
    ...probeDependencies,
    ...probeArgs,
    report,
  });
  let evidenceWritten = true;
  if (evidenceFile !== undefined) {
    try {
      await runReportedOperation({
        operation: `${parsed.provider}.evidence_record`,
        report,
        now: probeDependencies.now ?? (() => Date.now()),
        action: () =>
          writeEvidence(
            evidenceFile,
            createSafeEvidenceRecord({
              provider: parsed.provider,
              result,
              observedAt,
            }),
          ),
      });
    } catch {
      evidenceWritten = false;
    }
  }
  return result.ok && evidenceWritten ? 0 : 1;
}

const isDirectExecution =
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(process.argv[1]).href;

if (isDirectExecution) {
  main(process.argv.slice(2))
    .then((exitCode) => {
      process.exitCode = exitCode;
    })
    .catch(() => {
      process.exitCode = 1;
    });
}
