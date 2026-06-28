import { StarterPromptCard } from "@/components/palmier";
import type { DirectorQuality } from "@/lib/director/contract/director";
import { HeroComposer } from "../components/hero-composer";

const STARTERS = [
  { icon: "timeline" as const, title: "Cinematic ad", prompt: "A 15-second cinematic ad for a premium product, moody lighting." },
  { icon: "references" as const, title: "Develop a world", prompt: "Help me develop characters, locations and a visual language for a short film." },
  { icon: "image" as const, title: "Social spot", prompt: "A punchy 9:16 social spot with an energetic hook and CTA." },
];

/** Palmier home (HomeView): start a new production. */
export function ProductionsHome({
  creating,
  onStart,
  quality,
  onQualityChange,
}: {
  creating: boolean;
  onStart: (prompt: string) => void;
  quality: DirectorQuality;
  onQualityChange: (value: DirectorQuality) => void;
}) {
  return (
    <div className="flex h-full flex-col" style={{ background: "var(--pm-bg-base)" }}>
      <div className="min-h-0 flex-1 overflow-y-auto relative">
        <div className="pointer-events-none absolute inset-0 z-0" aria-hidden="true">
          <video
            src="https://wmstudioassets2.blob.core.windows.net/public-assets/root/assets/commercial-thumbnail/videocard1wm.mov"
            className="h-full w-full object-cover opacity-55"
            autoPlay
            loop
            muted
            playsInline
            preload="metadata"
          />
          <div className="absolute inset-0 bg-black/58" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_38%,rgba(24,24,27,0.12),rgba(8,8,8,0.72)_68%,rgba(8,8,8,0.96)_100%)]" />
        </div>
        <div className="relative z-10 mx-auto flex w-full max-w-3xl flex-col gap-7 px-6 py-10">
        <div className="text-center">
          <p className="font-mono text-[10px] uppercase tracking-[0.22em]" style={{ color: "var(--pm-text-muted)" }}>WM Studio · Director</p>
        </div>

        <HeroComposer
          onSend={onStart}
          disabled={creating}
          busy={creating}
          quality={quality}
          onQualityChange={onQualityChange}
        />

        <div className="grid grid-cols-3 gap-2">
          {STARTERS.map((s) => (
            <StarterPromptCard key={s.title} icon={s.icon} title={s.title} prompt={s.prompt} onSelect={() => onStart(s.prompt)} />
          ))}
        </div>
        </div>
      </div>
    </div>
  );
}
