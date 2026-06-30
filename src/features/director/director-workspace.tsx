import * as React from "react";
import { createPortal } from "react-dom";
import {
  Clapperboard,
  Film,
  Home,
  Layers,
  Library,
  Map,
  MoreHorizontal,
  Plus,
  SlidersHorizontal,
  Sparkles,
  X,
  type LucideIcon,
} from "lucide-react";
import {
  BoltIcon,
  ChatBubbleLeftRightIcon,
  CheckIcon,
  CubeTransparentIcon,
  FireIcon,
  LightBulbIcon,
  RocketLaunchIcon,
  SparklesIcon,
  XMarkIcon,
} from "@heroicons/react/24/solid";
import {
  ArrowRightOnRectangleIcon,
  ArrowsRightLeftIcon,
  LanguageIcon,
  UserIcon as HeroUserIcon,
} from "@heroicons/react/24/outline";
import { UpdateButton } from "@/components/layout/update-button";
import { directorApi } from "@/lib/api/director";
import type { DirectorBrief } from "@/lib/director/contract/brief";
import type { StreamItem } from "@/lib/director/stream";
import type { DirectorQuality, DirectorReference, DirectorRun } from "@/lib/director/contract/director";
import { cn } from "@/lib/utils/cn";
import { useAppearance, type AppearanceMode } from "@/lib/appearance/use-appearance";
import { LANGUAGES, setAppLocale, useAppLocale, useTranslations, type Locale } from "@/lib/i18n";
import { useAuth } from "@/features/auth/auth-context";
import { Composer } from "./composer";
import { ConversationView } from "./conversation-view";
import { MediaDock } from "./palmier/media-dock";
import { PreviewPanel } from "./palmier/preview-panel";
import { TimelineDock } from "./palmier/timeline-dock";
import { useBrief } from "./use-brief";
import { useRun } from "./use-run";
import { useRuns } from "./use-runs";
import { EditorPanel, collectEditorClips } from "./editor/components/editor-view";
import { latestEditorPlan, latestTimelineSyncVersion } from "./editor/lib/editor-plan-apply";
import { uploadAttachments } from "./editor/lib/upload-attachments";

type DirectorPanel = "references" | "assets" | "canvas" | "editor" | null;

const SIDEBAR_WIDTH = "14rem";
const SIDEBAR_ICON_WIDTH = "3.5rem";

const DIRECTOR_CONVERSATION_ICON_IDS = ["chat", "sparkles", "rocket", "lightbulb", "cube", "bolt", "fire"] as const;
type DirectorConversationIconId = (typeof DIRECTOR_CONVERSATION_ICON_IDS)[number];

const CONVERSATION_ICON_COMPONENTS = {
  chat: ChatBubbleLeftRightIcon,
  sparkles: SparklesIcon,
  rocket: RocketLaunchIcon,
  lightbulb: LightBulbIcon,
  cube: CubeTransparentIcon,
  bolt: BoltIcon,
  fire: FireIcon,
} as const satisfies Record<DirectorConversationIconId, typeof ChatBubbleLeftRightIcon>;

function normalizeDirectorConversationIcon(value: unknown): DirectorConversationIconId {
  return typeof value === "string" && (DIRECTOR_CONVERSATION_ICON_IDS as readonly string[]).includes(value)
    ? (value as DirectorConversationIconId)
    : "chat";
}

function iconIndexForConversation(id: string) {
  let hash = 0;
  for (let index = 0; index < id.length; index += 1) {
    hash = (hash + id.charCodeAt(index) * (index + 1)) % DIRECTOR_CONVERSATION_ICON_IDS.length;
  }
  return hash;
}

function iconForConversation(id: string, savedIcon?: unknown) {
  const iconId = savedIcon ? normalizeDirectorConversationIcon(savedIcon) : DIRECTOR_CONVERSATION_ICON_IDS[iconIndexForConversation(id)];
  return CONVERSATION_ICON_COMPONENTS[iconId];
}

function readableUserName(user: ReturnType<typeof useAuth>["user"], fallback: string): string {
  const metadata = user?.user_metadata as Record<string, unknown> | undefined;
  const candidates = [
    metadata?.full_name,
    metadata?.name,
    metadata?.user_name,
    metadata?.preferred_username,
    user?.email?.split("@")[0],
  ];
  const name = candidates.find((value): value is string => typeof value === "string" && value.trim().length > 0);
  return name?.trim().split(/\s+/)[0] || fallback;
}

function runMetadataString(run: DirectorRun, keys: string[]): string | null {
  for (const key of keys) {
    const value = run.metadata?.[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

function directorRunThumbnailUrl(run: DirectorRun): string | null {
  return runMetadataString(run, ["thumbnailUrl", "customThumbnailUrl", "coverImageUrl", "coverUrl"]);
}

function directorRunDescription(run: DirectorRun): string | null {
  return runMetadataString(run, ["description", "customDescription"]);
}

function runDescription(run: DirectorRun): string {
  return directorRunDescription(run) || run.input.prompt || "Director production";
}

type UserAvatarSource = Record<string, unknown>;

const AVATAR_CANDIDATE_KEYS = ["avatar_url", "picture", "avatar", "profile_image_url", "image", "photoURL"] as const;
const AVATAR_FALLBACK_PALETTE = [
  "#1a73e8",
  "#ea4335",
  "#fbbc04",
  "#34a853",
  "#a142f4",
  "#00bcd4",
  "#ff6d00",
  "#7c4dff",
  "#e91e63",
  "#009688",
] as const;

function readAvatarCandidate(source: UserAvatarSource | null | undefined): string | null {
  if (!source) return null;
  for (const key of AVATAR_CANDIDATE_KEYS) {
    const raw = source[key];
    if (typeof raw !== "string") continue;
    const value = raw.trim();
    if (value) return value;
  }
  return null;
}

function getUserAvatarUrl(user: ReturnType<typeof useAuth>["user"]): string | null {
  if (!user) return null;

  const fromMetadata = readAvatarCandidate(user.user_metadata ?? null);
  if (fromMetadata) return fromMetadata;

  const identities = Array.isArray(user.identities) ? user.identities : [];
  for (const identity of identities) {
    if (!identity || typeof identity !== "object") continue;
    const identityData =
      "identity_data" in identity && identity.identity_data && typeof identity.identity_data === "object"
        ? (identity.identity_data as UserAvatarSource)
        : null;
    const fromIdentityData = readAvatarCandidate(identityData);
    if (fromIdentityData) return fromIdentityData;

    const fromIdentity = readAvatarCandidate(identity as unknown as UserAvatarSource);
    if (fromIdentity) return fromIdentity;
  }

  return null;
}

function getAvatarFallbackColor(seed: string): string {
  let hash = 0;
  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash * 31 + seed.charCodeAt(index)) >>> 0;
  }
  return AVATAR_FALLBACK_PALETTE[hash % AVATAR_FALLBACK_PALETTE.length];
}

function getAvatarFallbackInitial(name: string): string {
  const trimmed = name.trim();
  return trimmed ? trimmed.charAt(0).toUpperCase() : "?";
}

async function openExternalUrl(url: string) {
  if (typeof window !== "undefined" && "__TAURI_INTERNALS__" in window) {
    const { openUrl } = await import("@tauri-apps/plugin-opener");
    await openUrl(url);
    return;
  }
  window.open(url, "_blank", "noopener,noreferrer");
}

function normalizeImageUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim().replace(/[)\].,;]+$/g, "");
  return trimmed || null;
}

function imageUrlsFromText(value: unknown): string[] {
  if (typeof value !== "string") return [];
  return (value.match(/https?:\/\/[^\s)\]>]+/g) ?? [])
    .map((url) => normalizeImageUrl(url))
    .filter((url): url is string => Boolean(url));
}

function latestDirectorBriefImageUrl(brief: DirectorBrief | undefined): string | null {
  const sections = brief?.sections;
  const scriptImages = sections?.scriptImages ?? [];
  for (let index = scriptImages.length - 1; index >= 0; index -= 1) {
    const url = normalizeImageUrl(scriptImages[index]?.url);
    if (url) return url;
  }

  const referenceImages = Object.values(sections?.referenceImages ?? {});
  for (let index = referenceImages.length - 1; index >= 0; index -= 1) {
    const urls = imageUrlsFromText(referenceImages[index]);
    if (urls[0]) return urls[0];
  }

  const linkedAssets = sections?.linkedAssets ?? [];
  for (let index = linkedAssets.length - 1; index >= 0; index -= 1) {
    const url = normalizeImageUrl(linkedAssets[index]?.url);
    if (url) return url;
  }

  return null;
}

/**
 * The Director desktop workspace with the web app's Director visual model:
 * dark zinc sidebar, floating home/chat header, centered hero composer,
 * recent-production shelf, narrow chat column, and right-side Director panels.
 *
 * Data/streaming still comes from the desktop hooks, so the Tauri app keeps its
 * native API/auth behaviour while matching the web surface.
 */
