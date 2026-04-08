/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  // Standalone output for Docker / Cloud Run deployment.
  // Produces a self-contained server.js in .next/standalone.
  output: "standalone",
};

export default nextConfig;
