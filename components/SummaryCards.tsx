"use client";

import { useEffect, useRef, useState } from "react";
import type { SummaryCardItem } from "@/types/graph";

/* ── Accent colors and icons per card index ── */
const CARD_ACCENTS = [
  {
    border: "border-l-sky-400",
    iconBg: "bg-sky-500/10",
    iconColor: "text-sky-400",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 7h-9" />
        <path d="M14 17H5" />
        <circle cx="17" cy="17" r="3" />
        <circle cx="7" cy="7" r="3" />
      </svg>
    ),
  },
  {
    border: "border-l-violet-400",
    iconBg: "bg-violet-500/10",
    iconColor: "text-violet-400",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <path d="M12 6v6l4 2" />
      </svg>
    ),
  },
  {
    border: "border-l-cyan-400",
    iconBg: "bg-cyan-500/10",
    iconColor: "text-cyan-400",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
      </svg>
    ),
  },
  {
    border: "border-l-amber-400",
    iconBg: "bg-amber-500/10",
    iconColor: "text-amber-400",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="14" width="7" height="7" rx="1" />
        <rect x="3" y="14" width="7" height="7" rx="1" />
      </svg>
    ),
  },
];

/* ── Animated counter ── */
function AnimatedValue({ value }: { value: string }) {
  const [displayed, setDisplayed] = useState(value);
  const prevRef = useRef(value);

  useEffect(() => {
    if (prevRef.current === value) return;
    prevRef.current = value;

    // If it's a number, animate it counting up
    const numericMatch = value.match(/^([\d,]+)/);
    if (numericMatch) {
      const target = parseInt(numericMatch[1].replace(/,/g, ""), 10);
      const suffix = value.slice(numericMatch[1].length);
      const duration = 500;
      const startTime = performance.now();
      const startValue = 0;

      function tick(now: number) {
        const elapsed = now - startTime;
        const progress = Math.min(elapsed / duration, 1);
        // ease out cubic
        const eased = 1 - Math.pow(1 - progress, 3);
        const current = Math.round(startValue + (target - startValue) * eased);
        setDisplayed(current.toLocaleString() + suffix);
        if (progress < 1) {
          requestAnimationFrame(tick);
        }
      }

      requestAnimationFrame(tick);
    } else {
      setDisplayed(value);
    }
  }, [value]);

  return <>{displayed}</>;
}

export default function SummaryCards({ items }: { items: SummaryCardItem[] }) {
  return (
    <section className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
      {items.map((item, index) => {
        const accent = CARD_ACCENTS[index % CARD_ACCENTS.length];
        return (
          <article
            key={item.label}
            className={`panel hover-lift relative overflow-hidden rounded-2xl border-l-2 ${accent.border} px-3 py-2.5 slide-up delay-${index + 1}`}
          >
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />

            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-500">
                  {item.label}
                </p>
                <p className="mt-1 truncate text-lg font-bold tracking-tight text-slate-50">
                  <AnimatedValue value={item.value} />
                </p>
                {item.hint ? (
                  <p className="truncate text-[11px] text-slate-500">{item.hint}</p>
                ) : null}
              </div>
              <div
                className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg ${accent.iconBg} ${accent.iconColor}`}
              >
                {accent.icon}
              </div>
            </div>
          </article>
        );
      })}
    </section>
  );
}
