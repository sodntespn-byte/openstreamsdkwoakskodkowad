import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Build otimizado para Node (ex.: SquareCloud, Docker) — `node server.js` na pasta standalone
  output: 'standalone',
  // Marcar pg como pacote externo do servidor para evitar problemas com bundlers
  serverExternalPackages: ['pg', 'pg-native', 'sharp'],
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
