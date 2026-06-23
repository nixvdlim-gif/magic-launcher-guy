import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronLeft } from "lucide-react";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/privacy")({
  head: () => ({ meta: [
    { title: "Privacy Policy — ChaleBid" },
    { name: "description", content: "Privacy policy for ChaleBid users." },
  ]}),
  component: PrivacyPage,
});

const sections = [
  {
    h: { bn: "১. তথ্য সংগ্রহ", en: "1. Information we collect" },
    p: {
      bn: "আমরা শুধু সেই তথ্য সংগ্রহ করি যা সেবা প্রদানের জন্য প্রয়োজন: নাম, ইমেইল, ফোন নম্বর (ঐচ্ছিক), KYC ডকুমেন্ট (যদি জমা দেন), পেমেন্ট রেফারেন্স।",
      en: "We collect only the data we need to provide the service: name, email, phone number (optional), KYC documents (if submitted), payment references.",
    },
  },
  {
    h: { bn: "২. তথ্য ব্যবহার", en: "2. How we use information" },
    p: {
      bn: "আপনার তথ্য শুধুমাত্র অ্যাকাউন্ট ব্যবস্থাপনা, পেমেন্ট প্রক্রিয়াকরণ, প্রতারণা প্রতিরোধ এবং সেবা উন্নয়নের জন্য ব্যবহার করা হয়।",
      en: "Your data is used only for account management, payment processing, fraud prevention and service improvements.",
    },
  },
  {
    h: { bn: "৩. তথ্য শেয়ারিং", en: "3. Data sharing" },
    p: {
      bn: "আমরা আপনার ব্যক্তিগত তথ্য কোনো তৃতীয় পক্ষের কাছে বিক্রি করি না। আইনি বাধ্যবাধকতা ছাড়া কোনো তথ্য প্রকাশ করা হয় না।",
      en: "We never sell your personal data to third parties. We only disclose information when legally required.",
    },
  },
  {
    h: { bn: "৪. নিরাপত্তা", en: "4. Security" },
    p: {
      bn: "সব ডেটা এনক্রিপ্টেড সংযোগে স্থানান্তরিত হয়। পাসওয়ার্ড হ্যাশড আকারে সংরক্ষিত।",
      en: "All data is transferred over encrypted connections. Passwords are stored hashed.",
    },
  },
  {
    h: { bn: "৫. কুকিজ", en: "5. Cookies" },
    p: {
      bn: "লগইন সেশন বজায় রাখার জন্য আমরা প্রয়োজনীয় কুকিজ ব্যবহার করি।",
      en: "We use essential cookies to maintain your login session.",
    },
  },
  {
    h: { bn: "৬. বয়স সীমা", en: "6. Age restriction" },
    p: {
      bn: "এই অ্যাপ ১৮ বছরের কম বয়সীদের জন্য নয়।",
      en: "This app is not intended for users under 18.",
    },
  },
  {
    h: { bn: "৭. যোগাযোগ", en: "7. Contact" },
    p: {
      bn: "প্রশ্ন থাকলে support টিকেটের মাধ্যমে যোগাযোগ করুন।",
      en: "For questions, please reach us through a support ticket.",
    },
  },
] as const;

function PrivacyPage() {
  const { lang } = useI18n();
  const bn = lang === "bn";
  return (
    <div className="min-h-screen bg-background flex justify-center">
      <div className="w-full max-w-[720px] px-5 py-6 space-y-4">
        <Link to="/" className="inline-flex items-center text-sm text-muted-foreground"><ChevronLeft className="h-4 w-4" /> {bn ? "ফিরে যান" : "Back"}</Link>
        <h1 className="text-2xl font-bold">{bn ? "প্রাইভেসি পলিসি" : "Privacy Policy"}</h1>
        <p className="text-xs text-muted-foreground">{bn ? "সর্বশেষ আপডেট: ২০২৬" : "Last updated: 2026"}</p>
        <section className="space-y-3 text-sm leading-relaxed">
          {sections.map((s, i) => (
            <div key={i} className="space-y-1">
              <h2 className="text-lg font-semibold">{bn ? s.h.bn : s.h.en}</h2>
              <p>{bn ? s.p.bn : s.p.en}</p>
            </div>
          ))}
        </section>
      </div>
    </div>
  );
}
