import * as React from "react";
import { cn } from "@/lib/utils/cn";

/**
 * Palmier inspector building blocks (right dock, 260w). A sectioned list of
 * label/value rows under small uppercase headers. Dense, 11–12px, hairline
 * dividers — pure presentation for the selected asset/clip's metadata.
 */
export function InspectorSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col" style={{ borderBottom: "0.5px solid var(--pm-border-subtle)" }}>
      <h3
        className="px-3 pb-1 pt-3 text-[9px] font-semibold uppercase"
        style={{ color: "var(--pm-text-muted)", letterSpacing: "var(--pm-tracking-wide)" }}
      >
        {title}
      </h3>
      <div className="flex flex-col pb-2">{children}</div>
    </section>
  );
}

export function InspectorRow({ label, value, className }: { label: string; value: React.ReactNode; className?: string }) {
  return (
    <div className={cn("flex items-center justify-between gap-3 px-3 py-1", className)}>
      <span className="shrink-0 text-[11px]" style={{ color: "var(--pm-text-tertiary)" }}>{label}</span>
      <span className="min-w-0 truncate text-right text-[11px] font-medium" style={{ color: "var(--pm-text-secondary)" }}>{value}</span>
    </div>
  );
}
