import * as React from "react";

/** Data-driven swatch lists keyed straight to the --pm-* vars (no primitives —
 *  Phase A builds those). Everything renders on the Palmier dark ramp. */
const BACKGROUNDS = [
  ["bg-base", "--pm-bg-base", "rgb(10,10,10)"],
  ["bg-surface", "--pm-bg-surface", "rgb(22,22,22)"],
  ["bg-raised", "--pm-bg-raised", "rgb(30,30,30)"],
  ["bg-prominent", "--pm-bg-prominent", "rgb(44,44,44)"],
  ["preview", "--pm-preview-canvas", "#000000"],
] as const;
const TEXT = [
  ["primary 1.00", "--pm-text-primary"],
  ["secondary 0.80", "--pm-text-secondary"],
  ["tertiary 0.62", "--pm-text-tertiary"],
  ["muted 0.34", "--pm-text-muted"],
] as const;
const RADII = [["xs", "3"], ["xsSm", "4"], ["sm", "6"], ["md", "10"], ["mdLg", "12"], ["lg", "14"], ["xl", "20"]] as const;
const SPACING = [["xxs", 2], ["xs", 4], ["sm", 6], ["smMd", 8], ["md", 10], ["mdLg", 12], ["lg", 14], ["lgXl", 16], ["xl", 20], ["xlXxl", 24], ["xxl", 28]] as const;
const SHADOWS = [["sm", "--pm-shadow-sm"], ["md", "--pm-shadow-md"], ["lg", "--pm-shadow-lg"]] as const;
const TRACKS = [["video", "--pm-track-video"], ["audio", "--pm-track-audio"], ["image/text", "--pm-track-image"], ["lottie", "--pm-track-lottie"], ["error", "--pm-error"]] as const;
const TYPE = [["micro 8", 8], ["xs 10", 10], ["sm 11", 11], ["smMd 12", 12], ["md 13", 13], ["lg 15", 15], ["xl 18", 18], ["title1 22", 22], ["title2 28", 28]] as const;
const HOVER_STATES = [["neither", "transparent"], ["hover .08", "rgba(255,255,255,0.08)"], ["active .10", "rgba(255,255,255,0.10)"], ["active+hover .15", "rgba(255,255,255,0.15)"]] as const;

const label = "text-[10px] font-medium tracking-wide";

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-2.5">
      <h2 className="text-[10px] font-semibold uppercase tracking-[1.5px]" style={{ color: "var(--pm-text-tertiary)" }}>{title}</h2>
      {children}
    </section>
  );
}

