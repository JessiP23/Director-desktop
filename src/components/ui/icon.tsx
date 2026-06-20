import {
  // Re-exported under one roof so the whole app draws from a single, consistent
  // icon set (lucide) — no mixing libraries, no hand-drawn SVGs. Retiring the
  // legacy heroicons usage means importing from here.
  X,
  Plus,
  Trash2,
  Library,
  Search,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Scan,
  Columns2,
  MoreHorizontal,
  ChevronDown,
  ChevronRight,
  Check,
  ArrowUp,
  Image as ImageIcon,
  Video,
  Volume2,
  Settings2,
  PanelRight,
  PanelLeft,
  LayoutGrid,
  Layers,
  Film,
  Sparkles,
  BookOpen,
  Brain,
  Plug,
  Folder,
  GripVertical,
  Pin,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";

export type { LucideIcon };

/** The curated, semantic icon set. Features reference these names, never lucide directly. */
export const icons = {
  close: X,
  add: Plus,
  delete: Trash2,
  library: Library,
  search: Search,
  zoomIn: ZoomIn,
  zoomOut: ZoomOut,
  fit: Maximize2,
  scan: Scan,
  split: Columns2,
  more: MoreHorizontal,
  chevronDown: ChevronDown,
  chevronRight: ChevronRight,
  check: Check,
  send: ArrowUp,
  image: ImageIcon,
  video: Video,
  audio: Volume2,
  settings: Settings2,
  inspector: PanelRight,
  sidebar: PanelLeft,
  grid: LayoutGrid,
  references: Layers,
  timeline: Film,
  skills: Sparkles,
  memory: Brain,
  notes: BookOpen,
  tools: Plug,
  asset: Folder,
  drag: GripVertical,
  pin: Pin,
} satisfies Record<string, LucideIcon>;

export type IconName = keyof typeof icons;

/**
 * Consistent icon renderer: one stroke weight, size in px, color inherited from
 * `currentColor`. Accepts either a semantic `name` or a raw lucide component so
 * callers never set stroke/size ad hoc.
 */
export function Icon({
  name,
  icon,
  size = 16,
  strokeWidth = 1.75,
  className,
}: {
  name?: IconName;
  icon?: LucideIcon;
  size?: number;
  strokeWidth?: number;
  className?: string;
}) {
  const Cmp = icon ?? (name ? icons[name] : undefined);
  if (!Cmp) return null;
  return <Cmp size={size} strokeWidth={strokeWidth} className={cn("shrink-0", className)} aria-hidden />;
}
