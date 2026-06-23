import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useI18n, ALL_LANGS } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ChevronLeft, Lock, Globe2, FileText, Info, Mail, Camera, BadgeCheck, Volume2, VolumeX, Vibrate } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { isSoundEnabled, setSoundEnabled, isHapticsEnabled, setHapticsEnabled, playClick, vibrate } from "@/lib/feedback";

export const Route = createFileRoute("/_authenticated/settings")({
  component: SettingsPage,
});

function SettingsPage() {
  const { user } = useAuth();
  const { t, lang, setLang } = useI18n();
  const nav = useNavigate();
  const [newPwd, setNewPwd] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [sound, setSound] = useState(isSoundEnabled());
  const [haptics, setHaptics] = useState(isHapticsEnabled());

  const onAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    setUploading(true);
    try {
      const ext = file.name.split(".").pop();
      const path = `${user.id}/avatar-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("avatars").upload(path, file, { upsert: true });
      if (upErr) throw upErr;
      const url = supabase.storage.from("avatars").getPublicUrl(path).data.publicUrl;
      const { error } = await supabase.from("profiles").update({ avatar_url: url }).eq("id", user.id);
      if (error) throw error;
      toast.success(lang === "bn" ? "আপডেট হয়েছে" : "Avatar updated");
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setUploading(false);
    }
  };

  const onChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPwd.length < 6) return toast.error(lang === "bn" ? "কমপক্ষে ৬ অক্ষর" : "At least 6 characters");
    if (newPwd !== confirm) return toast.error(lang === "bn" ? "পাসওয়ার্ড মিলেনি" : "Passwords don't match");
    setSaving(true);
    const { error } = await supabase.auth.updateUser({ password: newPwd });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success(t("password_updated"));
    setNewPwd("");
    setConfirm("");
  };

  return (
    <div className="px-5 pt-6 pb-8 space-y-5">
      <div className="flex items-center gap-3">
        <button onClick={() => nav({ to: "/profile" })} className="p-1 -ml-1">
          <ChevronLeft className="h-5 w-5" />
        </button>
        <h1 className="text-2xl font-bold">{t("settings")}</h1>
      </div>

      {/* Account */}
      <Card className="p-4 space-y-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          <Mail className="h-4 w-4" /> {t("account")}
        </div>
        <div className="text-sm">
          <div className="text-muted-foreground text-xs">{t("email")}</div>
          <div className="font-medium">{user?.email}</div>
        </div>
        <div className="pt-2 border-t border-border">
          <Label className="text-xs flex items-center gap-1 mb-1"><Camera className="h-3 w-3" /> {lang === "bn" ? "প্রোফাইল ছবি" : "Profile picture"}</Label>
          <Input type="file" accept="image/*" disabled={uploading} onChange={onAvatarChange} />
        </div>
      </Card>

      {/* Language */}
      <LanguageCard />


      {/* Sound & Haptics */}
      <Card className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {sound ? <Volume2 className="h-5 w-5 text-muted-foreground" /> : <VolumeX className="h-5 w-5 text-muted-foreground" />}
            <span className="font-medium">{lang === "bn" ? "সাউন্ড" : "Sound"}</span>
          </div>
          <button
            onClick={() => { const v = !sound; setSound(v); setSoundEnabled(v); if (v) playClick(); }}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${sound ? "bg-primary" : "bg-muted"}`}
            aria-label="Toggle sound"
          >
            <span className={`inline-block h-5 w-5 transform rounded-full bg-white transition ${sound ? "translate-x-5" : "translate-x-1"}`} />
          </button>
        </div>
        <div className="flex items-center justify-between border-t border-border pt-3">
          <div className="flex items-center gap-3">
            <Vibrate className="h-5 w-5 text-muted-foreground" />
            <span className="font-medium">{lang === "bn" ? "ভাইব্রেশন" : "Haptics"}</span>
          </div>
          <button
            onClick={() => { const v = !haptics; setHaptics(v); setHapticsEnabled(v); if (v) vibrate(30); }}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${haptics ? "bg-primary" : "bg-muted"}`}
            aria-label="Toggle haptics"
          >
            <span className={`inline-block h-5 w-5 transform rounded-full bg-white transition ${haptics ? "translate-x-5" : "translate-x-1"}`} />
          </button>
        </div>
      </Card>

      {/* Change password */}
      <Card className="p-4 space-y-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          <Lock className="h-4 w-4" /> {t("change_password")}
        </div>
        <form onSubmit={onChangePassword} className="space-y-3">
          <div className="space-y-1">
            <Label className="text-xs">{t("new_password")}</Label>
            <Input type="password" value={newPwd} onChange={(e) => setNewPwd(e.target.value)} required minLength={6} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">{t("confirm_password")}</Label>
            <Input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required minLength={6} />
          </div>
          <Button type="submit" className="w-full" disabled={saving}>
            {saving ? "…" : t("change_password")}
          </Button>
        </form>
      </Card>

      {/* Legal */}
      <Card className="p-4 space-y-2">
        <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          <FileText className="h-4 w-4" /> {t("legal")}
        </div>
        <div className="text-sm text-muted-foreground">
          {lang === "bn" ? "এই অ্যাপটি ১৮+ বয়সের জন্য। দায়িত্বশীলভাবে খেলুন।" : "For users 18+. Play responsibly."}
        </div>
        <div className="grid grid-cols-3 gap-2 pt-2">
          <Button variant="outline" size="sm" asChild><Link to="/terms">Terms</Link></Button>
          <Button variant="outline" size="sm" asChild><Link to="/privacy">Privacy</Link></Button>
          <Button variant="outline" size="sm" asChild><Link to="/about">About</Link></Button>
        </div>
        <Button variant="outline" size="sm" className="w-full mt-2" asChild>
          <Link to="/kyc"><BadgeCheck className="h-4 w-4 mr-1" /> KYC verification</Link>
        </Button>
      </Card>

      <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground pt-2">
        <Info className="h-3 w-3" />
        {t("app_version")} 1.0.0
      </div>
    </div>
  );
}

function LanguageCard() {
  const { t, lang, setLang, availableLangs } = useI18n();
  if (availableLangs.length <= 1) return null;
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Globe2 className="h-5 w-5 text-muted-foreground" />
          <span className="font-medium">{t("language")}</span>
        </div>
        <div className="flex gap-1 flex-wrap justify-end">
          {ALL_LANGS.filter((l) => availableLangs.includes(l.code)).map((l) => (
            <Button key={l.code} size="sm" variant={lang === l.code ? "default" : "outline"} onClick={() => setLang(l.code)}>
              {l.native}
            </Button>
          ))}
        </div>
      </div>
    </Card>
  );
}
