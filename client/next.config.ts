import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Static export to out/, served by nginx (docker/frontend), which also proxies /api to the backend.
  output: "export",
};

// `npm run dev` has no nginx: forward /api to the FastAPI backend instead (same origin, no CORS).
// Ignored by `npm run build`.
if (process.env.NODE_ENV === "development") {
  const target = process.env.API_PROXY_TARGET || "http://localhost:8000";
  // Let the iPhone load dev assets through a tunnel (see README).
  nextConfig.allowedDevOrigins = ["*.trycloudflare.com", "*.ngrok-free.app", "*.ngrok-free.dev", "*.ts.net", "*.*.ts.net"];
  nextConfig.rewrites = async () => [
    { source: "/api/:path*", destination: `${target}/api/:path*`  },
  ];
}

export default nextConfig;
