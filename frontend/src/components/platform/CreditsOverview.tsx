"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { LucideIcon } from "@/components/LucideIcon";
import {
  getCreditsBalance,
  getReferralStats,
  type CreditsBalanceResponse,
  type ReferralStatsResponse,
} from "@/lib/api";

const currencyFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

function formatCurrency(value: number) {
  return currencyFormatter.format(value);
}

interface CreditsOverviewProps {
  onBuyCredits?: () => void;
}

function formatCredits(value: number) {
  const formatted = new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value);
  const suffix = Math.abs(value) === 1 ? "crédito" : "créditos";
  return `${formatted} ${suffix}`;
}

function formatDateTime(value: string | undefined) {
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

export default function CreditsOverview({ onBuyCredits }: CreditsOverviewProps) {
  const balanceQuery = useQuery<CreditsBalanceResponse>({
    queryKey: ["credits", "balance"],
    queryFn: getCreditsBalance,
  });

  const referralQuery = useQuery<ReferralStatsResponse>({
    queryKey: ["referral", "stats"],
    queryFn: getReferralStats,
  });

  const [shareFeedback, setShareFeedback] = useState<string | null>(null);

  const totals = useMemo(() => {
    const valid = balanceQuery.data?.valid_credits ?? 0;
    const legacy = balanceQuery.data?.legacy_credits ?? 0;
    return {
      valid,
      legacy,
      total: valid + legacy,
    };
  }, [balanceQuery.data]);

  const buttonDisabled = balanceQuery.isLoading || balanceQuery.isError;

  const baseShareUrl = useMemo(() => {
    if (typeof window !== "undefined") {
      return (process.env.NEXT_PUBLIC_PUBLIC_BASE_URL || window.location.origin || "https://calculaconfia.com").replace(/\/$/, "");
    }
    return (process.env.NEXT_PUBLIC_PUBLIC_BASE_URL || "https://calculaconfia.com").replace(/\/$/, "");
  }, []);

  const shareData = referralQuery.data;
  const codeAvailable = Boolean(shareData?.referral_code) && (shareData?.total_referrals ?? 0) === 0;
  const shareLink = `${baseShareUrl}/platform`;
  const shareMessage = codeAvailable
    ? `Convite especial: use meu código ${shareData?.referral_code} e acesse a CalculaConfia para fazer sua simulação. Toque no link para começar: ${shareLink}`
    : `Descubra quanto você pode recuperar com a CalculaConfia: ${shareLink}`;

  const handleShare = useCallback(async () => {
    try {
      if (typeof navigator !== "undefined" && navigator.share) {
        await navigator.share({
          title: "Convite CalculaConfia",
          text: shareMessage,
          url: shareLink,
        });
        setShareFeedback("Convite compartilhado!");
        return;
      }

      if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(shareMessage);
        setShareFeedback("Convite copiado para a área de transferência!");
        return;
      }

      setShareFeedback("Copie manualmente: " + shareMessage);
    } catch (error) {
      console.error("Falha ao compartilhar código", error);
      setShareFeedback("Não foi possível compartilhar agora. Tente novamente.");
    }
  }, [shareLink, shareMessage]);

  useEffect(() => {
    if (!shareFeedback) return;
    const timeout = window.setTimeout(() => {
      setShareFeedback(null);
    }, 4000);
    return () => window.clearTimeout(timeout);
  }, [shareFeedback]);

  const isRefreshingBalance = balanceQuery.isRefetching && !balanceQuery.isLoading;

  return (
    <div className="flex h-full min-h-[calc(100vh-140px)] w-full items-center justify-center bg-gradient-to-br from-slate-100 via-white to-slate-200 px-4 pb-24 pt-12 md:pb-28">
      <div className="flex w-full max-w-4xl flex-col gap-8">
        <header className="text-left">
          <p className="text-sm font-medium uppercase tracking-wide text-amber-600">Créditos</p>
          <h1 className="text-3xl font-bold text-slate-900 md:text-4xl">Gerencie seu saldo e adquira novos créditos</h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-600 md:text-base">
            Acompanhe em tempo real o seu saldo disponível, visualize os bônus de indicação e compre mais créditos sempre que precisar.
          </p>
        </header>

        <div className="grid gap-4 lg:grid-cols-[1.4fr,1fr]">
          <div className="flex flex-col gap-4">
            <div className="relative overflow-hidden rounded-3xl bg-white/80 p-6 shadow-xl ring-1 ring-slate-200">
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-amber-500/10 via-transparent to-slate-900/10" />
              <div className="relative flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-2 rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700">
                    <LucideIcon name="Wallet" className="h-4 w-4" />
                    Saldo disponível
                  </span>
                  {balanceQuery.data?.timestamp ? (
                    <span className="text-xs text-slate-500">Atualizado em {formatDateTime(balanceQuery.data.timestamp)}</span>
                  ) : null}
                </div>
                <div>
                  <h2 className="text-4xl font-bold text-slate-900 md:text-5xl">
                    {balanceQuery.isLoading ? (
                      <span className="text-base font-medium text-slate-400">Carregando...</span>
                    ) : balanceQuery.isError ? (
                      <span className="text-base font-medium text-red-500">Erro ao carregar saldo</span>
                    ) : (
                      formatCredits(totals.total)
                    )}
                  </h2>
                  <p className="mt-2 text-sm text-slate-600">
                    Inclui todos os créditos prontos para uso e os ajustes automáticos vinculados à sua conta.
                  </p>
                </div>

                <div className="mt-4 flex flex-col gap-3 rounded-2xl bg-slate-50/80 p-4 text-sm text-slate-600">
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600">
                      <LucideIcon name="CircleCheck" className="h-5 w-5" />
                    </div>
                    <p>
                      Seus créditos podem ser utilizados imediatamente para novas simulações. Ajustes adicionais são aplicados automaticamente após cada operação.
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-3 pt-2">
                  <button
                    type="button"
                    onClick={onBuyCredits}
                    disabled={!onBuyCredits || buttonDisabled}
                    className="inline-flex items-center gap-2 rounded-full bg-amber-500 px-5 py-2 text-sm font-semibold text-white shadow-lg transition hover:bg-amber-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300 disabled:cursor-not-allowed disabled:bg-amber-300"
                  >
                    <LucideIcon name="ShoppingCart" className="h-5 w-5" />
                    Comprar créditos
                  </button>
                  <button
                    type="button"
                    onClick={() => balanceQuery.refetch()}
                    className="inline-flex items-center gap-2 rounded-full bg-white/70 px-4 py-2 text-xs font-semibold text-slate-600 ring-1 ring-slate-200 transition hover:bg-white"
                  >
                    <LucideIcon
                      name="RefreshCcw"
                      className={`h-4 w-4 ${isRefreshingBalance ? "animate-spin" : ""}`}
                    />
                    {isRefreshingBalance ? "Atualizando..." : "Atualizar saldo"}
                  </button>
                </div>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-3xl bg-white/80 p-5 shadow-lg ring-1 ring-slate-200">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600">
                    <LucideIcon name="Sparkles" className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-emerald-600">Créditos válidos</p>
                    <p className="text-lg font-bold text-slate-900">{formatCurrency(totals.valid)}</p>
                  </div>
                </div>
                <p className="mt-3 text-sm text-slate-600">
                  Utilize estes créditos para realizar novas simulações imediatamente.
                </p>
              </div>
              <div className="rounded-3xl bg-white/80 p-5 shadow-lg ring-1 ring-slate-200">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-500/10 text-slate-600">
                    <LucideIcon name="Layers" className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">Ajustes programados</p>
                    <p className="text-lg font-bold text-slate-900">{formatCredits(totals.legacy)}</p>
                  </div>
                </div>
                <p className="mt-3 text-sm text-slate-600">
                  Mantemos aqui ajustes automáticos vinculados às suas operações mais recentes.
                </p>
              </div>
            </div>
          </div>

          <div className="flex h-full flex-col gap-4 rounded-3xl bg-slate-900 p-6 text-white shadow-xl">
            <div className="space-y-3">
              <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-amber-200">
                <LucideIcon name="Users" className="h-4 w-4" />
                Programa de indicação
              </span>
              <h2 className="text-2xl font-semibold">Compartilhe seu código e ganhe créditos extras</h2>
              <p className="text-sm text-slate-200/80">
                Você pode compartilhar seu código com no máximo uma pessoa. Quando ela concluir a primeira compra, você recebe créditos bônus para utilizar nas próximas simulações.
              </p>
            </div>

            <div className="flex flex-col gap-3 rounded-2xl bg-white/10 p-5 text-sm">
              <div className="flex items-center justify-between text-xs uppercase tracking-wide text-slate-200">
                <span>Código</span>
                <span className="font-semibold text-white">
                  {referralQuery.isLoading
                    ? "Carregando..."
                    : referralQuery.isError
                      ? "Indisponível"
                      : referralQuery.data?.referral_code || "--"}
                </span>
              </div>
              <div className="grid gap-2">
                <div className="flex items-center justify-between">
                  <span>Total de indicações</span>
                  <span className="font-semibold text-white">
                    {referralQuery.data?.total_referrals ?? 0}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Créditos ganhos</span>
                  <span className="font-semibold text-emerald-300">
                    {referralQuery.data ? formatCredits(referralQuery.data.referral_credits_earned) : formatCredits(0)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Créditos disponíveis</span>
                  <span className="font-semibold text-amber-200">
                    {referralQuery.data ? formatCredits(referralQuery.data.referral_credits_remaining) : formatCredits(0)}
                  </span>
                </div>
              </div>
            </div>

            <p className="text-xs text-slate-200/70">
              {codeAvailable
                ? "Convide uma pessoa especial e combine com ela antes de compartilhar."
                : "Seu código já foi utilizado uma vez. Use o botão abaixo para enviar apenas o convite com o link."}
            </p>

            <button
              type="button"
              onClick={handleShare}
              className="inline-flex items-center justify-center gap-2 rounded-full bg-amber-500 px-5 py-2 text-sm font-semibold text-slate-900 shadow-lg transition hover:bg-amber-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300"
            >
              <LucideIcon name="Share2" className="h-4 w-4" />
              Compartilhar convite
            </button>
            {shareFeedback ? (
              <div className="rounded-xl bg-white/10 px-4 py-2 text-xs text-amber-100">
                {shareFeedback}
              </div>
            ) : null}

            <div className="mt-auto rounded-2xl bg-white/10 p-5 text-sm text-slate-200/80">
              <div className="flex items-start gap-3">
                <div className="mt-1 flex h-8 w-8 items-center justify-center rounded-full bg-amber-500/20 text-amber-200">
                  <LucideIcon name="Megaphone" className="h-4 w-4" />
                </div>
                <p>
                  Compartilhe seu convite nas redes sociais ou diretamente com quem mais precisa. Assim que a indicação for aprovada, os créditos bônus entrarão automaticamente no seu saldo.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}