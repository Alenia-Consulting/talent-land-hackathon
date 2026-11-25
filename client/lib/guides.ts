// The only module that talks to the guides API. Everything it sends and receives is typed from
// lib/api-types.ts, which is generated from contracts/openapi.json: if the backend changes its
// shape, this file stops compiling instead of failing in front of a visitor.
//
// See contracts/README.md for the contract itself.

import type { components } from "./api-types.ts";
import { apiUrl } from "./config.ts";

export type Guide = components["schemas"]["GuideOut"];
export type GuideSummary = components["schemas"]["GuideSummary"];
export type Step = components["schemas"]["StepOut"];
export type Mark = components["schemas"]["MarkIn"];
export type GuideCreate = components["schemas"]["GuideCreate"];
export type StepPatch = components["schemas"]["StepPatch"];
export type Route = components["schemas"]["RouteOut"];
export type RouteCreate = components["schemas"]["RouteCreate"];
export type Pending = components["schemas"]["Pending"];
export type Category = Mark["category"];
// Derived from StepPatch, not StepOut: the API declares the response field as a plain string,
// so only the request side carries the three allowed values.
export type NoiseLevel = NonNullable<StepPatch["noise_level"]>;

/** An answer the API refused to give. `status` is 0 when the request never arrived. */
export class ApiError extends Error {
  // Declared, not a constructor parameter property: Node's type stripping rejects those.
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

type ValidationItem = { loc?: (string | number)[]; msg?: string };

/**
 * Turn an error body into one line a person can read.
 *
 * FastAPI answers in two shapes: a plain string for a business rule ("the guide is not ready to
 * publish") and a list for a validation failure, where the field that is wrong only appears in
 * `loc`. Dropping that list on the floor would leave the user guessing which input to fix.
 */
function readError(status: number, body: unknown): string {
  const detail = (body as { detail?: unknown })?.detail;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) {
    return (detail as ValidationItem[])
      .map((item) => {
        const field = (item.loc ?? []).filter((part) => part !== "body").join(".");
        return field ? `${field}: ${item.msg ?? ""}` : (item.msg ?? "");
      })
      .join(" · ");
  }
  return `Error ${status}`;
}

async function request<T>(
  path: string,
  init: RequestInit,
  fetchImpl: typeof fetch = globalThis.fetch,
): Promise<T> {
  let response: Response;
  try {
    response = await fetchImpl(`${apiUrl()}${path}`, {
      ...init,
      cache: "no-store",
      headers: init.body ? { "Content-Type": "application/json" } : undefined,
    });
  } catch {
    throw new ApiError(0, "No hay conexión con el servidor.");
  }

  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) throw new ApiError(response.status, readError(response.status, body));
  return body as T;
}

/**
 * What the recorder sends. `language` is optional in the contract, but openapi-typescript marks
 * every field with a default as required, so it is made optional again here and defaulted below.
 */
export type NewGuide = Omit<GuideCreate, "language"> & { language?: string };

/** POST /guides — one step per mark, each running until the next one. Answers a draft. */
export function createGuide(body: NewGuide, fetchImpl?: typeof fetch): Promise<Guide> {
  return request<Guide>(
    "/guides",
    { method: "POST", body: JSON.stringify({ language: "es", ...body }) },
    fetchImpl,
  );
}

/** POST /guides/{id}/routes — another recording for a guide that exists. The guide comes back. */
export function addRoute(
  guideId: string,
  body: RouteCreate,
  fetchImpl?: typeof fetch,
): Promise<Guide> {
  return request<Guide>(
    `/guides/${guideId}/routes`,
    { method: "POST", body: JSON.stringify(body) },
    fetchImpl,
  );
}

/**
 * DELETE /guides/{id} — the guide, its steps and its files in storage, published or not.
 * It cannot be undone: callers ask the person first.
 */
export async function deleteGuide(id: string, fetchImpl?: typeof fetch): Promise<void> {
  await request<null>(`/guides/${id}`, { method: "DELETE" }, fetchImpl);
}

/** GET /guides — one page for the review panel, most recent first, without steps. */
export function listGuides(
  { limit = 20, offset = 0 }: { limit?: number; offset?: number } = {},
  fetchImpl?: typeof fetch,
): Promise<GuideSummary[]> {
  return request<GuideSummary[]>(
    `/guides?limit=${limit}&offset=${offset}`,
    { method: "GET" },
    fetchImpl,
  );
}

/** GET /guides/{id} — drafts included. For the panel, never for a visitor. */
export function readGuide(id: string, fetchImpl?: typeof fetch): Promise<Guide> {
  return request<Guide>(`/guides/${id}`, { method: "GET" }, fetchImpl);
}

/** PATCH one step. Only the fields passed are changed; the whole guide comes back. */
export function patchStep(
  guideId: string,
  stepId: string,
  changes: StepPatch,
  fetchImpl?: typeof fetch,
): Promise<Guide> {
  return request<Guide>(
    `/guides/${guideId}/steps/${stepId}`,
    { method: "PATCH", body: JSON.stringify(changes) },
    fetchImpl,
  );
}

/** POST publish — refused with 409 while any step is unreviewed or incomplete. */
export function publishGuide(id: string, fetchImpl?: typeof fetch): Promise<Guide> {
  return request<Guide>(`/guides/${id}/publish`, { method: "POST" }, fetchImpl);
}

/** GET /public/{slug} — what the visitor opens. Published guides only. */
export function readPublicGuide(slug: string, fetchImpl?: typeof fetch): Promise<Guide> {
  return request<Guide>(`/public/${slug}`, { method: "GET" }, fetchImpl);
}

/**
 * The URL of a step's ambience, or null when there is none.
 *
 * `sound_available` says whether a sound exists and `sound_url` where it is: the recording's audio
 * with the voices filtered out. A step that says it has a sound without a URL gets no button, so
 * nothing claims to play something it cannot reach.
 */
export function soundUrlOf(step: Step): string | null {
  if (!step.sound_available) return null;
  return typeof step.sound_url === "string" && step.sound_url.length > 0 ? step.sound_url : null;
}
