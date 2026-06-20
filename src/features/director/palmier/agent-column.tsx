import { PalmierIconButton, PanelHeaderBar, PanelShell } from "@/components/palmier";
import type { StreamItem } from "@/lib/director/stream";
import { Composer } from "../composer";
import { ConversationView } from "../conversation-view";

/**
 * Palmier agent column (left): the chat. Header with a back-to-productions
 * control, the message list, and the footer composer — all reused unchanged.
 */
export function AgentColumn({
  runTitle,
  items,
  onSend,
  composerDisabled,
  composerBusy,
  placeholder,
  error,
  onBack,
}: {
  runTitle?: string;
  items: StreamItem[];
  onSend: (text: string) => void;
  composerDisabled: boolean;
  composerBusy: boolean;
  placeholder: string;
  error?: string | null;
  onBack: () => void;
}) {
  return (
    <PanelShell>
      <PanelHeaderBar
        title={runTitle ?? "Director"}
        leading={<PalmierIconButton name="chevronRight" label="Productions" className="rotate-180" onClick={onBack} />}
      />
      {error && (
        <div className="px-3 py-2 text-center text-[11px]" style={{ color: "var(--pm-error)", background: "rgba(229,79,79,0.1)" }}>
          {error}
        </div>
      )}
      <ConversationView items={items} onSend={onSend} />
      <Composer onSend={onSend} disabled={composerDisabled} busy={composerBusy} placeholder={placeholder} />
    </PanelShell>
  );
}
