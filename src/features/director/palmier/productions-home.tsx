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
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-7 px-6 py-10">
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
