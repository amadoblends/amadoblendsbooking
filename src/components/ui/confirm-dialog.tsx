"use client";

import { createContext, useCallback, useContext, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AlertTriangle, Trash2, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Replaces `window.confirm`.
 *
 * The browser's dialog can't be styled, says "localhost says" on a phone, and
 * blocks the whole page — after which the rest of the app looks like a
 * different product. This keeps the same one-line ergonomics:
 *
 *   const confirm = useConfirm();
 *   if (await confirm({ title: "¿Cancelar esta cita?" })) { ... }
 */

export interface ConfirmOptions {
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Red styling and a warning icon, for anything destructive. */
  destructive?: boolean;
}

type Resolver = (value: boolean) => void;

const ConfirmContext = createContext<(opts: ConfirmOptions) => Promise<boolean>>(
  async () => false
);

export function useConfirm() {
  return useContext(ConfirmContext);
}

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [options, setOptions] = useState<ConfirmOptions | null>(null);
  const [working, setWorking] = useState(false);
  const resolver = useRef<Resolver | null>(null);

  const confirm = useCallback((opts: ConfirmOptions) => {
    setOptions(opts);
    setWorking(false);
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve;
    });
  }, []);

  function close(result: boolean) {
    resolver.current?.(result);
    resolver.current = null;
    setOptions(null);
  }

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {options && typeof document !== "undefined" &&
        createPortal(
          <div
            className="fixed inset-0 z-[90] flex items-center justify-center p-5"
            style={{
              paddingTop: "max(1.25rem, var(--safe-top))",
              paddingBottom: "max(1.25rem, var(--safe-bottom))",
            }}
            role="alertdialog"
            aria-modal="true"
          >
            <div
              className="absolute inset-0 bg-black/70 backdrop-blur-md"
              onClick={() => close(false)}
            />

            <div className="relative w-full max-w-[330px] bg-surface rounded-[26px] ring-1 ring-border shadow-2xl animate-sheet-in p-5">
              <div className="flex flex-col items-center text-center gap-3">
                <span
                  className={cn(
                    "w-12 h-12 rounded-full flex items-center justify-center",
                    options.destructive ? "bg-danger-light" : "bg-brand-light"
                  )}
                >
                  {options.destructive ? (
                    <AlertTriangle size={22} className="text-danger" />
                  ) : (
                    <Trash2 size={20} className="text-brand" />
                  )}
                </span>

                <div>
                  <h2 className="text-[17px] font-bold text-foreground leading-tight">
                    {options.title}
                  </h2>
                  {options.message && (
                    <p className="text-sm text-muted mt-1.5 leading-relaxed">
                      {options.message}
                    </p>
                  )}
                </div>
              </div>

              <div className="flex gap-2 mt-5">
                <button
                  onClick={() => close(false)}
                  disabled={working}
                  className="flex-1 h-12 rounded-2xl border border-border bg-background text-sm font-semibold text-foreground active:scale-95 transition-transform"
                >
                  {options.cancelLabel ?? "Cancelar"}
                </button>
                <button
                  onClick={() => {
                    setWorking(true);
                    close(true);
                  }}
                  disabled={working}
                  className={cn(
                    "flex-1 h-12 rounded-2xl text-sm font-bold flex items-center justify-center gap-2 active:scale-95 transition-transform",
                    options.destructive
                      ? "bg-danger text-white"
                      : "bg-foreground text-background"
                  )}
                >
                  {working && <Loader2 size={15} className="animate-spin" />}
                  {options.confirmLabel ?? "Confirmar"}
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </ConfirmContext.Provider>
  );
}
