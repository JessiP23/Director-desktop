/**
 * Desktop port of the editor's file upload: multipart POST to the wmstudio
 * backend (`/api/production-agent/attachments`) via the authorized fetch (base
 * URL + Supabase JWT). The browser sets the multipart Content-Type+boundary, so
 * we pass only the auth header. Returns the saved R2 references the editor places.
 */
import { buildAuthorizedRequest } from "@/lib/api/client";
import type { UploadedReference } from "../components/editor-view";

export async function uploadAttachments(files: File[]): Promise<UploadedReference[]> {
  if (files.length === 0) return [];
  const formData = new FormData();
  for (const file of files) formData.append("file", file);

  const { url, headers } = await buildAuthorizedRequest("/api/production-agent/attachments");
  const response = await fetch(url, { method: "POST", headers, body: formData });
  const data = (await response.json().catch(() => ({}))) as {
    references?: UploadedReference[];
    message?: string;
    error?: string;
  };
  if (!response.ok || !data.references) {
    throw new Error(data.message || data.error || "Failed to upload references");
  }
  return data.references;
}
