import { PanelRightClose, PanelRightOpen } from "lucide-react";
import { PalmierIconButton, PanelShell } from "@/components/palmier";
import type { DirectorQuality } from "@/lib/director/contract/director";
import type { StreamItem } from "@/lib/director/stream";
import { Composer } from "../composer";
import { ConversationView } from "../conversation-view";
import { HomeHeader } from "../components/home-header";
import { iconForConversation } from "../lib/conversation-icons";

/**
 * Palmier agent column (left): the chat. Header with a back-to-productions
 * control, the message list, and the footer composer — all reused unchanged.
 */
export function AgentColumn({
  runTitle,
  runId,
  items,
  onSend,
  composerDisabled,
  composerBusy,
  placeholder,
  error,
  onBack,
  contextUsage,
  quality,
  onQualityChange,
  rightOpen,
  onToggleRight,
  onRenameRun,
  isSavingTitle,
}: {
  runTitle?: string;
  runId?: string;
  items: StreamItem[];
  onSend: (text: string) => void;
  composerDisabled: boolean;
  composerBusy: boolean;
  placeholder: string;
  error?: string | null;
  onBack: () => void;
  contextUsage?: { usedTokens: number; budgetTokens: number };
  quality: DirectorQuality;
  onQualityChange: (value: DirectorQuality) => void;
  /** Whether the right side (media/preview/inspector/timeline) is open. */
  rightOpen: boolean;
  onToggleRight: () => void;
  onRenameRun?: (title: string) => Promise<void>;
  isSavingTitle?: boolean;
}) {
  const ConversationIcon = runId ? iconForConversation(runId) : undefined;

  return (
    <PanelShell>
      <HomeHeader
        conversationTitle={runTitle}
        conversationIcon={ConversationIcon}
        isSavingConversationTitle={isSavingTitle}
        onConversationTitleChange={onRenameRun}
        onHomeClick={onBack}
        rightAction={
          <PalmierIconButton
            icon={rightOpen ? PanelRightClose : PanelRightOpen}
            label={rightOpen ? "Hide panels" : "Show panels"}
            active={rightOpen}
            onClick={onToggleRight}
          />
        }
      />
      {error && (
        <div className="px-3 py-2 text-center text-[11px]" style={{ color: "var(--pm-error)", background: "rgba(229,79,79,0.1)" }}>
          {error}
        </div>
      )}
      <ConversationView items={items} onSend={onSend} />
      <Composer
        onSend={onSend}
        disabled={composerDisabled}
        busy={composerBusy}
        placeholder={placeholder}
        contextUsage={contextUsage}
        quality={quality}
        onQualityChange={onQualityChange}
      />
    </PanelShell>
  );
}
