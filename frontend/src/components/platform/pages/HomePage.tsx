"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import clsx from "clsx";
import { LucideIcon } from "@/components/LucideIcon";
import {
  getCreditsBalance,
  getCreditsHistory,
  getDetailedHistory,
  getReferralStats,
  type CreditHistoryItem,
  type CreditsBalanceResponse,
  type DetailedHistoryItem,
  type ReferralStatsResponse,
} from "@/lib/api";
import { parseHistoryMetadata } from "@/utils/history-metadata";
import FullscreenSlides, { type Slide } from "./FullscreenSlides";
import type { SlidesNavigationStateChange } from "./slides-navigation";
import { mobileSlideCardBase, mobileSlideSectionSpacing } from "../mobile";
import useAuth from "@/hooks/useAuth";
import ReferralCelebrationCard from "../ReferralCelebrationCard";

interface HomePageProps {
  onNavigateToHistory?: () => void;
  onNavigateToCredits?: () => void;
  onNavigateToCalculator?: () => void;
  onSlideStateChange?: SlidesNavigationStateChange;
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

export default function HomePage({
  onNavigateToHistory,
  onNavigateToCredits,
  onNavigateToCalculator,
  onSlideStateChange,
}: HomePageProps) {
  const { user } = useAuth();
  const [showReferralCelebration, setShowReferralCelebration] = useState(false);

  const baseSlideContainer = mobileSlideCardBase;
  const balanceQuery = useQuery<CreditsBalanceResponse>({
    queryKey: ["credits", "balance", "home"],
    queryFn: getCreditsBalance,
  });
  const detailedHistoryQuery = useQuery<DetailedHistoryItem[]>({
    queryKey: ["detailed-history", "home", 5],
    queryFn: () => getDetailedHistory({ limit: 5, offset: 0 }),
  });

  const referralQuery = useQuery<ReferralStatsResponse>({
    queryKey: ["referral", "stats", "home"],
    queryFn: getReferralStats,
  });

  const historyQuery = useQuery<CreditHistoryItem[]>({
    queryKey: ["credits", "history", "home", 5],
    queryFn: () => getCreditsHistory({ limit: 5 }),
  });

  const userId = user?.id != null ? String(user.id) : null;

  useEffect(() => {
    setShowReferralCelebration(false);
  }, [userId]);

  useEffect(() => {
    if (!userId) {
      return;
    }
    if (!historyQuery.data || historyQuery.data.length === 0) {
      return;
    }
    if (typeof window === "undefined") {
      return;
    }

    const storageKey = `cc-referral-celebrated-${userId}`;
    if (window.localStorage.getItem(storageKey) === "seen") {
      return;
    }

    const hasBonusTransaction = historyQuery.data.some(
      (item) =>
        item.transaction_type === "referral_bonus" &&
        typeof item.reference_id === "string" &&
        item.reference_id.toLowerCase() === `referral_bonus_for_${userId}`.toLowerCase(),
    );

    if (hasBonusTransaction) {
      setShowReferralCelebration(true);
      window.localStorage.setItem(storageKey, "seen");
    }
  }, [historyQuery.data, userId]);

  const handleReferralCelebrationDismiss = () => {
    setShowReferralCelebration(false);
  };

  const totalCredits = balanceQuery.data?.valid_credits ?? 0;

  const detailedHistoryMap = useMemo(() => {
    const map = new Map<number, DetailedHistoryItem>();
    (detailedHistoryQuery.data ?? []).forEach((item) => {
      const idNumber = Number(item.id);
      if (!Number.isNaN(idNumber)) {
        map.set(idNumber, item);
      }
    });
    return map;
  }, [detailedHistoryQuery.data]);

  const usageHistory = useMemo(() => {
    if (!historyQuery.data) return [] as CreditHistoryItem[];
    return historyQuery.data.filter((item) => {
      if (item.transaction_type === "usage") return true;
      if (typeof item.amount === "number" && item.amount < 0) return true;
      return typeof item.reference_id === "string" && /^calc_\d+$/i.test(item.reference_id);
    });
  }, [historyQuery.data]);

  const recentHistory = useMemo(() => {
    if (usageHistory.length === 0) return [] as CreditHistoryItem[];
    return [...usageHistory]
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 3);
  }, [usageHistory]);

  const [openFaq, setOpenFaq] = useState<string | null>("workflow");

  const resolveCalculationValue = (transaction: CreditHistoryItem) => {
    if (!transaction.reference_id) return null;
    const match = /^calc_(\d+)$/i.exec(transaction.reference_id);
    if (!match) return null;
    const calcId = Number(match[1]);
    if (!Number.isFinite(calcId)) return null;
    const details = detailedHistoryMap.get(calcId);
    if (!details || typeof details.calculated_value !== "number") {
      return null;
    }
    return details.calculated_value;
  };

  const lastSimulation = recentHistory[0];
  const lastMetadata = lastSimulation ? parseHistoryMetadata(lastSimulation) : null;
  const lastCalculatedValue = lastSimulation ? resolveCalculationValue(lastSimulation) : null;
  const lastValue = lastCalculatedValue ?? lastMetadata?.calculationValue ?? null;
  const referralTotal = referralQuery.data?.total_referrals ?? 0;
  const referralEarned = referralQuery.data?.referral_credits_earned ?? 0;

