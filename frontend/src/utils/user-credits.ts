import type { CreditsBalanceResponse, User } from "@/lib/api";

const CREDIT_KEYS = [
  "credits",
  "valid_credits",
  "available_credits",
  "balance",
  "credit_balance",
  "creditos",
] as const;

const PURCHASE_FLAG_KEYS = [
  "has_active_subscription",
  "has_payment",
  "has_any_purchase",
  "has_purchase_history",
  "has_paid_plan",
  "has_paid",
  "has_lifetime_access",
  "has_lifetime_plan",
] as const;

function isTruthyFlag(value: unknown): boolean {
  if (typeof value === "boolean") {
    return value;
  }
  if (typeof value === "number") {
    return value > 0;
  }
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    return ["true", "1", "yes", "sim"].includes(normalized);
  }
  return false;
}

function parseNumericValue(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string") {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : null;
  }
  if (value && typeof value === "object") {
    for (const key of CREDIT_KEYS) {
      const nested = (value as Record<string, unknown>)[key];
      const numeric = parseNumericValue(nested);
      if (numeric !== null) {
        return numeric;
      }
    }
  }
  return null;
}

function extractCreditsFromRecord(
  record: Record<string, unknown> | null | undefined,
): number {
  if (!record) {
    return 0;
  }

  for (const key of CREDIT_KEYS) {
    const numeric = parseNumericValue(record[key]);
    if (numeric !== null) {
      return numeric;
    }
  }
  return 0;
}

export function extractCreditsFromUser(user: User | null): number {
  if (!user) {
    return 0;
  }
  return extractCreditsFromRecord(user as Record<string, unknown>);
}

export function inferPurchaseFromUser(user: User | null): boolean {
  if (!user) {
    return false;
  }
  if (extractCreditsFromUser(user) > 0) {
    return true;
  }
  const record = user as Record<string, unknown>;
  const referralCreditsEarned = parseNumericValue(record.referral_credits_earned);
  if (typeof referralCreditsEarned === "number" && referralCreditsEarned > 0) {
    return true;
  }
  const purchaseDates = [
    record.last_purchase_at,
    record.first_purchase_at,
    record.purchased_at,
  ];
  if (
    purchaseDates.some(
      (value) => typeof value === "string" && value.trim() !== ""
    )
  ) {
    return true;
  }
  for (const key of PURCHASE_FLAG_KEYS) {
    if (isTruthyFlag(record[key])) {
      return true;
    }
  }
  return false;
}

export function extractCreditsFromBalanceResponse(
  balance: CreditsBalanceResponse | null | undefined,
): number {
  if (typeof balance === "number" && Number.isFinite(balance)) {
    return balance;
  }

  if (Array.isArray(balance)) {
    return 0;
  }

  if (balance && typeof balance === "object") {
    return extractCreditsFromRecord(balance as Record<string, unknown>);
  }

  return 0;
}