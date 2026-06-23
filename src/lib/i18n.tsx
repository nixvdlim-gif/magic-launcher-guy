import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";

export type Lang = "bn" | "en" | "hi";

export const ALL_LANGS: { code: Lang; label: string; native: string }[] = [
  { code: "bn", label: "Bangla", native: "বাংলা" },
  { code: "en", label: "English", native: "EN" },
  { code: "hi", label: "Hindi", native: "हिन्दी" },
];

type Entry = { bn: string; en: string; hi?: string };

const dict = {
  // Brand
  app_name: { bn: "ChaleBid", en: "ChaleBid", hi: "ChaleBid" },
  tagline: { bn: "খেলো, জিতো, টাকা কামাও", en: "Play. Win. Earn.", hi: "खेलें, जीतें, कमाएँ" },

  // Auth
  login: { bn: "লগইন", en: "Login", hi: "लॉगिन" },
  signup: { bn: "নিবন্ধন", en: "Sign Up", hi: "साइन अप" },
  logout: { bn: "লগআউট", en: "Logout", hi: "लॉगआउट" },
  email: { bn: "ইমেইল", en: "Email", hi: "ईमेल" },
  password: { bn: "পাসওয়ার্ড", en: "Password", hi: "पासवर्ड" },
  confirm_password: { bn: "পাসওয়ার্ড নিশ্চিত করুন", en: "Confirm password", hi: "पासवर्ड पुष्टि करें" },
  username: { bn: "নাম", en: "Name", hi: "नाम" },
  phone: { bn: "ফোন নম্বর", en: "Phone number", hi: "फ़ोन नंबर" },
  referral_code: { bn: "রেফারেল কোড (ঐচ্ছিক)", en: "Referral code (optional)", hi: "रेफ़रल कोड (वैकल्पिक)" },
  google_signin: { bn: "Google দিয়ে চালিয়ে যান", en: "Continue with Google", hi: "Google से जारी रखें" },
  forgot_password: { bn: "পাসওয়ার্ড ভুলে গেছেন?", en: "Forgot password?", hi: "पासवर्ड भूल गए?" },
  no_account: { bn: "অ্যাকাউন্ট নেই?", en: "No account?", hi: "खाता नहीं है?" },
  have_account: { bn: "অ্যাকাউন্ট আছে?", en: "Have an account?", hi: "खाता है?" },
  create_account: { bn: "অ্যাকাউন্ট তৈরি করুন", en: "Create account", hi: "खाता बनाएँ" },
  or: { bn: "অথবা", en: "or", hi: "या" },
  signing_in: { bn: "লগইন হচ্ছে…", en: "Signing in…", hi: "साइन इन हो रहा है…" },
  signing_up: { bn: "নিবন্ধন হচ্ছে…", en: "Creating account…", hi: "खाता बन रहा है…" },

  // Home / Nav
  home: { bn: "হোম", en: "Home", hi: "होम" },
  wallet: { bn: "ওয়ালেট", en: "Wallet", hi: "वॉलेट" },
  games: { bn: "গেম", en: "Games", hi: "गेम्स" },
  leaderboard: { bn: "লিডারবোর্ড", en: "Leaderboard", hi: "लीडरबोर्ड" },
  profile: { bn: "প্রোফাইল", en: "Profile", hi: "प्रोफ़ाइल" },

  // Wallet / actions
  total_balance: { bn: "মোট ব্যালেন্স", en: "Total Balance", hi: "कुल बैलेंस" },
  deposit_balance: { bn: "ডিপোজিট", en: "Deposit", hi: "जमा" },
  winnings_balance: { bn: "জিতেছেন", en: "Winnings", hi: "जीत" },
  add_cash: { bn: "টাকা যোগ", en: "Add Cash", hi: "पैसे जोड़ें" },
  withdraw: { bn: "উইথড্র", en: "Withdraw", hi: "निकालें" },
  refer_earn: { bn: "রেফার ও আয়", en: "Refer & Earn", hi: "रेफ़र करें और कमाएँ" },
  support: { bn: "সাপোর্ট", en: "Support", hi: "सहायता" },

  // Game types
  classic_ludo: { bn: "ক্লাসিক লুডু", en: "Classic Ludo", hi: "क्लासिक लूडो" },
  speed_ludo: { bn: "স্পিড লুডু", en: "Speed Ludo", hi: "स्पीड लूडो" },
  quick_ludo: { bn: "কুইক লুডু", en: "Quick Ludo", hi: "क्विक लूडो" },
  time_ludo: { bn: "টাইম লুডু", en: "Time Ludo", hi: "टाइम लूडो" },
  play: { bn: "খেলুন", en: "Play", hi: "खेलें" },
  coming_soon: { bn: "শীঘ্রই আসছে", en: "Coming Soon", hi: "जल्द आ रहा है" },

  // Profile
  game_id: { bn: "গেম আইডি", en: "Game ID", hi: "गेम आईडी" },
  copied: { bn: "কপি হয়েছে", en: "Copied", hi: "कॉपी हो गया" },
  level: { bn: "লেভেল", en: "Level", hi: "लेवल" },
  total_games: { bn: "মোট গেম", en: "Total Games", hi: "कुल गेम" },
  wins: { bn: "জয়", en: "Wins", hi: "जीत" },
  losses: { bn: "হার", en: "Losses", hi: "हार" },
  win_rate: { bn: "জয়ের হার", en: "Win rate", hi: "जीत दर" },
  language: { bn: "ভাষা", en: "Language", hi: "भाषा" },

  // Misc
  welcome_back: { bn: "আবার স্বাগতম", en: "Welcome back", hi: "वापसी पर स्वागत है" },
  hello: { bn: "হ্যালো", en: "Hello", hi: "नमस्ते" },
  notifications: { bn: "নোটিফিকেশন", en: "Notifications", hi: "सूचनाएँ" },
  no_notifications: { bn: "কোনো নোটিফিকেশন নেই", en: "No notifications yet", hi: "अभी कोई सूचना नहीं" },
  loading: { bn: "লোড হচ্ছে…", en: "Loading…", hi: "लोड हो रहा है…" },

  // Wallet / payments
  payment_method: { bn: "পেমেন্ট মাধ্যম", en: "Payment Method", hi: "भुगतान विधि" },
  amount: { bn: "পরিমাণ", en: "Amount", hi: "राशि" },
  sender_number: { bn: "যে নাম্বার থেকে পাঠিয়েছেন", en: "Sender number", hi: "भेजने वाला नंबर" },
  receive_number: { bn: "এই নাম্বারে পাঠান", en: "Send to this number", hi: "इस नंबर पर भेजें" },
  txn_id: { bn: "ট্রানজেকশন আইডি (TrxID)", en: "Transaction ID (TrxID)", hi: "लेन-देन आईडी (TrxID)" },
  account_name: { bn: "অ্যাকাউন্ট নাম", en: "Account name", hi: "खाता नाम" },
  account_number: { bn: "অ্যাকাউন্ট নাম্বার", en: "Account number", hi: "खाता संख्या" },
  bank_name: { bn: "ব্যাংকের নাম", en: "Bank name", hi: "बैंक का नाम" },
  submit_request: { bn: "রিকোয়েস্ট জমা দিন", en: "Submit Request", hi: "अनुरोध जमा करें" },
  submitting: { bn: "জমা হচ্ছে…", en: "Submitting…", hi: "जमा हो रहा है…" },
  cancel: { bn: "বাতিল", en: "Cancel", hi: "रद्द करें" },
  request_sent: { bn: "রিকোয়েস্ট পাঠানো হয়েছে — অনুমোদনের জন্য অপেক্ষা করুন।", en: "Request submitted — awaiting approval.", hi: "अनुरोध जमा — मंज़ूरी की प्रतीक्षा है।" },
  withdraw_balance_low: { bn: "যথেষ্ট ব্যালেন্স নেই।", en: "Insufficient balance.", hi: "अपर्याप्त बैलेंस।" },
  min_max_amount: { bn: "পরিমাণ {min} থেকে {max} এর মধ্যে হতে হবে।", en: "Amount must be between {min} and {max}.", hi: "राशि {min} से {max} के बीच होनी चाहिए।" },
  no_transactions: { bn: "এখনো কোনো লেনদেন নেই।", en: "No transactions yet.", hi: "अभी कोई लेन-देन नहीं।" },
  history: { bn: "লেনদেন ইতিহাস", en: "Transaction history", hi: "लेन-देन इतिहास" },
  pending: { bn: "অপেক্ষমান", en: "Pending", hi: "लंबित" },
  approved: { bn: "অনুমোদিত", en: "Approved", hi: "स्वीकृत" },
  rejected: { bn: "প্রত্যাখ্যাত", en: "Rejected", hi: "अस्वीकृत" },
  completed: { bn: "সম্পন্ন", en: "Completed", hi: "पूर्ण" },
  cancelled: { bn: "বাতিল", en: "Cancelled", hi: "रद्द" },
  type_deposit: { bn: "ডিপোজিট", en: "Deposit", hi: "जमा" },
  type_withdraw: { bn: "উইথড্র", en: "Withdraw", hi: "निकासी" },
  type_game_entry: { bn: "গেম এন্ট্রি", en: "Game entry", hi: "गेम एंट्री" },
  type_game_win: { bn: "প্রাইজ", en: "Prize", hi: "इनाम" },
  type_refund: { bn: "রিফান্ড", en: "Refund", hi: "रिफ़ंड" },
  type_referral_bonus: { bn: "রেফারেল বোনাস", en: "Referral bonus", hi: "रेफ़रल बोनस" },
  type_bonus: { bn: "বোনাস", en: "Bonus", hi: "बोनस" },

  type_admin_adjust: { bn: "এডমিন সমন্বয়", en: "Admin adjust", hi: "एडमिन समायोजन" },
  copy: { bn: "কপি", en: "Copy", hi: "कॉपी" },
  important_notice: { bn: "গুরুত্বপূর্ণ", en: "Important", hi: "महत्वपूर्ण" },

  // Admin
  admin_panel: { bn: "এডমিন প্যানেল", en: "Admin Panel", hi: "एडमिन पैनल" },
  claim_admin: { bn: "প্রথম এডমিন হোন", en: "Claim First Admin" },
  admin_claimed: { bn: "এডমিন অধিকার পেয়েছেন", en: "Admin role granted" },
  admin_exists: { bn: "এডমিন ইতিমধ্যে আছে", en: "Admin already exists" },
  pending_deposits: { bn: "অপেক্ষমান ডিপোজিট", en: "Pending Deposits" },
  pending_withdraws: { bn: "অপেক্ষমান উইথড্র", en: "Pending Withdraws" },
  users_tab: { bn: "ইউজার", en: "Users" },
  settings_tab: { bn: "সেটিংস", en: "Settings" },
  approve: { bn: "অনুমোদন", en: "Approve" },
  reject: { bn: "প্রত্যাখ্যান", en: "Reject" },
  approved_msg: { bn: "অনুমোদিত হয়েছে", en: "Approved" },
  rejected_msg: { bn: "প্রত্যাখ্যান করা হয়েছে", en: "Rejected" },
  no_pending: { bn: "কোনো অপেক্ষমান নেই", en: "Nothing pending" },
  block: { bn: "ব্লক", en: "Block" },
  unblock: { bn: "আনব্লক", en: "Unblock" },
  blocked: { bn: "ব্লকড", en: "Blocked" },
  search: { bn: "খুঁজুন…", en: "Search…" },
  save: { bn: "সংরক্ষণ", en: "Save" },
  saved: { bn: "সংরক্ষিত", en: "Saved" },
  edit: { bn: "এডিট", en: "Edit" },
  enabled: { bn: "চালু", en: "Enabled" },
  disabled: { bn: "বন্ধ", en: "Disabled" },
  min_amount: { bn: "ন্যূনতম পরিমাণ", en: "Min amount" },
  max_amount: { bn: "সর্বোচ্চ পরিমাণ", en: "Max amount" },
  instructions_label: { bn: "নির্দেশনা", en: "Instructions" },
  receive_number_label: { bn: "প্রাপ্তি নাম্বার", en: "Receive number" },

  // Transactions / Filters
  transactions: { bn: "লেনদেন", en: "Transactions", hi: "लेन-देन" },
  all: { bn: "সব", en: "All", hi: "सभी" },
  filter_by_type: { bn: "ধরন অনুযায়ী", en: "Filter by type", hi: "प्रकार के अनुसार" },
  type_transfer_in: { bn: "পেয়েছেন (ট্রান্সফার)", en: "Received (Transfer)", hi: "प्राप्त (ट्रांसफ़र)" },
  type_transfer_out: { bn: "পাঠানো (ট্রান্সফার)", en: "Sent (Transfer)", hi: "भेजा (ट्रांसफ़र)" },

  // Transfer
  transfer: { bn: "ব্যালেন্স ট্রান্সফার", en: "Balance Transfer", hi: "बैलेंस ट्रांसफ़र" },
  recipient_game_id: { bn: "প্রাপকের গেম আইডি", en: "Recipient Game ID", hi: "प्राप्तकर्ता गेम आईडी" },
  find_user: { bn: "ইউজার খুঁজুন", en: "Find user", hi: "उपयोगकर्ता खोजें" },
  user_not_found: { bn: "ইউজার পাওয়া যায়নি", en: "User not found", hi: "उपयोगकर्ता नहीं मिला" },
  fee: { bn: "চার্জ", en: "Fee", hi: "शुल्क" },
  recipient_gets: { bn: "প্রাপক পাবেন", en: "Recipient gets", hi: "प्राप्तकर्ता को मिलेगा" },
  send_now: { bn: "এখন পাঠান", en: "Send Now", hi: "अभी भेजें" },
  transfer_success: { bn: "ট্রান্সফার সফল!", en: "Transfer successful!", hi: "ट्रांसफ़र सफल!" },
  transfer_history: { bn: "ট্রান্সফার ইতিহাস", en: "Transfer history", hi: "ट्रांसफ़र इतिहास" },
  sent: { bn: "পাঠানো", en: "Sent", hi: "भेजा" },
  received: { bn: "প্রাপ্ত", en: "Received", hi: "प्राप्त" },

  // Referral
  referral: { bn: "রেফারেল", en: "Referral", hi: "रेफ़रल" },
  my_referral_code: { bn: "আমার রেফারেল কোড", en: "My referral code", hi: "मेरा रेफ़रल कोड" },
  share: { bn: "শেয়ার", en: "Share", hi: "साझा करें" },
  total_referred: { bn: "মোট রেফার", en: "Total referred", hi: "कुल रेफ़र" },
  total_earned: { bn: "মোট আয়", en: "Total earned", hi: "कुल कमाई" },
  commission_rates: { bn: "কমিশন হার", en: "Commission rates", hi: "कमीशन दर" },
  no_referrals: { bn: "এখনো কেউ যোগ দেয়নি", en: "No one has signed up yet", hi: "अभी तक कोई शामिल नहीं हुआ" },
  earnings_history: { bn: "আয়ের ইতিহাস", en: "Earnings history", hi: "कमाई इतिहास" },

  // Settings
  settings: { bn: "সেটিংস", en: "Settings", hi: "सेटिंग्स" },
  account: { bn: "অ্যাকাউন্ট", en: "Account", hi: "खाता" },
  change_password: { bn: "পাসওয়ার্ড পরিবর্তন", en: "Change Password", hi: "पासवर्ड बदलें" },
  current_password: { bn: "বর্তমান পাসওয়ার্ড", en: "Current password", hi: "वर्तमान पासवर्ड" },
  new_password: { bn: "নতুন পাসওয়ার্ড", en: "New password", hi: "नया पासवर्ड" },
  password_updated: { bn: "পাসওয়ার্ড আপডেট হয়েছে", en: "Password updated", hi: "पासवर्ड अपडेट हुआ" },
  legal: { bn: "আইন", en: "Legal", hi: "कानूनी" },
  app_version: { bn: "অ্যাপ ভার্সন", en: "App version", hi: "ऐप संस्करण" },

  // Forgot password
  reset_password: { bn: "পাসওয়ার্ড রিসেট", en: "Reset Password", hi: "पासवर्ड रीसेट" },
  send_reset_link: { bn: "রিসেট লিংক পাঠান", en: "Send reset link", hi: "रीसेट लिंक भेजें" },
  reset_email_sent: { bn: "ইমেইল পাঠানো হয়েছে — ইনবক্স দেখুন।", en: "Email sent — check your inbox.", hi: "ईमेल भेजा — इनबॉक्स देखें।" },
  back_to_login: { bn: "লগইনে ফিরে যান", en: "Back to login", hi: "लॉगिन पर वापस" },
} as const satisfies Record<string, Entry>;

