"use client";

import { useCallback, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import clsx from "clsx";
import { LucideIcon } from "@/components/LucideIcon";
import { getCreditsHistory, type CreditHistoryItem } from "@/lib/api";
import { parseHistoryMetadata } from "@/utils/history-metadata";
import FullscreenSlides from "./FullscreenSlides";
import FullscreenModal from "./FullscreenModal";

const currencyFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

const creditsFormatter = new Intl.NumberFormat("pt-BR", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

function formatCredits(value: number) {
  const suffix = Math.abs(value) === 1 ? "crédito" : "créditos";
  return `${creditsFormatter.format(value)} ${suffix}`;
}

function formatDateTime(value: string | undefined) {
  if (!value) return "--";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "--";
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

type FilterKey = "all" | "credit" | "debit";

export default function HistoryPage() {
  const [activeFilter, setActiveFilter] = useState<FilterKey>("all");
  const [showModal, setShowModal] = useState(false);

  const historyQuery = useQuery<CreditHistoryItem[]>({
    queryKey: ["credits", "history", "vertical"],
    queryFn: () => getCreditsHistory({ limit: 25 }),
  });

  const sortedHistory = useMemo(() => {
    if (!historyQuery.data) return [] as CreditHistoryItem[];
    return [...historyQuery.data].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    );
  }, [historyQuery.data]);

  const filteredHistory = useMemo(() => {
    switch (activeFilter) {
      case "credit":
        return sortedHistory.filter((item) => item.amount > 0);
      case "debit":
        return sortedHistory.filter((item) => item.amount < 0);
      default:
        return sortedHistory;
    }
  }, [activeFilter, sortedHistory]);

  const recentHistory = filteredHistory.slice(0, 5);

  const calculateStats = useCallback((items: CreditHistoryItem[]) => {
    return items.reduce(
      (accumulator, item) => {
        const metadata = parseHistoryMetadata(item);
        const recovered = Math.max(metadata.calculationValue ?? item.amount, 0);
        const credits = Math.max(metadata.creditsUsed ?? Math.abs(item.amount), 0);
        return {
          totalRecovered: accumulator.totalRecovered + recovered,
          totalCreditsUsed: accumulator.totalCreditsUsed + credits,
        };
      },
      { totalRecovered: 0, totalCreditsUsed: 0 },
    );
  }, []);

  const filteredStats = useMemo(() => calculateStats(filteredHistory), [calculateStats, filteredHistory]);
  const overallStats = useMemo(() => calculateStats(sortedHistory), [calculateStats, sortedHistory]);

  const averageRecovered = sortedHistory.length ? overallStats.totalRecovered / sortedHistory.length : 0;
  const averageCredits = sortedHistory.length ? overallStats.totalCreditsUsed / sortedHistory.length : 0;

  const slides = [
    {
      id: "history-filters",
      ariaLabel: "Filtros e resumo do histórico",
      content: (
        <div className="w-full max-w-3xl space-y-6">
          <header className="space-y-3">
            <h2 className="text-2xl font-semibold text-slate-900">Seu histórico, sem rolagem</h2>
            <p className="text-sm text-slate-600">
              Filtre os registros por tipo de movimentação e veja o volume acumulado de créditos utilizados e valores recuperados.
            </p>
          </header>
          <div className="flex flex-wrap items-center justify-center gap-3">
            {[
              { id: "all" as FilterKey, label: "Tudo" },
              { id: "credit" as FilterKey, label: "Entradas" },
              { id: "debit" as FilterKey, label: "Saídas" },
            ].map((filter) => {
              const isActive = activeFilter === filter.id;
              return (
                <button
                  key={filter.id}
                  type="button"
                  onClick={() => setActiveFilter(filter.id)}
                  className={clsx(
                    "rounded-full px-5 py-2 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-200",
                    isActive
                      ? "bg-indigo-600 text-white shadow-lg"
                      : "bg-white/80 text-slate-700 shadow"
                  )}
                >
                  {filter.label}
                </button>
              );
            })}
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-3xl bg-white/80 p-6 text-left shadow-lg ring-1 ring-slate-200">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Registros</p>
              <p className="mt-2 text-3xl font-bold text-slate-900">{filteredHistory.length}</p>
              <p className="mt-1 text-xs text-slate-500">Filtrados por {activeFilter === "all" ? "todos os tipos" : activeFilter === "credit" ? "entradas" : "saídas"}.</p>
            </div>
              <div className="rounded-3xl bg-white/80 p-6 text-left shadow-lg ring-1 ring-slate-200">
              <p className="text-xs font-semibold uppercase tracking-wide text-emerald-600">Valor recuperado</p>
              <p className="mt-2 text-3xl font-bold text-emerald-600">
                {currencyFormatter.format(filteredStats.totalRecovered)}
              </p>
              <p className="mt-1 text-xs text-slate-500">Somatório desde o início.</p>
            </div>
            <div className="rounded-3xl bg-white/80 p-6 text-left shadow-lg ring-1 ring-slate-200">
              <p className="text-xs font-semibold uppercase tracking-wide text-indigo-600">Créditos usados</p>
              <p className="mt-2 text-3xl font-bold text-indigo-600">{formatCredits(filteredStats.totalCreditsUsed)}</p>
              <p className="mt-1 text-xs text-slate-500">Média geral por simulação: {formatCredits(averageCredits)}</p>
            </div>
          </div>
        </div>
      ),
    },
    {
      id: "history-recent",
      ariaLabel: "Últimos cálculos",
      content: (
        <div className="w-full max-w-3xl space-y-6">
          <header className="space-y-2">
            <h2 className="text-2xl font-semibold text-slate-900">Últimos cálculos</h2>
            <p className="text-sm text-slate-600">Revise os cinco registros mais recentes sem sair desta tela.</p>
          </header>
          <div className="grid gap-3">
            {historyQuery.isLoading ? (
              <p className="text-sm text-slate-500">Carregando histórico...</p>
            ) : historyQuery.isError ? (
              <p className="text-sm font-semibold text-red-500">Não foi possível carregar o histórico.</p>
            ) : recentHistory.length === 0 ? (
              <div className="flex flex-col items-center gap-3 text-center">
                <LucideIcon name="Inbox" className="h-10 w-10 text-slate-400" />
                <p className="text-sm text-slate-500">Nenhum registro disponível no momento.</p>
              </div>
            ) : (
              recentHistory.map((item) => {
                const metadata = parseHistoryMetadata(item);
                const recovered = metadata.calculationValue ?? Math.max(item.amount, 0);
                const creditsUsed = metadata.creditsUsed ?? Math.abs(item.amount);
                return (
                  <div key={item.id} className="rounded-2xl bg-white/80 p-4 text-left shadow ring-1 ring-slate-200">
                    <div className="flex flex-col gap-2 text-sm text-slate-600 md:flex-row md:items-center md:justify-between">
                      <div>
                        <p className="text-base font-semibold text-slate-900">{item.transaction_type}</p>
                        <p>{formatDateTime(item.created_at)}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-base font-semibold text-emerald-600">
                          {currencyFormatter.format(Math.max(recovered, 0))}
                        </p>
                        <p className="text-xs text-slate-500">Créditos: {formatCredits(creditsUsed)}</p>
                      </div>
                    </div>
                    {item.description && (
                      <p className="mt-2 text-xs text-slate-500">{item.description}</p>
                    )}
                  </div>
                );
              })
            )}
          </div>
          <button
            type="button"
            onClick={() => setShowModal(true)}
            className="w-full rounded-full bg-indigo-600 px-6 py-3 text-sm font-semibold text-white shadow-lg transition hover:bg-indigo-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-200"
          >
            Ver tudo
          </button>
        </div>
      ),
    },
    {
      id: "history-stats",
      ariaLabel: "Estatísticas consolidadas",
      content: (
        <div className="w-full max-w-2xl space-y-5">
          <header className="space-y-2">
            <h2 className="text-2xl font-semibold text-slate-900">Insights rápidos</h2>
            <p className="text-sm text-slate-600">Indicadores que ajudam você a priorizar as próximas ações.</p>
          </header>
          <div className="grid gap-4">
            <div className="rounded-2xl bg-white/80 p-5 shadow ring-1 ring-slate-200">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Ticket médio</p>
              <p className="mt-2 text-2xl font-semibold text-slate-900">
                {currencyFormatter.format(averageRecovered)}
              </p>
              <p className="mt-1 text-xs text-slate-500">Baseado em {sortedHistory.length} simulações registradas.</p>
            </div>
            <div className="rounded-2xl bg-white/80 p-5 shadow ring-1 ring-slate-200">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Tendência recente</p>
              <p className="mt-2 text-sm text-slate-600">
                Compare os resultados das últimas simulações para identificar oportunidades de economia adicionais.
              </p>
            </div>
            <div className="rounded-2xl bg-white/80 p-5 shadow ring-1 ring-slate-200">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Próximos passos</p>
              <p className="mt-2 text-sm text-slate-600">
                Use os filtros acima para revisar cálculos específicos e planeje a compra de novos créditos na aba dedicada.
              </p>
            </div>
          </div>
        </div>
      ),
    },
  ];

  return (
    <>
      <FullscreenSlides slides={slides} />
      <FullscreenModal open={showModal} onClose={() => setShowModal(false)} title="Todos os cálculos">
        <div className="space-y-3">
          {sortedHistory.length === 0 ? (
            <p className="text-sm text-slate-500">Sem registros para exibir.</p>
          ) : (
            sortedHistory.map((item) => {
              const metadata = parseHistoryMetadata(item);
              const recovered = metadata.calculationValue ?? Math.max(item.amount, 0);
              const creditsUsed = metadata.creditsUsed ?? Math.abs(item.amount);
              return (
                <div key={`modal-${item.id}`} className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-600 shadow">
                  <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                    <div>
                      <p className="text-base font-semibold text-slate-900">{item.transaction_type}</p>
                      <p>{formatDateTime(item.created_at)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-base font-semibold text-emerald-600">
                        {currencyFormatter.format(Math.max(recovered, 0))}
                      </p>
                      <p className="text-xs text-slate-500">Créditos: {formatCredits(creditsUsed)}</p>
                    </div>
                  </div>
                  {item.description && <p className="mt-2 text-xs text-slate-500">{item.description}</p>}
                </div>
              );
            })
          )}
        </div>
      </FullscreenModal>
    </>
  );
}