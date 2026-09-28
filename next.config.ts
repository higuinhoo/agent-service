/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    typedRoutes: true,
  },
  // Worker roda fora do Next.js — excluir da compilação web
  serverExternalPackages: ["pg", "pg-boss"],
};

export default nextConfig;
