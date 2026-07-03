"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { CalendarPlus, Clock, ShoppingBag, UserPlus, Check } from "lucide-react";
import { cn } from "@/lib/utils";

const ITEMS = [
  { key: "reservar", href: "/reservar", label: "Reservar cita", icon: CalendarPlus },
  { key: "citas", href: "/citas", label: "Mis citas", icon: Clock },
  { key: "invitado", href: "/invitado", label: "Agregar invitado", icon: UserPlus },
  { key: "tienda", href: "/tienda", label: "Productos", icon: ShoppingBag },
] as const;

type ItemKey = (typeof ITEMS)[number]["key"];
const STORAGE_KEY = "quickAccessOrder.v1";
const LONG_PRESS_MS = 450;

export function QuickAccessGrid() {
  const router = useRouter();
  const [order, setOrder] = useState<ItemKey[]>(ITEMS.map((i) => i.key));
  const [editing, setEditing] = useState(false);
  const [dragKey, setDragKey] = useState<ItemKey | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startPos = useRef<{ x: number; y: number } | null>(null);
  const movedRef = useRef(false);

  // Load saved order
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as ItemKey[];
        const valid = parsed.filter((k) => ITEMS.some((i) => i.key === k));
        const missing = ITEMS.map((i) => i.key).filter((k) => !valid.includes(k));
        setOrder([...valid, ...missing]);
      }
    } catch {
      // ignore corrupt storage
    }
  }, []);

  function save(next: ItemKey[]) {
    setOrder(next);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // storage full/blocked — order just won't persist
    }
  }

  const indexFromPoint = useCallback(
    (clientX: number): number | null => {
      const el = containerRef.current;
      if (!el) return null;
      const rect = el.getBoundingClientRect();
      const cols = 4;
      const cellW = rect.width / cols;
      const col = Math.min(cols - 1, Math.max(0, Math.floor((clientX - rect.left) / cellW)));
      return Math.min(order.length - 1, col);
    },
    [order.length]
  );

  function clearPress() {
    if (pressTimer.current) {
      clearTimeout(pressTimer.current);
      pressTimer.current = null;
    }
  }

  function handlePointerDown(e: React.PointerEvent, key: ItemKey) {
    movedRef.current = false;
    startPos.current = { x: e.clientX, y: e.clientY };

    if (editing) {
      // Start dragging immediately in edit mode
      setDragKey(key);
      (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
      return;
    }
    // Long press enters edit mode
    clearPress();
    pressTimer.current = setTimeout(() => {
      setEditing(true);
      if (typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate?.(30);
    }, LONG_PRESS_MS);
  }

  function handlePointerMove(e: React.PointerEvent) {
    if (startPos.current) {
      const dx = e.clientX - startPos.current.x;
      const dy = e.clientY - startPos.current.y;
      if (Math.hypot(dx, dy) > 10) {
        movedRef.current = true;
        if (!editing) clearPress(); // scrolling, not long-pressing
      }
    }
    if (!editing || !dragKey) return;
    const target = indexFromPoint(e.clientX);
    if (target === null) return;
    const from = order.indexOf(dragKey);
    if (from === -1 || from === target) return;
    const next = [...order];
    next.splice(from, 1);
    next.splice(target, 0, dragKey);
    setOrder(next);
  }

  function handlePointerUp(key: ItemKey) {
    clearPress();
    if (editing) {
      if (dragKey) {
        save(order);
        setDragKey(null);
      }
      return;
    }
    // Normal tap → navigate
    if (!movedRef.current) {
      const item = ITEMS.find((i) => i.key === key);
      if (item) router.push(item.href);
    }
  }

  const sorted = order
    .map((k) => ITEMS.find((i) => i.key === k))
    .filter(Boolean) as unknown as typeof ITEMS[number][];

  return (
    <div className="space-y-2">
      {editing && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted">Arrastra las tarjetas para ordenarlas</p>
          <button
            onClick={() => {
              setEditing(false);
              setDragKey(null);
              save(order);
            }}
            className="flex items-center gap-1 text-xs font-bold text-brand bg-brand-light px-3 py-1.5 rounded-full"
          >
            <Check size={12} /> Listo
          </button>
        </div>
      )}

      <div ref={containerRef} className="grid grid-cols-4 gap-3 select-none touch-none">
        {sorted.map((item) => {
          const isDragging = dragKey === item.key;
          return (
            <div
              key={item.key}
              onPointerDown={(e) => handlePointerDown(e, item.key)}
              onPointerMove={handlePointerMove}
              onPointerUp={() => handlePointerUp(item.key)}
              onPointerCancel={() => {
                clearPress();
                setDragKey(null);
              }}
              onContextMenu={(e) => e.preventDefault()}
              className={cn(
                "flex flex-col items-center gap-2 cursor-pointer transition-transform",
                editing && !isDragging && "animate-wiggle",
                isDragging && "scale-110 z-10 opacity-80"
              )}
            >
              <div
                className={cn(
                  "w-full aspect-square max-w-[72px] rounded-2xl bg-surface border flex items-center justify-center",
                  editing ? "border-brand/40" : "border-border active:bg-brand-light"
                )}
              >
                <item.icon size={22} className="text-brand" />
              </div>
              <span className="text-[10px] font-medium text-muted text-center leading-tight">
                {item.label}
              </span>
            </div>
          );
        })}
      </div>

      {!editing && (
        <p className="text-[10px] text-muted/60 text-center">
          Mantén presionada una tarjeta para organizarlas
        </p>
      )}
    </div>
  );
}
