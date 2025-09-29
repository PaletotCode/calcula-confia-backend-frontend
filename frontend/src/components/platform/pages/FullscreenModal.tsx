"use client";

import type { ReactNode } from "react";
import { useCallback, useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";
import clsx from "clsx";

interface FullscreenModalProps {
  open: boolean;
  title?: string;
  onClose: () => void;
  children: ReactNode;
  className?: string;
}

export default function FullscreenModal({ open, title, onClose, children, className }: FullscreenModalProps) {
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const headingId = useId();

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    },
    [onClose],
  );

  useEffect(() => {
    if (!open) {
      return;
    }

    document.addEventListener("keydown", handleKeyDown);
    const button = closeButtonRef.current;
    button?.focus({ preventScroll: true });

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [handleKeyDown, open]);

  if (!open) {
    return null;
  }

  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-center justify-center">
      <div className="absolute inset-0 bg-slate-900/70" onClick={onClose} aria-hidden="true" />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? headingId : undefined}
        className={clsx(
          "relative z-10 flex h-[96vh] w-[min(640px,90vw)] flex-col overflow-hidden rounded-3xl bg-white text-slate-900 shadow-2xl",
          className,
        )}
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <h2 id={headingId} className="text-lg font-semibold text-slate-900">
            {title}
          </h2>
          <button
            ref={closeButtonRef}
            type="button"
            className="rounded-full bg-slate-100 px-3 py-1 text-sm font-semibold text-slate-600 transition hover:bg-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
            onClick={onClose}
          >
            Fechar
          </button>
        </div>
        <div className="flex-1 overflow-auto px-6 py-4">
          {children}
        </div>
      </div>
    </div>,
    document.body,
  );
}