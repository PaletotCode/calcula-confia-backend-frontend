import { CreditHistoryItem } from "@/lib/api";

export interface ParsedBillMetadata {
  label?: string;
  value?: number;
}

export interface ParsedHistoryMetadata {
  calculationValue?: number;
  creditsUsed?: number;
  bills: ParsedBillMetadata[];
  notes?: string;
}

const numberKeys = [
  "calculation_value",
  "calculationValue",
  "valor_calculado",
  "valorCalculado",
  "result_value",
  "resultado",
  "value",
  "valor",
];

const creditKeys = [
  "credits_used",
  "creditsUsed",
  "creditos",
  "creditos_usados",
  "credits",
];

const billsKeys = [
  "bills",
  "faturas",
  "invoices",
  "documents",
  "documentos",
  "input_bills",
];

function toRecord(value: unknown): Record<string, unknown> | null {
  if (!value) return null;
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch (error) {
      console.warn("Failed to parse history metadata string", error);
    }
    return null;
  }
  if (typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}

function pickNumber(source: Record<string, unknown>, keys: string[]): number | undefined {
  for (const key of keys) {
    const raw = source[key];
    if (raw == null) continue;
    const parsed = Number(raw);
    if (!Number.isNaN(parsed)) {
      return parsed;
    }
  }
  return undefined;
}

function parseBills(source: Record<string, unknown>): ParsedBillMetadata[] {
  for (const key of billsKeys) {
    const value = source[key];
    if (!Array.isArray(value)) continue;
    return value
      .map((entry) => {
        if (!entry || typeof entry !== "object") {
          return null;
        }
        const record = entry as Record<string, unknown>;
        const label =
          (record.label as string | undefined) ||
          (record.reference as string | undefined) ||
          (record.descricao as string | undefined) ||
          (record.description as string | undefined) ||
          (record.issue_date as string | undefined) ||
          (record.data as string | undefined);
        const valueNumber = pickNumber(record, [
          "value",
          "valor",
          "amount",
          "icms",
          "icms_value",
        ]);
        if (label === undefined && valueNumber === undefined) {
          return null;
        }

        const bill: ParsedBillMetadata = {};
        if (label !== undefined) {
          bill.label = label;
        }
        if (valueNumber !== undefined) {
          bill.value = valueNumber;
        }

        return bill;
      })
      .filter((bill): bill is ParsedBillMetadata => bill !== null);
  }
  return [];
}

export function parseHistoryMetadata(item: CreditHistoryItem): ParsedHistoryMetadata {
  const sources: Array<Record<string, unknown> | null> = [
    toRecord(item.metadata ?? null),
    toRecord(item.details ?? null),
    toRecord(item.payload ?? null),
  ];

  const metadata = sources.find((source) => source !== null);
  if (!metadata) {
    return {
      bills: [],
    };
  }

  const calculationValue = pickNumber(metadata, numberKeys);
  const creditsUsed = pickNumber(metadata, creditKeys);
  const bills = parseBills(metadata);
  const notes =
    typeof metadata.notes === "string"
      ? metadata.notes
      : typeof metadata.message === "string"
        ? metadata.message
        : undefined;

  return {
    calculationValue,
    creditsUsed,
    bills,
    notes,
  };
}