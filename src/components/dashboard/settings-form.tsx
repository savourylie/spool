"use client";

import { useState } from "react";
import { Key, CheckCircle, Warning, CircleNotch } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Provider = "anthropic" | "openai" | null;

interface SettingsFormProps {
  initialProvider: Provider;
  initialHasKey: boolean;
  initialBaseUrl: string;
  initialModel: string;
}

const PROVIDER_OPTIONS = [
  {
    value: null as Provider,
    label: "Server Default",
    description: "Use Spool's shared AI key",
  },
  {
    value: "anthropic" as Provider,
    label: "Anthropic",
    description: "Claude (claude-sonnet-4-6)",
  },
  {
    value: "openai" as Provider,
    label: "OpenAI-compatible",
    description: "OpenAI, Ollama, LM Studio, Together AI, and more",
  },
];

export function SettingsForm({
  initialProvider,
  initialHasKey,
  initialBaseUrl,
  initialModel,
}: SettingsFormProps) {
  const [provider, setProvider] = useState<Provider>(initialProvider);
  const [apiKey, setApiKey] = useState("");
  const [hasKey, setHasKey] = useState(initialHasKey);
  const [isChangingKey, setIsChangingKey] = useState(false);
  const [baseUrl, setBaseUrl] = useState(initialBaseUrl);
  const [model, setModel] = useState(initialModel);
  const [status, setStatus] = useState<
    "idle" | "saving" | "success" | "error"
  >("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const [testStatus, setTestStatus] = useState<
    "idle" | "testing" | "success" | "error"
  >("idle");
  const [testMessage, setTestMessage] = useState("");

  const needsKey = provider !== null;
  const isDirty =
    provider !== initialProvider ||
    (needsKey && isChangingKey && apiKey.length > 0) ||
    baseUrl !== initialBaseUrl ||
    model !== initialModel;

  async function handleSave() {
    setStatus("saving");
    setErrorMessage("");

    try {
      const body: Record<string, unknown> = { provider, baseUrl, model };
      if (needsKey && (isChangingKey || !hasKey)) {
        body.apiKey = apiKey;
      }

      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (!res.ok || data.success === false) {
        setStatus("error");
        if (data.error === "invalid_key") {
          setErrorMessage(
            "Invalid API key. Please check your key and try again.",
          );
        } else {
          setErrorMessage(data.error ?? "Failed to save settings.");
        }
        return;
      }

      setStatus("success");
      setHasKey(provider !== null);
      setIsChangingKey(false);
      setApiKey("");
      setTimeout(() => setStatus("idle"), 3000);
    } catch {
      setStatus("error");
      setErrorMessage("Network error. Please try again.");
    }
  }

  async function handleTest() {
    setTestStatus("testing");
    setTestMessage("");
    setStatus("idle");
    setErrorMessage("");

    try {
      const body: Record<string, unknown> = { provider, baseUrl, model };
      if (needsKey && apiKey) {
        body.apiKey = apiKey;
      }

      const res = await fetch("/api/settings/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (data.ok) {
        setTestStatus("success");
        const reply = data.response ? ` — reply: "${data.response}"` : "";
        setTestMessage(`Connection OK${reply}`);
        return;
      }

      setTestStatus("error");
      const prefix =
        data.errorType === "auth"
          ? "Auth failed"
          : data.errorType === "rate_limit"
            ? "Rate limited"
            : data.errorType === "timeout"
              ? "Timed out"
              : data.errorType === "server"
                ? "Server error"
                : data.errorType === "config"
                  ? "Config"
                  : "Failed";
      setTestMessage(`${prefix}: ${data.error ?? "Unknown error"}`);
    } catch {
      setTestStatus("error");
      setTestMessage("Network error. Please try again.");
    }
  }

  async function handleClear() {
    setStatus("saving");
    setErrorMessage("");

    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider: null }),
      });

      if (!res.ok) {
        setStatus("error");
        setErrorMessage("Failed to remove key.");
        return;
      }

      setProvider(null);
      setHasKey(false);
      setApiKey("");
      setBaseUrl("");
      setModel("");
      setIsChangingKey(false);
      setStatus("success");
      setTimeout(() => setStatus("idle"), 3000);
    } catch {
      setStatus("error");
      setErrorMessage("Network error. Please try again.");
    }
  }

  return (
    <div className="max-w-lg space-y-6">
      {/* Provider selector */}
      <div className="space-y-2">
        <label className="text-xs font-bold uppercase tracking-wide text-foreground">
          AI Provider
        </label>
        <div className="grid gap-2">
          {PROVIDER_OPTIONS.map((opt) => (
            <button
              key={opt.value ?? "default"}
              type="button"
              onClick={() => {
                setProvider(opt.value);
                setStatus("idle");
                setErrorMessage("");
                setTestStatus("idle");
                setTestMessage("");
                if (opt.value === null) {
                  setIsChangingKey(false);
                  setApiKey("");
                  setBaseUrl("");
                  setModel("");
                }
              }}
              className={cn(
                "flex items-start gap-3 rounded-[var(--radius-md)] border-2 px-4 py-3 text-left transition-all",
                provider === opt.value
                  ? "border-primary bg-primary/5"
                  : "border-border hover:border-border/80 hover:bg-muted/50",
              )}
            >
              <div
                className={cn(
                  "mt-0.5 size-4 shrink-0 rounded-full border-2 transition-colors",
                  provider === opt.value
                    ? "border-primary bg-primary"
                    : "border-muted-foreground/40",
                )}
              >
                {provider === opt.value && (
                  <div className="flex h-full items-center justify-center">
                    <div className="size-1.5 rounded-full bg-white" />
                  </div>
                )}
              </div>
              <div>
                <div className="text-sm font-semibold">{opt.label}</div>
                <div className="text-xs text-muted-foreground">
                  {opt.description}
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* API key section */}
      {needsKey && (
        <div className="space-y-2">
          <label className="text-xs font-bold uppercase tracking-wide text-foreground">
            API Key{" "}
            {provider === "openai" && (
              <span className="font-normal normal-case text-muted-foreground">
                (optional for local models)
              </span>
            )}
          </label>

          {hasKey && !isChangingKey ? (
            <div className="flex items-center gap-3 rounded-[var(--radius-md)] border-2 border-border bg-muted/30 px-4 py-3">
              <Key weight="duotone" className="size-5 text-muted-foreground" />
              <span className="flex-1 text-sm text-muted-foreground">
                Key saved
              </span>
              <button
                type="button"
                onClick={() => setIsChangingKey(true)}
                className="text-xs font-semibold text-primary hover:underline"
              >
                Change
              </button>
            </div>
          ) : (
            <div className="space-y-1.5">
              <Input
                type="password"
                placeholder={
                  provider === "openai"
                    ? "sk-..."
                    : "sk-ant-..."
                }
                value={apiKey}
                onChange={(e) => {
                  setApiKey(e.target.value);
                  setStatus("idle");
                  setErrorMessage("");
                  setTestStatus("idle");
                  setTestMessage("");
                }}
              />
              <p className="text-xs text-muted-foreground">
                {provider === "openai"
                  ? "Your API key from OpenAI or your provider"
                  : "Get your key from console.anthropic.com/settings/keys"}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Base URL (optional) */}
      {needsKey && (
        <div className="space-y-2">
          <label className="text-xs font-bold uppercase tracking-wide text-foreground">
            Base URL{" "}
            <span className="font-normal normal-case text-muted-foreground">
              (optional)
            </span>
          </label>
          <Input
            type="url"
            placeholder={
              provider === "openai"
                ? "https://api.openai.com/v1"
                : "https://api.anthropic.com"
            }
            value={baseUrl}
            onChange={(e) => {
              setBaseUrl(e.target.value);
              setStatus("idle");
              setErrorMessage("");
              setTestStatus("idle");
              setTestMessage("");
            }}
          />
          <p className="text-xs text-muted-foreground">
            {provider === "openai"
              ? "Leave blank for OpenAI. Set for Ollama (http://localhost:11434/v1), LM Studio, Together AI, etc."
              : "Leave blank for Anthropic's default API endpoint."}
          </p>
        </div>
      )}

      {/* Model name (optional) */}
      {needsKey && (
        <div className="space-y-2">
          <label className="text-xs font-bold uppercase tracking-wide text-foreground">
            Model{" "}
            <span className="font-normal normal-case text-muted-foreground">
              (optional)
            </span>
          </label>
          <Input
            type="text"
            placeholder={
              provider === "openai"
                ? "gpt-4o"
                : "claude-sonnet-4-6"
            }
            value={model}
            onChange={(e) => {
              setModel(e.target.value);
              setStatus("idle");
              setErrorMessage("");
              setTestStatus("idle");
              setTestMessage("");
            }}
          />
          <p className="text-xs text-muted-foreground">
            Leave blank to use the default. Examples:{" "}
            {provider === "openai"
              ? "gpt-4o, llama3.1, mistral, deepseek-r1"
              : "claude-sonnet-4-6, claude-haiku-4-5-20251001"}
          </p>
        </div>
      )}

      {/* Error message */}
      {errorMessage && (
        <div className="flex items-center gap-2 rounded-[var(--radius-md)] border-2 border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          <Warning weight="fill" className="size-4 shrink-0" />
          {errorMessage}
        </div>
      )}

      {/* Success message */}
      {status === "success" && (
        <div className="flex items-center gap-2 rounded-[var(--radius-md)] border-2 border-green-500/30 bg-green-500/5 px-4 py-3 text-sm text-green-700 dark:text-green-400">
          <CheckCircle weight="fill" className="size-4 shrink-0" />
          Settings saved successfully.
        </div>
      )}

      {/* Test result */}
      {testStatus === "success" && (
        <div className="flex items-start gap-2 rounded-[var(--radius-md)] border-2 border-green-500/30 bg-green-500/5 px-4 py-3 text-sm text-green-700 dark:text-green-400">
          <CheckCircle weight="fill" className="mt-0.5 size-4 shrink-0" />
          <span className="break-words">{testMessage}</span>
        </div>
      )}
      {testStatus === "error" && (
        <div className="flex items-start gap-2 rounded-[var(--radius-md)] border-2 border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          <Warning weight="fill" className="mt-0.5 size-4 shrink-0" />
          <span className="break-words">{testMessage}</span>
        </div>
      )}

      {/* Actions */}
      <div className="flex flex-wrap gap-3">
        <Button
          variant="candy"
          size="sm"
          disabled={
            status === "saving" ||
            testStatus === "testing" ||
            (!isDirty && provider !== null) ||
            (provider === "anthropic" && !hasKey && !apiKey) ||
            (provider === "anthropic" && isChangingKey && !apiKey)
          }
          onClick={handleSave}
        >
          {status === "saving" ? (
            <>
              <CircleNotch className="size-4 animate-spin" />
              Validating...
            </>
          ) : (
            "Save"
          )}
        </Button>

        {needsKey && (
          <Button
            variant="outline"
            size="sm"
            disabled={
              testStatus === "testing" ||
              status === "saving" ||
              (provider === "anthropic" && !hasKey && !apiKey)
            }
            onClick={handleTest}
          >
            {testStatus === "testing" ? (
              <>
                <CircleNotch className="size-4 animate-spin" />
                Testing...
              </>
            ) : (
              "Test Connection"
            )}
          </Button>
        )}

        {hasKey && (
          <Button
            variant="outline"
            size="sm"
            disabled={status === "saving" || testStatus === "testing"}
            onClick={handleClear}
          >
            Remove Key
          </Button>
        )}
      </div>

      {/* Info note */}
      <p className="text-xs text-muted-foreground">
        When no key is configured, Spool uses its shared API key for AI
        features. Providing your own key gives you dedicated rate limits.
        Your key is encrypted at rest and never exposed in the UI.
      </p>
    </div>
  );
}
