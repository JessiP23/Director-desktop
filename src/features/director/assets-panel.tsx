import * as React from "react"
import { useTranslations } from "@/lib/i18n"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import {
  Handle,
  Panel,
  Position,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  type Edge,
  type Node,
  type NodeProps,
  type NodeTypes,
  type ReactFlowInstance,
} from "@xyflow/react"
import "@xyflow/react/dist/style.css"
import { X } from "lucide-react"
import {
  ArrowLeftIcon,
  ArrowsPointingOutIcon,
  BookOpenIcon,
  ClipboardDocumentListIcon,
  CubeIcon,
  DocumentTextIcon,
  FilmIcon,
  LinkIcon,
  MapIcon,
  MapPinIcon,
  MagnifyingGlassMinusIcon,
  MagnifyingGlassPlusIcon,
  PhotoIcon,
  QuestionMarkCircleIcon,
  RectangleStackIcon,
  SparklesIcon,
  SpeakerWaveIcon,
  SwatchIcon,
  UsersIcon,
} from "@heroicons/react/24/solid"
import { cn } from "@/lib/utils/cn"
import { directorApi } from "@/lib/api/director"
import type {
  DirectorBrief,
  DirectorLinkedAsset,
  DirectorScriptImage,
} from "@/lib/director/contract/brief"

type BriefIcon = React.ComponentType<React.SVGProps<SVGSVGElement>>
type BriefBlock = {
  key: string
  label: string
  md: string
  preview: string
  Icon: BriefIcon
}
type BriefGroupKey = "story" | "world" | "production" | "continuity"
type BriefGraphGroup = {
  key: BriefGroupKey
  label: string
  Icon: BriefIcon
  angle: number
  blocks: BriefBlock[]
}
type BriefCanvasNodeData = {
  kind: "center" | "group" | "section"
  label: string
  preview?: string
  Icon: BriefIcon
  selected?: boolean
  onSelect?: () => void
}
type BriefCanvasNode = Node<BriefCanvasNodeData, "briefCanvasNode">

interface AssetPanelProps {
  runId: string | null
  isOpen: boolean
  onClose: () => void
  brief?: DirectorBrief | null
}

const FIRST_URL_PATTERN = /https?:\/\/[^\s"')]+/i

// Older briefs embedded the approved sheet into the character description as
// markdown; referenceImages is the single home now — strip the legacy copy.
const EMBEDDED_REFERENCE_IMAGE_RE = /\n*!\[Approved character reference\]\(https?:\/\/[^\s)]+\)\s*/gi

function parseReferenceImageEntry(value: string): { kind: string; url: string } | null {
  const url = value.match(FIRST_URL_PATTERN)?.[0]
  if (!url) return null
  const kind = value.replace(url, "").replace(/[\s:—–-]+$/, "").trim().toLowerCase()
  return { kind, url }
}

/**
 * One unified card per entity: name, approved casting sheet (joined from
 * referenceImages by name), and description. Sheets without a saved
 * description still show up in their kind's section, so nothing lives in a
 * separate "reference images" bucket anymore.
 */
function entityRecordToMarkdown(
  record: Record<string, string> | undefined,
  referenceImages: Record<string, string> | undefined,
  kind: "character" | "location" | "prop",
): string {
  const sheets = new Map<string, { url: string; name: string }>()
  for (const [name, value] of Object.entries(referenceImages ?? {})) {
    const parsed = parseReferenceImageEntry(value)
    if (!parsed) continue
    // Legacy entries without a kind prefix were always characters.
    if (parsed.kind ? parsed.kind !== kind : kind !== "character") continue
    sheets.set(name.toLocaleLowerCase(), { url: parsed.url, name })
  }

  const parts: string[] = []
  for (const [name, description] of Object.entries(record ?? {})) {
    const sheet = sheets.get(name.toLocaleLowerCase())
    sheets.delete(name.toLocaleLowerCase())
    const cleanDescription = description.replace(EMBEDDED_REFERENCE_IMAGE_RE, " ").trim()
    parts.push([
      `**${name}**`,
      sheet ? `![${name}](${sheet.url})` : "",
      cleanDescription,
    ].filter(Boolean).join("\n\n"))
  }
  // Approved sheets whose entity has no saved description yet.
  for (const sheet of sheets.values()) {
    parts.push(`**${sheet.name}**\n\n![${sheet.name}](${sheet.url})`)
  }
  return parts.join("\n\n---\n\n")
}

