import * as React from "react";
import { cn } from "@/lib/utils/cn";
import { MemoriesTab } from "@/features/library/memories-tab";
import { SkillsTab } from "@/features/library/skills-tab";
import { ToolsTab } from "@/features/library/tools-tab";

const TABS = [
  { id: "memory", label: "Memory" },
  { id: "skills", label: "Skills" },
  { id: "tools", label: "Tools" },
] as const;
type TabId = (typeof TABS)[number]["id"];

/** Docked Library: Memory / Skills / Tools (cached stores, reused unchanged). */
export function LibraryContent() {
  const [tab, setTab] = React.useState<TabId>("memory");
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 items-center gap-0.5 px-2 py-1.5" style={{ borderBottom: "0.5px solid var(--pm-border-subtle)" }}>
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={cn("rounded-[var(--pm-r-sm)] px-2 py-1 text-[11px] font-medium transition-colors")}
            style={tab === t.id ? { background: "var(--pm-bg-prominent)", color: "var(--pm-text-primary)" } : { color: "var(--pm-text-tertiary)" }}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {tab === "memory" && <MemoriesTab />}
        {tab === "skills" && <SkillsTab />}
        {tab === "tools" && <ToolsTab />}
      </div>
    </div>
  );
}