export function PalmierTokens() {
  return (
    <div className="flex flex-col gap-7">
      <Group title="Backgrounds — the 4-step ramp + preview">
        <div className="flex flex-wrap gap-2">
          {BACKGROUNDS.map(([name, v, hex]) => (
            <div key={name} className="w-28 overflow-hidden rounded-md" style={{ border: "0.5px solid var(--pm-border-primary)" }}>
              <div className="h-14" style={{ background: `var(${v})` }} />
              <div className="px-2 py-1.5" style={{ background: "var(--pm-bg-surface)" }}>
                <div className={label} style={{ color: "var(--pm-text-secondary)" }}>{name}</div>
                <div className="text-[9px]" style={{ color: "var(--pm-text-muted)" }}>{hex}</div>
              </div>
            </div>
          ))}
        </div>
      </Group>

      <Group title="Text hierarchy (white descending alpha)">
        <div className="flex flex-col gap-1.5 rounded-md p-3.5" style={{ background: "var(--pm-bg-surface)", border: "0.5px solid var(--pm-border-primary)" }}>
          {TEXT.map(([name, v]) => (
            <div key={name} className="flex items-baseline justify-between" style={{ color: `var(${v})` }}>
              <span className="text-[13px] font-medium">The quick brown fox — {name}</span>
              <span className="text-[9px]" style={{ color: "var(--pm-text-muted)" }}>{v}</span>
            </div>
          ))}
        </div>
      </Group>

      <div className="grid grid-cols-2 gap-7">
        <Group title="Borders (white low-alpha · widths)">
          <div className="flex flex-col gap-2 rounded-md p-3" style={{ background: "var(--pm-bg-surface)" }}>
            {[["hairline 0.5px", "0.5px"], ["thin 1px", "1px"], ["medium 1.5px", "1.5px"], ["thick 2px", "2px"]].map(([n, w]) => (
              <div key={n} className="rounded-md px-2 py-1.5 text-[10px]" style={{ border: `${w} solid var(--pm-border-primary)`, color: "var(--pm-text-secondary)" }}>{n}</div>
            ))}
          </div>
        </Group>
        <Group title="Accent — off-white + brand-amber timecode">
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2 rounded-md p-2" style={{ background: "var(--pm-bg-surface)" }}>
              <span className="size-9 rounded-md" style={{ background: "var(--pm-accent-primary)" }} />
              <span className="text-[10px]" style={{ color: "var(--pm-text-secondary)" }}>accent-primary<br />focus / selection</span>
            </div>
            <div className="flex items-center gap-2 rounded-md p-2" style={{ background: "var(--pm-bg-surface)" }}>
              <span className="size-9 rounded-md" style={{ background: "var(--pm-accent-timecode)" }} />
              <span className="text-[10px]" style={{ color: "var(--pm-text-secondary)" }}>timecode (your #E6B15A)<br />playhead only</span>
            </div>
            <div className="h-9 rounded-md" style={{ backgroundImage: "var(--pm-ai-gradient)" }} title="AI shimmer gradient" />
          </div>
        </Group>
      </div>

      <Group title="Hover-highlight fills (radius 6 · ease-out 0.15s)">
        <div className="flex flex-wrap items-center gap-2">
          {HOVER_STATES.map(([n, fill]) => (
            <div key={n} className="grid h-10 w-28 place-items-center rounded-md text-[10px]" style={{ background: fill, border: "0.5px solid var(--pm-border-subtle)", color: "var(--pm-text-secondary)" }}>{n}</div>
          ))}
          <LiveHover />
        </div>
      </Group>

      <div className="grid grid-cols-2 gap-7">
        <Group title="Corner radii (px)">
          <div className="flex flex-wrap items-end gap-2">
            {RADII.map(([n, px]) => (
              <div key={n} className="flex flex-col items-center gap-1">
                <div className="size-12" style={{ background: "var(--pm-bg-prominent)", borderRadius: `${px}px`, border: "0.5px solid var(--pm-border-primary)" }} />
                <span className="text-[9px]" style={{ color: "var(--pm-text-muted)" }}>{n} {px}</span>
              </div>
            ))}
          </div>
        </Group>
        <Group title="Shadows">
          <div className="flex gap-3 rounded-md p-4" style={{ background: "var(--pm-bg-base)" }}>
            {SHADOWS.map(([n, v]) => (
              <div key={n} className="grid size-16 place-items-center rounded-md text-[9px]" style={{ background: "var(--pm-bg-raised)", boxShadow: `var(${v})`, color: "var(--pm-text-muted)" }}>{n}</div>
            ))}
          </div>
        </Group>
      </div>

      <Group title="Spacing scale (px)">
        <div className="flex flex-col gap-1">
          {SPACING.map(([n, px]) => (
            <div key={n} className="flex items-center gap-2">
              <span className="w-12 text-[9px]" style={{ color: "var(--pm-text-muted)" }}>{n} {px}</span>
              <span className="h-2.5 rounded-sm" style={{ width: `${px}px`, background: "var(--pm-accent-primary)" }} />
            </div>
          ))}
        </div>
      </Group>

      <Group title="Track-type tints + status">
        <div className="flex flex-wrap gap-2">
          {TRACKS.map(([n, v]) => (
            <span key={n} className="rounded-[3px] px-2.5 py-1 text-[10px] font-medium text-white" style={{ background: `var(${v})` }}>{n}</span>
          ))}
        </div>
      </Group>

      <Group title="Type ramp (SF system · 8–28px)">
        <div className="flex flex-col gap-1 rounded-md p-3" style={{ background: "var(--pm-bg-surface)" }}>
          {TYPE.map(([n, px]) => (
            <span key={n} style={{ fontSize: `${px}px`, color: "var(--pm-text-primary)" }}>{n} — Director production timeline</span>
          ))}
        </div>
      </Group>
    </div>
  );
}

function LiveHover() {
  const [s, setS] = React.useState<{ a: boolean; h: boolean }>({ a: false, h: false });
  const fill = s.a && s.h ? 0.15 : s.a ? 0.1 : s.h ? 0.08 : 0;
  return (
    <button
      type="button"
      onMouseEnter={() => setS((p) => ({ ...p, h: true }))}
      onMouseLeave={() => setS((p) => ({ ...p, h: false }))}
      onClick={() => setS((p) => ({ ...p, a: !p.a }))}
      className="grid h-10 w-32 place-items-center rounded-md text-[10px] transition-[background-color] duration-150 ease-out"
      style={{ background: `rgba(255,255,255,${fill})`, color: "var(--pm-text-primary)" }}
    >
      live · hover + click
    </button>
  );
}
