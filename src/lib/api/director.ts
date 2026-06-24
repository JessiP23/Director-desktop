/**
 * Typed Director endpoints — the desktop app's view of the backend's
 * `/api/production-agent/*` and `/api/director/*` routes. One function per
 * operation, so components never hand-build URLs or payloads.
 */
import { apiClient, buildAuthorizedRequest } from "@/lib/api/client";
import {
  AUTO_MODEL_ID,
  type DirectorEvent,
  type DirectorModelId,
  type DirectorReference,
  type DirectorRun,
  type DirectorRunMode,
  type DirectorQuality,
} from "@/lib/director/contract/director";
import type { DirectorBrief, DirectorBriefPatchPayload } from "@/lib/director/contract/brief";

const RUNS = "/api/production-agent/runs";

export type CreateRunPayload = {
  prompt: string;
  references?: DirectorReference[];
  mode?: DirectorRunMode;
  model?: DirectorModelId;
  autoProceed?: boolean;
  quality?: DirectorQuality;
};

export type ContinueRunPayload = {
  prompt: string;
  references?: DirectorReference[];
  model?: DirectorModelId;
  autoProceed?: boolean;
  quality?: DirectorQuality;
};

export const directorApi = {
  listRuns: () => apiClient.get<{ runs: DirectorRun[] }>(RUNS).then((r) => r.runs),

  getRun: (runId: string) =>
    apiClient.get<{ run: DirectorRun; events: DirectorEvent[] }>(`${RUNS}/${runId}`),

  createRun: (payload: CreateRunPayload) =>
    apiClient
      .post<{ run: DirectorRun }>(RUNS, {
        mode: payload.mode ?? "video-production",
        model: AUTO_MODEL_ID,
        references: payload.references ?? [],
        ...payload,
      })
      .then((r) => r.run),

  continueRun: (runId: string, payload: ContinueRunPayload) =>
    apiClient
      .post<{ run: DirectorRun }>(`${RUNS}/${runId}`, { references: [], ...payload })
      .then((r) => r.run),

  cancelRun: (runId: string) =>
    apiClient.patch<{ run: DirectorRun }>(`${RUNS}/${runId}`, { status: "cancelled" }),

  renameRun: (runId: string, title: string) =>
    apiClient.patch<{ run: DirectorRun }>(`${RUNS}/${runId}`, { title }),

  deleteRun: (runId: string) => apiClient.delete<unknown>(`${RUNS}/${runId}`),

  // The brief routes wrap the payload as `{ brief }`.
  getBrief: (runId: string) =>
    apiClient.get<{ brief: DirectorBrief }>(`/api/director/${runId}/brief`).then((r) => r.brief),

  patchBrief: (runId: string, patch: DirectorBriefPatchPayload) =>
    apiClient.patch<{ brief: DirectorBrief }>(`/api/director/${runId}/brief`, patch).then((r) => r.brief),

  /** Authorized SSE URL + headers for a run's event stream. */
  streamRequest: (runId: string, followLatestTurn = false) =>
    buildAuthorizedRequest(
      `${RUNS}/${runId}/stream${followLatestTurn ? "?follow=1" : ""}`,
    ),
};
