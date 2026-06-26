import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

type TwilioCfg = {
  account_sid: string;
  auth_token: string;
  verify_service_sid: string;
  enabled: boolean;
};

async function getTwilioConfig(): Promise<TwilioCfg> {
  const { data, error } = await supabaseAdmin
    .from("app_settings")
    .select("value")
    .eq("key", "twilio")
    .maybeSingle();
  if (error) throw new Error("Could not load Twilio settings");
  const cfg = (data?.value ?? {}) as Partial<TwilioCfg>;
  if (!cfg.enabled) throw new Error("Phone OTP is disabled by admin");
  if (!cfg.account_sid || !cfg.auth_token || !cfg.verify_service_sid) {
    throw new Error("Twilio is not configured. Contact admin.");
  }
  return cfg as TwilioCfg;
}

function basicAuth(username: string, password: string) {
  return btoa(`${username}:${password}`);
}

function normalizePhone(input: string): string {
  const trimmed = input.trim().replace(/[\s-()]/g, "");
  if (trimmed.startsWith("+")) return trimmed;
  // Default to Bangladesh if no country code (10–11 digits)
  if (/^01\d{9}$/.test(trimmed)) return "+88" + trimmed;
  if (/^88\d{11}$/.test(trimmed)) return "+" + trimmed;
  return trimmed.startsWith("0") ? "+88" + trimmed : "+" + trimmed;
}

async function recordAttempt(phone: string, action: string, status: string) {
  await supabaseAdmin.from("phone_otp_attempts").insert({ phone, action, status });
}

async function tooManyRecent(phone: string): Promise<boolean> {
  const since = new Date(Date.now() - 60_000).toISOString();
  const { count } = await supabaseAdmin
    .from("phone_otp_attempts")
    .select("*", { count: "exact", head: true })
    .eq("phone", phone)
    .eq("action", "send")
    .gte("created_at", since);
  return (count ?? 0) >= 3;
}

export const sendPhoneOtp = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ phone: z.string().min(6).max(20) }).parse(input),
  )
  .handler(async ({ data }) => {
    const cfg = await getTwilioConfig();
    const phone = normalizePhone(data.phone);

    if (await tooManyRecent(phone)) {
      throw new Error("Too many requests. Please wait a minute.");
    }

    const auth = basicAuth(cfg.account_sid, cfg.auth_token);
    const res = await fetch(
      `https://verify.twilio.com/v2/Services/${cfg.verify_service_sid}/Verifications`,
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${auth}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({ To: phone, Channel: "sms" }),
      },
    );
    const body = (await res.json().catch(() => ({}))) as { status?: string; message?: string };
    if (!res.ok) {
      await recordAttempt(phone, "send", "failed");
      throw new Error(body.message ?? `Twilio error ${res.status}`);
    }
    await recordAttempt(phone, "send", body.status ?? "pending");
    return { phone, status: body.status ?? "pending" };
  });

export const verifyPhoneOtp = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        phone: z.string().min(6).max(20),
        code: z.string().regex(/^\d{4,8}$/, "Invalid code"),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const cfg = await getTwilioConfig();
    const phone = normalizePhone(data.phone);
    const auth = basicAuth(cfg.account_sid, cfg.auth_token);

    const res = await fetch(
      `https://verify.twilio.com/v2/Services/${cfg.verify_service_sid}/VerificationCheck`,
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${auth}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({ To: phone, Code: data.code }),
      },
    );
    const body = (await res.json().catch(() => ({}))) as { status?: string; message?: string };
    if (!res.ok) {
      await recordAttempt(phone, "verify", "failed");
      throw new Error(body.message ?? `Twilio error ${res.status}`);
    }
    if (body.status !== "approved") {
      await recordAttempt(phone, "verify", body.status ?? "denied");
      throw new Error("Invalid or expired code");
    }
    await recordAttempt(phone, "verify", "approved");

    // Mark current user's profile verified + save phone
    const { error: upErr } = await supabaseAdmin
      .from("profiles")
      .update({ phone, is_verified: true })
      .eq("id", context.userId);
    if (upErr) throw new Error("Could not update profile: " + upErr.message);

    return { verified: true, phone };
  });

// Admin-only: load and save Twilio settings
export const getTwilioSettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: roleRow } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId)
      .eq("role", "admin")
      .maybeSingle();
    if (!roleRow) throw new Error("Admin only");

    const { data } = await supabaseAdmin
      .from("app_settings")
      .select("value")
      .eq("key", "twilio")
      .maybeSingle();
    const v = (data?.value ?? {}) as Partial<TwilioCfg>;
    return {
      account_sid: v.account_sid ?? "",
      auth_token: v.auth_token ? "••••••••" : "",
      verify_service_sid: v.verify_service_sid ?? "",
      enabled: !!v.enabled,
      has_token: !!v.auth_token,
    };
  });

export const saveTwilioSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        account_sid: z.string().trim().max(64),
        auth_token: z.string().trim().max(128),
        verify_service_sid: z.string().trim().max(64),
        enabled: z.boolean(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: roleRow } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId)
      .eq("role", "admin")
      .maybeSingle();
    if (!roleRow) throw new Error("Admin only");

    // Preserve existing token if user left placeholder unchanged
    let tokenToSave = data.auth_token;
    if (!tokenToSave || tokenToSave === "••••••••") {
      const { data: existing } = await supabaseAdmin
        .from("app_settings")
        .select("value")
        .eq("key", "twilio")
        .maybeSingle();
      tokenToSave = ((existing?.value as Partial<TwilioCfg> | null)?.auth_token) ?? "";
    }

    const value = {
      account_sid: data.account_sid,
      auth_token: tokenToSave,
      verify_service_sid: data.verify_service_sid,
      enabled: data.enabled,
    };

    const { error } = await supabaseAdmin
      .from("app_settings")
      .upsert({ key: "twilio", value, updated_by: context.userId });
    if (error) throw new Error(error.message);

    return { ok: true };
  });