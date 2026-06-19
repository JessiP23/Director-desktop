import * as React from "react";
import { SlideOver } from "@/components/ui/slide-over";
import { cn } from "@/lib/utils/cn";
import { MemoriesTab } from "./memories-tab";
import { SkillsTab } from "./skills-tab";
import { ToolsTab } from "./tools-tab";

const TABS = [
  { id: "memory", label: "Memory" },
  { id: "skills", label: "Skills" },
  { id: "tools", label: "Tools" },
] as const;

type TabId = (typeof TABS)[number]["id"];

/**
 * The user-scoped "library": Memory, Skills, and Tools, mirroring WM Studio.
 * Each tab reads from its cached store, so opening/closing or switching tabs is
 * instant and never re-fetches on agent output.
 */
export function LibraryPanel({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const [tab, setTab] = React.useState<TabId>("memory");

  return (
    <SlideOver
      title="Library"
      isOpen={isOpen}
      onClose={onClose}
      header={
        <div className="flex items-center gap-0.5 rounded-lg bg-ink-800 p-0.5">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={cn(
                "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                tab === t.id ? "bg-ink-600 text-fg" : "text-fg-muted hover:text-fg",
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
      }
    >
      {tab === "memory" && <MemoriesTab />}
      {tab === "skills" && <SkillsTab />}
      {tab === "tools" && <ToolsTab />}
    </SlideOver>
  );
}
