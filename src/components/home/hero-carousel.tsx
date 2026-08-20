"use client";

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import Image from "next/image";
import Link from "next/link";
import { Scissors } from "lucide-react";
import { cn } from "@/lib/utils";
import { visiblePosts, nextTransitionAt } from "@/lib/carousel-status";
import { translate } from "@/lib/i18n";
import { cropStyle, normalizeCrop } from "@/lib/carousel-crop";

export interface CarouselPost {
  id: string;
  title: string;
  description: string | null;
  image_url: string | null;
  type: string;
  button_label: string | null;
  button_href: string | null;
  // The publication window, evaluated live — see lib/carousel-status
  is_active: boolean;
  is_draft: boolean | null;
  is_permanent: boolean | null;
  starts_at: string | null;
  ends_at: string | null;
  /** Which part of the image shows — see lib/carousel-crop. */
  focal_x?: number | null;
  focal_y?: number | null;
  zoom?: number | null;
}

const TYPE_META: Record<string, { label: string; labelEn: string; emoji: string }> = {
  promocion: { label: "Promoción", labelEn: "Promotion", emoji: "🎉" },
  oferta: { label: "Oferta", labelEn: "Deal", emoji: "🏷️" },
  vacaciones: { label: "Vacaciones", labelEn: "Vacation", emoji: "🌴" },
  cerrado: { label: "Cerrado", labelEn: "Closed", emoji: "🚫" },
  holiday: { label: "Feriado", labelEn: "Holiday", emoji: "📅" },
  aviso: { label: "Aviso", labelEn: "Notice", emoji: "📢" },
  servicio: { label: "Nuevo", labelEn: "New", emoji: "✂️" },
  info: { label: "Info", labelEn: "Info", emoji: "ℹ️" },
};

const AUTOPLAY_MS = 6000;

