import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { uploadKycDocument } from "@/lib/kyc.functions";
import { ArrowLeft, BadgeCheck, Upload } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/kyc")({
  component: KycPage,
});

function KycPage() {
  const { user } = useAuth();
  const uploadKyc = useServerFn(uploadKycDocument);
  const [submission, setSubmission] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ doc_type: "nid", doc_number: "" });
  const [docFile, setDocFile] = useState<File | null>(null);
  const [selfieFile, setSelfieFile] = useState<File | null>(null);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase.from("kyc_submissions").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(1).maybeSingle();
      setSubmission(data);
      setLoading(false);
    })();
  }, [user]);

  const toBase64 = (file: File) => new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

  const upload = async (file: File, kind: string) => {
    const fileBase64 = await toBase64(file);
    const { path } = await uploadKyc({
      data: {
        kind: kind as "doc" | "selfie",
        file: { fileName: file.name, fileType: file.type || "image/jpeg", fileSize: file.size, fileBase64 },
      },
    });
    return path;
  };

  const submit = async () => {
    if (!user || !form.doc_number || !docFile) {
      return toast.error("Provide document");
    }
    setBusy(true);
    try {
      const doc_image_url = await upload(docFile, "doc");
      const selfie_url = selfieFile ? await upload(selfieFile, "selfie") : null;
      const { error } = await supabase.from("kyc_submissions").insert({
        user_id: user.id, doc_type: form.doc_type, doc_number: form.doc_number,
        doc_image_url, selfie_url, status: "pending",
      });
      if (error) throw error;
      toast.success("Submitted");
      const { data } = await supabase.from("kyc_submissions").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(1).maybeSingle();
      setSubmission(data);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <p className="p-6 text-center text-sm text-muted-foreground">…</p>;

  return (
    <div className="px-4 pt-6 pb-20 space-y-4">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" asChild>
          <Link to="/profile"><ArrowLeft className="h-5 w-5" /></Link>
        </Button>
        <BadgeCheck className="h-6 w-6 text-primary" />
        <h1 className="text-xl font-bold">KYC</h1>
      </div>

      {submission && submission.status !== "rejected" ? (
        <Card className="p-4 space-y-2">
          <div className="flex items-center justify-between">
            <div className="font-bold capitalize">{submission.doc_type}</div>
            <Badge variant={submission.status === "approved" ? "default" : "outline"} className="capitalize">{submission.status}</Badge>
          </div>
          <div className="text-xs text-muted-foreground">
            Number: <span className="font-mono">{submission.doc_number}</span>
          </div>
          {submission.admin_note && (
            <div className="text-xs bg-secondary/40 rounded p-2 mt-2">{submission.admin_note}</div>
          )}
        </Card>
      ) : (
        <Card className="p-4 space-y-3">
          {submission?.status === "rejected" && (
            <div className="text-xs bg-destructive/10 text-destructive rounded p-2">
              Previous submission rejected. {submission.admin_note}
            </div>
          )}
          <div>
            <Label className="text-xs">Document Type</Label>
            <select value={form.doc_type} onChange={(e) => setForm({ ...form, doc_type: e.target.value })}
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
              <option value="nid">NID</option>
              <option value="passport">Passport</option>
              <option value="driving_license">Driving License</option>
            </select>
          </div>
          <div>
            <Label className="text-xs">Document Number</Label>
            <Input value={form.doc_number} onChange={(e) => setForm({ ...form, doc_number: e.target.value })} />
          </div>
          <div>
            <Label className="text-xs">Document image</Label>
            <Input type="file" accept="image/*" onChange={(e) => setDocFile(e.target.files?.[0] ?? null)} />
          </div>
          <div>
            <Label className="text-xs">Selfie (optional)</Label>
            <Input type="file" accept="image/*" onChange={(e) => setSelfieFile(e.target.files?.[0] ?? null)} />
          </div>
          <Button className="w-full" disabled={busy} onClick={submit}>
            <Upload className="h-4 w-4 mr-2" /> {busy ? "…" : "Submit"}
          </Button>
        </Card>
      )}
    </div>
  );
}