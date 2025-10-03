"use client";

import type { CSSProperties, ReactNode } from "react";
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

const overlaySafeAreaStyle: CSSProperties = {
  paddingTop: "max(env(safe-area-inset-top, 0px), 24px)",
  paddingBottom: "max(env(safe-area-inset-bottom, 0px), 24px)",
  paddingLeft: "max(env(safe-area-inset-left, 0px), 16px)",
  paddingRight: "max(env(safe-area-inset-right, 0px), 16px)",
};

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
    <div
      className="platform-fullscreen-modal fixed inset-0 z-[70] flex items-center justify-center"
      style={overlaySafeAreaStyle}
    >
      <div className="absolute inset-0 bg-slate-900/70" onClick={onClose} aria-hidden="true" />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? headingId : undefined}
        className={clsx(
          "platform-fullscreen-modal__panel relative z-10 flex w-full max-w-[min(640px,100%)] flex-col overflow-hidden rounded-[24px] bg-white text-slate-900 shadow-2xl transition-[transform,opacity] sm:max-w-[min(720px,100%)] sm:rounded-[28px] md:rounded-[32px]",
          "max-h-[calc(100svh-48px)] sm:max-h-[calc(100svh-72px)]",
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
        <div className="flex-1 overflow-y-auto">
          {children}
        </div>
      </div>
    </div>,
    document.body,
  );
}