export function DirectorWorkspace() {
  const { user } = useAuth();
  const { runs, loading, error: runsError, createRun, deleteRun, patchRun } = useRuns();
  const [selectedRunId, setSelectedRunId] = React.useState<string | null>(null);
  const [creating, setCreating] = React.useState(false);
  const [deletingRunId, setDeletingRunId] = React.useState<string | null>(null);
  const [pendingFirstPrompt, setPendingFirstPrompt] = React.useState<string | null>(null);
  const [briefKey, setBriefKey] = React.useState(0);
  const [sidebarOpen, setSidebarOpen] = React.useState(true);
  const [rightPanel, setRightPanel] = React.useState<DirectorPanel>(null);
  const [quality, setQuality] = React.useState<DirectorQuality>("premium");

  const onBriefUpdated = React.useCallback(() => setBriefKey((key) => key + 1), []);
  const { items, events, send, cancel, sendState, isRunning, run, error } = useRun(selectedRunId, {
    onRunPatch: patchRun,
    onBriefUpdated,
    initialPendingPrompt: pendingFirstPrompt,
  });
  const { brief, loading: briefLoading } = useBrief(selectedRunId, briefKey);

  React.useEffect(() => {
    if (selectedRunId) setPendingFirstPrompt(null);
  }, [selectedRunId]);

  async function startNewProduction(prompt: string, references: DirectorReference[] = []) {
    setPendingFirstPrompt(prompt);
    setCreating(true);
    setRightPanel(null);
    try {
      const created = await createRun({ prompt, quality, references });
      setSelectedRunId(created.id);
    } catch (err) {
      setPendingFirstPrompt(null);
      throw err;
    } finally {
      setCreating(false);
    }
  }

  async function removeRun(runId: string) {
    setDeletingRunId(runId);
    try {
      await deleteRun(runId);
      if (selectedRunId === runId) {
        setSelectedRunId(null);
        setRightPanel(null);
      }
    } finally {
      setDeletingRunId(null);
    }
  }

  const LOADING_ITEM: StreamItem = {
    kind: "activity",
    id: "__director_loading__",
    toolCallId: "__director_loading__",
    toolName: "director",
    status: "running",
    timestamp: new Date().toISOString(),
  };
  const agentIsWorking =
    creating ||
    (isRunning && !items.some((item) => item.kind === "message" || item.kind === "tool-generation" || item.kind === "activity"));
  const conversationItems: StreamItem[] = selectedRunId
    ? agentIsWorking
      ? [...items, LOADING_ITEM]
      : items
    : pendingFirstPrompt
      ? [
          { kind: "user", id: "__pending_first__", text: pendingFirstPrompt, timestamp: new Date().toISOString() },
          ...(agentIsWorking ? [LOADING_ITEM] : []),
        ]
      : [];
  const composerBusy = isRunning || sendState === "sending" || creating;

  const usedTokens = React.useMemo(
    () =>
      items.reduce((sum, item) => {
        const text = item.kind === "user" || item.kind === "message" ? item.text : "";
        return sum + (text ? Math.ceil(text.length / 4) : 0);
      }, 0),
    [items],
  );

  const editorClips = React.useMemo(() => collectEditorClips(items), [items]);
  const editorPlan = React.useMemo(() => latestEditorPlan(events), [events]);
  const timelineSyncToken = React.useMemo(() => latestTimelineSyncVersion(events), [events]);
  const hasConversation = Boolean(selectedRunId || pendingFirstPrompt);
  const sidebarWidth = sidebarOpen ? SIDEBAR_WIDTH : SIDEBAR_ICON_WIDTH;
  const panelOpen = rightPanel !== null;
  const homeName = readableUserName(user, "there");

  return (
    <div
      className="relative h-full min-h-0 overflow-hidden bg-[#141416] text-[#f4f4f5]"
      style={{ "--director-sidebar-width": sidebarWidth } as React.CSSProperties}
    >
      {!hasConversation && <DirectorStreamingHomeBackground sidebarWidth={sidebarWidth} />}

      <DirectorSidebar
        runs={runs}
        loading={loading}
        loadingRunId={selectedRunId}
        deletingRunId={deletingRunId}
        selectedRunId={selectedRunId ?? undefined}
        collapsed={!sidebarOpen}
        activeSection="chat"
        onSelectRun={(runId) => {
          setSelectedRunId(runId);
          setRightPanel(null);
        }}
        onDeleteRun={(runId) => void removeRun(runId)}
        onNewProduction={() => {
          setSelectedRunId(null);
          setPendingFirstPrompt(null);
          setRightPanel(null);
        }}
      />

      <main
        className={cn(
          "relative z-10 flex h-full min-h-0 flex-col bg-transparent transition-[padding] duration-300 ease-out",
          panelOpen && (rightPanel === "editor" ? "pr-[clamp(760px,68vw,1320px)]" : "pr-[clamp(560px,52vw,980px)]"),
        )}
        style={{ paddingLeft: "var(--director-sidebar-width)" }}
      >
        {!hasConversation ? (
          <DirectorHome
            name={homeName}
            runs={runs}
            loading={loading}
            error={runsError}
            creating={creating}
            quality={quality}
            onQualityChange={setQuality}
            onStart={(prompt, references) => void startNewProduction(prompt, references)}
            onSelectRun={setSelectedRunId}
            onDeleteRun={(runId) => void removeRun(runId)}
            onToggleSidebar={() => setSidebarOpen((value) => !value)}
            sidebarOpen={sidebarOpen}
          />
        ) : (
          <DirectorChat
            title={run?.title || "Director"}
            items={conversationItems}
            error={error}
            composerDisabled={composerBusy}
            composerBusy={composerBusy}
            isRunning={isRunning}
            onCancel={cancel}
            onSend={(text, references) => send(text, { quality, references })}
            contextUsage={{ usedTokens, budgetTokens: 30_000 }}
            quality={quality}
            onQualityChange={setQuality}
            rightPanel={rightPanel}
            onPanelChange={setRightPanel}
            onNewProduction={() => {
              setSelectedRunId(null);
              setPendingFirstPrompt(null);
              setRightPanel(null);
            }}
            onToggleSidebar={() => setSidebarOpen((value) => !value)}
            sidebarOpen={sidebarOpen}
          />
        )}
      </main>

      <DirectorRightPanel
        panel={rightPanel}
        runId={selectedRunId}
        brief={brief}
        briefLoading={briefLoading}
        items={items}
        editorClips={editorClips}
        editorPlan={editorPlan}
        timelineSyncToken={timelineSyncToken}
        onClose={() => setRightPanel(null)}
        onOpenEditor={() => setRightPanel("editor")}
      />
    </div>
  );
}

