"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { LucideIcon } from "@/components/LucideIcon";
import { getDetailedHistory, type DetailedHistoryItem } from "@/lib/api";

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

function toNumber(value: unknown): number | null {
  if (value == null) return null;
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value.replace(/,/g, "."));
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function formatCredits(value: unknown) {
  const numeric = toNumber(value);
  if (numeric == null) {
    return "--";
  }
  const formatted = new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(numeric);
  const suffix = Math.abs(numeric) === 1 ? "crédito" : "créditos";
  return `${formatted} ${suffix}`;
}

function formatDateTime(value: string | undefined | null) {
  if (!value) return "--";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "--";
  }
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function formatDate(value: string | undefined | null) {
  if (!value) return "--";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "--";
  }
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(date);
}

function toTimestamp(value: string | null | undefined): number {
  if (!value) return 0;
  const d = new Date(value);
  const t = d.getTime();
  return Number.isNaN(t) ? 0 : t;
}

export default function CreditsHistory() {
  const historyQuery = useQuery<DetailedHistoryItem[]>({
    queryKey: ["detailed-history", { limit: 100, offset: 0, scope: "credits" }],
    queryFn: () => getDetailedHistory({ limit: 100, offset: 0 }),
  });

  const [expandedId, setExpandedId] = useState<string | number | null>(null);

  const sortedHistory = useMemo(() => {
    if (!historyQuery.data) return [] as DetailedHistoryItem[];
    return [...historyQuery.data].sort(
      (a, b) => toTimestamp(b.created_at) - toTimestamp(a.created_at)
    );
  }, [historyQuery.data]);

  const toggleCard = (id: string | number) => {
    setExpandedId((previous) => (previous === id ? null : id));
  };

  return (
    <div className="flex h-full min-h-[calc(100vh-140px)] w-full items-center justify-center bg-gradient-to-br from-slate-100 via-white to-slate-200 px-4 pb-24 pt-12 md:pb-28">
      <div className="flex w-full max-w-4xl flex-col gap-6">
        <header className="text-left">
          <p className="text-sm font-medium uppercase tracking-wide text-indigo-600">Histórico</p>
          <h1 className="text-3xl font-bold text-slate-900 md:text-4xl">Histórico completo de cálculos</h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-600 md:text-base">
            Revise cada simulação concluída e confira rapidamente o valor estimado recuperado. Expanda qualquer item para visualizar as faturas utilizadas e os detalhes adicionais do cálculo.
          </p>
        </header>

        <div className="flex-1 overflow-hidden rounded-3xl bg-white/80 p-4 shadow-xl ring-1 ring-slate-200 md:p-6">
          {historyQuery.isLoading ? (
            <div className="flex h-full min-h-[200px] items-center justify-center text-sm text-slate-500">
              Carregando histórico...
            </div>
          ) : historyQuery.isError ? (
            <div className="flex h-full min-h-[200px] flex-col items-center justify-center gap-3 text-center">
              <p className="text-sm font-medium text-red-500">Não foi possível carregar o histórico de créditos.</p>
              <button
                type="button"
                className="rounded-full bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700"
                onClick={() => historyQuery.refetch()}
              >
                Tentar novamente
              </button>
            </div>
          ) : sortedHistory.length === 0 ? (
            <div className="flex h-full min-h-[200px] flex-col items-center justify-center gap-2 text-center">
              <LucideIcon name="Inbox" className="h-10 w-10 text-slate-400" />
              <p className="text-sm font-medium text-slate-500">Nenhum cálculo encontrado.</p>
            </div>
          ) : (
            <div className="flex h-full flex-col gap-3 overflow-y-auto pr-1">
              {sortedHistory.map((item) => {
                const isExpanded = expandedId === item.id;
                const calculationValue = toNumber(item.calculated_value) ?? 0;
                const creditsUsed = toNumber(item.credits_used);
                const bills = Array.isArray(item.bills) ? item.bills : [];
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => toggleCard(item.id)}
                    className="group flex flex-col gap-3 rounded-2xl bg-slate-50/80 p-4 text-left shadow-sm ring-1 ring-slate-100 transition hover:-translate-y-0.5 hover:bg-white hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-sm font-semibold text-slate-900 md:text-base">Simulação #{item.id}</p>
                        <p className="text-xs text-slate-500 md:text-sm">{formatDateTime(item.created_at)}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-base font-semibold text-emerald-600 md:text-lg">
                          {formatCurrency(Math.max(0, calculationValue))}
                        </p>
                        <p className="text-xs text-slate-500">
                          Créditos utilizados: {creditsUsed != null ? formatCredits(creditsUsed) : "--"}
                        </p>
                        <p className="text-xs text-slate-500">Faturas: {bills.length}</p>
                      </div>
                    </div>

                    <div className={`grid gap-3 text-sm text-slate-600 transition-all duration-300 ${isExpanded ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-70"}`}>
                      <div className="overflow-hidden">
                        <div className="rounded-2xl bg-white/80 p-4 ring-1 ring-slate-100">
                          <div className="flex flex-col gap-4">
                            <div className="grid gap-1 text-right text-xs text-slate-500 md:text-sm">
                              <span>
                                <span className="font-semibold text-slate-700">Criado em:</span> {formatDateTime(item.created_at)}
                              </span>
                              {creditsUsed != null ? (
                                <span>
                                  <span className="font-semibold text-slate-700">Créditos consumidos:</span> {formatCredits(creditsUsed)}
                                </span>
                              ) : null}
                            </div>
                            {bills.length > 0 ? (
                              <div className="space-y-2">
                                <p className="text-xs uppercase tracking-wide text-slate-500">Faturas analisadas</p>
                                <div className="grid gap-2">
                                  {bills.map((bill, index) => {
                                    const formattedDate = formatDate(bill.issue_date);
                                    const billValue = toNumber(bill.icms_value);
                                    return (
                                      <div
                                        key={`${item.id}-bill-${index}`}
                                        className="flex items-center justify-between rounded-xl bg-slate-50/80 px-3 py-2"
                                      >
                                        <span className="text-sm font-medium text-slate-700">
                                          {formattedDate !== "--" ? formattedDate : `Fatura ${index + 1}`}
                                        </span>
                                        <span className="text-xs font-semibold text-slate-500">
                                          {billValue != null ? formatCurrency(billValue) : "--"}
                                        </span>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            ) : (
                              <div className="rounded-xl bg-slate-50/80 p-3 text-xs text-slate-500">
                                Nenhuma fatura disponível para esta simulação.
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-end gap-2 text-xs font-medium text-indigo-600">
                      <span>{isExpanded ? "Recolher detalhes" : "Ver detalhes"}</span>
                      <LucideIcon
                        name={isExpanded ? "ChevronUp" : "ChevronDown"}
                        className="h-4 w-4 transition-transform group-hover:translate-y-0.5"
                      />
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
