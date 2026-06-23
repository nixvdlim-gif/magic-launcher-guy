import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// Fincra hosted-checkout config stored in app_settings (key="fincra")
export type FincraCfg = {
  enabled: boolean;
  environment: "sandbox" | "live";
  business_id: string;
  public_key: string;
  secret_key: string;
  currency: string; // ISO alpha (NGN, KES, USD, GHS, etc.)
  webhook_secret: string; // shared secret for HMAC verification (== secret_key by default)
  success_url: string; // optional override
};

const DEFAULTS: FincraCfg = {
  enabled: false,
  environment: "sandbox",
  business_id: "",
  public_key: "",
  secret_key: "",
  currency: "NGN",
  webhook_secret: "",
  success_url: "",
};

function apiBase(env: "sandbox" | "live") {
  return env === "live"
    ? "https://api.fincra.com"
    : "https://sandboxapi.fincra.com";
}

async function loadCfg(): Promise<FincraCfg> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("app_settings")
    .select("value")
    .eq("key", "fincra")
    .maybeSingle();
  return { ...DEFAULTS, ...((data?.value ?? {}) as Partial<FincraCfg>) };
}

async function assertAdmin(ctx: { supabase: any; userId: string }) {
  const { data } = await ctx.supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", ctx.userId)
    .eq("role", "admin")
    .maybeSingle();
  if (!data) throw new Error("Admin only");
}

// ── Public: minimal status (used by deposit dialog to show Auto option) ──
export const getFincraPublicStatus = createServerFn({ method: "GET" }).handler(
  async () => {
    const v = await loadCfg();
    return {
      enabled: !!v.enabled && !!v.business_id && !!v.secret_key,
      currency: v.currency || "NGN",
      environment: v.environment,
    };
  },
);


// ── Admin: load settings (mask secrets) ──────────────────────────
export const getFincraSettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const v = await loadCfg();
    return {
      enabled: v.enabled,
      environment: v.environment,
      business_id: v.business_id,
      public_key: v.public_key,
      secret_key: v.secret_key ? "••••••••" : "",
      currency: v.currency,
      webhook_secret: v.webhook_secret ? "••••••••" : "",
      success_url: v.success_url,
      has_secret: !!v.secret_key,
      has_webhook_secret: !!v.webhook_secret,
    };
  });

// ── Admin: save settings ─────────────────────────────────────────
export const saveFincraSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        enabled: z.boolean(),
        environment: z.enum(["sandbox", "live"]),
        business_id: z.string().trim().max(128),
        public_key: z.string().trim().max(256),
        secret_key: z.string().trim().max(256),
        currency: z.string().trim().max(8),
        webhook_secret: z.string().trim().max(256),
        success_url: z.string().trim().max(256),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const existing = await loadCfg();
    const value: FincraCfg = {
      enabled: data.enabled,
      environment: data.environment,
      business_id: data.business_id,
      public_key: data.public_key,
      secret_key:
        !data.secret_key || data.secret_key === "••••••••" ? existing.secret_key : data.secret_key,
      currency: data.currency || "NGN",
      webhook_secret:
        !data.webhook_secret || data.webhook_secret === "••••••••"
          ? existing.webhook_secret
          : data.webhook_secret,
      success_url: data.success_url,
    };
    const { error } = await supabaseAdmin
      .from("app_settings")
      .upsert({ key: "fincra", value, updated_by: context.userId });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ── User: initiate a deposit (creates Fincra payment link) ───────