function MemoryBulbIcon({ className }: { className?: string; strokeWidth?: number }) {
  return (
    <svg viewBox="-0.5 0 25 25" fill="none" className={className} aria-hidden="true">
      <path
        d="M19.0006 9.03002C19.0007 8.10058 18.8158 7.18037 18.4565 6.32317C18.0972 5.46598 17.5709 4.68895 16.9081 4.03734C16.2453 3.38574 15.4594 2.87265 14.5962 2.52801C13.7331 2.18336 12.8099 2.01409 11.8806 2.03002C10.0966 2.08307 8.39798 2.80604 7.12302 4.05504C5.84807 5.30405 5.0903 6.98746 5.00059 8.77001C4.95795 9.9595 5.21931 11.1402 5.75999 12.2006C6.30067 13.2609 7.10281 14.1659 8.09058 14.83C8.36897 15.011 8.59791 15.2584 8.75678 15.5499C8.91565 15.8415 8.99945 16.168 9.00059 16.5V18.03H15.0006V16.5C15.0006 16.1689 15.0829 15.843 15.24 15.5515C15.3971 15.26 15.6241 15.0121 15.9006 14.83C16.8528 14.1911 17.6336 13.328 18.1741 12.3167C18.7147 11.3054 18.9985 10.1767 19.0006 9.03002V9.03002Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M15 21.04C14.1345 21.6891 13.0819 22.04 12 22.04C10.9181 22.04 9.86548 21.6891 9 21.04"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function SkillsDocumentIcon({ className }: { className?: string; strokeWidth?: number }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path
        d="M18.18 8.03933L18.6435 7.57589C19.4113 6.80804 20.6563 6.80804 21.4241 7.57589C22.192 8.34374 22.192 9.58868 21.4241 10.3565L20.9607 10.82M18.18 8.03933C18.18 8.03933 18.238 9.02414 19.1069 9.89309C19.9759 10.762 20.9607 10.82 20.9607 10.82M18.18 8.03933L13.9194 12.2999C13.6308 12.5885 13.4865 12.7328 13.3624 12.8919C13.2161 13.0796 13.0906 13.2827 12.9882 13.4975C12.9014 13.6797 12.8368 13.8732 12.7078 14.2604L12.2946 15.5L12.1609 15.901M20.9607 10.82L16.7001 15.0806C16.4115 15.3692 16.2672 15.5135 16.1081 15.6376C15.9204 15.7839 15.7173 15.9094 15.5025 16.0118C15.3203 16.0986 15.1268 16.1632 14.7396 16.2922L13.5 16.7054L13.099 16.8391M13.099 16.8391L12.6979 16.9728C12.5074 17.0363 12.2973 16.9867 12.1553 16.8447C12.0133 16.7027 11.9637 16.4926 12.0272 16.3021L12.1609 15.901M13.099 16.8391L12.1609 15.901"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <path d="M8 13H10.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M8 9H14.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M8 17H9.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path
        d="M19.8284 3.17157C18.6569 2 16.7712 2 13 2H11C7.22876 2 5.34315 2 4.17157 3.17157C3 4.34315 3 6.22876 3 10V14C3 17.7712 3 19.6569 4.17157 20.8284C5.34315 22 7.22876 22 11 22H13C16.7712 22 18.6569 22 19.8284 20.8284C20.7715 19.8853 20.9554 18.4796 20.9913 16"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

function GenerationsArchiveIcon({ className }: { className?: string; strokeWidth?: number }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path d="M2 12C2 7.28595 2 4.92893 3.46447 3.46447C4.92893 2 7.28595 2 12 2C16.714 2 19.0711 2 20.5355 3.46447C22 4.92893 22 7.28595 22 12" stroke="currentColor" strokeWidth="1.5" />
      <path d="M2 14C2 11.1997 2 9.79961 2.54497 8.73005C3.02433 7.78924 3.78924 7.02433 4.73005 6.54497C5.79961 6 7.19974 6 10 6H14C16.8003 6 18.2004 6 19.27 6.54497C20.2108 7.02433 20.9757 7.78924 21.455 8.73005C22 9.79961 22 11.1997 22 14C22 16.8003 22 18.2004 21.455 19.27C20.9757 20.2108 20.2108 20.9757 19.27 21.455C18.2004 22 16.8003 22 14 22H10C7.19974 22 5.79961 22 4.73005 21.455C3.78924 20.9757 3.02433 20.2108 2.54497 19.27C2 18.2004 2 16.8003 2 14Z" stroke="currentColor" strokeWidth="1.5" />
      <path d="M9.5 14.4L10.9286 16L14.5 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function CursorArrowRaysIcon({ className }: { className?: string; strokeWidth?: number }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path d="M4.5 4.5L13 20l1.7-6.2L21 12 4.5 4.5Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M15.7 5.2 17.2 3M18.9 8.1l2.5-.8M6.8 17.2 5 19.1M3.6 13.1l-2.1.7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function DirectorSidebar({
  runs,
  loading,
  loadingRunId,
  deletingRunId,
  selectedRunId,
  collapsed,
  activeSection,
  onSelectRun,
  onDeleteRun,
  onNewProduction,
}: {
  runs: DirectorRun[];
  loading: boolean;
  loadingRunId: string | null;
  deletingRunId: string | null;
  selectedRunId?: string;
  collapsed: boolean;
  activeSection: "chat" | "memory" | "skills" | "generations" | "connectors";
  onSelectRun: (runId: string) => void;
  onDeleteRun: (runId: string) => void;
  onNewProduction: () => void;
}) {
  const t = useTranslations("director.sidebar");
  const navItems: Array<{ key: typeof activeSection | "newProduction"; icon: React.ComponentType<{ className?: string; strokeWidth?: number }>; label: string; onClick?: () => void }> = [
    { key: "newProduction", icon: Plus, label: t("newProduction"), onClick: onNewProduction },
    { key: "memory", icon: MemoryBulbIcon, label: t("nav.memory"), onClick: () => undefined },
    { key: "skills", icon: SkillsDocumentIcon, label: t("nav.skills"), onClick: () => undefined },
    { key: "connectors", icon: CursorArrowRaysIcon, label: t("nav.connectors"), onClick: () => undefined },
    { key: "generations", icon: GenerationsArchiveIcon, label: t("nav.generations"), onClick: () => undefined },
  ];

  return (
    <aside
      data-director-sidebar="true"
      className={cn(
        "absolute bottom-0 left-0 top-0 z-[600] flex flex-col overflow-hidden bg-[#18181b] text-[#71717a] transition-[width] duration-300 ease-out",
        collapsed ? "w-14" : "w-56",
      )}
    >
      <div className={cn("shrink-0 px-0 pb-0 pt-0", collapsed ? "flex justify-center pt-4" : "-ml-1 -mt-6 -mb-6")}>
        <img
          src="/brand/wm-symbol-white.svg"
          alt="WM Studio"
          className={cn("select-none object-contain", collapsed ? "h-8 w-8 scale-125" : "h-28 w-28")}
          draggable={false}
        />
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-0 overflow-hidden p-2 pt-0">
        <nav className="shrink-0 space-y-0.5">
          {navItems.map(({ key, icon: Icon, label, onClick }) => {
            const isActive = key !== "newProduction" && activeSection === key;
            return (
              <button
                key={key}
                type="button"
                onClick={onClick}
                title={label}
                className={cn(
                  "flex h-8 w-full items-center gap-2 rounded-[10px] px-2 text-left text-[#52525b] transition-colors hover:bg-white/[0.04] hover:text-[#a1a1aa]",
                  collapsed && "justify-center gap-0 px-0",
                  key === "newProduction" && "hover:bg-white/[0.06]",
                  isActive && "bg-white/[0.08] text-[#a1a1aa] hover:bg-white/[0.1]",
                )}
              >
                <Icon className="h-4 w-4 shrink-0 opacity-40" strokeWidth={1.5} />
                {!collapsed && <span className="truncate text-[14px] font-medium opacity-60">{label}</span>}
              </button>
            );
          })}
        </nav>

        {!collapsed && <div className="mx-auto my-1.5 h-px w-[78%] shrink-0 bg-[#27272a]/70" />}

        {!collapsed && (
          <div className="flex shrink-0 items-center px-2 pb-1 pt-1 text-[11px] font-medium tracking-[0.01em] text-[#71717a]/40">
            {t("recent")}
          </div>
        )}

        <div className="min-h-0 flex-1 overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {loading && runs.length === 0 ? (
            <div className="space-y-1">
              {Array.from({ length: 4 }).map((_, index) => (
                <div
                  key={index}
                  className={cn(
                    "flex h-8 items-center gap-2 rounded-[10px] px-2",
                    collapsed && "mx-auto w-8 justify-center px-0",
                  )}
                >
                  <span className="h-4 w-4 shrink-0 rounded-md bg-white/[0.045]" />
                  {!collapsed && <span className="h-3 flex-1 rounded-full bg-white/[0.045]" />}
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-0.5">
              {runs.map((run) => (
                <RunMenuItem
                  key={run.id}
                  run={run}
                  collapsed={collapsed}
                  selected={run.id === selectedRunId}
                  loading={run.id === loadingRunId}
                  deleting={run.id === deletingRunId}
                  onSelect={() => onSelectRun(run.id)}
                  onDelete={() => onDeleteRun(run.id)}
                  deleteLabel={t("deleteRun")}
                />
              ))}
              {!loading && runs.length === 0 && !collapsed && (
                <div className="px-2 pt-6">
                  <div className="relative mx-auto mb-4 h-20 w-12">
                    {[
                      { rotate: "rotate-6", z: 1, top: 10, left: 10 },
                      { rotate: "-rotate-3", z: 2, top: 5, left: 5 },
                      { rotate: "rotate-0", z: 3, top: 0, left: 0 },
                    ].map(({ rotate, z, top, left }, index) => (
                      <div
                        key={index}
                        className={cn("absolute rounded-[8px] bg-white/[0.05]", rotate)}
                        style={{ width: 40, height: 52, top, left, zIndex: z }}
                      />
                    ))}
                  </div>
                  <p className="text-[13px] font-medium text-[#d4d4d8]">{t("emptyRuns")}</p>
                  <p className="mt-0.5 text-[11px] leading-4 text-[#52525b]">{t("emptyRunsHint")}</p>
                </div>
              )}
            </div>
          )}
        </div>

        {!collapsed && (
          <button
            type="button"
            aria-label={t("cta.aria")}
            onClick={() => void openExternalUrl("https://wmstudio.ai/dashboard/credits")}
            className="mx-2 mt-2 flex h-11 shrink-0 items-center gap-2 rounded-[12px] bg-[#174cff]/18 px-2.5 text-left text-[#b8c7ff] backdrop-blur-[18px] transition-colors hover:bg-[#2457ff]/24"
          >
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#6f8cff]/16 ring-1 ring-[#9ab0ff]/22">
              <RocketLaunchIcon className="h-3.5 w-3.5" />
            </span>
            <span className="min-w-0 flex-1 truncate text-[12px] font-medium">{t("cta.title")}</span>
            <span className="shrink-0 rounded-full bg-[#dbe5ff]/14 px-2 py-1 text-[11px] font-semibold leading-none text-[#d7e0ff] ring-1 ring-[#dbe5ff]/18">
              40% off
            </span>
          </button>
        )}

        <div className={cn("mt-1 shrink-0 pt-1.5", !collapsed && "before:mx-auto before:mb-1.5 before:block before:h-px before:w-[78%] before:bg-[#27272a]/70")}>
          <UpdateButton
            variant="sidebar"
            collapsed={collapsed}
            className={cn("mb-1", collapsed ? "mx-auto" : "mx-2")}
          />
          <ProfileMenu collapsed={collapsed} />
        </div>
      </div>
    </aside>
  );
}

function CreditsRingAvatar({
  avatarUrl,
  displayName,
  fallbackClassName,
  showRing,
  circleConfig,
  progressRatio,
  wrapperClassName,
  avatarClassName,
}: {
  avatarUrl: string | null;
  displayName: string;
  fallbackClassName: string;
  showRing: boolean;
  circleConfig: { size: number; strokeWidth: number; radius: number };
  progressRatio: number;
  wrapperClassName: string;
  avatarClassName: string;
}) {
  const [imageFailed, setImageFailed] = React.useState(false);
  const visibleProgressRatio = Math.min(0.92, Math.max(0, progressRatio));
  const circumference = 2 * Math.PI * circleConfig.radius;
  const offset = circumference - visibleProgressRatio * circumference;
  const showImage = Boolean(avatarUrl) && !imageFailed;

  React.useEffect(() => setImageFailed(false), [avatarUrl]);

  return (
    <span className={cn("relative flex shrink-0 items-center justify-center", wrapperClassName)}>
      {showRing && (
        <svg
          className="pointer-events-none absolute -rotate-90 transition-opacity duration-300"
          width={circleConfig.size}
          height={circleConfig.size}
          viewBox={`0 0 ${circleConfig.size} ${circleConfig.size}`}
        >
          <circle
            cx={circleConfig.size / 2}
            cy={circleConfig.size / 2}
            r={circleConfig.radius}
            stroke="#f5f1eb"
            strokeWidth={circleConfig.strokeWidth}
            fill="transparent"
            className="opacity-[0.18]"
          />
          <circle
            cx={circleConfig.size / 2}
            cy={circleConfig.size / 2}
            r={circleConfig.radius}
            stroke="rgba(245,241,235,0.72)"
            strokeWidth={circleConfig.strokeWidth}
            fill="transparent"
            strokeDasharray={circumference}
            style={{
              strokeDashoffset: offset,
              transition: "stroke-dashoffset 1s ease-in-out",
            }}
            strokeLinecap="round"
            className="transition-colors duration-500"
          />
        </svg>
      )}
      <span className={cn("overflow-hidden rounded-full", avatarClassName)}>
        {showImage ? (
          <img
            src={avatarUrl ?? undefined}
            alt={displayName}
            className="h-full w-full object-cover"
            onError={() => setImageFailed(true)}
          />
        ) : (
          <span
            className={cn("flex h-full w-full items-center justify-center font-semibold text-white", fallbackClassName)}
            style={{ backgroundColor: getAvatarFallbackColor(displayName) }}
          >
            {getAvatarFallbackInitial(displayName)}
          </span>
        )}
      </span>
    </span>
  );
}

function LanguageSubMenu({
  currentLocale,
  onSelect,
  side = "left",
}: {
  currentLocale: Locale;
  onSelect: (locale: Locale) => void;
  side?: "left" | "right";
}) {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement | null>(null);
  const t = useTranslations("director.sidebar.profile");

  React.useEffect(() => {
    if (!open) return;
    const handler = (event: MouseEvent) => {
      if (!ref.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler, true);
    return () => document.removeEventListener("mousedown", handler, true);
  }, [open]);

  return (
    <div ref={ref} className="relative w-full">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex h-8 w-full items-center justify-between rounded-[10px] px-2 text-left text-[12px] font-medium text-[#f5f1eb]/90 transition-colors hover:bg-[#f5f1eb]/[0.06]"
      >
        <span className="flex items-center gap-2">
          <LanguageIcon className="h-4 w-4 text-[#f5f1eb]/70" />
          {t("language")}
        </span>
        <svg className="h-4 w-4 text-[#f5f1eb]/50" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9 18l6-6-6-6" />
        </svg>
      </button>

      {open && (
        <div
          className={cn(
            "absolute top-0 z-50 flex w-36 flex-col gap-0.5 rounded-[14px] border-0 bg-[#1b1b1f] p-1.5 shadow-lg",
            side === "right" ? "left-full ml-1.5" : "right-full mr-1.5",
          )}
        >
          {LANGUAGES.map(({ locale, label }) => (
            <button
              key={locale}
              type="button"
              onClick={() => {
                onSelect(locale);
                setOpen(false);
              }}
              className={cn(
                "flex w-full items-center justify-between rounded-[10px] px-2.5 py-1.5 text-[12px] font-medium transition-colors",
                currentLocale === locale
                  ? "bg-[#f5f1eb]/[0.08] text-[#f5f1eb]"
                  : "text-[#f5f1eb]/80 hover:bg-[#f5f1eb]/[0.06] hover:text-[#f5f1eb]",
              )}
            >
              {label}
              {currentLocale === locale && <CheckIcon className="h-3.5 w-3.5" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function ProfileAppearanceControl() {
  const { mode, setMode } = useAppearance();
  const t = useTranslations("director.sidebar.profile");
  const options: { mode: AppearanceMode; label: string }[] = [
    { mode: "auto", label: t("appearanceAuto") },
    { mode: "light", label: t("appearanceLight") },
    { mode: "dark", label: t("appearanceDark") },
  ];

  return (
    <div className="rounded-[10px] px-2 py-1.5">
      <div className="flex items-center gap-2 text-[12px] font-medium text-[#f5f1eb]/90">
        <SlidersHorizontal className="h-4 w-4 text-[#f5f1eb]/70" strokeWidth={1.6} />
        {t("appearance")}
      </div>
      <div className="mt-2 grid grid-cols-3 gap-1 rounded-[10px] bg-[#f5f1eb]/[0.04] p-1">
        {options.map((option) => {
          const active = mode === option.mode;
          return (
            <button
              key={option.mode}
              type="button"
              onClick={() => setMode(option.mode)}
              className={cn(
                "h-7 rounded-[8px] px-2 text-[11px] font-semibold transition-colors",
                active ? "bg-[#f5f1eb] text-black" : "text-[#f5f1eb]/60 hover:bg-[#f5f1eb]/[0.06] hover:text-[#f5f1eb]",
              )}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ProfileMenu({ collapsed }: { collapsed: boolean }) {
  const { user, signOut } = useAuth();
  const locale = useAppLocale();
  const t = useTranslations("director.sidebar");
  const [open, setOpen] = React.useState(false);
  const [position, setPosition] = React.useState<React.CSSProperties>({ left: -9999, top: -9999 });
  const triggerRef = React.useRef<HTMLButtonElement | null>(null);
  const panelRef = React.useRef<HTMLDivElement | null>(null);
  const displayName = user ? readableUserName(user, "WM Studio") : t("signIn");
  const detail = user?.email ?? t("saveChats");
  const avatarFallbackClass = "rounded-full";
  const avatarUrl = React.useMemo(() => getUserAvatarUrl(user), [user]);
  const circleConfig = {
    size: 38,
    strokeWidth: 2,
    radius: 17,
  };
  const profileRingConfig = {
    size: 40,
    strokeWidth: 2,
    radius: 18,
  };
  const profileRingRatio = user ? 0.45 : 0;
  const shouldShowCreditsRing = Boolean(user);

  const updatePosition = React.useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger || typeof window === "undefined") return;
    const rect = trigger.getBoundingClientRect();
    const panelHeight = panelRef.current?.getBoundingClientRect().height ?? 390;
    const margin = 12;
    setPosition({
      left: Math.max(margin, Math.min(rect.right + 8, window.innerWidth - 292)),
      top: Math.max(margin, Math.min(rect.bottom - panelHeight, window.innerHeight - panelHeight - margin)),
    });
  }, []);

  React.useLayoutEffect(() => {
    if (open) updatePosition();
  }, [open, collapsed, updatePosition]);

  React.useEffect(() => {
    if (!open) return;
    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (triggerRef.current?.contains(target) || panelRef.current?.contains(target)) return;
      setOpen(false);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, updatePosition]);

  async function handleSignOut() {
    setOpen(false);
    await signOut();
  }

  const panel =
    open && typeof document !== "undefined"
      ? createPortal(
          <div
            ref={panelRef}
            style={position}
            className="fixed z-[9999] flex w-[280px] flex-col rounded-[22px] border-0 bg-[#1b1b1f] p-3 text-[#f5f1eb] shadow-2xl"
          >
            <div className="flex items-center gap-2.5 px-2 py-2">
              <CreditsRingAvatar
                avatarUrl={avatarUrl}
                displayName={displayName}
                fallbackClassName={avatarFallbackClass}
                showRing={shouldShowCreditsRing}
                circleConfig={profileRingConfig}
                progressRatio={profileRingRatio}
                wrapperClassName="h-[42px] w-[42px]"
                avatarClassName="h-[30px] w-[30px]"
              />
              <div className="flex min-w-0 flex-col leading-tight">
                <span className="truncate text-[13px] font-semibold">{displayName}</span>
                <span className="truncate text-[11px] text-[#f5f1eb]/55">{user ? t("profile.plan") : t("saveChats")}</span>
              </div>
            </div>

            <div className="mb-1 rounded-[14px] bg-[#f5f1eb]/[0.04] p-3">
              <button
                type="button"
                onClick={() => void openExternalUrl("https://wmstudio.ai/dashboard/credits")}
                className="mb-2 flex w-full items-center justify-between text-left"
              >
                <span className="text-[12px] font-semibold">{t("profile.creditsTitle")}</span>
                <span className="inline-flex items-center gap-1 text-[11px] text-[#f5f1eb]/70 transition hover:text-[#f5f1eb]">
                  {t("profile.creditsValue")}
                </span>
              </button>
              <div className="flex items-center gap-[2.5px]">
                {Array.from({ length: 20 }).map((_, index) => (
                  <span key={index} className={cn("h-1 w-1 rounded-full", index < 9 ? "bg-white" : "bg-white/[0.18]")} />
                ))}
              </div>
              <p className="mt-2 text-[11px] leading-4 text-[#f5f1eb]/55">{t("profile.creditsHint")}</p>
              <div className="mx-0.5 my-2 h-px bg-[#f5f1eb]/[0.08]" />
              <button
                type="button"
                onClick={() => void openExternalUrl("https://wmstudio.ai/dashboard/credits")}
                className="group flex w-full items-center gap-2 rounded-[10px] py-0.5 text-left transition hover:bg-[#f5f1eb]/[0.06]"
              >
                <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center">
                  <BoltIcon className="h-4 w-4 text-[#f5f1eb]" />
                </span>
                <span className="min-w-0 flex-1 truncate text-[12px] font-medium text-[#f5f1eb]/90">{t("profile.upgradePlan")}</span>
                <span className="inline-flex h-7 items-center justify-center rounded-[9px] bg-white px-3 text-[11px] font-semibold text-black transition group-hover:bg-zinc-200">
                  {t("profile.get")}
                </span>
              </button>
            </div>

            <button
              type="button"
              onClick={() => void openExternalUrl("https://wmstudio.ai/dashboard/settings")}
              className="group mb-1 flex w-full items-center justify-between rounded-[10px] bg-[#f5f1eb]/[0.04] px-2.5 py-2 text-left transition hover:bg-[#f5f1eb]/[0.07]"
            >
              <div className="flex min-w-0 flex-col">
                <span className="mb-0.5 text-[11px] text-[#f5f1eb]/55">{t("profile.workspaceLabel")}</span>
                <span className="truncate text-sm font-medium text-[#f5f1eb]">{t("profile.workspaceName")}</span>
                <span className="mt-0.5 text-[12px] text-[#f5f1eb]/60">{t("profile.workspaceRole")}</span>
              </div>
              <span className="flex items-center justify-center rounded-[8px] p-1.5 text-[#f5f1eb]/70 transition-colors group-hover:bg-[#f5f1eb]/[0.06] group-hover:text-[#f5f1eb]">
                <ArrowsRightLeftIcon className="h-4 w-4" />
              </span>
            </button>

            <div className="mx-0.5 my-1 h-px bg-[#f5f1eb]/[0.08]" />

            <div className="flex flex-col gap-0.5 px-0.5 py-1">
              <button
                type="button"
                onClick={() => void openExternalUrl("https://wmstudio.ai/dashboard/settings")}
                className="flex h-8 w-full items-center gap-2 rounded-[10px] px-2 text-left text-[12px] font-medium text-[#f5f1eb]/90 transition hover:bg-[#f5f1eb]/[0.06]"
              >
                <HeroUserIcon className="h-4 w-4 text-[#f5f1eb]/70" />
                {t("profile.settings")}
              </button>
              <button
                type="button"
                onClick={() => void openExternalUrl("https://wmstudio.ai/dashboard/credits")}
                className="flex h-8 w-full items-center gap-2 rounded-[10px] px-2 text-left text-[12px] font-medium text-[#f5f1eb]/90 transition hover:bg-[#f5f1eb]/[0.06]"
              >
                <SparklesIcon className="h-4 w-4 text-[#f5f1eb]/70" />
                {t("profile.pricing")}
              </button>
              <LanguageSubMenu currentLocale={locale} onSelect={setAppLocale} side="left" />
              <ProfileAppearanceControl />
            </div>

            <div className="mx-0.5 my-1 h-px bg-[#f5f1eb]/[0.08]" />

            <div className="flex flex-col px-0.5 py-1">
              <button
                type="button"
                onClick={() => void handleSignOut()}
                className="flex h-8 w-full items-center gap-2 rounded-[10px] px-2 text-left text-[12px] font-medium text-[#f5f1eb]/90 transition hover:bg-[#f5f1eb]/[0.06]"
              >
                <ArrowRightOnRectangleIcon className="h-4 w-4 text-[#f5f1eb]/70" />
                <span>{t("profile.signOut")}</span>
              </button>
            </div>
          </div>,
          document.body,
        )
      : null;

  return (
    <>
      <div
        className={cn(
          "relative flex items-center justify-center",
          collapsed ? "h-[34px] w-full" : "h-10 min-w-[140px] w-full",
        )}
      >
        <button
          ref={triggerRef}
          type="button"
          onClick={() => setOpen((value) => !value)}
          className={cn(
            "relative cursor-pointer transition-colors group",
            collapsed
              ? "flex h-[41px] w-[41px] items-center justify-center rounded-[10px] border-0 bg-transparent"
              : "flex h-10 min-w-[140px] w-full items-center justify-start gap-2 rounded-[10px] border-0 bg-transparent px-1.5 shadow-none",
          )}
          title={detail}
          aria-haspopup="menu"
          aria-expanded={open}
        >
          <CreditsRingAvatar
            avatarUrl={avatarUrl}
            displayName={displayName}
            fallbackClassName={avatarFallbackClass}
            showRing={shouldShowCreditsRing}
            circleConfig={circleConfig}
            progressRatio={profileRingRatio}
            wrapperClassName="h-[41px] w-[41px]"
            avatarClassName="h-[26px] w-[26px]"
          />
          {!collapsed && (
            <span className="min-w-0 truncate text-xs font-semibold text-[#f5f1eb]">
              {displayName}
            </span>
          )}
        </button>
      </div>
      {panel}
    </>
  );
}

function RunMenuItem({
  run,
  collapsed,
  selected,
  loading,
  deleting,
  onSelect,
  onDelete,
  deleteLabel,
}: {
  run: DirectorRun;
  collapsed: boolean;
  selected: boolean;
  loading: boolean;
  deleting: boolean;
  onSelect: () => void;
  onDelete: () => void;
  deleteLabel: string;
}) {
  const isSkeleton = loading || deleting;
  const ConversationIcon = iconForConversation(run.id, run.metadata.conversationIcon);

  return (
    <div className="group relative">
      <button
        type="button"
        onClick={onSelect}
        disabled={isSkeleton}
        title={run.title}
        className={cn(
          "flex h-auto min-h-8 w-full items-center gap-2 rounded-[10px] px-2 py-1 text-left text-[#d4d4d8]/55 transition-colors hover:bg-white/[0.04] hover:text-[#f4f4f5]/65 disabled:pointer-events-none",
          selected && "bg-white/[0.08] text-[#f4f4f5]/65 hover:bg-white/[0.1]",
          collapsed && "justify-center gap-0 px-0",
          isSkeleton &&
            "relative overflow-hidden bg-white/[0.04] text-transparent before:absolute before:inset-0 before:-translate-x-full before:animate-[shimmer_1.6s_infinite] before:bg-gradient-to-r before:from-transparent before:via-white/[0.06] before:to-transparent hover:bg-white/[0.04]",
        )}
      >
        <ConversationIcon className={cn("h-4 w-4 shrink-0", isSkeleton && "text-transparent")} />
        {!collapsed && (
          <span className="flex min-w-0 flex-1 flex-col items-start leading-tight">
            <span className="w-full truncate text-[14px] font-medium">{run.title || "Untitled production"}</span>
          </span>
        )}
      </button>
      {!collapsed && (
        <button
          type="button"
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            onDelete();
          }}
          disabled={isSkeleton}
          aria-label={`${deleteLabel}: ${run.title || "production"}`}
          className={cn(
            "absolute right-1 top-1/2 hidden h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full text-[#52525b] transition-colors hover:bg-white/[0.06] hover:text-red-300 disabled:pointer-events-none disabled:opacity-50 group-hover:flex",
            isSkeleton && "opacity-0",
          )}
        >
          <XMarkIcon className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}

function DirectorFloatingHeader({
  title,
  sidebarOpen,
  onToggleSidebar,
  onNewProduction,
  showCreditsNotice = false,
}: {
  title?: string;
  sidebarOpen: boolean;
  onToggleSidebar: () => void;
  onNewProduction?: () => void;
  showCreditsNotice?: boolean;
}) {
  const [showNotice, setShowNotice] = React.useState(showCreditsNotice);
  const rightButtonIsHome = Boolean(title);
  return (
    <div className="absolute inset-x-3 top-4 z-50 flex h-9 items-center justify-between sm:inset-x-4">
      <button
        type="button"
        onClick={onToggleSidebar}
        aria-label={sidebarOpen ? "Collapse sidebar" : "Expand sidebar"}
        className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[#52525b] transition-colors hover:bg-[#27272a]/60 hover:text-[#d4d4d8]"
      >
        <img
          src="/assets/director/sidebar.png"
          alt=""
          aria-hidden="true"
          className={cn("h-4 w-4 object-contain opacity-70 invert transition duration-200", !sidebarOpen && "scale-x-[-1]")}
          draggable={false}
        />
      </button>

      <div className="pointer-events-none absolute left-1/2 top-1/2 max-w-[calc(100vw-20rem)] -translate-x-1/2 -translate-y-1/2">
        {title ? (
          <button
            type="button"
            className="pointer-events-auto inline-flex h-8 max-w-[min(520px,100%)] items-center justify-center gap-1.5 rounded-full px-3 text-[13px] font-medium leading-none text-[#d4d4d8] transition-colors hover:bg-[#27272a]/60 hover:text-[#f4f4f5]"
            title={title}
          >
            <Clapperboard className="h-4 w-4 shrink-0 text-[#71717a]" strokeWidth={1.5} />
            <span className="min-w-0 truncate">{title}</span>
          </button>
        ) : showNotice && (
          <div className="pointer-events-auto flex h-9 min-w-0 items-center gap-1.5 text-[11px] leading-4 text-[#52525b]">
            <Sparkles className="h-3.5 w-3.5 shrink-0" strokeWidth={1.5} />
            <span className="truncate">Director uses credits for generated media.</span>
            <button
              type="button"
              onClick={() => setShowNotice(false)}
              aria-label="Dismiss"
              className="inline-flex h-4 w-4 shrink-0 items-center justify-center text-[#3f3f46] transition-colors hover:text-[#a1a1aa]"
            >
              <X className="h-3.5 w-3.5" strokeWidth={1.5} />
            </button>
          </div>
        )}
      </div>

      {onNewProduction ? (
        <button
          type="button"
          onClick={onNewProduction}
          className="inline-flex h-8 items-center justify-center gap-2 rounded-full bg-[#27272a]/60 px-3 text-[13px] font-medium leading-none text-[#a1a1aa] transition-colors hover:bg-[#27272a] hover:text-[#f4f4f5]"
        >
          {rightButtonIsHome ? <Home className="h-4 w-4" /> : <Plus className="h-4 w-4" strokeWidth={1.5} />}
          <span className="hidden sm:inline">{rightButtonIsHome ? "Home" : "New"}</span>
        </button>
      ) : (
        <button
          type="button"
          className="inline-flex h-8 items-center justify-center gap-2 rounded-full bg-[#27272a]/60 px-3 text-[13px] font-medium leading-none text-[#a1a1aa] transition-colors hover:bg-[#27272a] hover:text-[#f4f4f5]"
          aria-label="Home"
        >
          <Home className="h-4 w-4" />
          <span className="hidden sm:inline">Home</span>
        </button>
      )}
    </div>
  );
}

function DirectorHome({
  name,
  runs,
  loading,
  error,
  creating,
  quality,
  onQualityChange,
  onStart,
  onSelectRun,
  onDeleteRun,
  onToggleSidebar,
  sidebarOpen,
}: {
  name: string;
  runs: DirectorRun[];
  loading: boolean;
  error?: string | null;
  creating: boolean;
  quality: DirectorQuality;
  onQualityChange: (value: DirectorQuality) => void;
  onStart: (prompt: string, references?: DirectorReference[]) => void;
  onSelectRun: (runId: string) => void;
  onDeleteRun: (runId: string) => void;
  onToggleSidebar: () => void;
  sidebarOpen: boolean;
}) {
  return (
    <div className="relative min-h-0 flex-1 overflow-y-auto bg-transparent">
      <DirectorFloatingHeader sidebarOpen={sidebarOpen} onToggleSidebar={onToggleSidebar} showCreditsNotice />
      <div className="relative z-10 flex min-h-full w-full flex-col px-4 pb-2 pt-9 sm:px-6 md:pb-3 md:pt-12">
        <div className="mx-auto flex w-full max-w-4xl flex-1 translate-y-5 flex-col items-center justify-center pb-0 md:translate-y-7">
          <div className="mb-6 flex w-full max-w-3xl flex-col items-center">
            <h1 className="max-w-[min(980px,100%)] whitespace-nowrap text-center text-[1.35rem] font-medium leading-[1.08] tracking-tight text-zinc-50 sm:text-3xl md:text-[2.65rem]">
              What are we making today,{" "}{name}?
            </h1>
          </div>

          <div className="w-full max-w-3xl">
            <div className="relative z-10 rounded-[30px] bg-[rgba(39,39,42,0.62)] p-1 shadow-[0_18px_60px_-20px_rgba(0,0,0,0.6)] backdrop-blur-[32px] backdrop-saturate-150">
              <Composer
                onSend={onStart}
                disabled={creating}
                busy={creating}
                placeholder="Ask Director to write, generate, cast, research, or edit…"
                quality={quality}
                onQualityChange={onQualityChange}
                qualitySelectDirection="down"
                variant="web"
              />
            </div>
          </div>
        </div>

        <DirectorHomeShelf
          runs={runs}
          loading={loading}
          error={error}
          onSelectRun={onSelectRun}
          onDeleteRun={onDeleteRun}
          onStartCreate={() => {
            window.requestAnimationFrame(() => {
              document.querySelector<HTMLTextAreaElement>("textarea")?.focus();
            });
          }}
        />
        <DirectorHomeFooter />
      </div>
    </div>
  );
}

function DirectorHomeShelf({
  runs,
  loading,
  error,
  onSelectRun,
  onDeleteRun,
  onStartCreate,
}: {
  runs: DirectorRun[];
  loading: boolean;
  error?: string | null;
  onSelectRun: (runId: string) => void;
  onDeleteRun: (runId: string) => void;
  onStartCreate: () => void;
}) {
  const visibleRuns = runs.slice(0, 6);
  const hasRecentRuns = visibleRuns.length > 0;
  const visibleRunIds = visibleRuns.map((runItem) => runItem.id).join("|");
  const [thumbnailUrls, setThumbnailUrls] = React.useState<Record<string, string | null>>({});
  const [loadedThumbnailUrls, setLoadedThumbnailUrls] = React.useState<Record<string, true>>({});
  const [failedThumbnailUrls, setFailedThumbnailUrls] = React.useState<Record<string, true>>({});

  React.useEffect(() => {
    if (!hasRecentRuns) return;
    const controller = new AbortController();

    void Promise.all(
      visibleRuns.map(async (recentRun) => {
        try {
          const brief = await directorApi.getBrief(recentRun.id);
          if (controller.signal.aborted) return null;
          return [recentRun.id, latestDirectorBriefImageUrl(brief)] as const;
        } catch {
          if (controller.signal.aborted) return null;
          return [recentRun.id, null] as const;
        }
      }),
    ).then((entries) => {
      if (controller.signal.aborted) return;
      const next: Record<string, string | null> = {};
      for (const entry of entries) {
        if (entry) next[entry[0]] = entry[1];
      }
      if (Object.keys(next).length > 0) {
        setThumbnailUrls((current) => ({ ...current, ...next }));
      }
    });

    return () => controller.abort();
    // `visibleRunIds` intentionally drives this effect; `visibleRuns` identity changes every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasRecentRuns, visibleRunIds]);

  if (loading && !hasRecentRuns) {
    return (
      <section className="-mt-2 w-full max-w-[1180px] self-center md:-mt-3" aria-label="Loading productions">
        <div className="mb-3 px-1">
          <div className="h-3 w-24 rounded-full bg-white/[0.08]" />
          <div className="mt-2 h-5 w-44 rounded-full bg-white/[0.08]" />
        </div>
        <div className="-mx-4 overflow-hidden px-4 sm:-mx-6 sm:px-6" style={directorHomeCarouselFadeStyle}>
          <div className="flex gap-2">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className={directorHomeShelfCardClass}>
                <DirectorHomeThumbnailShimmer />
              </div>
            ))}
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="-mt-2 w-full max-w-[1180px] self-center md:-mt-3" aria-label={hasRecentRuns ? "Recent productions" : "Starter productions"}>
      <div className="mb-3 flex items-end justify-between gap-4 px-1">
        <div>
          <h2 className="text-[15px] font-semibold text-white/62 sm:text-base">
          {hasRecentRuns ? "Recent productions" : "Start with a direction"}
          </h2>
          {error && <p className="mt-1 text-[11px] text-red-300/60">Recent productions are unavailable.</p>}
        </div>
      </div>
      <div
        className="-mx-4 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:-mx-6 sm:px-6 [&::-webkit-scrollbar]:hidden"
        style={directorHomeCarouselFadeStyle}
      >
        <div className="flex w-max gap-2 pb-2">
          {hasRecentRuns ? (
            visibleRuns.map((run, index) => {
              const customThumbnailUrl = directorRunThumbnailUrl(run);
              const thumbnailResult = thumbnailUrls[run.id];
              const availableCustomThumbnailUrl = customThumbnailUrl && !failedThumbnailUrls[customThumbnailUrl] ? customThumbnailUrl : null;
              const fetchedThumbnailUrl = typeof thumbnailResult === "string" && !failedThumbnailUrls[thumbnailResult] ? thumbnailResult : null;
              const thumbnailUrl = availableCustomThumbnailUrl || fetchedThumbnailUrl;
              const isThumbnailLoading = availableCustomThumbnailUrl
                ? !loadedThumbnailUrls[availableCustomThumbnailUrl]
                : thumbnailResult === undefined || (!!thumbnailUrl && !loadedThumbnailUrls[thumbnailUrl]);

              return (
                <HomeRunCard
                  key={run.id}
                  run={run}
                  index={index}
                  thumbnailUrl={thumbnailUrl}
                  isThumbnailLoading={isThumbnailLoading}
                  onThumbnailLoad={(url) => setLoadedThumbnailUrls((current) => (current[url] ? current : { ...current, [url]: true }))}
                  onThumbnailError={(url) => {
                    setFailedThumbnailUrls((current) => (current[url] ? current : { ...current, [url]: true }));
                    if (!availableCustomThumbnailUrl) {
                      setThumbnailUrls((current) => ({ ...current, [run.id]: null }));
                    }
                  }}
                  onSelect={() => onSelectRun(run.id)}
                  onDelete={() => onDeleteRun(run.id)}
                />
              );
            })
          ) : (
            <button
              type="button"
              onClick={onStartCreate}
              className={cn(
                "group relative text-left transition duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/55",
                directorHomeShelfCardClass,
              )}
              aria-label="Start with a direction"
            >
              <div className="absolute inset-0 bg-[#242427]/55" />
              <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.035),rgba(0,0,0,0.32))]" />
              <div className="relative flex h-full items-center justify-center">
                <span className="flex size-10 items-center justify-center rounded-full bg-white/[0.08] text-[28px] font-light leading-none text-white/62 backdrop-blur-md transition-colors duration-200 group-hover:bg-white/[0.11] group-hover:text-white/80">
                  +
                </span>
              </div>
            </button>
          )}
        </div>
      </div>
    </section>
  );
}

const SHELF_TONES = [
  "from-[#2f4a78]/80 via-[#151b2f]/86 to-[#08090f]/96",
  "from-[#5d3f6b]/76 via-[#201528]/88 to-[#09080d]/96",
  "from-[#6d4733]/74 via-[#211714]/88 to-[#0a0908]/96",
  "from-[#2f5b54]/74 via-[#132520]/88 to-[#080d0b]/96",
] as const;

const directorHomeCarouselFadeStyle = {
  WebkitMaskImage:
    "linear-gradient(90deg, transparent 0, black clamp(20px,4vw,36px), black calc(100% - clamp(32px,6vw,64px)), transparent 100%)",
  maskImage:
    "linear-gradient(90deg, transparent 0, black clamp(20px,4vw,36px), black calc(100% - clamp(32px,6vw,64px)), transparent 100%)",
} satisfies React.CSSProperties;

const directorHomeShelfCardClass =
  "relative aspect-[1.9/1] w-[min(82vw,360px)] shrink-0 overflow-hidden rounded-[14px] bg-white/[0.055] sm:w-[clamp(300px,25vw,380px)]";

function DirectorHomeThumbnailShimmer() {
  return (
    <div className="absolute inset-0 overflow-hidden bg-[#242427]/55">
      <div className="absolute inset-0 -translate-x-full animate-[shimmer_1.8s_ease-in-out_infinite] bg-gradient-to-r from-transparent via-[#3a3a3d]/20 to-transparent" />
    </div>
  );
}

function HomeRunCard({
  run,
  index,
  thumbnailUrl,
  isThumbnailLoading,
  onThumbnailLoad,
  onThumbnailError,
  onSelect,
  onDelete,
}: {
  run: DirectorRun;
  index: number;
  thumbnailUrl: string | null;
  isThumbnailLoading: boolean;
  onThumbnailLoad: (url: string) => void;
  onThumbnailError: (url: string) => void;
  onSelect: () => void;
  onDelete: () => void;
}) {
  const showFallbackTone = !isThumbnailLoading && !thumbnailUrl;
  const description = runDescription(run);
  return (
    <div className={cn("group relative text-left transition duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/55", directorHomeShelfCardClass)}>
      {isThumbnailLoading ? (
        <DirectorHomeThumbnailShimmer />
      ) : thumbnailUrl ? (
        <div className="absolute inset-0 bg-[#1f2023]" />
      ) : (
        <div className={cn("absolute inset-0 bg-gradient-to-br", SHELF_TONES[index % SHELF_TONES.length])} />
      )}
      {thumbnailUrl && (
        <img
          src={thumbnailUrl}
          alt=""
          className="absolute inset-0 h-full w-full object-cover opacity-[0.58] transition-opacity duration-300 group-hover:opacity-[0.68]"
          loading="lazy"
          onLoad={(event) => {
            const image = event.currentTarget;
            const markLoaded = () => onThumbnailLoad(thumbnailUrl);
            if (typeof image.decode === "function") {
              void image.decode().then(markLoaded, markLoaded);
              return;
            }
            markLoaded();
          }}
          onError={() => onThumbnailError(thumbnailUrl)}
        />
      )}
      {!isThumbnailLoading && (
        <div
          className={cn(
            "absolute inset-0",
            showFallbackTone
              ? "bg-[linear-gradient(180deg,rgba(16,16,18,0.2),rgba(0,0,0,0.76))]"
              : "bg-[linear-gradient(180deg,rgba(16,16,18,0.18),rgba(0,0,0,0.74))]",
          )}
        />
      )}
      <div className="relative flex h-full flex-col justify-between p-[18px]">
        <div aria-hidden="true" />
        <div>
          <h3 className="truncate text-[15px] font-semibold text-white/90">{run.title || "Untitled production"}</h3>
          <p className="mt-1 line-clamp-2 text-[11px] leading-4 text-white/46">{description}</p>
        </div>
      </div>
      <button
        type="button"
        onClick={onSelect}
        className="absolute inset-0 z-20 rounded-[14px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/55"
        aria-label={`Open ${run.title}`}
      />
      <DirectorHomeRunMenu run={run} onDelete={onDelete} />
    </div>
  );
}

function DirectorHomeRunMenu({ run, onDelete }: { run: DirectorRun; onDelete: () => void }) {
  const [open, setOpen] = React.useState(false);
  const wrapperRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!wrapperRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [open]);

  return (
    <div
      ref={wrapperRef}
      className={cn(
        "absolute right-3 top-3 z-30 opacity-0 transition-opacity duration-200 group-focus-within:opacity-100 group-hover:opacity-100",
        open && "opacity-100",
      )}
    >
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          setOpen((value) => !value);
        }}
        aria-label={`Options for ${run.title}`}
        className="inline-flex size-7 items-center justify-center rounded-full bg-black/28 text-white/68 backdrop-blur-md transition-colors hover:bg-black/42 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/45"
      >
        <MoreHorizontal className="size-4" aria-hidden="true" />
      </button>
      {open && (
        <div className="absolute right-0 mt-2 min-w-40 overflow-hidden rounded-[10px] border border-white/[0.08] bg-[#19191b]/95 p-1 text-white/72 shadow-[0_18px_48px_rgba(0,0,0,0.32)] backdrop-blur-xl">
          <button
            type="button"
            disabled
            className="flex w-full items-center gap-2 rounded-[7px] px-2 py-1.5 text-left text-[12px] text-white/28"
          >
            <SlidersHorizontal className="size-3.5" aria-hidden="true" />
            Customize
          </button>
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              setOpen(false);
              onDelete();
            }}
            className="flex w-full items-center gap-2 rounded-[7px] px-2 py-1.5 text-left text-[12px] text-red-300 transition-colors hover:bg-red-500/10 hover:text-red-200"
          >
            <X className="size-3.5" aria-hidden="true" />
            Delete
          </button>
        </div>
      )}
    </div>
  );
}

function DirectorHomeXLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className={className}>
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

function DirectorHomeInstagramLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true" className={className}>
      <rect x="4" y="4" width="16" height="16" rx="5" />
      <circle cx="12" cy="12" r="3.5" />
      <circle cx="16.7" cy="7.3" r="0.8" fill="currentColor" stroke="none" />
    </svg>
  );
}

function DirectorHomeYoutubeLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className={className}>
      <path d="M21.5 7.1a3 3 0 0 0-2.1-2.1C17.5 4.5 12 4.5 12 4.5s-5.5 0-7.4.5a3 3 0 0 0-2.1 2.1A31.2 31.2 0 0 0 2 12a31.2 31.2 0 0 0 .5 4.9 3 3 0 0 0 2.1 2.1c1.9.5 7.4.5 7.4.5s5.5 0 7.4-.5a3 3 0 0 0 2.1-2.1A31.2 31.2 0 0 0 22 12a31.2 31.2 0 0 0-.5-4.9ZM10 15.4V8.6l5.8 3.4L10 15.4Z" />
    </svg>
  );
}

function DirectorHomeLinkedinLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className={className}>
      <path d="M6.9 8.6H3.4v11h3.5v-11ZM5.2 7.1a2 2 0 1 0 0-4 2 2 0 0 0 0 4ZM20.6 13.6c0-3.3-1.8-5.3-4.6-5.3a4 4 0 0 0-3.5 1.9V8.6H9v11h3.5v-5.5c0-1.5.3-2.9 2.1-2.9 1.7 0 1.8 1.6 1.8 3v5.4h3.5l.1-6Z" />
    </svg>
  );
}

const DIRECTOR_HOME_SOCIALS = [
  { key: "x", label: "X", icon: DirectorHomeXLogo, href: "https://x.com/WMStudio_io" },
  { key: "instagram", label: "Instagram", icon: DirectorHomeInstagramLogo, href: "https://www.instagram.com/wmstudio.io/" },
  { key: "youtube", label: "YouTube", icon: DirectorHomeYoutubeLogo, href: "https://www.youtube.com/@wm_studio_io" },
  { key: "linkedin", label: "LinkedIn", icon: DirectorHomeLinkedinLogo, href: "https://www.linkedin.com/company/wm-studioo" },
] as const;

const DIRECTOR_HOME_FOOTER_LINKS = [
  { key: "Plans", href: "https://wmstudio.ai/dashboard/credits", important: true },
  { key: "Docs", href: "https://wmstudio.ai/docs", important: false },
  { key: "Terms", href: "https://wmstudio.ai/terms", important: false },
  { key: "Privacy", href: "https://wmstudio.ai/privacy", important: false },
] as const;

function DirectorHomeFooter() {
  return (
    <footer className="-mx-2 mt-5 flex min-h-9 w-[calc(100%+16px)] max-w-none shrink-0 items-center justify-between gap-4 self-center px-2.5 text-[11px] text-white/40 sm:-mx-4 sm:w-[calc(100%+32px)] md:mt-6">
      <div className="flex shrink-0 items-center gap-1.5">
        {DIRECTOR_HOME_SOCIALS.map(({ key, label, icon: Icon, href }) => (
          <a
            key={key}
            href={href}
            target="_blank"
            rel="noreferrer"
            aria-label={label}
            title={label}
            className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-white/[0.035] text-white/42 backdrop-blur-xl transition duration-200 hover:bg-white/[0.08] hover:text-white/76 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
          >
            <Icon className="h-3.5 w-3.5" />
          </a>
        ))}
      </div>
      <nav className="flex min-w-0 items-center justify-end gap-3 overflow-x-auto whitespace-nowrap [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {DIRECTOR_HOME_FOOTER_LINKS.map(({ key, href, important }) => (
          <a
            key={key}
            href={href}
            target="_blank"
            rel="noreferrer"
            className={cn(
              "shrink-0 transition-colors duration-200 hover:text-white/75",
              important ? "font-medium text-white/62" : "text-white/38",
            )}
          >
            {key}
          </a>
        ))}
      </nav>
    </footer>
  );
}

function DirectorChat({
  title,
  items,
  error,
  composerDisabled,
  composerBusy,
  isRunning,
  onCancel,
  onSend,
  contextUsage,
  quality,
  onQualityChange,
  rightPanel,
  onPanelChange,
  onNewProduction,
  onToggleSidebar,
  sidebarOpen,
}: {
  title: string;
  items: StreamItem[];
  error?: string | null;
  composerDisabled: boolean;
  composerBusy: boolean;
  isRunning: boolean;
  onCancel: () => void;
  onSend: (text: string, references?: DirectorReference[]) => void;
  contextUsage: { usedTokens: number; budgetTokens: number };
  quality: DirectorQuality;
  onQualityChange: (value: DirectorQuality) => void;
  rightPanel: DirectorPanel;
  onPanelChange: (panel: DirectorPanel) => void;
  onNewProduction: () => void;
  onToggleSidebar: () => void;
  sidebarOpen: boolean;
}) {
  return (
    <div className="relative flex min-h-0 flex-1 flex-col bg-[#141416]">
      <DirectorFloatingHeader title={title} sidebarOpen={sidebarOpen} onToggleSidebar={onToggleSidebar} onNewProduction={onNewProduction} />
      <DirectorPanelToolbar activePanel={rightPanel} onChange={onPanelChange} />
      {error && (
        <div className="absolute left-1/2 top-16 z-40 -translate-x-1/2 rounded-full bg-red-500/10 px-3 py-1.5 text-[12px] text-red-200 ring-1 ring-red-400/20">
          {error}
        </div>
      )}
      <ConversationView items={items} onSend={onSend} />
      <div className="shrink-0 bg-transparent px-5 pb-4 pt-0">
        <div className="relative mx-auto w-full max-w-3xl rounded-[30px] bg-[#1f1f22] p-1">
          <Composer
            onSend={onSend}
            disabled={composerDisabled}
            busy={composerBusy}
            onCancel={isRunning ? onCancel : undefined}
            placeholder={isRunning ? "Director is working…" : `Reply to ${title || "Director"}…`}
            contextUsage={contextUsage}
            quality={quality}
            onQualityChange={onQualityChange}
            qualitySelectDirection="up"
            variant="web"
          />
        </div>
      </div>
    </div>
  );
}

function DirectorPanelToolbar({ activePanel, onChange }: { activePanel: DirectorPanel; onChange: (panel: DirectorPanel) => void }) {
  const tools: Array<{ key: Exclude<DirectorPanel, null>; icon: LucideIcon; label: string }> = [
    { key: "references", icon: Library, label: "References" },
    { key: "assets", icon: Layers, label: "Assets" },
    { key: "canvas", icon: Map, label: "Canvas" },
    { key: "editor", icon: Film, label: "Editor" },
  ];
  return (
    <div className="pointer-events-none fixed bottom-0 right-0 top-0 z-20 flex items-center pr-4">
      <div className="pointer-events-auto flex flex-col items-center gap-0.5 rounded-full bg-[#1f1f22] p-1 ring-1 ring-white/[0.05]">
        {tools.map(({ key, icon: Icon, label }) => {
          const active = activePanel === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => onChange(active ? null : key)}
              aria-label={label}
              title={label}
              className={cn(
                "inline-flex h-8 w-8 items-center justify-center rounded-full transition-colors",
                active ? "bg-white/[0.1] text-[#f4f4f5]/80" : "text-[#52525b] hover:bg-white/[0.06] hover:text-[#d4d4d8]",
              )}
            >
              <Icon className="h-4 w-4" strokeWidth={1.6} />
            </button>
          );
        })}
      </div>
    </div>
  );
}

function DirectorRightPanel({
  panel,
  runId,
  brief,
  briefLoading,
  items,
  editorClips,
  editorPlan,
  timelineSyncToken,
  onClose,
  onOpenEditor,
}: {
  panel: DirectorPanel;
  runId: string | null;
  brief: ReturnType<typeof useBrief>["brief"];
  briefLoading: boolean;
  items: StreamItem[];
  editorClips: React.ComponentProps<typeof EditorPanel>["clips"];
  editorPlan: React.ComponentProps<typeof EditorPanel>["agentPlan"];
  timelineSyncToken: number;
  onClose: () => void;
  onOpenEditor: () => void;
}) {
  if (!panel) return null;
  const wide = panel === "editor";
  return (
    <aside
      className={cn(
        "absolute bottom-0 right-0 top-0 z-30 flex min-h-0 overflow-hidden border-l border-white/[0.06] bg-[#101012] text-[#f4f4f5] shadow-[0_24px_80px_rgba(0,0,0,0.42)]",
        wide ? "w-[clamp(760px,68vw,1320px)]" : "w-[clamp(560px,52vw,980px)]",
      )}
    >
      {panel !== "editor" && (
        <button
          type="button"
          onClick={onClose}
          aria-label="Close panel"
          className="absolute right-4 top-4 z-40 inline-flex h-8 w-8 items-center justify-center rounded-full bg-[#27272a]/60 text-[#f4f4f5]/70 transition-colors hover:bg-[#27272a] hover:text-[#f4f4f5]"
        >
          <X className="h-4 w-4" />
        </button>
      )}
      {panel === "references" && <MediaDock runId={runId} brief={brief} briefLoading={briefLoading} onOpenEditor={onOpenEditor} />}
      {panel === "assets" && <PreviewPanel items={items} />}
      {panel === "canvas" && <TimelineDock brief={brief} items={items} />}
      {panel === "editor" && (
        <EditorPanel
          isOpen
          onClose={onClose}
          runId={runId}
          clips={editorClips}
          onUploadFiles={uploadAttachments}
          agentPlan={editorPlan}
          timelineSyncToken={timelineSyncToken}
        />
      )}
    </aside>
  );
}

function DirectorStreamingHomeBackground({ sidebarWidth }: { sidebarWidth: string }) {
  return (
    <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden bg-[#141416]" aria-hidden="true">
      <div
        className="absolute -top-[14vh] right-0 h-[clamp(420px,80vh,760px)] overflow-hidden transition-[left] duration-300 ease-out [mask-image:linear-gradient(180deg,black_0%,black_52%,rgba(0,0,0,0.72)_66%,rgba(0,0,0,0.22)_84%,transparent_100%)] [-webkit-mask-image:linear-gradient(180deg,black_0%,black_52%,rgba(0,0,0,0.72)_66%,rgba(0,0,0,0.22)_84%,transparent_100%)]"
        style={{ left: sidebarWidth }}
      >
        <video
          src="https://wmstudioassets2.blob.core.windows.net/public-assets/root/explore-videos/videohero.mov"
          className="h-full w-full object-cover object-top opacity-75 saturate-[1.04]"
          autoPlay
          loop
          muted
          playsInline
          preload="auto"
        />
        <div className="absolute inset-0 bg-black/10" />
        <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(20,20,22,0.9)_0%,rgba(20,20,22,0.64)_18%,rgba(20,20,22,0.2)_48%,rgba(20,20,22,0.36)_100%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(20,20,22,0.04)_0%,rgba(20,20,22,0.1)_34%,rgba(20,20,22,0.48)_68%,#141416_100%)]" />
      </div>
      <div className="absolute inset-x-0 bottom-0 top-[42vh] bg-[linear-gradient(180deg,rgba(20,20,22,0)_0%,rgba(20,20,22,0.36)_30%,rgba(20,20,22,0.82)_58%,#141416_100%)]" />
    </div>
  );
}