export function HeroCarousel({
  posts,
  lang = "es",
}: {
  posts: CarouselPost[];
  lang?: "es" | "en";
}) {
  const [index, setIndex] = useState(0);
  const trackRef = useRef<HTMLDivElement>(null);
  const pausedRef = useRef(false);

  /*
   * Expiry is a clock event, not a database change, so realtime never fires
   * for it. `now` advances at exactly the moment the soonest post starts or
   * ends, which re-runs the filter below and drops the finished slide without
   * a refresh, a re-login or any action from the client.
   */
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const next = nextTransitionAt(posts, now);
    if (next === null) return;
    // A second of slack so the boundary is safely behind us when we re-check
    const id = setTimeout(() => setNow(Date.now()), Math.max(next - Date.now() + 1000, 1000));
    return () => clearTimeout(id);
  }, [posts, now]);

  // Coming back to a backgrounded tab must not show a stale window either
  useEffect(() => {
    function onVisible() {
      if (document.visibilityState === "visible") setNow(Date.now());
    }
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, []);

  /*
   * Live content wins; permanent brand content fills in when nothing is
   * running. A finished promotion is never a fallback.
   */
  const visible = useMemo(() => visiblePosts(posts, now), [posts, now]);
  // The fallback is the only slide whose text we author, so it gets
  // translated like everything else the client reads.
  const slides =
    visible.length > 0
      ? visible
      : [{ ...FALLBACK, title: translate("carousel.fallbackTitle", lang) }];
  const count = slides.length;

  // A shrinking list must not leave the dots pointing past the end
  useEffect(() => {
    setIndex((i) => (i < count ? i : 0));
  }, [count]);

  const scrollTo = useCallback((i: number) => {
    const track = trackRef.current;
    if (!track) return;
    track.scrollTo({ left: track.clientWidth * i, behavior: "smooth" });
  }, []);

  // Auto-advance, paused while the user is touching the track
  useEffect(() => {
    if (count < 2) return;
    const id = setInterval(() => {
      if (pausedRef.current) return;
      setIndex((prev) => {
        const next = (prev + 1) % count;
        scrollTo(next);
        return next;
      });
    }, AUTOPLAY_MS);
    return () => clearInterval(id);
  }, [count, scrollTo]);

  // Keep the dots in sync when the user swipes
  function handleScroll() {
    const track = trackRef.current;
    if (!track) return;
    const i = Math.round(track.scrollLeft / track.clientWidth);
    if (i !== index) setIndex(i);
  }

  return (
    <div className="space-y-2">
      <div
        ref={trackRef}
        onScroll={handleScroll}
        onPointerDown={() => (pausedRef.current = true)}
        onPointerUp={() => (pausedRef.current = false)}
        onPointerLeave={() => (pausedRef.current = false)}
        className="flex overflow-x-auto snap-x snap-mandatory no-scrollbar rounded-3xl"
      >
        {slides.map((post) => (
          <Slide key={post.id} post={post} lang={lang} />
        ))}
      </div>

      {count > 1 && (
        <div className="flex items-center justify-center gap-1.5">
          {slides.map((_, i) => (
            <button
              key={i}
              onClick={() => {
                setIndex(i);
                scrollTo(i);
              }}
              aria-label={`Ir a la publicación ${i + 1}`}
              className={cn(
                "h-1.5 rounded-full transition-all",
                i === index ? "w-5 bg-brand" : "w-1.5 bg-border"
              )}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function Slide({ post, lang }: { post: CarouselPost; lang: "es" | "en" }) {
  const meta = TYPE_META[post.type] ?? TYPE_META.aviso;

  const body = (
    <div
      className="relative w-full min-w-full snap-center overflow-hidden rounded-3xl border border-border"
      style={
        post.image_url
          ? {
              backgroundImage: `linear-gradient(100deg, rgba(11,11,13,0.94) 5%, rgba(11,11,13,0.7) 55%, rgba(11,11,13,0.35) 100%), url('${post.image_url}')`,
              // The framing the barber chose, applied by the same CSS their
              // preview used — see lib/carousel-crop
              ...cropStyle(
                normalizeCrop({ focal_x: post.focal_x, focal_y: post.focal_y, zoom: post.zoom })
              ),
            }
          : {
              backgroundImage:
                "linear-gradient(100deg, rgba(11,11,13,0.95) 5%, rgba(11,11,13,0.6) 50%, rgba(255,106,61,0.35) 130%)",
            }
      }
    >
      <div className="p-5 pr-24 min-h-[168px] flex flex-col justify-center">
        <span className="inline-flex self-start items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-brand bg-brand/15 px-2 py-1 rounded-full mb-2">
          {meta.emoji} {lang === "en" ? meta.labelEn : meta.label}
        </span>

        <p className="text-[22px] leading-[1.15] font-black text-white uppercase">{post.title}</p>

        {post.description && (
          <p className="text-xs text-white/70 mt-1.5 line-clamp-2 max-w-[85%]">
            {post.description}
          </p>
        )}

        {post.button_label && (
          <span className="mt-3 inline-flex self-start bg-brand text-white text-xs font-bold px-4 py-2 rounded-xl">
            {post.button_label}
          </span>
        )}
      </div>

      {!post.image_url && (
        <Scissors
          size={90}
          className="absolute -right-3 top-1/2 -translate-y-1/2 text-brand/15 rotate-[-20deg]"
        />
      )}
    </div>
  );

  if (post.button_href) {
    return (
      <Link href={post.button_href} className="min-w-full snap-center">
        {body}
      </Link>
    );
  }
  return body;
}

// Last resort: nothing live and no permanent content configured either
const FALLBACK: CarouselPost = {
  id: "fallback",
  title: "",
  description: null,
  image_url: null,
  type: "info",
  button_label: null,
  button_href: null,
  is_active: true,
  is_draft: false,
  is_permanent: true,
  starts_at: null,
  ends_at: null,
};