function scriptImagesToMarkdown(images: DirectorScriptImage[]): string {
  return images
    .map((image) => [
      `**${image.scriptReference}**`,
      `![${image.scriptReference}](${image.url})`,
      image.prompt ? `_${image.prompt}_` : "",
    ].filter(Boolean).join("\n\n"))
    .join("\n\n---\n\n")
}

/** The screenplay and its approved frames belong together: one section. */
function scriptWithFramesMarkdown(
  script: string | undefined,
  images: DirectorScriptImage[] | undefined,
  framesHeading: string,
): string {
  const parts: string[] = []
  if (script?.trim()) parts.push(script.trim())
  if (images?.length) parts.push(`## ${framesHeading}\n\n${scriptImagesToMarkdown(images)}`)
  return parts.join("\n\n---\n\n")
}

/**
 * Images imported from a web link the user approved. Each becomes a card with
 * its thumbnail, name, a "logo" marker, and a link back to the source page —
 * mirroring how casting sheets are rendered in entity sections.
 */
function linkedAssetsToMarkdown(
  assets: DirectorLinkedAsset[],
  logoLabel: string,
  sourceLabel: string,
): string {
  return assets
    .map((asset) => [
      asset.isLogo ? `**${asset.name}** · ${logoLabel}` : `**${asset.name}**`,
      `![${asset.name}](${asset.url})`,
      asset.sourceUrl ? `[${sourceLabel}](${asset.sourceUrl})` : "",
    ].filter(Boolean).join("\n\n"))
    .join("\n\n---\n\n")
}

function listToMarkdown(items: string[]): string {
  return items.map((item) => `- ${item}`).join("\n")
}

const BRIEF_SECTION_ICONS: Record<string, BriefIcon> = {
  logline: SparklesIcon,
  creativeBrief: BookOpenIcon,
  script: DocumentTextIcon,
  scriptImages: FilmIcon,
  productionPlan: MapIcon,
  characters: UsersIcon,
  locations: MapPinIcon,
  props: CubeIcon,
  referenceImages: LinkIcon,
  linkedAssets: PhotoIcon,
  visualLanguage: SwatchIcon,
  audio: SpeakerWaveIcon,
  continuity: ClipboardDocumentListIcon,
  decisions: ClipboardDocumentListIcon,
  openQuestions: QuestionMarkCircleIcon,
  summary: DocumentTextIcon,
}

const BRIEF_GROUPS: Array<{
  key: BriefGroupKey
  Icon: BriefIcon
  angle: number
  sections: string[]
}> = [
  {
    key: "story",
    Icon: BookOpenIcon,
    angle: -Math.PI / 2,
    sections: ["logline", "creativeBrief", "script", "summary"],
  },
  {
    key: "world",
    Icon: SwatchIcon,
    angle: 0,
    sections: ["characters", "locations", "props", "linkedAssets", "visualLanguage"],
  },
  {
    key: "production",
    Icon: FilmIcon,
    angle: Math.PI / 2,
    sections: ["productionPlan", "audio"],
  },
  {
    key: "continuity",
    Icon: ClipboardDocumentListIcon,
    angle: Math.PI,
    sections: ["continuity", "decisions", "openQuestions"],
  },
]

