import type { Metadata, Viewport } from 'next';
import { Poppins } from 'next/font/google';
import './globals.css';
import { Providers } from '@/components/Providers';
import { ConsoleFilter } from '@/components/ConsoleFilter';

const poppins = Poppins({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'],
  display: 'swap',
  variable: '--font-poppins',
});

export const metadata: Metadata = {
  title: 'Superflix — Filmes, Séries e Animes',
  description:
    'Assista aos melhores filmes, séries e animes em HD. Streaming com legendas em português.',
  keywords: ['streaming', 'filmes', 'séries', 'animes', 'Superflix', 'assistir online', 'hd', 'legendado'],
  authors: [{ name: 'Superflix' }],
  manifest: '/manifest.json',
  icons: {
    icon: '/favicon.ico',
    apple: '/icons/icon-192x192.png',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  viewportFit: 'cover',
  themeColor: '#000000',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR" className="scroll-smooth" suppressHydrationWarning>
      <body className={poppins.className}>
        <ConsoleFilter />
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}
