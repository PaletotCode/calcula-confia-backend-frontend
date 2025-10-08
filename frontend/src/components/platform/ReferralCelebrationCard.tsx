"use client";

import clsx from "clsx";
import { LucideIcon } from "@/components/LucideIcon";

interface ReferralCelebrationCardProps {
  onDismiss?: () => void;
  className?: string;
}

export default function ReferralCelebrationCard({ onDismiss, className }: ReferralCelebrationCardProps) {
  return (
    <div
      className={clsx(
        "relative overflow-hidden rounded-3xl bg-gradient-to-r from-amber-500 via-pink-500 to-purple-600 p-6 text-white shadow-xl ring-1 ring-amber-200/70",
        className,
      )}
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.25),_transparent_55%)] opacity-70" />
      <div className="pointer-events-none absolute -left-16 -top-20 h-48 w-48 rounded-full bg-white/20 blur-3xl" />
      <div className="relative flex flex-col gap-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full bg-white/20 px-3 py-1 text-xs font-semibold uppercase tracking-[0.3em] text-white/80">
              <LucideIcon name="Sparkles" className="h-4 w-4" />
              Indicação confirmada
            </span>
            <h2 className="mt-3 text-2xl font-bold md:text-3xl">Parabéns! Você ganhou 1 crédito bônus 🎉</h2>
            <p className="mt-2 max-w-xl text-sm text-white/80 md:text-base">
              Obrigado por usar um código de indicação. Aproveite o crédito extra para iniciar sua primeira simulação agora mesmo.
            </p>
          </div>
          <div className="flex items-start gap-3">
            <div className="rounded-2xl bg-white/15 p-3">
              <LucideIcon name="Gift" className="h-6 w-6" />
            </div>
            {onDismiss ? (
              <button
                type="button"
                onClick={onDismiss}
                className="rounded-full bg-white/20 p-2 text-white transition hover:bg-white/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
                aria-label="Fechar aviso de indicação"
              >
                <LucideIcon name="X" className="h-4 w-4" />
              </button>
            ) : null}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs text-white/70">
          <span className="inline-flex items-center gap-1 rounded-full bg-white/10 px-3 py-1">
            <LucideIcon name="CircleCheck" className="h-4 w-4" />
            Crédito aplicado automaticamente
          </span>
          <span className="inline-flex items-center gap-1 rounded-full bg-white/10 px-3 py-1">
            <LucideIcon name="Wand" className="h-4 w-4" />
            Use em qualquer simulação
          </span>
        </div>
      </div>
    </div>
  );
}
