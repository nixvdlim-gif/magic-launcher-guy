import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronLeft } from "lucide-react";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/about")({
  head: () => ({ meta: [
    { title: "About — ChaleBid" },
    { name: "description", content: "About ChaleBid — multiplayer Ludo for everyone." },
  ]}),
  component: AboutPage,
});

function AboutPage() {
  const { lang } = useI18n();
  const bn = lang === "bn";
  return (
    <div className="min-h-screen bg-background flex justify-center">
      <div className="w-full max-w-[720px] px-5 py-6 space-y-4">
        <Link to="/" className="inline-flex items-center text-sm text-muted-foreground"><ChevronLeft className="h-4 w-4" /> {bn ? "ফিরে যান" : "Back"}</Link>
        <h1 className="text-2xl font-bold">{bn ? "ChaleBid সম্পর্কে" : "About ChaleBid"}</h1>
        <section className="space-y-3 text-sm leading-relaxed">
          <p>{bn
            ? "ChaleBid — বাংলাদেশের সবচেয়ে জনপ্রিয় মাল্টিপ্লেয়ার লুডু গেম। ক্লাসিক, স্পিড, কুইক ও টাইম মোডে খেলুন এবং রিয়েল টাকা জিতুন।"
            : "ChaleBid — the most popular multiplayer Ludo game. Play Classic, Speed, Quick and Time modes and win real cash."}</p>
          <h2 className="text-lg font-semibold">{bn ? "আমাদের লক্ষ্য" : "Our mission"}</h2>
          <p>{bn
            ? "সবার জন্য একটি ন্যায্য, নিরাপদ এবং আনন্দদায়ক গেমিং অভিজ্ঞতা তৈরি করা।"
            : "To create a fair, safe and enjoyable gaming experience for everyone."}</p>
          <h2 className="text-lg font-semibold">{bn ? "নিরাপত্তা" : "Security"}</h2>
          <p>{bn
            ? "সব লেনদেন এনক্রিপ্টেড। KYC ভেরিফিকেশন বাধ্যতামূলক উইথড্রর জন্য।"
            : "All transactions are encrypted. KYC verification is required for withdrawals."}</p>
          <h2 className="text-lg font-semibold">{bn ? "দায়িত্বশীল গেমিং" : "Responsible gaming"}</h2>
          <p>{bn
            ? "১৮+ বয়সের জন্য। সামর্থ্যের বেশি বাজি ধরবেন না।"
            : "18+ only. Never bet more than you can afford."}</p>
          <p className="text-xs text-muted-foreground pt-4">Version 1.0.0</p>
        </section>
      </div>
    </div>
  );
}
