// Browser configuration read at runtime, so the same image works in every environment.
//
// The container writes /env.js at startup (docker/frontend/entrypoint.sh) from its NEXT_PUBLIC_*
// environment variables (Kubernetes ConfigMap / docker compose); the root layout loads it before
// the app. With `npm run dev`, client/.env.local (NEXT_PUBLIC_*) is used instead.
// Everything here reaches the browser: never put secrets in NEXT_PUBLIC_* variables.

export type RuntimeEnv = Partial<Record<`NEXT_PUBLIC_${string}`, string>>;

declare global {
  interface Window {
    __ENV__?: RuntimeEnv;
  }
}

function runtimeEnv(): RuntimeEnv {
  return (typeof window !== "undefined" && window.__ENV__) || {};
}

/** Base URL of the REST API, without trailing slash. Defaults to /api (proxied by nginx). */
export function apiUrl(): string {
  const url = runtimeEnv().NEXT_PUBLIC_API_URL || process.env.NEXT_PUBLIC_API_URL || "/api";
  return url.replace(/\/+$/, "");
}
