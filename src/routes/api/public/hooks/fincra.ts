import { createFileRoute } from "@tanstack/react-router";

// Fincra webhook handler â€” verifies HMAC SHA512 signature with secret_key
// Header: "signature" = HMAC-SHA512(raw_body, secret_key) hex

export const Route = createFileRoute("/api/public/hooks/fincra")({
  server: {
    handlers: {
      GET: async () =>
        new Response(JSON.stringify({ ok: true, endpoint: "fincra-webhook" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),

      POST: async ({ request }) => {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        const { data: row } = await supabaseAdmin
          .from("app_settings")
          .select("value")
          .eq("key", "fincra")
          .maybeSingle();
        const cfg = (row?.value ?? {}) as {
          enabled?: boolean;
          secret_key?: string;
          webhook_secret?: string;
        };

        const raw = await request.text();
        const signature = request.headers.get("signature") ?? "";
        const verifyKey = cfg.webhook_secret || cfg.secret_key || "";

        if (!verifyKey) {
          return json({ ok: false, error: "webhook not configured" }, 503);
        }
        const expected = await hmacSha512Hex(verifyKey, raw);
        if (!safeEqualHex(signature, expected)) {
          return json({ ok: false, error: "invalid signature" }, 401);
        }


        let payload: any = {};
        try {
          payload = JSON.parse(raw);
        } catch {
          return json({ ok: false, error: "invalid body" }, 400);
        }

        const event: string = String(payload.event ?? payload.type ?? "");
        const d = payload.data ?? payload;
        const reference: string = String(
          d.reference ?? d.merchantReference ?? d.customReference ?? "",
        );
        if (!reference) return json({ ok: false, error: "missing reference" }, 400);

        const status: string = String(d.status ?? "").toLowerCase();
        const success =
          event.includes("success") ||
          status === "success" ||
          status === "successful" ||
          status === "approved" ||
          status === "completed";
        const failed =
          event.includes("failed") ||
          status === "failed" ||
          status === "declined" ||
          status === "cancelled";

        const { data: tx } = await supabaseAdmin
          .from("transactions")
          .select("id, user_id, amount, status, method")
          .eq("external_txn_id", reference)
          .eq("method", "fincra")
          .maybeSingle();
        if (!tx) return json({ ok: false, error: "txn not found" }, 404);
        if (tx.status === "approved") return json({ ok: true, already: true });

        if (failed && !success) {
          await supabaseAdmin
            .from("transactions")
            .update({
              status: "rejected",
              processed_at: new Date().toISOString(),
              admin_note: `Fincra ${status || event || "failed"}`,
              meta: { gateway: "fincra", payload },
            })
            .eq("id", tx.id);
          return json({ ok: true, status: "rejected" });
        }

        if (!success) return json({ ok: true, status: "ignored" });

        // Amount sanity (Fincra reports major units)
        const reportedAmount = Number(d.amount ?? d.amountPaid ?? 0);
        if (reportedAmount > 0 && Math.abs(reportedAmount - Number(tx.amount)) > 0.01) {
          await supabaseAdmin
            .from("transactions")
            .update({
              status: "rejected",
              processed_at: new Date().toISOString(),
              admin_note: `Amount mismatch: got ${reportedAmount}, expected ${tx.amount}`,
            })
            .eq("id", tx.id);
          return json({ ok: false, error: "amount mismatch" }, 400);
        }

        const { data: rpcRes, error: rpcErr } = await supabaseAdmin.rpc(
          "admin_process_transaction" as any,
          { _txn_id: tx.id, _action: "approve" },
        );
        if (rpcErr) return json({ ok: false, error: rpcErr.message }, 500);
        const r = rpcRes as { ok: boolean; error?: string } | null;
        if (!r?.ok) return json({ ok: false, error: r?.error ?? "rpc failed" }, 500);

        return json({ ok: true, status: "approved", reference });
      },
    },
  },
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
async function hmacSha512Hex(secret: string, message: string) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-512" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(message));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function safeEqualHex(a: string, b: string) {
  const left = a.trim().toLowerCase();
  const right = b.trim().toLowerCase();
  if (left.length !== right.length) return false;
  let diff = 0;
  for (let i = 0; i < left.length; i++) {
    diff |= left.charCodeAt(i) ^ right.charCodeAt(i);
  }
  return diff === 0;
}
