/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  // Proxy all /api/* requests to the FastAPI backend so the browser never
  // has to cross origins. Works locally (127.0.0.1:8000) and in Cloud Shell.
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
