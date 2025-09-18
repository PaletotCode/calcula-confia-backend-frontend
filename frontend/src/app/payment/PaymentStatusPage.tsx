"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { LucideIcon, type IconName } from "@/components/LucideIcon";
import useAuth from "@/hooks/useAuth";
import {
  extractCreditsFromUser,
  inferPurchaseFromUser,
} from "@/utils/user-credits";

type PaymentStatus = "success" | "pending" | "failure";

type StatusContent = {
  title: string;
  subtitle: string;
  description: string;
  icon: IconName;
  accent: string;
  highlight?: string;
  timeoutMessage?: string;
};

const STATUS_CONTENT: Record<PaymentStatus, StatusContent> = {
  success: {
    title: "Pagamento confirmado!",
    subtitle: "Estamos liberando seus créditos na plataforma.",
    description:
      "Atualizamos automaticamente o seu acesso a cada poucos segundos. Assim que o Mercado Pago finalizar a confirmação, vamos redirecionar você para a plataforma.",
    icon: "CircleCheckBig",
    accent: "bg-green-500/15 text-green-300",
    highlight:
      "Obrigado por confiar na CalculaConfia. Estamos garantindo que tudo esteja pronto para você aproveitar seus créditos.",
    timeoutMessage:
      "Se a confirmação demorar mais que alguns minutos, clique no botão abaixo para acessar a plataforma e verificar manualmente.",
  },
  pending: {
    title: "Pagamento em processamento",
    subtitle: "Ainda não recebemos a confirmação do Mercado Pago.",
    description:
      "Tudo certo por aqui! Assim que a operadora concluir a análise do pagamento, vamos liberar seus créditos automaticamente.",
    icon: "Clock",
    accent: "bg-yellow-500/15 text-yellow-200",
    highlight:
      "Você não precisa fazer nada agora. Pode deixar esta página aberta que cuidamos de atualizar tudo para você.",
    timeoutMessage:
      "Caso já tenham se passado alguns minutos, acesse a plataforma para conferir o status ou tente novamente iniciar o pagamento.",
  },
  failure: {
    title: "Pagamento não foi concluído",
    subtitle: "Identificamos que o pagamento foi cancelado ou não autorizado.",
    description:
      "Você pode tentar novamente iniciando um novo pagamento ou revisar os dados informados. Se o valor já tiver sido debitado, ele deve ser estornado automaticamente pela operadora.",
    icon: "CircleX",
    accent: "bg-red-500/15 text-red-200",
    highlight:
      "Caso precise de ajuda, entre em contato com a nossa equipe. Estamos prontos para apoiar você na finalização do acesso.",
    timeoutMessage:
      "Se acredita que o pagamento foi concluído, acesse a plataforma para verificar seus créditos atualizados.",
  },
};

interface PaymentStatusPageProps {
  status: PaymentStatus;
}

export function PaymentStatusPage({ status }: PaymentStatusPageProps) {
  const router = useRouter();
  const { refresh, user, isAuthenticated } = useAuth();
  const [hasTimedOut, setHasTimedOut] = useState(false);

  const content = useMemo(() => STATUS_CONTENT[status], [status]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    let intervalId: number | null = null;
    let timeoutId: number | null = null;
    let disposed = false;

    const runRefresh = async () => {
      try {
        await refresh();
      } catch (error) {
        console.error("Falha ao atualizar a sessão", error);
      }
    };

    void runRefresh();

    intervalId = window.setInterval(() => {
      void refresh();
    }, 4000);

    timeoutId = window.setTimeout(() => {
      if (!disposed) {
        setHasTimedOut(true);
      }
      if (intervalId) {
        window.clearInterval(intervalId);
        intervalId = null;
      }
    }, 2 * 60 * 1000);

    return () => {
      disposed = true;
      if (intervalId) {
        window.clearInterval(intervalId);
      }
      if (timeoutId) {
        window.clearTimeout(timeoutId);
      }
    };
  }, [refresh]);

  useEffect(() => {
    if (!isAuthenticated) {
      return;
    }
    const credits = extractCreditsFromUser(user);
    if (credits > 0 || inferPurchaseFromUser(user)) {
      router.replace("/platform");
    }
  }, [isAuthenticated, router, user]);

  const showLoginReminder = !isAuthenticated && status !== "failure";

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-white">
      <div className="mx-auto flex min-h-screen w-full max-w-3xl flex-col justify-center px-4 py-12">
        <div className="glass-effect rounded-3xl border border-white/10 bg-white/10 p-8 shadow-2xl backdrop-blur">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              <span
                className={`flex h-14 w-14 items-center justify-center rounded-full text-2xl font-bold ${content.accent}`}
              >
                <LucideIcon name={content.icon} className="h-7 w-7" />
              </span>
              <div>
                <p className="text-sm uppercase tracking-wide text-white/60">Status do pagamento</p>
                <h1 className="text-2xl font-semibold sm:text-3xl">{content.title}</h1>
              </div>
            </div>
          </div>

          <div className="mt-6 space-y-4 text-white/80">
            <p className="text-base font-medium text-white/90">{content.subtitle}</p>
            <p className="leading-relaxed">{content.description}</p>
            {content.highlight ? (
              <p className="rounded-2xl border border-white/10 bg-white/10 p-4 text-sm text-white/90">
                {content.highlight}
              </p>
            ) : null}
            {hasTimedOut && content.timeoutMessage ? (
              <p className="rounded-2xl border border-yellow-500/20 bg-yellow-500/10 p-4 text-sm text-yellow-100">
                {content.timeoutMessage}
              </p>
            ) : null}
            {showLoginReminder ? (
              <p className="rounded-2xl border border-white/20 bg-white/5 p-4 text-sm text-white/80">
                Identificamos que você ainda não está autenticado. Use o botão abaixo para acessar a plataforma com o mesmo e-mail
                utilizado na compra e verificar os seus créditos.
              </p>
            ) : null}
          </div>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
            <Link
              href="/platform"
              className="cta-button inline-flex w-full items-center justify-center rounded-xl px-5 py-3 text-center text-sm font-semibold uppercase tracking-wide text-white shadow-lg transition hover:scale-[1.01] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 sm:w-auto"
            >
              Acessar a plataforma
            </Link>
            <Link
              href="/"
              className="inline-flex w-full items-center justify-center rounded-xl border border-white/20 px-5 py-3 text-center text-sm font-semibold text-white/80 transition hover:border-white/40 hover:text-white sm:w-auto"
            >
              Voltar para a página inicial
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export default PaymentStatusPage;