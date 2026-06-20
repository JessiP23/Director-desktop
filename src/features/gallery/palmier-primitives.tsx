import * as React from "react";
import {
  Clip,
  IconRail,
  InspectorRow,
  InspectorSection,
  PalmierIconButton,
  PalmierToolbar,
  PanelHeaderBar,
  PanelShell,
  StarterPromptCard,
  ToolbarDivider,
  ToolbarGroup,
  ToolbarSpacer,
  Track,
  type RailTab,
} from "@/components/palmier";

const RAIL_TABS: RailTab[] = [
  { id: "media", label: "Library", icon: "library" },
  { id: "refs", label: "References", icon: "references" },
  { id: "brief", label: "Brief", icon: "notes" },
];

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-2.5">
      <h2 className="text-[10px] font-semibold uppercase tracking-[1.5px]" style={{ color: "var(--pm-text-tertiary)" }}>{title}</h2>
      {children}
    </section>
  );
}

export function PalmierPrimitives() {
  const [tab, setTab] = React.useState("media");
  const [tool, setTool] = React.useState("pointer");

  return (
    <div className="flex flex-col gap-7">
      <Group title="PanelShell + PanelHeaderBar + IconRail (on bg-base)">
        <div className="flex h-56 gap-[5px] rounded-md p-2" style={{ background: "var(--pm-bg-base)" }}>
          <PanelShell focused>
            <PanelHeaderBar title="Media" trailing={<PalmierIconButton name="add" label="Add" />} />
            <div className="flex min-h-0 flex-1">
              <IconRail tabs={RAIL_TABS} activeId={tab} onSelect={setTab} />
              <div className="grid flex-1 place-items-center text-[12px]" style={{ color: "var(--pm-text-muted)" }}>
                {RAIL_TABS.find((t) => t.id === tab)?.label} content (focused panel — note the off-white ring)
              </div>
            </div>
          </PanelShell>
          <PanelShell>
            <PanelHeaderBar title="Inspector" />
            <div className="min-h-0 flex-1 overflow-y-auto">
              <InspectorSection title="Asset">
                <InspectorRow label="Type" value="image" />
                <InspectorRow label="Aspect" value="16:9" />
                <InspectorRow label="Model" value="nano-banana-pro" />
              </InspectorSection>
              <InspectorSection title="Source">
                <InspectorRow label="Run" value="930d…919b" />
              </InspectorSection>
            </div>
          </PanelShell>
        </div>
      </Group>

      <Group title="Toolbar (38h · grouped · dividers 20h)">
        <PanelShell className="!flex-none">
          <PalmierToolbar>
            <ToolbarGroup>
              <PalmierIconButton name="chevronRight" label="Undo" className="rotate-180" />
              <PalmierIconButton name="chevronRight" label="Redo" />
            </ToolbarGroup>
            <ToolbarDivider />
            <ToolbarGroup>
              <PalmierIconButton name="references" label="Pointer" active={tool === "pointer"} onClick={() => setTool("pointer")} />
              <PalmierIconButton name="split" label="Razor" active={tool === "razor"} onClick={() => setTool("razor")} />
            </ToolbarGroup>
            <ToolbarDivider />
            <ToolbarGroup>
              <PalmierIconButton name="add" label="Add text" />
            </ToolbarGroup>
            <ToolbarSpacer />
            <PalmierIconButton name="zoomOut" label="Zoom out" />
          </PalmierToolbar>
        </PanelShell>
      </Group>

      <Group title="Timeline tracks (50h · header 100 · type tints · 3px clips)">
        <PanelShell className="!flex-none">
          <div className="overflow-hidden" style={{ borderTop: "0.5px solid var(--pm-border-subtle)" }}>
            <Track label="Video" kind="video">
              <Clip kind="video" label="Scene 1" style={{ left: 8, width: 160 }} selected />
              <Clip kind="video" label="Scene 2" style={{ left: 176, width: 120 }} />
            </Track>
            <Track label="Audio" kind="audio">
              <Clip kind="audio" label="VO" style={{ left: 8, width: 280 }} />
            </Track>
            <Track label="Title" kind="text">
              <Clip kind="text" label="Lower third" style={{ left: 40, width: 90 }} />
            </Track>
          </div>
        </PanelShell>
      </Group>

      <Group title="Starter prompt cards (agent empty state)">
        <div className="grid grid-cols-3 gap-2">
          <StarterPromptCard icon="timeline" title="New production" prompt="A 15s cinematic ad for…" onSelect={() => {}} />
          <StarterPromptCard icon="references" title="Develop the world" prompt="Propose characters and locations…" onSelect={() => {}} />
          <StarterPromptCard icon="image" title="Generate a keyframe" prompt="Scene 1 / Shot 1 wide…" onSelect={() => {}} />
        </div>
      </Group>
    </div>
  );
}
