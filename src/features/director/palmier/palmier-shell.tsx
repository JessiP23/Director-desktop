import * as React from "react";
import { SplitPane } from "@/components/ui";
import { PalmierIconButton, PalmierToolbar, ToolbarDivider, ToolbarGroup } from "@/components/palmier";

export type Preset = "default" | "media" | "vertical";

type Panes = { media: React.ReactNode; preview: React.ReactNode; inspector: React.ReactNode; timeline: React.ReactNode };

const H = (props: React.ComponentProps<typeof SplitPane>) => <SplitPane direction="horizontal" className="flex-1" {...props} />;
const V = (props: React.ComponentProps<typeof SplitPane>) => <SplitPane direction="vertical" className="flex-1" {...props} />;

/** The preset root (EditorView.swift): media/preview/inspector/timeline arranged
 *  per the chosen preset, with persisted resizable splits. */
function PresetRoot({ preset, media, preview, inspector, timeline }: { preset: Preset } & Panes) {
  const pi = (
    <H defaultSize={66} minFirst={320} minSecond={200} storageKey="pm.preview-inspector">
      {preview}
      {inspector}
    </H>
  );
  if (preset === "media") {
    return (
      <H defaultSize={30} minFirst={240} minSecond={460} storageKey="pm.media-rest">
        {media}
        <V defaultSize={62} minFirst={200} minSecond={120} storageKey="pm.media-rows">
          {pi}
          {timeline}
        </V>
      </H>
    );
  }
  if (preset === "vertical") {
    return (
      <H defaultSize={58} minFirst={300} minSecond={300} storageKey="pm.vertical">
        <V defaultSize={62} minFirst={200} minSecond={120} storageKey="pm.vertical-rows">
          <H defaultSize={62} minFirst={220} minSecond={180} storageKey="pm.vertical-mi">
            {media}
            {inspector}
          </H>
          {timeline}
        </V>
        {preview}
      </H>
    );
  }
  // default: [media | preview | inspector] over timeline
  return (
    <V defaultSize={68} minFirst={220} minSecond={120} storageKey="pm.rows">
      <H defaultSize={30} minFirst={240} minSecond={460} storageKey="pm.top">
        {media}
        {pi}
      </H>
      {timeline}
    </V>
  );
}

const PRESETS: { id: Preset; icon: "grid" | "sidebar" | "inspector"; label: string }[] = [
  { id: "default", icon: "grid", label: "Default layout" },
  { id: "media", icon: "sidebar", label: "Media layout" },
  { id: "vertical", icon: "inspector", label: "Vertical layout" },
];

/**
 * Palmier spatial model: a top editor toolbar (agent toggle + preset switcher),
 * a collapsible AGENT column, then the preset root. Before a production is
 * opened, the home switcher fills the window.
 */
export function PalmierShell({
  inEditor,
  agentOpen,
  preset,
  onToggleAgent,
  onPreset,
  home,
  agent,
  media,
  preview,
  inspector,
  timeline,
}: {
  inEditor: boolean;
  agentOpen: boolean;
  preset: Preset;
  onToggleAgent: () => void;
  onPreset: (p: Preset) => void;
  home: React.ReactNode;
} & { agent: React.ReactNode } & Panes) {
  if (!inEditor) return <div className="h-full">{home}</div>;

  const root = <PresetRoot preset={preset} media={media} preview={preview} inspector={inspector} timeline={timeline} />;

  return (
    <div className="flex h-full min-h-0 flex-col" style={{ background: "var(--pm-bg-base)" }}>
      <PalmierToolbar className="!h-[30px]">
        <PalmierIconButton name="chat" label="Toggle chat" active={agentOpen} onClick={onToggleAgent} />
        <ToolbarDivider />
        <ToolbarGroup>
          {PRESETS.map((p) => (
            <PalmierIconButton key={p.id} name={p.icon} label={p.label} active={preset === p.id} onClick={() => onPreset(p.id)} />
          ))}
        </ToolbarGroup>
      </PalmierToolbar>
      <div className="flex min-h-0 flex-1">
        {agentOpen ? (
          <SplitPane direction="horizontal" defaultSize={26} minFirst={240} minSecond={600} storageKey="pm.agent" className="flex-1">
            {agent}
            {root}
          </SplitPane>
        ) : (
          root
        )}
      </div>
    </div>
  );
}
