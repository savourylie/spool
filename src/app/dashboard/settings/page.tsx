import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/server";
import { SESSION_COOKIE_NAME } from "@/lib/session";
import { SettingsForm } from "@/components/dashboard/settings-form";

export const metadata: Metadata = { title: "Settings — Spool" };

export default async function SettingsPage() {
  const cookieStore = await cookies();
  const session = cookieStore.get(SESSION_COOKIE_NAME);
  if (!session) redirect("/");

  const userId = session.value;
  const supabase = createAdminClient();

  const { data: user } = await supabase
    .from("users")
    .select("llm_provider, llm_api_key_encrypted, llm_base_url, llm_model")
    .eq("id", userId)
    .single();

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-heading text-2xl font-bold">Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage your AI provider and API key.
        </p>
      </div>

      <SettingsForm
        initialProvider={(user?.llm_provider as "anthropic" | "openai") ?? null}
        initialHasKey={!!user?.llm_api_key_encrypted}
        initialBaseUrl={user?.llm_base_url ?? ""}
        initialModel={user?.llm_model ?? ""}
      />
    </div>
  );
}
