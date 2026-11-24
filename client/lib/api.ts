import { apiUrl } from "./config.ts";

type HealthDbResponse = { status?: string; database?: string; detail?: string };

/** Calls GET /health/db and returns a short message for the UI. */
export async function checkDatabase(fetchImpl: typeof fetch = globalThis.fetch): Promise<string> {
  try {
    const response = await fetchImpl(`${apiUrl()}/health/db`, { cache: "no-store" });
    const body: HealthDbResponse = await response.json().catch(() => ({}));
    if (response.ok) {
      return `Database: ${body.database ?? "ok"}`;
    }
    return `Error ${response.status}: ${body.detail ?? response.statusText}`;
  } catch {
    return "API unreachable";
  }
}
