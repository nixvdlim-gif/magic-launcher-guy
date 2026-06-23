import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { useCurrency } from "@/lib/currency";

export const Route = createFileRoute("/terms")({
  component: TermsPage,
});

function TermsPage() {
  const { lang } = useI18n();
  const c = useCurrency();
  const bn = lang === "bn";
  return (
    <div className="px-5 pt-6 pb-20 max-w-2xl mx-auto">
      <Button variant="ghost" size="sm" asChild className="mb-3"><Link to="/"><ArrowLeft className="h-4 w-4 mr-1" /> {bn ? "ফিরে যান" : "Back"}</Link></Button>
      <h1 className="text-2xl font-bold mb-4">{bn ? "শর্তাবলি" : "Terms & Conditions"}</h1>
      <div className="prose prose-invert text-sm space-y-3 text-muted-foreground">
        <p>{bn
          ? "ChaleBid ব্যবহার করে আপনি ন্যায্যভাবে খেলতে এবং অনলাইন স্কিল-ভিত্তিক গেমিং সংক্রান্ত স্থানীয় আইন মেনে চলতে সম্মত হচ্ছেন।"
          : "By using ChaleBid you agree to play fairly and follow all local laws regarding online skill-based gaming."}</p>
        <h2 className="text-foreground font-bold mt-4">{bn ? "যোগ্যতা" : "Eligibility"}</h2>
        <p>{bn
          ? "ক্যাশ গেম খেলতে আপনার বয়স ১৮+ হতে হবে। KYC ভেরিফিকেশন প্রয়োজন হতে পারে।"
          : "You must be 18+ to play with cash. KYC verification may be required."}</p>
        <h2 className="text-foreground font-bold mt-4">{bn ? "ডিপোজিট ও উইথড্র" : "Deposits & Withdrawals"}</h2>
        <p>{bn
          ? `উইথড্র রিকোয়েস্ট ২৪ ঘণ্টার মধ্যে প্রসেস করা হয়। সর্বনিম্ন উইথড্র ${c}১০০।`
          : `Withdraw requests are processed within 24 hours. Minimum withdraw ${c}100.`}</p>
        <h2 className="text-foreground font-bold mt-4">{bn ? "ফেয়ার প্লে" : "Fair Play"}</h2>
        <p>{bn
          ? "চিটিং, মাল্টি-অ্যাকাউন্টিং বা যোগসাজশের ফলে স্থায়ী ব্যান এবং ব্যালেন্স বাজেয়াপ্ত হবে।"
          : "Cheating, multi-accounting, or collusion will result in permanent ban and forfeiture of balance."}</p>
        <h2 className="text-foreground font-bold mt-4">{bn ? "রিফান্ড" : "Refunds"}</h2>
        <p>{bn
          ? "ম্যাচ শুরু হয়ে গেলে গেম এন্ট্রি ফি রিফান্ডযোগ্য নয়।"
          : "Game entry fees are non-refundable once a match begins."}</p>
      </div>
    </div>
  );
}