  const slides: Slide[] = [
      {
        id: "home-hero",
        ariaLabel: "Apresentação da plataforma",
        content: (
          <div className={clsx(baseSlideContainer, "text-center")}>
            {showReferralCelebration ? (
              <div className="mb-6 w-full text-left">
                <ReferralCelebrationCard
                  onDismiss={handleReferralCelebrationDismiss}
                  className="w-full text-left"
                />
              </div>
            ) : null}
            <div className={clsx(mobileSlideSectionSpacing, "md:space-y-4")}>
              <span className="inline-flex items-center gap-2 rounded-full bg-teal-100 px-4 py-1 text-xs font-semibold uppercase tracking-wide text-teal-700">
                <LucideIcon name="Sparkles" className="h-4 w-4" />
                Plataforma CalculaConfia
              </span>
              <h1 className="text-2xl font-bold leading-tight text-slate-900 md:text-4xl">
                Simule, acompanhe e compre créditos em um só fluxo
              </h1>
              <p className="text-sm text-slate-600 md:text-base">
                Explore os destaques abaixo ou pule direto para a área de cálculo quando quiser começar uma nova simulação.
              </p>
            </div>
            <div className="mx-auto flex w-full max-w-sm flex-col items-center gap-3 sm:flex-row sm:items-center">
              <button
                type="button"
                onClick={onNavigateToHistory}
                className="w-full rounded-full bg-teal-600 px-6 py-3 text-sm font-semibold text-white shadow-lg transition hover:bg-teal-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-200"
              >
                Explorar histórico
              </button>
              <button
                type="button"
                onClick={onNavigateToCalculator}
                disabled={!onNavigateToCalculator}
                className="w-full rounded-full bg-white/80 px-6 py-3 text-sm font-semibold text-teal-700 shadow-lg ring-1 ring-teal-200 transition hover:bg-teal-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-200 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Ir para a calculadora
              </button>
            </div>
            <p className="text-center text-xs text-slate-500">
              Arraste para cima ou use os atalhos para navegar rapidamente pela plataforma.
            </p>
          </div>
        ),
      },
      {
        id: "home-kpis",
        ariaLabel: "Indicadores de desempenho",
        content: (
          <div className={clsx(baseSlideContainer, "text-left")}>
            <header className={clsx(mobileSlideSectionSpacing, "text-center md:text-left")}>
              <h2 className="text-2xl font-bold text-slate-900 md:text-4xl">Indicadores rápidos</h2>
              <p className="text-sm text-slate-600 md:text-base">
                Tenha visibilidade imediata do que mudou desde seu último acesso.
              </p>
            </header>
            <div className="grid w-full gap-3 md:gap-4 md:grid-cols-3">
              <div className="flex h-full flex-col justify-between gap-3 rounded-3xl bg-white/90 p-5 shadow-sm ring-1 ring-slate-200">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-[0.3em] text-teal-600">Saldo atual</span>
                  <LucideIcon name="Wallet" className="h-6 w-6 text-teal-500" />
                </div>
                <p className="text-2xl font-semibold text-slate-900 md:text-3xl">
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
              <div className="flex h-full flex-col justify-between gap-3 rounded-3xl bg-white/90 p-5 shadow-sm ring-1 ring-slate-200">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-[0.3em] text-purple-600">Indicações</span>
                  <LucideIcon name="Users" className="h-6 w-6 text-purple-500" />
                </div>
                <p className="text-2xl font-semibold text-slate-900 md:text-3xl">
                {referralQuery.isLoading ? "--" : numberFormatter.format(referralTotal)}
                </p>
                <p className="text-xs text-slate-500">Créditos ganhos: {formatCredits(referralEarned)}</p>
              </div>
              <div className="hidden h-full flex-col justify-between gap-3 rounded-3xl bg-white/90 p-5 shadow-sm ring-1 ring-slate-200 md:flex">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-[0.3em] text-indigo-600">Última simulação</span>
                  <LucideIcon name="Activity" className="h-6 w-6 text-indigo-500" />
                </div>
                <div>
                  <p className="text-3xl font-semibold text-slate-900">
                    {historyQuery.isLoading
                      ? "Carregando..."
                      : lastSimulation
                        ? lastValue != null
                          ? currencyFormatter.format(Math.max(lastValue, 0))
                          : "--"
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
          <div className={clsx(baseSlideContainer, "space-y-6 text-left")}>
            <header className={clsx(mobileSlideSectionSpacing, "text-center md:text-left")}>
              <h2 className="text-2xl font-bold text-slate-900 md:text-4xl">Dicas para aproveitar melhor</h2>
              <p className="text-sm text-slate-600 md:text-base">
                Use os atalhos abaixo para navegar sem perder tempo.
              </p>
            </header>
            <div className="flex flex-col gap-4">
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
                  <div key={item.id} className="rounded-2xl bg-white/90 shadow-sm ring-1 ring-slate-200">
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

  return (
    <FullscreenSlides
      slides={slides}
      onSlideStateChange={onSlideStateChange}
    />
  );
}