function markdownPreview(markdown: string): string {
  return markdown
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/https?:\/\/\S+/g, "")
    .replace(/[#*_`>\[\]()-]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 72)
}

const CANVAS_HANDLE_CLASS = "!h-1 !w-1 !border-0 !bg-transparent !opacity-0"
const HANDLE_POSITIONS = [Position.Top, Position.Right, Position.Bottom, Position.Left]

function BriefCanvasNodeComponent({ data }: NodeProps<BriefCanvasNode>) {
  const { kind, label, preview, Icon, selected, onSelect } = data
  return (
    <div className="relative">
      {HANDLE_POSITIONS.map((position) => (
        <React.Fragment key={position}>
          <Handle
            type="target"
            id={`target-${position}`}
            position={position}
            className={CANVAS_HANDLE_CLASS}
          />
          <Handle
            type="source"
            id={`source-${position}`}
            position={position}
            className={CANVAS_HANDLE_CLASS}
          />
        </React.Fragment>
      ))}

      {kind === "center" ? (
        <div className="flex h-9 w-[180px] items-center justify-center gap-2.5 text-[#f4f4f5]">
          <Icon className="h-5 w-5 shrink-0" />
          <span className="text-[15px] font-semibold">{label}</span>
        </div>
      ) : kind === "group" ? (
        <div className="flex h-8 w-[150px] items-center justify-center gap-2 text-[#d4d4d8]">
          <Icon className="h-4 w-4 shrink-0" />
          <span className="whitespace-nowrap text-[10px] font-semibold uppercase tracking-[0.14em] text-[#a1a1aa]">
            {label}
          </span>
        </div>
      ) : (
        <button
          type="button"
          onClick={onSelect}
          aria-pressed={selected}
          aria-label={`${label}: ${preview ?? ""}`}
          className={cn(
            "group flex w-[172px] items-start gap-2.5 rounded-[14px] border bg-[#1c1c1f]/95 px-3 py-2.5 text-left transition-all duration-300 hover:border-white hover:bg-[#252528] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70",
            selected
              ? "scale-[1.04] border-white bg-[#252528]"
              : "border-transparent",
          )}
        >
          <Icon className="mt-0.5 h-4 w-4 shrink-0 text-[#d4d4d8] transition-colors group-hover:text-white" />
          <span className="min-w-0">
            <span className="block text-[12px] font-semibold leading-[1.35] text-[#f4f4f5]">{label}</span>
            <span className="mt-0.5 block truncate text-[10px] text-[#71717a] transition-colors group-hover:text-[#a1a1aa]">
              {preview}
            </span>
          </span>
        </button>
      )}
    </div>
  )
}

const BRIEF_CANVAS_NODE_TYPES: NodeTypes = {
  briefCanvasNode: BriefCanvasNodeComponent,
}

function handleForAngle(angle: number) {
  const x = Math.cos(angle)
  const y = Math.sin(angle)
  if (Math.abs(x) > Math.abs(y)) return x >= 0 ? Position.Right : Position.Left
  return y >= 0 ? Position.Bottom : Position.Top
}

function oppositeHandle(position: Position) {
  if (position === Position.Top) return Position.Bottom
  if (position === Position.Right) return Position.Left
  if (position === Position.Bottom) return Position.Top
  return Position.Right
}

function BriefCanvasControls() {
  const { zoomIn, zoomOut, fitView } = useReactFlow()
  const buttonClass =
    "flex h-8 w-8 items-center justify-center text-[#a1a1aa] transition-colors hover:text-white focus-visible:outline-none focus-visible:text-white"
  return (
    <Panel position="bottom-left" className="!m-3 flex items-center gap-1">
      <button type="button" onClick={() => void zoomIn({ duration: 180 })} className={buttonClass} aria-label="Zoom in">
        <MagnifyingGlassPlusIcon className="h-4 w-4" />
      </button>
      <button type="button" onClick={() => void zoomOut({ duration: 180 })} className={buttonClass} aria-label="Zoom out">
        <MagnifyingGlassMinusIcon className="h-4 w-4" />
      </button>
      <button type="button" onClick={() => void fitView({ padding: 0.08, maxZoom: 1.12, duration: 240 })} className={buttonClass} aria-label="Fit view">
        <ArrowsPointingOutIcon className="h-4 w-4" />
      </button>
    </Panel>
  )
}

function BriefGraph({
  blocks,
  title,
  groupLabels,
  onSelect,
}: {
  blocks: BriefBlock[]
  title: string
  groupLabels: Record<BriefGroupKey, string>
  onSelect: (key: string) => void
}) {
  const flowInstanceRef = React.useRef<ReactFlowInstance<BriefCanvasNode, Edge> | null>(null)
  const openSectionTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)
  const [selectedSection, setSelectedSection] = React.useState<string | null>(null)

  React.useEffect(() => () => {
    if (openSectionTimerRef.current) clearTimeout(openSectionTimerRef.current)
  }, [])

  const selectSection = React.useCallback((key: string, x: number, y: number) => {
    if (openSectionTimerRef.current) clearTimeout(openSectionTimerRef.current)
    setSelectedSection(key)
    void flowInstanceRef.current?.setCenter(x, y, {
      zoom: 1.12,
      duration: 460,
    })
    openSectionTimerRef.current = setTimeout(() => onSelect(key), 480)
  }, [onSelect])

  const groups: BriefGraphGroup[] = BRIEF_GROUPS.map((group) => ({
    ...group,
    label: groupLabels[group.key],
    blocks: group.sections
      .map((section) => blocks.find((block) => block.key === section))
      .filter((block): block is BriefBlock => Boolean(block)),
  })).filter((group) => group.blocks.length > 0)

  const groupNodes = groups.map((group) => ({
    ...group,
    x: Math.cos(group.angle) * 270,
    y: Math.sin(group.angle) * 250,
  }))
  const sectionNodes = groupNodes.flatMap((group) => {
    const spread = Math.min(Math.PI * 0.42, Math.PI * 0.16 * Math.max(group.blocks.length - 1, 1))
    return group.blocks.map((block, index) => {
      const offset = group.blocks.length === 1
        ? 0
        : -spread / 2 + (index * spread) / (group.blocks.length - 1)
      const angle = group.angle + offset
      return {
        ...block,
        groupKey: group.key,
        groupX: group.x,
        groupY: group.y,
        x: Math.cos(angle) * 560,
        y: Math.sin(angle) * 500,
      }
    })
  })
  const nodes: BriefCanvasNode[] = [
    {
      id: "brief-center",
      type: "briefCanvasNode",
      position: { x: -90, y: -18 },
      draggable: false,
      data: { kind: "center", label: title, Icon: BookOpenIcon },
    },
    ...groupNodes.map((group): BriefCanvasNode => ({
      id: `group-${group.key}`,
      type: "briefCanvasNode",
      position: { x: group.x - 75, y: group.y - 16 },
      draggable: false,
      data: { kind: "group", label: group.label, Icon: group.Icon },
    })),
    ...sectionNodes.map((section): BriefCanvasNode => ({
      id: `section-${section.key}`,
      type: "briefCanvasNode",
      position: { x: section.x - 86, y: section.y - 30 },
      draggable: false,
      data: {
        kind: "section",
        label: section.label,
        preview: section.preview,
        Icon: section.Icon,
        selected: selectedSection === section.key,
        onSelect: () => selectSection(section.key, section.x, section.y),
      },
    })),
  ]
  const groupEdgeStyle = {
    stroke: "rgba(244,244,245,0.11)",
    strokeWidth: 0.9,
    strokeLinecap: "round" as const,
  }
  const sectionEdgeStyle = {
    stroke: "rgba(244,244,245,0.075)",
    strokeWidth: 0.8,
    strokeLinecap: "round" as const,
  }
  const edges: Edge[] = [
    ...groupNodes.map((group): Edge => {
      const sourceHandle = handleForAngle(group.angle)
      return {
        id: `center-${group.key}`,
        source: "brief-center",
        target: `group-${group.key}`,
        sourceHandle: `source-${sourceHandle}`,
        targetHandle: `target-${oppositeHandle(sourceHandle)}`,
        type: "default",
        style: groupEdgeStyle,
      }
    }),
    ...sectionNodes.map((section): Edge => {
      const group = groupNodes.find((candidate) => candidate.key === section.groupKey)!
      const angle = Math.atan2(section.y - group.y, section.x - group.x)
      const sourceHandle = handleForAngle(angle)
      return {
        id: `${section.groupKey}-${section.key}`,
        source: `group-${section.groupKey}`,
        target: `section-${section.key}`,
        sourceHandle: `source-${sourceHandle}`,
        targetHandle: `target-${oppositeHandle(sourceHandle)}`,
        type: "default",
        style: sectionEdgeStyle,
      }
    }),
  ]

  return (
    <ReactFlowProvider>
      <div className="h-full min-h-[520px] w-full overflow-hidden">
        <ReactFlow
          onInit={(instance) => {
            flowInstanceRef.current = instance
          }}
          nodes={nodes}
          edges={edges}
          nodeTypes={BRIEF_CANVAS_NODE_TYPES}
          fitView
          fitViewOptions={{ padding: 0.08, minZoom: 0.6, maxZoom: 1.12 }}
          minZoom={0.25}
          maxZoom={1.5}
          panOnDrag
          panOnScroll
          zoomOnScroll
          zoomOnPinch
          preventScrolling
          nodesDraggable={false}
          nodesConnectable={false}
          elementsSelectable
          nodesFocusable
          edgesFocusable={false}
          proOptions={{ hideAttribution: true }}
          className="!bg-transparent"
        >
          <BriefCanvasControls />
        </ReactFlow>
      </div>
    </ReactFlowProvider>
  )
}