export type DictKey = keyof typeof dict;

const STORAGE_KEY = "lc:lang";
const DEFAULT_AVAILABLE: Record<Lang, boolean> = { bn: false, en: true, hi: false };

type Ctx = {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (k: DictKey) => string;
  availableLangs: Lang[];
};
const I18nContext = createContext<Ctx | null>(null);

function pickInitial(available: Record<Lang, boolean>): Lang {
  return available.en ? "en" : "en";
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [available, setAvailable] = useState<Record<Lang, boolean>>(DEFAULT_AVAILABLE);
  const [lang, setLangState] = useState<Lang>("en");

  useEffect(() => {
    let active = true;
    const load = async () => {
      const { data } = await supabase.from("app_settings").select("value").eq("key", "languages").maybeSingle();
      if (!active) return;
      const raw = (data?.value as any) ?? {};
      const next: Record<Lang, boolean> = {
        bn: false,
        en: raw.en !== false,
        hi: false,
      };
      // ensure at least one enabled
      if (!next.bn && !next.en && !next.hi) next.en = true;
      setAvailable(next);
      setLangState((cur) => (next[cur] ? cur : pickInitial(next)));
    };
    load();
    setLangState(pickInitial(DEFAULT_AVAILABLE));
    const ch = supabase
      .channel("app_settings_languages")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "app_settings", filter: "key=eq.languages" },
        () => load(),
      )
      .subscribe();
    return () => {
      active = false;
      supabase.removeChannel(ch);
    };
  }, []);

  const setLang = (l: Lang) => {
    setLangState("en");
    if (typeof window !== "undefined") window.localStorage.setItem(STORAGE_KEY, "en");
  };

  const t = (k: DictKey) => {
    const e = dict[k] as Entry | undefined;
    return e?.en ?? String(k);
  };


  const availableLangs: Lang[] = ["en"];

  return (
    <I18nContext.Provider value={{ lang, setLang, t, availableLangs }}>{children}</I18nContext.Provider>
  );
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used inside <I18nProvider>");
  return ctx;
}
