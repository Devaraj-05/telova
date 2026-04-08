/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  // Standalone output for Docker / Cloud Run deployment.
  // Produces a self-contained server.js in .next/standalone.
  output: "standalone",

  // Proxy all /api/* requests to the FastAPI backend so the browser never
  // has to cross origins.
  // - Local dev:    BACKEND_URL=http://127.0.0.1:8000
  // - Cloud Shell:  BACKEND_URL=http://127.0.0.1:8000
  // - Cloud Run:    BACKEND_URL=https://telova-backend-<hash>-uc.a.run.app
  async rewrites() {
    const backendUrl =
      process.env.BACKEND_URL?.replace(/\/$/, "") ?? "http://127.0.0.1:8000";

    return [
      {
        source: "/api/:path*",
        destination: `${backendUrl}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
