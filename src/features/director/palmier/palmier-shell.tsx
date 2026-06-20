import * as React from "react";
import { SplitPane } from "@/components/ui";

/**
 * Palmier spatial model (EditorView.swift, "default" preset): a collapsible
 * AGENT column on the left, then the preset root — row 1 [MEDIA | PREVIEW |
 * INSPECTOR], row 2 [TIMELINE] — as resizable panels (5px gaps via PanelShell
 * insets, persisted sizes). Pure arrangement; panels are passed in as nodes.
 * Before a production is opened, the home switcher fills the window.
 */
export function PalmierShell({
  inEditor,
  agentOpen,
  home,
  agent,
  media,
  preview,
  inspector,
  timeline,
}: {
  inEditor: boolean;
  agentOpen: boolean;
  home: React.ReactNode;
  agent: React.ReactNode;
  media: React.ReactNode;
  preview: React.ReactNode;
  inspector: React.ReactNode;
  timeline: React.ReactNode;
}) {
  if (!inEditor) return <div className="h-full">{home}</div>;

  const root = (
    <SplitPane direction="vertical" defaultSize={68} minFirst={220} minSecond={120} storageKey="pm.rows" className="flex-1">
      <SplitPane direction="horizontal" defaultSize={30} minFirst={240} minSecond={460} storageKey="pm.top" className="flex-1">
        {media}
        <SplitPane direction="horizontal" defaultSize={66} minFirst={320} minSecond={200} storageKey="pm.preview-inspector" className="flex-1">
          {preview}
          {inspector}
        </SplitPane>
      </SplitPane>
      {timeline}
    </SplitPane>
  );

  return (
    <div className="flex h-full min-h-0" style={{ background: "var(--pm-bg-base)" }}>
      {agentOpen ? (
        <SplitPane direction="horizontal" defaultSize={26} minFirst={240} minSecond={600} storageKey="pm.agent" className="flex-1">
          {agent}
          {root}
        </SplitPane>
      ) : (
        root
      )}
    </div>
  );
}
