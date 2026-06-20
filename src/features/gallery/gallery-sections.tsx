import * as React from "react";
import {
  AssetTile,
  Button,
  Card,
  Canvas,
  ContextMenu,
  EmptyState,
  Icon,
  IconButton,
  Kbd,
  Panel,
  SegmentedControl,
  SplitPane,
  TabBar,
  Thumbnail,
  Toolbar,
  ToolbarSeparator,
  Tooltip,
  icons,
  type IconName,
  type TabItem,
} from "@/components/ui";

const POSTERS = ["/wm.svg", "/director-symbol.svg", "https://picsum.photos/seed/director-1/240/180", "https://picsum.photos/seed/director-2/240/180"];

export function IconsSection() {
  return (
    <div className="grid grid-cols-6 gap-2 sm:grid-cols-10">
      {(Object.keys(icons) as IconName[]).map((name) => (
        <div key={name} className="flex flex-col items-center gap-1.5 rounded-lg border border-separator p-2">
          <Icon name={name} size={18} className="text-text-secondary" />
          <span className="truncate text-[10px] text-text-quaternary">{name}</span>
        </div>
      ))}
    </div>
  );
}

export function ButtonsSection() {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button variant="primary">Primary</Button>
      <Button variant="secondary">Secondary</Button>
      <Button variant="ghost">Ghost</Button>
      <Button variant="danger">Danger</Button>
      <IconButton name="add" label="Add" />
      <IconButton name="settings" label="Settings" variant="secondary" />
      <IconButton name="delete" label="Delete" variant="danger" />
      <IconButton name="references" label="Active" active />
      <Tooltip label="With ⌘K shortcut">
        <Button variant="secondary">Hover me</Button>
      </Tooltip>
      <span className="inline-flex items-center gap-1 text-text-tertiary">
        <Kbd>⌘</Kbd>
        <Kbd>K</Kbd>
      </span>
    </div>
  );
}

export function ControlsSection() {
  const [seg, setSeg] = React.useState("grid");
  return (
    <div className="flex flex-wrap items-center gap-3">
      <SegmentedControl
        value={seg}
        onChange={setSeg}
        options={[
          { value: "grid", label: "Grid", icon: "grid" },
          { value: "list", label: "List", icon: "notes" },
          { value: "canvas", label: "Canvas", icon: "references" },
        ]}
      />
      <Toolbar floating>
        <IconButton name="zoomOut" label="Out" size="sm" />
        <IconButton name="zoomIn" label="In" size="sm" />
        <ToolbarSeparator />
        <IconButton name="fit" label="Fit" size="sm" />
      </Toolbar>
    </div>
  );
}

export function CardsSection() {
  const [selected, setSelected] = React.useState(1);
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <Card className="p-4 text-sm text-text-secondary">Plain card</Card>
      <Card onClick={() => {}} className="p-4 text-sm text-text">Interactive card</Card>
      <Thumbnail src={POSTERS[2]} aspect="4 / 3" />
      {POSTERS.slice(0, 2).map((p, i) => (
        <AssetTile key={i} url={p} label={`Reference ${i + 1}`} selected={selected === i} onSelect={() => setSelected(i)} />
      ))}
      <AssetTile url={POSTERS[3]} label="Clip.mp4" kind="video" />
    </div>
  );
}

export function EmptyStateSection() {
  return (
    <div className="grid grid-cols-2 gap-3">
      <Card className="h-44">
        <EmptyState name="references" title="No references yet" description="Add reference images or let Director suggest them." action={<Button size="sm" variant="secondary">Add reference</Button>} />
      </Card>
      <Card className="h-44">
        <EmptyState name="timeline" title="Timeline is empty" description="Confirmed clips appear here in screenplay order." />
      </Card>
    </div>
  );
}

export function ContextMenuSection() {
  return (
    <ContextMenu
      items={[
        { label: "Open", icon: "references", onSelect: () => {} },
        { label: "Rename", icon: "notes", onSelect: () => {} },
        { type: "separator" },
        { label: "Delete", icon: "delete", danger: true, onSelect: () => {} },
      ]}
    >
      <Card className="grid h-24 place-items-center text-sm text-text-tertiary">Right-click anywhere here</Card>
    </ContextMenu>
  );
}

const DEMO_TABS: TabItem[] = [
  { id: "a", label: "Scene 1 — Shot 1", icon: "image", closable: false },
  { id: "b", label: "Scene 1 — Clip", icon: "video" },
  { id: "c", label: "References", icon: "references" },
];

export function PanelAndTabsSection() {
  const [tabs, setTabs] = React.useState(DEMO_TABS);
  const [active, setActive] = React.useState<string | null>("a");
  return (
    <div className="h-64 overflow-hidden rounded-xl border border-separator">
      <Panel
        title="Workspace"
        icon="grid"
        toolbar={
          <TabBar
            tabs={tabs}
            activeId={active}
            onActivate={setActive}
            onClose={(id) => setTabs((t) => t.filter((x) => x.id !== id))}
            onAdd={() => {
              const id = crypto.randomUUID().slice(0, 4);
              setTabs((t) => [...t, { id, label: `Untitled ${id}`, icon: "asset" }]);
              setActive(id);
            }}
          />
        }
      >
        <div className="grid h-full place-items-center text-sm text-text-tertiary">
          Active tab: {tabs.find((t) => t.id === active)?.label ?? "none"}
        </div>
      </Panel>
    </div>
  );
}

export function SplitSection() {
  return (
    <div className="h-56 overflow-hidden rounded-xl border border-separator">
      <SplitPane direction="horizontal" defaultSize={55} storageKey="gallery.split">
        <div className="grid h-full place-items-center bg-surface-1 text-sm text-text-tertiary">Pane A — drag the divider →</div>
        <div className="grid h-full place-items-center bg-surface-0 text-sm text-text-tertiary">Pane B</div>
      </SplitPane>
    </div>
  );
}

export function CanvasSection() {
  return (
    <div className="h-80 overflow-hidden rounded-xl border border-separator">
      <Canvas>
        <div className="grid w-[520px] grid-cols-3 gap-4 p-8">
          {POSTERS.concat(POSTERS).map((p, i) => (
            <div key={i} className="w-40">
              <AssetTile url={p} label={`Tile ${i + 1}`} kind={i % 4 === 3 ? "video" : "image"} />
            </div>
          ))}
        </div>
      </Canvas>
    </div>
  );
}
