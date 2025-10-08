"use client";

import { useMemo, useState } from "react";
import clsx from "clsx";
import { useQuery } from "@tanstack/react-query";
// Importações de componentes locais (mantendo a referência, mas o compilador pode ter problemas se não estiverem no mesmo diretório)
import FullscreenSlides from "./FullscreenSlides";
import FullscreenModal from "./FullscreenModal";
import type { SlidesNavigationStateChange } from "./slides-navigation";
import { mobileSlideCardBase, mobileSlideSectionSpacing } from "../mobile";

// Importações de API e utilitários do seu projeto
import {
  getCreditsBalance,
  getCreditsHistory,
  type CreditHistoryItem,
  type CreditsBalanceResponse,
} from "@/lib/api";
import { parseHistoryMetadata } from "@/utils/history-metadata";


interface CreditsPageProps {
  onRequestBuyCredits?: () => void;
  onSlideStateChange?: SlidesNavigationStateChange;
}

const creditsFormatter = new Intl.NumberFormat("pt-BR", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

function formatCredits(value: number | undefined) {
  if (typeof value !== "number") return "--";
  const suffix = Math.abs(value) === 1 ? "crédito" : "créditos";
  // Garante que o sinal (+/-) seja exibido apenas se o valor não for zero
  const sign = value > 0 ? "+" : value < 0 ? "-" : "";
  return `${sign}${creditsFormatter.format(Math.abs(value))} ${suffix}`;
}

function formatDate(value: string | undefined | null) {
  if (!value) return "--";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "--";
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

// Ícone SVG Simples (Carteira) para substituir LucideIcon
const WalletIcon = (props: React.SVGProps<SVGSVGElement>) => (
    <svg 
        {...props} 
        fill="none" 
        stroke="currentColor" 
        viewBox="0 0 24 24" 
        xmlns="http://www.w3.org/2000/svg"
    >
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 10h18M7 15h1m4 0h1m-1 4h.01M19 8v5a2 2 0 01-2 2H7a2 2 0 01-2-2V8a2 2 0 012-2h10a2 2 0 012 2z" />
    </svg>
);


export default function CreditsPage({ onRequestBuyCredits, onSlideStateChange }: CreditsPageProps) {
  const baseSlideContainer = clsx(mobileSlideCardBase, "text-center");
  const [showModal, setShowModal] = useState(false);

  const balanceQuery = useQuery<CreditsBalanceResponse>({
    queryKey: ["credits", "balance", "slides"],
    queryFn: getCreditsBalance,
  });

  const historyQuery = useQuery<CreditHistoryItem[]>({
    queryKey: ["credits", "history", "credits"],
    queryFn: () => getCreditsHistory({ limit: 50 }), 
  });

  const totalCredits = useMemo(() => balanceQuery.data?.valid_credits ?? 0, [balanceQuery.data]);

  // RENOMEADO E FILTRO REMOVIDO para que o modal exiba TODAS as movimentações (débito e crédito)
  const allTransactions = useMemo(() => {
    if (!historyQuery.data) return [] as CreditHistoryItem[];
    // Removemos o .filter(item => item.amount > 0) para incluir débitos e créditos
    return historyQuery.data.sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    );
  }, [historyQuery.data]);


  const slides = [
    {
      id: "credits-overview",
      ariaLabel: "Visão geral dos créditos",
      content: (
        <div className={baseSlideContainer}>
          <header className={clsx(mobileSlideSectionSpacing, "text-center")}>
            <h2 className="text-2xl font-bold text-slate-900 md:text-4xl">Créditos</h2>
            <p className="text-sm text-slate-600 md:text-base">
              Acompanhe seu saldo, visualize o histórico e compre novos créditos com facilidade.
            </p>
          </header>

          <div className="mx-auto w-full max-w-md space-y-4 rounded-3xl bg-gradient-to-br from-white to-amber-50 p-6 sm:p-8 shadow-xl ring-2 ring-amber-200">
            <div className="space-y-2 text-left">
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-teal-600">Saldo disponível</p>
              <p className="text-3xl font-semibold text-slate-900 sm:text-5xl">
                {balanceQuery.isLoading ? "--" : formatCredits(totalCredits)}
              </p>
              <p className="text-xs text-slate-500">
                Atualizado automaticamente com base nas últimas movimentações.
              </p>
            </div>

            <button
              type="button"
              onClick={onRequestBuyCredits}
              className="w-full rounded-full bg-amber-500 px-6 py-3 text-sm font-semibold text-white shadow-lg transition hover:bg-amber-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-200"
            >
              Comprar mais créditos
            </button>
          </div>

          <section className="mx-auto w-full max-w-md">
            <button
              type="button"
              onClick={() => setShowModal(true)}
              className="w-full rounded-full bg-slate-200 px-6 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-300"
            >
              Ver Histórico de Movimentações
            </button>
          </section>
        </div>
      ),
    },
  ];

  return (
    <>
      <FullscreenSlides slides={slides} onSlideStateChange={onSlideStateChange} />
      
      {/* MODAL DE HISTÓRICO COMPLETO */}
      <FullscreenModal open={showModal} onClose={() => setShowModal(false)} title="Histórico de Movimentações">
        <div className="space-y-3">
          {historyQuery.isLoading ? (
            <p className="text-sm text-slate-500">Carregando histórico...</p>
          ) : historyQuery.isError ? (
            <p className="text-sm font-semibold text-red-500">Não foi possível carregar o histórico.</p>
          ) : allTransactions.length === 0 ? (
            <div className="flex flex-col items-center gap-3 text-center py-10">
              {/* Uso de SVG simples para substituir o LucideIcon */}
              <WalletIcon className="h-10 w-10 text-slate-400" /> 
              <p className="text-sm text-slate-500">Nenhuma movimentação de crédito encontrada.</p>
            </div>
          ) : (
            allTransactions.map((item) => {
              const metadata = parseHistoryMetadata(item);
              const amount = item.amount;
              const note = item.description || metadata.notes;
              
              // Lógica para diferenciar Créditos (Entradas) e Débitos (Saídas)
              const isCredit = amount > 0;
              const amountColor = isCredit ? "text-amber-600" : "text-red-500";
              
              // Garante que o sinal (+/-) seja exibido, se não for zero
              const formattedAmount = formatCredits(amount);


              return (
                // Layout compacto de uma linha (mobile-first)
                <div key={`tx-${item.id}`} className="flex justify-between items-center rounded-xl bg-slate-50 p-3 shadow-sm text-sm ring-1 ring-slate-100">
                  <div className="text-left leading-tight pr-4">
                    <p className="font-semibold text-slate-800">{item.transaction_type}</p>
                    <p className="text-xs text-slate-500">{formatDate(item.created_at)}</p>
                  </div>
                  
                  <div className="text-right">
                    {/* Valor: Exibe cor e sinal baseados na transação */}
                    <p className={`font-bold text-base ${amountColor} leading-none`}>
                      {formattedAmount}
                    </p>
                    {/* Saldo Após: Informação secundária */}
                    <p className="text-xs text-slate-400">Saldo: {formatCredits(item.balance_after ?? 0)}</p>
                  </div>
                  
                  {/* Nota ou descrição, se houver, pode ser desativada para manter o layout compacto em dispositivos móveis */}
                  {/* {note && <p className="mt-2 text-xs text-slate-500">{note}</p>} */}
                </div>
              );
            })
          )}
        </div>
      </FullscreenModal>
    </>
  );
}