const briefRemarkPlugins = [remarkGfm]

const BRIEF_IMAGE_URL_PATTERN = /\.(png|jpe?g|webp|gif|avif)(?:[?#].*)?$/i

function BriefInlineImage({ src, alt }: { src: string; alt?: string }) {
  return (
    <a href={src} target="_blank" rel="noreferrer" className="my-2 block w-fit max-w-full">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt || ""}
        loading="lazy"
        className="block h-auto max-h-[220px] w-auto max-w-full rounded-[10px] object-contain"
      />
    </a>
  )
}

const briefMarkdownComponents: React.ComponentProps<typeof ReactMarkdown>["components"] = {
  p: ({ children }) => (
    <p className="mb-2 text-[13px] leading-relaxed text-[#f4f4f5]/85 last:mb-0">{children}</p>
  ),
  img: ({ src, alt }) => {
    if (!src) return null
    return <BriefInlineImage src={String(src)} alt={alt || undefined} />
  },
  a: ({ children, href }) => {
    if (href && BRIEF_IMAGE_URL_PATTERN.test(href)) {
      return <BriefInlineImage src={href} alt={typeof children === "string" ? children : undefined} />
    }
    return (
      <a
        href={href}
        target="_blank"
        rel="noreferrer"
        className="underline decoration-[#f4f4f5]/30 underline-offset-2 transition-colors hover:decoration-[#f4f4f5]"
      >
        {children}
      </a>
    )
  },
  strong: ({ children }) => <strong className="font-semibold text-[#f4f4f5]">{children}</strong>,
  em: ({ children }) => <em className="italic">{children}</em>,
  ul: ({ children }) => (
    <ul className="mb-2 list-disc space-y-1 pl-4 text-[13px] text-[#f4f4f5]/85 last:mb-0">{children}</ul>
  ),
  ol: ({ children }) => (
    <ol className="mb-2 list-decimal space-y-1 pl-4 text-[13px] text-[#f4f4f5]/85 last:mb-0">{children}</ol>
  ),
  li: ({ children }) => <li className="pl-0.5">{children}</li>,
  h1: ({ children }) => <h3 className="mb-1 text-[14px] font-semibold text-[#f4f4f5]">{children}</h3>,
  h2: ({ children }) => <h4 className="mb-1 text-[13px] font-semibold text-[#f4f4f5]">{children}</h4>,
  h3: ({ children }) => <h5 className="mb-1 text-[13px] font-semibold text-[#f4f4f5]/90">{children}</h5>,
  blockquote: ({ children }) => (
    <blockquote className="mb-2 border-l-2 border-[#f4f4f5]/20 pl-3 italic text-[#f4f4f5]/70 last:mb-0">
      {children}
    </blockquote>
  ),
  code: ({ children, className }) => {
    const isBlock = Boolean(className)
    if (!isBlock) {
      return (
        <code className="rounded bg-black/40 px-1 py-0.5 font-mono text-[0.85em] text-[#f4f4f5]">
          {children}
        </code>
      )
    }
    return <code className={cn("font-mono text-[12px] leading-5", className)}>{children}</code>
  },
  pre: ({ children }) => (
    <pre className="mb-2 max-w-full overflow-x-auto rounded-[8px] bg-black/40 p-2.5 text-[#f4f4f5] last:mb-0">
      {children}
    </pre>
  ),
  hr: () => <hr className="my-3 border-[#f4f4f5]/10" />,
  table: ({ children }) => (
    <div className="mb-2 max-w-full overflow-x-auto last:mb-0">
      <table className="min-w-full border-collapse text-left text-[12px]">{children}</table>
    </div>
  ),
  th: ({ children }) => (
    <th className="border border-[#f4f4f5]/15 px-2 py-1 font-semibold">{children}</th>
  ),
  td: ({ children }) => <td className="border border-[#f4f4f5]/15 px-2 py-1">{children}</td>,
}

function BriefMarkdown({ text }: { text: string }) {
  return (
    <div className="min-w-0 break-words">
      <ReactMarkdown remarkPlugins={briefRemarkPlugins} components={briefMarkdownComponents}>
        {text}
      </ReactMarkdown>
    </div>
  )
}

/**
 * One approved screenplay frame with a two-step delete: the first click arms
 * the confirmation, the second removes the frame from the brief.
 */
function ScriptFrameCard({
  image,
  deleting,
  onDelete,
  deleteLabel,
  confirmLabel,
}: {
  image: DirectorScriptImage
  deleting: boolean
  onDelete: () => void
  deleteLabel: string
  confirmLabel: string
}) {
  const [confirming, setConfirming] = React.useState(false)

  React.useEffect(() => {
    if (!confirming) return
    const timer = setTimeout(() => setConfirming(false), 4000)
    return () => clearTimeout(timer)
  }, [confirming])

  return (
    <div className="rounded-[12px] bg-black/20 p-3">
      <div className="flex items-start justify-between gap-3">
        <span className="text-[13px] font-semibold text-[#f4f4f5]">{image.scriptReference}</span>
        <button
          type="button"
          disabled={deleting}
          onClick={() => (confirming ? onDelete() : setConfirming(true))}
          aria-label={confirming ? confirmLabel : deleteLabel}
          className={cn(
            "inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] transition-colors disabled:cursor-not-allowed disabled:opacity-50",
            confirming
              ? "bg-red-500/15 text-red-300 hover:bg-red-500/25"
              : "text-[#f4f4f5]/45 hover:bg-white/[0.06] hover:text-[#f4f4f5]",
          )}
        >
          {deleting ? (
            <span className="h-3 w-3 animate-spin rounded-full border border-current border-t-transparent" />
          ) : (
            <X className="h-3.5 w-3.5" />
          )}
          {confirming && !deleting ? confirmLabel : null}
        </button>
      </div>
      <div className="mt-2 flex items-start gap-3">
        <div className="w-[110px] shrink-0">
          <BriefInlineImage src={image.url} alt={image.scriptReference} />
        </div>
        {image.prompt && (
          <p className="text-[12px] italic leading-relaxed text-[#f4f4f5]/55">{image.prompt}</p>
        )}
      </div>
    </div>
  )
}

function BriefGraphSkeleton() {
  const cards = [
    { w: "w-[160px]", h: "h-[72px]", top: "top-[12%]", left: "left-[8%]" },
    { w: "w-[148px]", h: "h-[64px]", top: "top-[12%]", left: "left-[38%]" },
    { w: "w-[156px]", h: "h-[68px]", top: "top-[12%]", left: "left-[66%]" },
    { w: "w-[152px]", h: "h-[64px]", top: "top-[42%]", left: "left-[8%]" },
    { w: "w-[160px]", h: "h-[72px]", top: "top-[42%]", left: "left-[38%]" },
    { w: "w-[148px]", h: "h-[68px]", top: "top-[42%]", left: "left-[66%]" },
    { w: "w-[156px]", h: "h-[64px]", top: "top-[70%]", left: "left-[22%]" },
    { w: "w-[152px]", h: "h-[68px]", top: "top-[70%]", left: "left-[52%]" },
  ]
  return (
    <div className="relative h-full w-full overflow-hidden">
      {cards.map((card, i) => (
        <div
          key={i}
          style={{ animationDelay: `${i * 120}ms` }}
          className={cn(
            "absolute rounded-[14px] border border-white/[0.06] bg-white/[0.03]",
            "overflow-hidden before:absolute before:inset-0 before:-translate-x-full before:animate-[shimmer_1.8s_infinite] before:bg-gradient-to-r before:from-transparent before:via-white/[0.05] before:to-transparent",
            card.w, card.h, card.top, card.left,
          )}
        >
          <div className="p-3 space-y-2">
            <div className="h-2 w-[55%] rounded-full bg-white/[0.08]" />
            <div className="h-1.5 w-[80%] rounded-full bg-white/[0.05]" />
            <div className="h-1.5 w-[65%] rounded-full bg-white/[0.05]" />
          </div>
        </div>
      ))}
    </div>
  )
}

export function AssetsPanel({ runId, isOpen, onClose, brief }: AssetPanelProps) {
  const t = useTranslations("director.references")
  const [localBrief, setLocalBrief] = React.useState<DirectorBrief | null>(brief || null)
  const [selectedBriefSection, setSelectedBriefSection] = React.useState<string | null>(null)
  const [isLoading, setIsLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [deletingFrameUrl, setDeletingFrameUrl] = React.useState<string | null>(null)
  const [frameError, setFrameError] = React.useState<string | null>(null)

  const deleteScriptFrame = React.useCallback(async (url: string) => {
    if (!runId || !localBrief) return
    setDeletingFrameUrl(url)
    setFrameError(null)
    try {
      const updated = await directorApi.patchBrief(runId, {
        removeScriptImageUrls: [url],
        expectedVersion: localBrief.version,
        reason: "Frame removed manually from the references panel",
      })
      setLocalBrief(updated)
    } catch (err) {
      // On a version conflict, re-read so the next attempt starts fresh.
      const status =
        err && typeof err === "object" && "status" in err ? (err as { status: number }).status : 0
      if (status === 409) {
        const fresh = await directorApi.getBrief(runId).catch(() => null)
        if (fresh) setLocalBrief(fresh)
      }
      setFrameError(t("brief.frameDeleteError"))
    } finally {
      setDeletingFrameUrl(null)
    }
  }, [runId, localBrief, t])

  React.useEffect(() => {
    if (brief != null) {
      setLocalBrief(brief)
      return
    }
    if (!runId || !isOpen) {
      setLocalBrief(null)
      setError(null)
      return
    }
    let cancelled = false
    const fetchBrief = async () => {
      setIsLoading(true)
      setError(null)
      try {
        const loaded = await directorApi.getBrief(runId)
        if (cancelled) return
        setLocalBrief(loaded ?? null)
      } catch {
        if (!cancelled) setError(t("briefError"))
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }
    fetchBrief()
    return () => { cancelled = true }
  }, [runId, isOpen, brief, t])

  const briefBlocks = React.useMemo(() => {
    const sections = localBrief?.sections
    const blocks: BriefBlock[] = []
    const add = (key: string, md?: string) => {
      if (!md?.trim()) return
      blocks.push({
        key,
        label: t(`brief.${key}`),
        md,
        preview: markdownPreview(md) || t("brief.graph.open"),
        Icon: BRIEF_SECTION_ICONS[key] ?? DocumentTextIcon,
      })
    }
    add("logline", sections?.logline)
    add("creativeBrief", sections?.creativeBrief)
    add("script", scriptWithFramesMarkdown(sections?.script, sections?.scriptImages, t("brief.scriptImages")))
    add("productionPlan", sections?.productionPlan)
    add("characters", entityRecordToMarkdown(sections?.characters, sections?.referenceImages, "character"))
    add("locations", entityRecordToMarkdown(sections?.locations, sections?.referenceImages, "location"))
    add("props", entityRecordToMarkdown(sections?.props, sections?.referenceImages, "prop"))
    if (sections?.linkedAssets?.length) {
      add("linkedAssets", linkedAssetsToMarkdown(
        sections.linkedAssets,
        t("brief.linkedAssetLogo"),
        t("brief.linkedAssetSource"),
      ))
    }
    add("visualLanguage", sections?.visualLanguage)
    add("audio", sections?.audio)
    add("continuity", sections?.continuity)
    if (sections?.decisions) add("decisions", listToMarkdown(sections.decisions))
    if (sections?.openQuestions) add("openQuestions", listToMarkdown(sections.openQuestions))
    add("summary", localBrief?.summary)
    return blocks
  }, [localBrief, t])

  const selectedBriefBlock = briefBlocks.find((block) => block.key === selectedBriefSection) ?? null

  return (
    <div
      aria-hidden={!isOpen}
      className={cn(
        "fixed inset-y-3 right-0 z-50 flex w-[clamp(640px,56vw,1100px)] max-w-[96vw] flex-col overflow-hidden rounded-l-[20px] bg-[rgba(24,24,27,0.92)] text-[#f4f4f5] backdrop-blur-[72px] transition-transform duration-300 ease-out will-change-transform",
        isOpen ? "translate-x-0" : "pointer-events-none translate-x-full",
      )}
    >
      {/* Dot pattern — fades out when a brief section is open */}
      <div
        aria-hidden
        style={{
          backgroundImage: "radial-gradient(circle, rgba(255,255,255,0.045) 1px, transparent 1px)",
          backgroundSize: "9px 9px",
        }}
        className={cn(
          "pointer-events-none absolute inset-0 transition-opacity duration-500",
          selectedBriefBlock ? "opacity-0" : "opacity-100",
        )}
      />
      {/* Header */}
      <div className="flex items-center justify-between gap-2 px-5 pb-3 pt-4">
        <div className="flex items-center gap-2">
          <RectangleStackIcon className="h-4 w-4 text-[#f4f4f5]/70" />
          <h2 className="text-[15px] font-semibold text-[#f4f4f5]">{t("title")}</h2>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label={t("close")}
          className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[#27272a]/60 text-[#f4f4f5]/70 transition-colors hover:bg-[#27272a] hover:text-[#f4f4f5]"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Content */}
      <div
        className={cn(
          "scrollbar-hide min-h-0 flex-1",
          !selectedBriefBlock ? "overflow-hidden" : "overflow-auto px-4 py-4",
        )}
      >
        {isLoading ? (
          <BriefGraphSkeleton />
        ) : error ? (
          <div className="py-10 text-center text-[13px] text-[#f4f4f5]/55">{error}</div>
        ) : briefBlocks.length === 0 ? (
          <div className="py-8 text-center text-[#f4f4f5]/60">{t("brief.empty")}</div>
        ) : selectedBriefBlock ? (
          <div className="mx-auto w-full max-w-4xl animate-in fade-in zoom-in-95 pb-8 duration-300">
            <button
              type="button"
              onClick={() => setSelectedBriefSection(null)}
              className="mb-5 inline-flex items-center gap-2 text-[12px] font-medium text-[#a1a1aa] transition-colors hover:text-white focus-visible:outline-none focus-visible:text-white"
            >
              <ArrowLeftIcon className="h-3.5 w-3.5" />
              {t("brief.graph.back")}
            </button>
            <div className="mb-6 flex items-center gap-2 border-b border-white/[0.07] pb-5">
              <selectedBriefBlock.Icon className="h-5 w-5 shrink-0 text-[#f4f4f5]/60" />
              <h3 className="text-xl font-semibold text-[#f4f4f5]">{selectedBriefBlock.label}</h3>
            </div>
            {selectedBriefBlock.key === "script" ? (
              <>
                {localBrief?.sections.script?.trim() && (
                  <BriefMarkdown text={localBrief.sections.script} />
                )}
                {(localBrief?.sections.scriptImages?.length ?? 0) > 0 && (
                  <div className="mt-6 border-t border-white/[0.07] pt-5">
                    <h4 className="mb-3 text-[13px] font-semibold text-[#f4f4f5]">
                      {t("brief.scriptImages")}
                    </h4>
                    {frameError && (
                      <p className="mb-3 text-[12px] text-red-300">{frameError}</p>
                    )}
                    <div className="space-y-3">
                      {localBrief!.sections.scriptImages!.map((image) => (
                        <ScriptFrameCard
                          key={image.url}
                          image={image}
                          deleting={deletingFrameUrl === image.url}
                          onDelete={() => void deleteScriptFrame(image.url)}
                          deleteLabel={t("brief.deleteFrame")}
                          confirmLabel={t("brief.confirmDeleteFrame")}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <BriefMarkdown text={selectedBriefBlock.md} />
            )}
          </div>
        ) : (
          <BriefGraph
            blocks={briefBlocks}
            title={t("brief.graph.title")}
            groupLabels={{
              story: t("brief.graph.groups.story"),
              world: t("brief.graph.groups.world"),
              production: t("brief.graph.groups.production"),
              continuity: t("brief.graph.groups.continuity"),
            }}
            onSelect={setSelectedBriefSection}
          />
        )}
      </div>

    </div>
  )
}
