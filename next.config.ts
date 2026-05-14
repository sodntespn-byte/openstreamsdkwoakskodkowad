import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Build standalone: `node .next/standalone/server.js` (Docker / PaaS com Node)
  output: 'standalone',
  productionBrowserSourceMaps: false,
  // Marcar pg como pacote externo do servidor para evitar problemas com bundlers
  serverExternalPackages: ['pg', 'pg-native'],
  // Desabilitar Turbopack em desenvolvimento para compatibilidade com pg no Windows
  turbopack: {
    rules: {},
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'image.tmdb.org',
        pathname: '/t/p/**',
      },
      {
        protocol: 'https',
        hostname: '**.postimg.org',
      },
      {
        protocol: 'http',
        hostname: '**.postimg.org',
      },
      {
        protocol: 'https',
        hostname: 'i.imgur.com',
      },
      {
        protocol: 'https',
        hostname: 'lut.im',
      },
    ],
    unoptimized: true,
  },
  async headers() {
    return [
      {
        source: '/api/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        ],
      },
    ];
  },
};

export default nextConfig;
