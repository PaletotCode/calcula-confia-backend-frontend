"use client";

import { useCallback, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import clsx from "clsx";

import { LucideIcon } from "@/components/LucideIcon";
import {
  getDetailedHistory,
  type DetailedHistoryItem,
} from "@/lib/api";

import FullscreenModal from "./FullscreenModal";
import FullscreenSlides, { type Slide } from "./FullscreenSlides";
import type { SlidesNavigationStateChange } from "./slides-navigation";
import { mobileSlideCardBase, mobileSlideCardWide, mobileSlideSectionSpacing } from "../mobile";

interface HistoryPageProps {
  onSlideStateChange?: SlidesNavigationStateChange;
}

const currencyFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

const integerFormatter = new Intl.NumberFormat("pt-BR", {
  maximumFractionDigits: 0,
});

function toNumber(value: unknown): number | null {
  if (value == null) return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  return parsed;
}

function formatCurrency(value: unknown): string {
  const numeric = toNumber(value);
  if (numeric == null) {
    return "--";
  }
  return currencyFormatter.format(numeric);
}

function formatInteger(value: number, isLoading: boolean): string {
  if (isLoading) {
    return "--";
  }
  return integerFormatter.format(value);
}

function formatDateTime(value: string | null | undefined): string {
  if (!value) return "--";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "--";
  }
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function formatBillDate(value: string | null | undefined): string {
  if (!value) return "--";
  const date = new Date(value);
  if (!Number.isNaN(date.getTime())) {
    return new Intl.DateTimeFormat("pt-BR", {
      month: "long",
      year: "numeric",
    }).format(date);
  }

  const [year, month] = value.split("-");
  if (year && month) {
    const fallbackDate = new Date(Number(year), Number(month) - 1, 1);
    if (!Number.isNaN(fallbackDate.getTime())) {
      return new Intl.DateTimeFormat("pt-BR", {
        month: "long",
        year: "numeric",
      }).format(fallbackDate);
    }
  }

  return value;
}

const queryLimit = 50;

export default function HistoryPage({ onSlideStateChange }: HistoryPageProps) {
  const [showModal, setShowModal] = useState(false);
  const [expandedId, setExpandedId] = useState<string | number | null>(null);

  const historyQuery = useQuery<DetailedHistoryItem[]>({
    queryKey: ["detailed-history", { limit: queryLimit, offset: 0 }],
    queryFn: () => getDetailedHistory({ limit: queryLimit, offset: 0 }),
  });

  const {
    isLoading: isHistoryLoading,
    isError: isHistoryError,
    refetch: refetchHistory,
  } = historyQuery;

  const sortedHistory = useMemo(() => {
    if (!historyQuery.data) return [] as DetailedHistoryItem[];
    return [...historyQuery.data].sort((a, b) => {
      const timeA = a.created_at ? new Date(a.created_at).getTime() : 0;
      const timeB = b.created_at ? new Date(b.created_at).getTime() : 0;
      return timeB - timeA;
    });
  }, [historyQuery.data]);

  const metrics = useMemo(() => {
    const totalCalculations = sortedHistory.length;
    const creditsSum = sortedHistory.reduce((sum, item) => {
      const credits = toNumber(item.credits_used);
      return sum + (credits ?? 0);
    }, 0);
    const hasCreditsData = sortedHistory.some((item) => toNumber(item.credits_used) != null);

    return {
      totalCalculations,
      totalCreditsUsed: hasCreditsData ? creditsSum : totalCalculations,
    };
  }, [sortedHistory]);

  const recentHistory = useMemo(() => sortedHistory.slice(0, 4), [sortedHistory]);

  const toggleExpanded = useCallback((id: string | number) => {
    setExpandedId((previous) => (previous === id ? null : id));
  }, []);

  const slides: Slide[] = useMemo(
    () => [
      {
        id: "history-overview",
        ariaLabel: "Histórico de cálculos consolidado",
        content: (
          <div className={clsx(mobileSlideCardBase, "text-center")}>
            <div className={mobileSlideSectionSpacing}>
              <h1 className="text-2xl font-bold text-slate-900 md:text-4xl">Histórico de Cálculos</h1>
              <p className="text-sm text-slate-600 md:text-base">
                Visualize métricas consolidadas e explore os detalhes de cada simulação.
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="group flex flex-col gap-5 rounded-[24px] border border-indigo-100/70 bg-white/90 p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-indigo-200 hover:shadow-xl">
                <div className="flex items-center justify-between gap-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.3em] text-indigo-600">
                    Total de cálculos
                  </p>
                  <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-500/10 text-indigo-600">
                    <LucideIcon name="ChartBar" className="h-6 w-6" />
                  </span>
                </div>
                <p className="text-3xl font-semibold text-slate-900 md:text-4xl">
                  {formatInteger(metrics.totalCalculations, isHistoryLoading)}
                </p>
                <p className="text-sm text-slate-500">Total de registros processados.</p>
              </div>

              <div className="group flex flex-col gap-5 rounded-[24px] border border-indigo-100/70 bg-white/90 p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-indigo-200 hover:shadow-xl">
                <div className="flex items-center justify-between gap-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.3em] text-indigo-600">
                    Créditos utilizados
                  </p>
                  <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-500/10 text-indigo-600">
                    <LucideIcon name="Coins" className="h-6 w-6" />
                  </span>
                </div>
                <p className="text-3xl font-semibold text-slate-900 md:text-4xl">
                  {formatInteger(Math.round(metrics.totalCreditsUsed), isHistoryLoading)}
                </p>
                <p className="text-sm text-slate-500">Total de créditos consumidos.</p>
              </div>
            </div>
          </div>
        ),
      },
      {
        id: "history-recent",
        ariaLabel: "Últimos cálculos realizados",
        content: (
          <div className={clsx(mobileSlideCardWide, "text-left")}>
            <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
              <div className={mobileSlideSectionSpacing}>
                <p className="text-xs font-semibold uppercase tracking-[0.3em] text-indigo-600">
                  Últimos cálculos
                </p>
                <h2 className="text-2xl font-semibold text-slate-900 md:text-3xl">Últimos cálculos</h2>
                <p className="text-sm text-slate-600 md:text-base">
                  Confira os cálculos mais recentes processados pela plataforma.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowModal(true)}
                className="inline-flex items-center justify-center gap-2 rounded-full bg-indigo-600 px-5 py-2 text-sm font-semibold text-white shadow-lg transition hover:bg-indigo-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300"
              >
                Ver todos
                <LucideIcon name="ArrowUpRight" className="h-4 w-4" />
              </button>
            </div>

            <div className="grid gap-3 md:gap-4 md:grid-cols-2">
              {isHistoryLoading
                ? Array.from({ length: 4 }).map((_, index) => (
                    <div
                      key={`loading-${index}`}
                      className={clsx(
                        "rounded-[24px] border border-indigo-100/70 bg-white/75 p-5 shadow-sm",
                        index > 0 ? "hidden md:block" : "block",
                      )}
                    >
                      <div className="flex animate-pulse flex-col gap-4">
                        <div className="h-4 w-28 rounded bg-slate-200" />
                        <div className="h-7 w-40 rounded bg-slate-200" />
                        <div className="h-3 w-24 rounded bg-slate-200" />
                        <div className="h-3 w-20 rounded bg-slate-200" />
                      </div>
                    </div>
                  ))
                : isHistoryError
                ? (
                    <div className="col-span-full flex flex-col items-center gap-3 rounded-[24px] border border-red-100 bg-white/90 p-5 text-center shadow-sm">
                      <p className="text-sm font-semibold text-red-500">
                        Não foi possível carregar os cálculos recentes.
                      </p>
                      <button
                        type="button"
                        onClick={() => refetchHistory()}
                        className="rounded-full bg-red-500 px-4 py-2 text-xs font-semibold text-white transition hover:bg-red-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-300"
                      >
                        Tentar novamente
                      </button>
                    </div>
                  )
                : recentHistory.length === 0
                ? (
                    <div className="col-span-full flex flex-col items-center justify-center gap-3 rounded-[24px] border border-indigo-100/70 bg-white/90 p-6 text-center shadow-sm">
                      <LucideIcon name="Inbox" className="h-10 w-10 text-slate-400" />
                      <p className="text-sm font-medium text-slate-500">
                        Nenhum cálculo encontrado até o momento.
                      </p>
                    </div>
                  )
                : recentHistory.map((item, index) => {
                    const billsCount = item.bills?.length ?? 0;
                    const creditsUsed = toNumber(item.credits_used);

                    return (
                      <div
                        key={item.id ?? `recent-${index}`}
                        className={clsx(
                          "group h-full rounded-[24px] border border-indigo-100/70 bg-white/90 p-5 text-left shadow-sm transition hover:-translate-y-1 hover:border-indigo-200 hover:shadow-xl",
                          index > 0 ? "hidden md:flex md:flex-col md:justify-between" : "flex flex-col justify-between",
                        )}
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="space-y-2">
                            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-indigo-600">
                              Simulação
                            </p>
                            <p className="text-2xl font-semibold text-slate-900">
                              {formatCurrency(item.calculated_value)}
                            </p>
                            <p className="text-sm text-slate-500">{formatDateTime(item.created_at)}</p>
                          </div>
                          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-500/10 text-indigo-600">
                            <LucideIcon name="Calculator" className="h-6 w-6" />
                          </span>
                        </div>

                        <div className="mt-6 flex items-center justify-between text-sm text-slate-600">
                          <span>
                            {integerFormatter.format(billsCount)} {billsCount === 1 ? "fatura" : "faturas"}
                          </span>
                          {creditsUsed != null ? (
                            <span className="font-semibold text-slate-700">
                              {integerFormatter.format(creditsUsed)} {creditsUsed === 1 ? "crédito" : "créditos"}
                            </span>
                          ) : null}
                        </div>
                      </div>
                    );
                  })}
            </div>
          </div>
        ),
      },
    ],
    [
      isHistoryError,
      isHistoryLoading,
      refetchHistory,
      metrics.totalCalculations,
      metrics.totalCreditsUsed,
      recentHistory,
    ],
  );

  return (
    <>
      <FullscreenSlides slides={slides} onSlideStateChange={onSlideStateChange} />

      <FullscreenModal open={showModal} onClose={() => setShowModal(false)} title="Todos os cálculos">
        <div className="max-h-[70vh] space-y-4 overflow-y-auto pr-1">
          {isHistoryLoading ? (
            <div className="flex h-48 items-center justify-center text-sm text-slate-500">
              Carregando histórico detalhado...
            </div>
          ) : isHistoryError ? (
            <div className="flex flex-col items-center justify-center gap-3 rounded-3xl bg-white/90 p-6 text-center shadow-sm ring-1 ring-red-200">
              <p className="text-sm font-semibold text-red-500">Não foi possível carregar o histórico.</p>
              <button
                type="button"
                onClick={() => refetchHistory()}
                className="rounded-full bg-red-500 px-4 py-2 text-xs font-semibold text-white transition hover:bg-red-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-300"
              >
                Tentar novamente
              </button>
            </div>
          ) : sortedHistory.length === 0 ? (
            <div className="flex h-48 flex-col items-center justify-center gap-3 text-center">
              <LucideIcon name="Inbox" className="h-10 w-10 text-slate-400" />
              <p className="text-sm font-medium text-slate-500">Sem registros para exibir.</p>
            </div>
          ) : (
            sortedHistory.map((item, index) => {
              const bills = item.bills ?? [];
              const isExpanded = expandedId === item.id;

              return (
                <div
                  key={item.id ?? `detail-${index}`}
                  className="rounded-3xl bg-white/90 p-4 text-left shadow-sm ring-1 ring-slate-200"
                >
                  <button
                    type="button"
                    onClick={() => toggleExpanded(item.id)}
                    className="flex w-full items-center justify-between gap-4 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300"
                  >
                    <div className="space-y-1">
                      <p className="text-sm font-semibold text-slate-900">Simulação {`#${item.id}`}</p>
                      <p className="text-xs text-slate-500">{formatDateTime(item.created_at)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-emerald-600">
                        {formatCurrency(item.calculated_value)}
                      </p>
                      {toNumber(item.credits_used) != null ? (
                        <p className="text-xs text-slate-500">
                          Créditos: {integerFormatter.format(toNumber(item.credits_used) ?? 0)}
                        </p>
                      ) : null}
                    </div>
                    <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-600">
                      <LucideIcon name={isExpanded ? "ChevronUp" : "ChevronDown"} className="h-5 w-5" />
                    </span>
                  </button>

                  {bills.length > 0 ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {bills.map((bill, billIndex) => (
                        <span
                          key={`${item.id}-bill-value-${billIndex}`}
                          className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700"
                        >
                          {formatCurrency(bill.icms_value)}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-3 text-xs text-slate-500">Sem faturas registradas.</p>
                  )}

                  <div
                    className={clsx(
                      "grid transition-[grid-template-rows] duration-300 ease-out",
                      isExpanded ? "mt-4 grid-rows-[1fr] opacity-100" : "mt-0 grid-rows-[0fr] opacity-0",
                    )}
                  >
                    <div className="overflow-hidden">
                      <div className="space-y-2">
                        {bills.map((bill, billIndex) => {
                          const formattedDate = formatBillDate(bill.issue_date);
                          const billLabel = formattedDate === "--" ? `Fatura ${billIndex + 1}` : formattedDate;

                          return (
                            <div
                              key={`${item.id}-bill-detail-${billIndex}`}
                              className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-600"
                            >
                              <div className="space-y-1 text-left">
                                <p className="font-semibold text-slate-700">{billLabel}</p>
                                {formattedDate !== "--" ? (
                                  <span className="text-slate-500">Data de emissão: {billLabel}</span>
                                ) : null}
                              </div>
                              <span className="text-sm font-semibold text-slate-900">
                                {formatCurrency(bill.icms_value)}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </FullscreenModal>
    </>
  );
}
