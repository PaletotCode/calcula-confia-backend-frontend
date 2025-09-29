"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import clsx from "clsx";
import { LucideIcon } from "@/components/LucideIcon";
import {
  getCreditsBalance,
  getCreditsHistory,
  getReferralStats,
  type CreditHistoryItem,
  type CreditsBalanceResponse,
  type ReferralStatsResponse,
} from "@/lib/api";
import { parseHistoryMetadata } from "@/utils/history-metadata";
import FullscreenSlides, { type Slide } from "./FullscreenSlides";

interface HomePageProps {
  onNavigateToHistory?: () => void;
  onNavigateToCredits?: () => void;
}

const currencyFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

const numberFormatter = new Intl.NumberFormat("pt-BR", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

function formatCredits(value: number | undefined) {
  if (typeof value !== "number") return "--";
  const suffix = Math.abs(value) === 1 ? "crédito" : "créditos";
  return `${numberFormatter.format(value)} ${suffix}`;
}

function formatDate(value: string | undefined) {
  if (!value) return "--";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "--";
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

export default function HomePage({ onNavigateToHistory, onNavigateToCredits }: HomePageProps) {
  const balanceQuery = useQuery<CreditsBalanceResponse>({
    queryKey: ["credits", "balance", "home"],
    queryFn: getCreditsBalance,
  });

  const referralQuery = useQuery<ReferralStatsResponse>({
    queryKey: ["referral", "stats", "home"],
    queryFn: getReferralStats,
  });

  const historyQuery = useQuery<CreditHistoryItem[]>({
    queryKey: ["credits", "history", "home", 5],
    queryFn: () => getCreditsHistory({ limit: 5 }),
  });

  const totalCredits = useMemo(() => {
    const valid = balanceQuery.data?.valid_credits ?? 0;
    const legacy = balanceQuery.data?.legacy_credits ?? 0;
    return valid + legacy;
  }, [balanceQuery.data]);

  const recentHistory = useMemo(() => {
    if (!historyQuery.data) return [] as CreditHistoryItem[];
    return [...historyQuery.data]
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 3);
  }, [historyQuery.data]);

  const [openFaq, setOpenFaq] = useState<string | null>("workflow");

  const lastSimulation = recentHistory[0];
  const lastMetadata = lastSimulation ? parseHistoryMetadata(lastSimulation) : null;
  const lastValue = lastMetadata?.calculationValue ?? lastSimulation?.amount;
  const referralTotal = referralQuery.data?.total_referrals ?? 0;
  const referralEarned = referralQuery.data?.referral_credits_earned ?? 0;

  const slides: Slide[] = [
      {
        id: "home-hero",
        ariaLabel: "Apresentação da plataforma",
        content: (
          <div className="w-full max-w-2xl space-y-6">
            <div className="space-y-4">
              <span className="inline-flex items-center gap-2 rounded-full bg-teal-100 px-4 py-1 text-xs font-semibold uppercase tracking-wide text-teal-700">
                <LucideIcon name="Sparkles" className="h-4 w-4" />
                Plataforma CalculaConfia
              </span>
              <h1 className="text-3xl font-bold leading-tight text-slate-900 md:text-4xl">
                Simule, acompanhe e compre créditos em um só fluxo
              </h1>
              <p className="text-sm text-slate-600 md:text-base">
                Navegue pelos conteúdos deslizando para cima e para baixo. Quando estiver pronto, avance para a aba de cálculo para iniciar uma nova simulação.
              </p>
            </div>
            <div className="mx-auto flex w-full max-w-sm flex-col items-center gap-3">
              <button
                type="button"
                onClick={onNavigateToHistory}
                className="w-full rounded-full bg-teal-600 px-6 py-3 text-sm font-semibold text-white shadow-lg transition hover:bg-teal-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-200"
              >
                Explorar histórico
              </button>
              <p className="text-xs text-slate-500">Arraste para cima ou use os botões para conhecer os destaques.</p>
            </div>
          </div>
        ),
      },
      {
        id: "home-kpis",
        ariaLabel: "Indicadores de desempenho",
        content: (
          <div className="w-full max-w-3xl space-y-6">
            <header className="space-y-2">
              <h2 className="text-2xl font-semibold text-slate-900">Indicadores rápidos</h2>
              <p className="text-sm text-slate-600">Tenha visibilidade imediata do que mudou desde seu último acesso.</p>
            </header>
            <div className="grid w-full gap-4 sm:grid-cols-3">
              <div className="flex h-full flex-col items-center justify-between gap-4 rounded-3xl bg-white/80 p-6 text-left shadow-lg ring-1 ring-slate-200">
                <div className="flex w-full items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wide text-teal-600">Saldo atual</span>
                  <LucideIcon name="Wallet" className="h-6 w-6 text-teal-500" />
                </div>
                <p className="w-full text-2xl font-bold text-slate-900">
                  {balanceQuery.isLoading ? "--" : formatCredits(totalCredits)}
                </p>
                <button
                  type="button"
                  onClick={onNavigateToCredits}
                  className="w-full rounded-full bg-teal-500/10 px-3 py-2 text-xs font-semibold text-teal-600 transition hover:bg-teal-500/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-200"
                >
                  Ver detalhes
                </button>
              </div>
              <div className="flex h-full flex-col items-center justify-between gap-4 rounded-3xl bg-white/80 p-6 text-left shadow-lg ring-1 ring-slate-200">
                <div className="flex w-full items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wide text-purple-600">Indicações</span>
                  <LucideIcon name="Users" className="h-6 w-6 text-purple-500" />
                </div>
                <p className="w-full text-2xl font-bold text-slate-900">
                  {referralQuery.isLoading ? "--" : numberFormatter.format(referralTotal)}
                </p>
                <p className="w-full text-xs text-slate-500">Créditos ganhos: {formatCredits(referralEarned)}</p>
              </div>
              <div className="flex h-full flex-col items-center justify-between gap-4 rounded-3xl bg-white/80 p-6 text-left shadow-lg ring-1 ring-slate-200">
                <div className="flex w-full items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wide text-indigo-600">Última simulação</span>
                  <LucideIcon name="Activity" className="h-6 w-6 text-indigo-500" />
                </div>
                <div className="w-full text-left">
                  <p className="text-base font-semibold text-slate-800">
                    {historyQuery.isLoading
                      ? "Carregando..."
                      : lastSimulation
                        ? currencyFormatter.format(Math.max(lastValue ?? 0, 0))
                        : "Sem registros"}
                  </p>
                  <p className="text-xs text-slate-500">{lastSimulation ? formatDate(lastSimulation.created_at) : ""}</p>
                </div>
                <button
                  type="button"
                  onClick={onNavigateToHistory}
                  className="w-full rounded-full bg-indigo-500/10 px-3 py-2 text-xs font-semibold text-indigo-600 transition hover:bg-indigo-500/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-200"
                >
                  Revisar histórico
                </button>
              </div>
            </div>
          </div>
        ),
      },
      {
        id: "home-faq",
        ariaLabel: "Dúvidas frequentes",
        content: (
          <div className="w-full max-w-2xl space-y-5">
            <header className="space-y-2">
              <h2 className="text-2xl font-semibold text-slate-900">Dicas para aproveitar melhor</h2>
              <p className="text-sm text-slate-600">
                Use os atalhos abaixo para navegar sem perder tempo.
              </p>
            </header>
            <div className="flex flex-col gap-3">
              {[
                {
                  id: "workflow",
                  title: "Como navegar sem rolagem?",
                  description:
                    "Use os botões ou arraste para navegar entre os blocos de conteúdo. Cada slide exibe as informações essenciais.",
                },
                {
                  id: "history",
                  title: "Onde encontro meus cálculos anteriores?",
                  description:
                    "Acesse a aba Histórico pelo menu inferior ou pelo botão acima para visualizar os últimos cálculos e abrir a lista completa.",
                },
                {
                  id: "credits",
                  title: "Como comprar mais créditos?",
                  description:
                    "Na aba Créditos você acompanha o saldo disponível e inicia uma nova compra com poucos cliques.",
                },
              ].map((item) => {
                const isOpen = openFaq === item.id;
                return (
                  <div key={item.id} className="rounded-2xl bg-white/80 shadow-lg ring-1 ring-slate-200">
                    <button
                      type="button"
                      className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left"
                      onClick={() => setOpenFaq(isOpen ? null : item.id)}
                    >
                      <span className="text-sm font-semibold text-slate-800 md:text-base">{item.title}</span>
                      <LucideIcon
                        name="ChevronDown"
                        className={clsx(
                          "h-5 w-5 text-slate-500 transition-transform duration-300",
                          isOpen ? "rotate-180" : "rotate-0",
                        )}
                      />
                    </button>
                    <div
                      className={clsx(
                        "grid transition-all duration-300",
                        isOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
                      )}
                    >
                      <div className="overflow-hidden px-5 pb-4 text-sm text-slate-600">{item.description}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ),
      },
    ];

  return <FullscreenSlides slides={slides} />;
}