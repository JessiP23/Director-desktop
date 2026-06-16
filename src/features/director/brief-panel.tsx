import { Markdown } from "@/components/ui/markdown";
import { Spinner } from "@/components/ui/spinner";
import type { DirectorBrief } from "@/lib/director/contract/brief";

/** A reference-image value is stored as "<kind>: <url>"; pull the URL out. */
function parseReference(value: string): { kind?: string; url: string } {
  const match = value.match(/^\s*([a-z]+)\s*:\s*(https?:\/\/.+)$/i);
  if (match) return { kind: match[1], url: match[2] };
  return { url: value.trim() };
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border-b border-line px-4 py-4 last:border-b-0">
      <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-fg-subtle">{title}</h3>
      {children}
    </section>
  );
}

function Entities({ entries }: { entries: Record<string, string> }) {
  return (
    <dl className="space-y-2.5">
      {Object.entries(entries).map(([name, description]) => (
        <div key={name}>
          <dt className="text-sm font-medium text-fg">{name}</dt>
          <dd className="text-xs leading-relaxed text-fg-muted">{description}</dd>
        </div>
      ))}
    </dl>
  );
}

/** Right-hand references / production-brief panel. Read-only for now. */
export function BriefPanel({ brief, loading }: { brief: DirectorBrief | null; loading: boolean }) {
  if (loading && !brief) {
    return (
      <div className="flex h-full items-center justify-center text-fg-subtle">
        <Spinner />
      </div>
    );
  }

  const s = brief?.sections;
  const hasAnything =
    s &&
    (s.logline ||
      s.referenceImages ||
      s.characters ||
      s.locations ||
      s.props ||
      s.script ||
      s.visualLanguage ||
      s.decisions?.length ||
      s.openQuestions?.length);

  if (!hasAnything) {
    return (
      <div className="flex h-full items-center justify-center px-6 text-center text-xs text-fg-subtle">
        The production brief fills in here as Director develops characters, locations, and shots.
      </div>
    );
  }

  const references = s?.referenceImages ? Object.entries(s.referenceImages) : [];

  return (
    <div className="h-full overflow-y-auto">
      {s?.logline && (
        <Section title="Logline">
          <p className="text-sm italic leading-relaxed text-fg">{s.logline}</p>
        </Section>
      )}

      {references.length > 0 && (
        <Section title="Reference images">
          <div className="grid grid-cols-2 gap-2">
            {references.map(([name, value]) => {
              const { url } = parseReference(value);
              return (
                <figure key={name} className="overflow-hidden rounded-lg border border-line bg-black/30">
                  <img src={url} alt={name} loading="lazy" className="aspect-square w-full object-cover" />
                  <figcaption className="truncate px-2 py-1 text-[11px] text-fg-muted">{name}</figcaption>
                </figure>
              );
            })}
          </div>
        </Section>
      )}

      {s?.characters && <Section title="Characters"><Entities entries={s.characters} /></Section>}
      {s?.locations && <Section title="Locations"><Entities entries={s.locations} /></Section>}
      {s?.props && <Section title="Props"><Entities entries={s.props} /></Section>}

      {s?.visualLanguage && (
        <Section title="Visual language">
          <p className="text-xs leading-relaxed text-fg-muted">{s.visualLanguage}</p>
        </Section>
      )}

      {s?.script && (
        <Section title="Script">
          <Markdown className="text-xs">{s.script}</Markdown>
        </Section>
      )}

      {s?.decisions && s.decisions.length > 0 && (
        <Section title="Locked decisions">
          <ul className="list-disc space-y-1 pl-4 text-xs text-fg-muted marker:text-fg-subtle">
            {s.decisions.map((d, i) => (
              <li key={i}>{d}</li>
            ))}
          </ul>
        </Section>
      )}

      {s?.openQuestions && s.openQuestions.length > 0 && (
        <Section title="Open questions">
          <ul className="list-disc space-y-1 pl-4 text-xs text-fg-muted marker:text-fg-subtle">
            {s.openQuestions.map((q, i) => (
              <li key={i}>{q}</li>
            ))}
          </ul>
        </Section>
      )}
    </div>
  );
}
