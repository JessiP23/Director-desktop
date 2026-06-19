import * as React from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { useResource } from "@/lib/data/resource-store";
import { memories, memoriesStore } from "@/lib/data/library-stores";
import {
  DIRECTOR_MEMORY_CONTENT_MAX,
  DIRECTOR_MEMORY_DEFAULT_TYPE,
  DIRECTOR_MEMORY_TITLE_MAX,
  DIRECTOR_MEMORY_TYPES,
  type DirectorMemoryType,
} from "@/lib/director/contract/memory";
import { Pill, Select, StateHint, TextArea, TextField, Toggle } from "./ui";

/** Manage the Director's long-term memories (user facts/preferences). */
export function MemoriesTab() {
  const { data, loading, error } = useResource(memoriesStore);
  const [adding, setAdding] = React.useState(false);
  const [busyId, setBusyId] = React.useState<string | null>(null);

  if (loading && !data) return <StateHint><Spinner /></StateHint>;
  if (error && !data) return <StateHint tone="danger">{error}</StateHint>;

  const items = data ?? [];

  return (
    <div className="flex flex-col gap-2 p-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-text-tertiary">
          Facts the Director remembers across every production.
        </p>
        <Button size="sm" variant="secondary" onClick={() => setAdding((v) => !v)}>
          <Plus className="size-3.5" /> Add
        </Button>
      </div>

      {adding && (
        <AddMemoryForm
          onDone={() => setAdding(false)}
        />
      )}

      {items.length === 0 ? (
        <StateHint>No memories yet. Add one, or let the Director suggest them.</StateHint>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {items.map((m) => (
            <li
              key={m.id}
              className="flex items-start gap-3 rounded-xl border border-line-strong bg-ink-800/60 px-3 py-2.5"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <Pill>{m.type}</Pill>
                  <span className="truncate text-sm font-medium text-fg">{m.title}</span>
                </div>
                <p className="mt-1 line-clamp-3 text-xs text-text-tertiary">{m.content}</p>
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                <Toggle
                  label={`Enable ${m.title}`}
                  checked={m.enabled}
                  disabled={busyId === m.id}
                  onChange={async (enabled) => {
                    setBusyId(m.id);
                    try {
                      await memories.update(m.id, { enabled });
                    } finally {
                      setBusyId(null);
                    }
                  }}
                />
                <button
                  type="button"
                  aria-label={`Delete ${m.title}`}
                  disabled={busyId === m.id}
                  onClick={async () => {
                    setBusyId(m.id);
                    try {
                      await memories.remove(m.id);
                    } finally {
                      setBusyId(null);
                    }
                  }}
                  className="grid size-7 place-items-center rounded-md text-text-tertiary transition-colors hover:bg-danger/10 hover:text-danger disabled:opacity-50"
                >
                  <Trash2 className="size-4" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function AddMemoryForm({ onDone }: { onDone: () => void }) {
  const [type, setType] = React.useState<DirectorMemoryType>(DIRECTOR_MEMORY_DEFAULT_TYPE);
  const [title, setTitle] = React.useState("");
  const [content, setContent] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const canSave = title.trim().length > 0 && content.trim().length > 0 && !saving;

  async function save() {
    setSaving(true);
    setError(null);
    try {
      await memories.create({ type, title: title.trim(), content: content.trim() });
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-2.5 rounded-xl border border-line-strong bg-ink-800/40 p-3">
      <Select label="Type" value={type} options={DIRECTOR_MEMORY_TYPES} onChange={setType} />
      <TextField label="Title" value={title} onChange={setTitle} maxLength={DIRECTOR_MEMORY_TITLE_MAX} placeholder="e.g. Preferred aspect ratio" />
      <TextArea label="Content" value={content} onChange={setContent} maxLength={DIRECTOR_MEMORY_CONTENT_MAX} placeholder="What should the Director remember?" />
      {error && <p className="text-xs text-danger">{error}</p>}
      <div className="flex justify-end gap-2">
        <Button size="sm" variant="ghost" onClick={onDone} disabled={saving}>Cancel</Button>
        <Button size="sm" variant="primary" onClick={save} disabled={!canSave}>
          {saving ? <Spinner className="size-3.5" /> : "Save"}
        </Button>
      </div>
    </div>
  );
}
