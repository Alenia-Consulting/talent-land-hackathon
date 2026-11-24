import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Static export to out/, served by nginx (docker/frontend), which also proxies /api to the backend.
  output: "export",
};

// `npm run dev` has no nginx: forward /api to the FastAPI backend instead (same origin, no CORS).
// Ignored by `npm run build`.
if (process.env.NODE_ENV === "development") {
  const target = process.env.API_PROXY_TARGET || "http://localhost:8000";
  nextConfig.rewrites = async () => [
    { source: "/api/:path*", destination: `${target}/api/:path*`  },
  ];
}

export default nextConfig;
