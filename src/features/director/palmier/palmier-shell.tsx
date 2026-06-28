import * as React from "react";
import { Clapperboard, Layers, Eye, Settings, Clock, X, MessageSquare } from "lucide-react";
import { SplitPane } from "@/components/ui";
import { PalmierIconButton } from "@/components/palmier";

export type RightPanelTab = "preview" | "media" | "inspector" | "timeline";

type Panes = { media: React.ReactNode; preview: React.ReactNode; inspector: React.ReactNode; timeline: React.ReactNode; editor: React.ReactNode };

const TABS: { id: RightPanelTab; icon: typeof Eye; label: string }[] = [
  { id: "preview", icon: Eye, label: "Preview" },
  { id: "media", icon: Layers, label: "Media" },
  { id: "inspector", icon: Settings, label: "Inspector" },
  { id: "timeline", icon: Clock, label: "Timeline" },
];

/**
 * Palmier spatial model: a top editor toolbar (agent toggle + tab switcher),
 * a collapsible AGENT column, then the tab content. Before a production is
 * opened, the home switcher fills the window.
 */
export function PalmierShell({
  inEditor,
  rightOpen,
  agentOpen,
  editorActive,
  onToggleAgent,
  onToggleEditor,
  onCloseRight,
  home,
  agent,
  media,
  preview,
  inspector,
  timeline,
  editor,
  rightPanelTab,
  onRightPanelTabChange,
}: {
  inEditor: boolean;
  /** Whether the whole right side (media/preview/inspector/timeline) is shown.
   *  When false, only the agent (chatbot) fills the window. Toggled from the
   *  agent header (see AgentColumn). */
  rightOpen: boolean;
  agentOpen: boolean;
  /** Whether the preview pane currently shows the full Editor (vs. the preview). */
  editorActive: boolean;
  onToggleAgent: () => void;
  onToggleEditor: () => void;
  onCloseRight: () => void;
  home: React.ReactNode;
  rightPanelTab: RightPanelTab;
  onRightPanelTabChange: (tab: RightPanelTab) => void;
} & { agent: React.ReactNode } & Panes) {
  if (!inEditor) return <div className="h-full">{home}</div>;

  // Simplified tab view: show only the active tab's content
  const tabContent = React.useMemo(() => {
    switch (rightPanelTab) {
      case "preview":
        return preview;
      case "media":
        return media;
      case "inspector":
        return inspector;
      case "timeline":
        return timeline;
    }
  }, [rightPanelTab, preview, media, inspector, timeline]);

  return (
    <div className="flex h-full min-h-0 flex-col" style={{ background: "var(--pm-bg-base)" }}>
      <div className="flex min-h-0 flex-1">
        {!rightOpen ? (
          // Right side closed: the chatbot fills the window.
          <div className="flex min-h-0 flex-1">{agent}</div>
        ) : (
          <>
            {/* Main content area */}
            {agentOpen ? (
              <SplitPane direction="horizontal" defaultSize={26} minFirst={240} minSecond={600} storageKey="pm.agent" className="flex-1">
                {agent}
                {editorActive ? editor : (
                  <div className="flex min-h-0 flex-1">
                    {tabContent}
                  </div>
                )}
              </SplitPane>
            ) : (
              editorActive ? editor : (
                <div className="flex min-h-0 flex-1">
                  {tabContent}
                </div>
              )
            )}
            {/* Vertical tab sidebar on the right */}
            <div className="flex w-16 flex-col items-center border-l border-zinc-800 bg-zinc-900/50 py-2">
              <PalmierIconButton icon={MessageSquare} label="Toggle chat" active={agentOpen} onClick={onToggleAgent} size={32} glyph={18} />
              <div className="my-2 h-px w-10 bg-zinc-800" />
              {/* Vertical tab navigation */}
              <div className="flex flex-col gap-2">
                {TABS.map((tab) => {
                  const Icon = tab.icon;
                  return (
                    <PalmierIconButton
                      key={tab.id}
                      icon={Icon}
                      label={tab.label}
                      active={rightPanelTab === tab.id}
                      onClick={() => {
                        onRightPanelTabChange(tab.id);
                        if (editorActive) {
                          onToggleEditor();
                        }
                      }}
                      size={32}
                      glyph={18}
                    />
                  );
                })}
              </div>
              <div className="my-2 h-px w-10 bg-zinc-800" />
              {/* Swap the preview pane to the full Editor (and back). */}
              <PalmierIconButton icon={Clapperboard} label="Editor" active={editorActive} onClick={() => {
                if (!editorActive) {
                  onToggleEditor();
                }
              }} size={32} glyph={18} />
              <div className="flex-1" />
              {/* Close right panel */}
              <PalmierIconButton icon={X} label="Close panel" onClick={onCloseRight} size={32} glyph={18} />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
