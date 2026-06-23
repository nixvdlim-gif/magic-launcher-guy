import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";

type CurrencyValue = { symbol: string; code: string };

const DEFAULT: CurrencyValue = { symbol: "৳", code: "BDT" };

const CurrencyContext = createContext<CurrencyValue>(DEFAULT);

// Module-level cache so non-component code (template literals in helpers) can read it.
let _current: CurrencyValue = DEFAULT;
export function getCurrencySymbol() {
  return _current.symbol;
}

export function CurrencyProvider({ children }: { children: ReactNode }) {
  const [value, setValue] = useState<CurrencyValue>(_current);

  useEffect(() => {
    let active = true;
    const load = async () => {
      const { data } = await supabase
        .from("app_settings")
        .select("value")
        .eq("key", "currency")
        .maybeSingle();
      if (!active) return;
      const v = (data?.value as CurrencyValue | null) ?? DEFAULT;
      const next = { symbol: v.symbol || "৳", code: v.code || "BDT" };
      _current = next;
      setValue(next);
    };
    load();

    const channel = supabase
      .channel("app_settings_currency")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "app_settings", filter: "key=eq.currency" },
        () => load(),
      )
      .subscribe();
    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, []);

  return <CurrencyContext.Provider value={value}>{children}</CurrencyContext.Provider>;
}

export function useCurrency() {
  return useContext(CurrencyContext).symbol;
}

export function useCurrencyInfo() {
  return useContext(CurrencyContext);
}

// Common world currencies for the admin picker.
export const CURRENCY_PRESETS: CurrencyValue[] = [
  { symbol: "৳", code: "BDT" },
  { symbol: "$", code: "USD" },
  { symbol: "€", code: "EUR" },
  { symbol: "£", code: "GBP" },
  { symbol: "₹", code: "INR" },
  { symbol: "₨", code: "PKR" },
  { symbol: "₺", code: "TRY" },
  { symbol: "₽", code: "RUB" },
  { symbol: "¥", code: "JPY" },
  { symbol: "¥", code: "CNY" },
  { symbol: "₩", code: "KRW" },
  { symbol: "₦", code: "NGN" },
  { symbol: "R", code: "ZAR" },
  { symbol: "د.إ", code: "AED" },
  { symbol: "﷼", code: "SAR" },
  { symbol: "QR", code: "QAR" },
  { symbol: "KD", code: "KWD" },
  { symbol: "RM", code: "MYR" },
  { symbol: "S$", code: "SGD" },
  { symbol: "฿", code: "THB" },
  { symbol: "₫", code: "VND" },
  { symbol: "Rp", code: "IDR" },
  { symbol: "₱", code: "PHP" },
  { symbol: "C$", code: "CAD" },
  { symbol: "A$", code: "AUD" },
  { symbol: "NZ$", code: "NZD" },
  { symbol: "CHF", code: "CHF" },
  { symbol: "kr", code: "SEK" },
  { symbol: "kr", code: "NOK" },
  { symbol: "kr", code: "DKK" },
  { symbol: "zł", code: "PLN" },
  { symbol: "₪", code: "ILS" },
  { symbol: "EGP", code: "EGP" },
  { symbol: "৳", code: "Custom" },
];
