"use client";

import { useRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";

export function BackButton() {
  const router = useRouter();
  return (
    <button
      onClick={() => router.back()}
      aria-label="Volver"
      className="w-10 h-10 rounded-full bg-surface border border-border flex items-center justify-center shrink-0 active:bg-background"
    >
      <ChevronLeft size={20} />
    </button>
  );
}