export const initFincraDeposit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({ amount: z.number().positive().max(10_000_000) })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const cfg = await loadCfg();
    if (!cfg.enabled) throw new Error("Fincra is currently disabled");
    if (!cfg.business_id || !cfg.secret_key) {
      throw new Error("Fincra is not configured. Contact admin.");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Customer details for Fincra
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("username, game_id")
      .eq("id", context.userId)
      .maybeSingle();
    const { data: userRow } = await supabaseAdmin.auth.admin.getUserById(context.userId);
    const email = userRow?.user?.email || `user-${context.userId.slice(0, 8)}@noemail.local`;
    const fullName: string = profile?.username || profile?.game_id || "Customer";
    const [firstName, ...rest] = fullName.split(" ");
    const lastName = rest.join(" ") || "User";

    // Unique reference
    const reference = `FN${Date.now()}${Math.floor(Math.random() * 1000)
      .toString()
      .padStart(3, "0")}`;

    // Insert pending transaction
    const { error: insErr } = await supabaseAdmin.from("transactions").insert({
      user_id: context.userId,
      type: "deposit",
      method: "fincra",
      amount: data.amount,
      status: "pending",
      external_txn_id: reference,
      reference,
      meta: { gateway: "fincra", environment: cfg.environment, currency: cfg.currency },
    });
    if (insErr) throw new Error(insErr.message);

    // Build success redirect
    const { getRequestHost } = await import("@tanstack/react-start/server");
    const host = getRequestHost();
    const proto = host.includes("localhost") ? "http" : "https";
    const successUrl = cfg.success_url || `${proto}://${host}/wallet?fn_ref=${reference}`;

    // Call Fincra Checkout API
    const ALLOWED = ["NGN","USD","GBP","EUR","GHS","KES","UGX","TZS","ZMW","EGP","MZN","MWK","ZWL","GNF","XOF","XAF","ZAR"];
    const currency = (cfg.currency || "NGN")
      .split(/[,\s/|]+/)
      .map((s) => s.trim().toUpperCase())
      .find((s) => ALLOWED.includes(s)) || "NGN";

    const body = {
      amount: Math.max(1, Math.round(Number(data.amount))),
      currency,
      reference,
      customer: {
        name: `${firstName} ${lastName}`.trim(),
        email,
        phoneNumber: "08000000000",
      },
      successMessage: "Payment received — balance will credit shortly.",
      redirectUrl: successUrl,
      feeBearer: "business",
    };

    let res: Response;
    let json: any = {};
    try {
      res = await fetch(`${apiBase(cfg.environment)}/checkout/payments`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "api-key": cfg.secret_key,
          "x-business-id": cfg.business_id,
          "x-pub-key": cfg.public_key || "",
        },
        body: JSON.stringify(body),
      });
      json = await res.json().catch(() => ({}));
    } catch (e) {
      throw new Error(
        `Fincra network error: ${e instanceof Error ? e.message : "unknown"}`,
      );
    }

    if (!res.ok || !json?.data?.link) {
      const detail =
        json?.message ||
        json?.error ||
        (json?.errors && JSON.stringify(json.errors)) ||
        `HTTP ${res.status}`;
      const hint =
        res.status === 403
          ? " — Likely causes: (1) IP whitelisting is ON in your Fincra dashboard (disable it, our server IPs are dynamic), (2) wrong environment selected (sandbox keys used in live, or vice-versa), or (3) Business ID does not match the API key."
          : res.status === 401
            ? " — Check the secret API key and Business ID in admin settings."
            : "";
      throw new Error(`Fincra ${res.status}: ${detail}${hint}`);
    }

    return {
      method: "GET" as const,
      checkout_url: String(json.data.link),
      reference,
    };
  });

// ── User: verify a pending Fincra deposit by reference ────────────
// Falls back when the webhook didn't reach our server. Polls Fincra's
// transaction-by-reference endpoint and approves the local pending txn
// if Fincra reports a successful payment with the correct amount.
export const verifyFincraDeposit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ reference: z.string().trim().min(1).max(128) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const cfg = await loadCfg();
    if (!cfg.business_id || !cfg.secret_key) {
      throw new Error("Fincra is not configured");
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: tx } = await supabaseAdmin
      .from("transactions")
      .select("id, user_id, amount, status, method")
      .eq("external_txn_id", data.reference)
      .eq("method", "fincra")
      .maybeSingle();
    if (!tx) return { ok: false, status: "not_found" as const };
    if (tx.user_id !== context.userId) return { ok: false, status: "forbidden" as const };
    if (tx.status === "approved" || tx.status === "completed") {
      return { ok: true, status: "already" as const };
    }

    // Query Fincra by merchant reference
    const url = `${apiBase(cfg.environment)}/checkout/payments/merchant-reference/${encodeURIComponent(data.reference)}`;
    const res = await fetch(url, {
      method: "GET",
      headers: {
        "api-key": cfg.secret_key,
        "x-business-id": cfg.business_id,
      },
    });
    const json: any = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { ok: false, status: "gateway_error" as const, http: res.status, message: json?.message };
    }

    const d = json?.data ?? json;
    const statusStr = String(d?.status ?? "").toLowerCase();
    const success =
      statusStr === "success" ||
      statusStr === "successful" ||
      statusStr === "approved" ||
      statusStr === "completed" ||
      statusStr === "paid";

    if (!success) {
      return { ok: false, status: "pending" as const, fincra_status: statusStr };
    }

    // Amount sanity (Fincra reports major units)
    const reportedAmount = Number(d?.amount ?? d?.amountPaid ?? 0);
    if (reportedAmount > 0 && Math.abs(reportedAmount - Number(tx.amount)) > 0.01) {
      await supabaseAdmin
        .from("transactions")
        .update({
          status: "rejected",
          processed_at: new Date().toISOString(),
          admin_note: `Amount mismatch: got ${reportedAmount}, expected ${tx.amount}`,
        })
        .eq("id", tx.id);
      return { ok: false, status: "amount_mismatch" as const };
    }

    const { data: rpcRes, error: rpcErr } = await supabaseAdmin.rpc(
      "admin_process_transaction" as any,
      { _txn_id: tx.id, _action: "approve" },
    );
    if (rpcErr) throw new Error(rpcErr.message);
    const r = rpcRes as { ok: boolean; error?: string } | null;
    if (!r?.ok) {
      if (r?.error === "already_processed") return { ok: true, status: "already" as const };
      throw new Error(r?.error ?? "approval failed");
    }
    return { ok: true, status: "approved" as const };
  });

