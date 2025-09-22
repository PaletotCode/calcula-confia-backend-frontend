"use client";

import Link from "next/link";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState, Suspense } from "react";
import { LucideIcon, type IconName } from "@/components/LucideIcon";
import useAuth from "@/hooks/useAuth";
import { confirmPayment } from "@/lib/api";
import clsx from "clsx";

type PaymentStatus = "success" | "pending" | "failure";

type StatusContent = {
  title: string;
  subtitle: string;
  description: string;
  icon: IconName;
  accentColor: string;
};

const STATUS_CONTENT: Record<PaymentStatus, StatusContent> = {
  success: {
    title: "Pagamento Aprovado!",
    subtitle: "Seu acesso foi liberado.",
    description: "Preparamos tudo para você. Em instantes, você será redirecionado para a plataforma para começar sua análise.",
    icon: "CircleCheckBig",
    accentColor: "text-green-500",
  },
  pending: {
    title: "Pagamento Pendente",
    subtitle: "Aguardando confirmação.",
    description: "Assim que o pagamento for aprovado, seu acesso será liberado automaticamente. Você também receberá uma notificação por e-mail.",
    icon: "Clock",
    accentColor: "text-yellow-500",
  },
  failure: {
    title: "Falha no Pagamento",
    subtitle: "Não foi possível processar.",
    description: "Houve um problema ao processar seu pagamento. Por favor, verifique os dados e tente novamente ou utilize outra forma de pagamento.",
    icon: "TriangleAlert",
    accentColor: "text-red-500",
  },
};

function PaymentStatusComponent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { refresh, isAuthenticated } = useAuth();

  const [isConfirming, setIsConfirming] = useState(true);
  const [confirmedStatus, setConfirmedStatus] = useState<PaymentStatus | null>(null);

  const paymentId = useMemo(() => searchParams.get("payment_id"), [searchParams]);
  const status = useMemo(() => {
    const param = searchParams.get("status");
    if (param === "approved" || param === "success") return "success";
    if (param === "in_process" || param === "pending") return "pending";
    return "failure";
  }, [searchParams]);

  useEffect(() => {
    if (paymentId && isAuthenticated) {
      confirmPayment({ payment_id: paymentId })
        .then(() => {
          setConfirmedStatus("success");
          void refresh(); // Força a atualização dos créditos do usuário
        })
        .catch(() => {
          // Se a confirmação da API falhar, confia no status da URL
          setConfirmedStatus(status);
        })
        .finally(() => {
          setIsConfirming(false);
        });
    } else {
      setIsConfirming(false);
      setConfirmedStatus(status);
    }
  }, [paymentId, status, refresh, isAuthenticated]);

  useEffect(() => {
    if (confirmedStatus === 'success') {
      const timer = setTimeout(() => {
        router.replace("/platform");
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [confirmedStatus, router]);
  
  const content = useMemo(() => {
      const currentStatus = confirmedStatus ?? "pending";
      return STATUS_CONTENT[currentStatus];
  },[confirmedStatus]);


  if (isConfirming) {
    return (
        <div className="w-full max-w-lg text-center">
            <h1 className="text-2xl font-bold text-slate-700">Confirmando seu pagamento...</h1>
            <p className="text-slate-500">Isso pode levar alguns segundos.</p>
        </div>
    );
  }

  return (
    <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-xl">
      <LucideIcon name={content.icon} className={clsx("mx-auto mb-6 h-16 w-16", content.accentColor)} />
      <h1 className="mb-2 text-3xl font-bold text-slate-800">{content.title}</h1>
      <p className="mb-6 text-slate-600">{content.subtitle}</p>
      <p className="mb-8 text-sm text-slate-500">{content.description}</p>
      <div className="flex flex-col gap-4 sm:flex-row sm:justify-center">
        {confirmedStatus === 'success' ? (
             <Link
                href="/platform"
                className="cta-button inline-block rounded-lg px-8 py-3 font-bold text-white shadow-md"
              >
                Ir para a Plataforma
              </Link>
        ) : (
            <Link
                href="/#preco"
                className="cta-button inline-block rounded-lg px-8 py-3 font-bold text-white shadow-md"
              >
                Tentar Novamente
              </Link>
        )}
        <Link
          href="/"
          className="inline-block rounded-lg bg-slate-100 px-8 py-3 font-semibold text-slate-700 transition-colors hover:bg-slate-200"
        >
          Voltar ao Início
        </Link>
      </div>
    </div>
  );
}


export default function PaymentPage() {
    return (
        <div className="flex min-h-screen flex-col bg-[var(--background-light)] text-slate-900">
          <header className="glass-effect fixed inset-x-0 top-0 z-50">
            <div className="container mx-auto flex items-center justify-between px-4 py-3 md:px-6">
              <Link href="/" className="flex items-center space-x-2">
                <Image src="https://i.imgur.com/64Tovft.png" alt="Logotipo CalculaConfia" width={120} height={32} className="h-8 w-auto" />
                <span className="hidden text-2xl font-bold text-slate-800 sm:block">
                  Calcula<span className="text-[var(--primary-accent)]">Confia</span>
                </span>
              </Link>
            </div>
          </header>

          <main className="flex flex-grow items-center justify-center px-4 pt-16">
            <Suspense fallback={<div className="text-slate-500">Carregando status do pagamento...</div>}>
                <PaymentStatusComponent />
            </Suspense>
          </main>

          <footer className="bg-slate-900 py-12 text-white">
            <div className="container mx-auto px-6 text-center text-xs text-slate-400 sm:text-sm">
                <p className="mx-auto max-w-3xl">
                  <strong>Aviso Legal:</strong> Nosso cálculo estimativo é válido em todo o território nacional e restrito a unidades consumidoras residenciais. A CalculaConfia é uma ferramenta de software para estimativa e não constitui aconselhamento jurídico.
                </p>
                <p className="mt-6 text-slate-500">© 2025 Torres Project. Todos os direitos reservados.</p>
            </div>
          </footer>
        </div>
      );
}