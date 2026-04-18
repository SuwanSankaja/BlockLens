import type { SummaryCardItem } from "@/types/graph";

export default function SummaryCards({ items }: { items: SummaryCardItem[] }) {
  return (
    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {items.map((item) => (
        <article
          key={item.label}
          className="panel relative overflow-hidden rounded-3xl px-4 py-4"
        >
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-sky-300/45 to-transparent" />
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">
            {item.label}
          </p>
          <p className="mt-3 text-lg font-semibold text-slate-50">{item.value}</p>
          {item.hint ? (
            <p className="mt-1 text-xs text-slate-400">{item.hint}</p>
          ) : null}
        </article>
      ))}
    </section>
  );
}
