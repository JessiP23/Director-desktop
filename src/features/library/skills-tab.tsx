import * as React from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { useResource } from "@/lib/data/resource-store";
import { skills, skillsStore } from "@/lib/data/library-stores";
import {
  DIRECTOR_SKILL_ACTIVATIONS,
  DIRECTOR_SKILL_CATEGORIES,
  DIRECTOR_SKILL_DESCRIPTION_MAX,
  DIRECTOR_SKILL_NAME_MAX,
  DIRECTOR_SKILL_SYSTEM_PROMPT_MAX,
  DIRECTOR_SKILL_TYPES,
  type DirectorSkillActivation,
  type DirectorSkillCategory,
  type DirectorSkillType,
} from "@/lib/director/contract/skills";
import { Pill, Select, StateHint, TextArea, TextField, Toggle } from "./ui";

/** Manage reusable Director skills (always-on or on-demand SKILL.md). */
export function SkillsTab() {
  const { data, loading, error } = useResource(skillsStore);
  const [adding, setAdding] = React.useState(false);
  const [busyId, setBusyId] = React.useState<string | null>(null);

  if (loading && !data) return <StateHint><Spinner /></StateHint>;
  if (error && !data) return <StateHint tone="danger">{error}</StateHint>;

  const items = data ?? [];

  return (
    <div className="flex flex-col gap-2 p-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-text-tertiary">
          Reusable abilities the Director can apply across productions.
        </p>
        <Button size="sm" variant="secondary" onClick={() => setAdding((v) => !v)}>
          <Plus className="size-3.5" /> Add
        </Button>
      </div>

      {adding && <AddSkillForm onDone={() => setAdding(false)} />}

      {items.length === 0 ? (
        <StateHint>No skills yet. Create one to teach the Director a repeatable workflow.</StateHint>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {items.map((s) => (
            <li
              key={s.id}
              className="flex items-start gap-3 rounded-xl border border-line-strong bg-ink-800/60 px-3 py-2.5"
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="truncate text-sm font-medium text-fg">{s.name}</span>
                  <Pill>{s.category}</Pill>
                  <Pill className="bg-accent/10 text-accent">{s.activation ?? "always_on"}</Pill>
                </div>
                <p className="mt-1 line-clamp-2 text-xs text-text-tertiary">{s.description}</p>
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                <Toggle
                  label={`Enable ${s.name}`}
                  checked={s.enabled}
                  disabled={busyId === s.id}
                  onChange={async (enabled) => {
                    setBusyId(s.id);
                    try {
                      await skills.update(s.id, { enabled });
                    } finally {
                      setBusyId(null);
                    }
                  }}
                />
                <button
                  type="button"
                  aria-label={`Delete ${s.name}`}
                  disabled={busyId === s.id}
                  onClick={async () => {
                    setBusyId(s.id);
                    try {
                      await skills.remove(s.id);
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

function AddSkillForm({ onDone }: { onDone: () => void }) {
  const [name, setName] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [category, setCategory] = React.useState<DirectorSkillCategory>("custom");
  const [skillType, setSkillType] = React.useState<DirectorSkillType>("prompt_template");
  const [activation, setActivation] = React.useState<DirectorSkillActivation>("on_demand");
  const [systemPrompt, setSystemPrompt] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const canSave = name.trim().length > 0 && description.trim().length > 0 && !saving;

  async function save() {
    setSaving(true);
    setError(null);
    try {
      await skills.create({
        name: name.trim(),
        description: description.trim(),
        category,
        skillType,
        activation,
        systemPrompt: systemPrompt.trim() || undefined,
      });
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-2.5 rounded-xl border border-line-strong bg-ink-800/40 p-3">
      <TextField label="Name" value={name} onChange={setName} maxLength={DIRECTOR_SKILL_NAME_MAX} placeholder="e.g. Cinematic color grade" />
      <TextField label="Description" value={description} onChange={setDescription} maxLength={DIRECTOR_SKILL_DESCRIPTION_MAX} placeholder="One line on what this skill does" />
      <div className="grid grid-cols-3 gap-2">
        <Select label="Category" value={category} options={DIRECTOR_SKILL_CATEGORIES} onChange={setCategory} />
        <Select label="Type" value={skillType} options={DIRECTOR_SKILL_TYPES} onChange={setSkillType} />
        <Select label="Activation" value={activation} options={DIRECTOR_SKILL_ACTIVATIONS} onChange={setActivation} />
      </div>
      <TextArea label="Instructions (optional)" value={systemPrompt} onChange={setSystemPrompt} maxLength={DIRECTOR_SKILL_SYSTEM_PROMPT_MAX} placeholder="What the Director should do when this skill applies" rows={4} />
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
