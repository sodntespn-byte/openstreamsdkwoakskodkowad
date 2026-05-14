import type { Metadata } from 'next';
import { LandingPage } from '@/components/landing/LandingPage';

export const metadata: Metadata = {
  title: 'Bem-vindo — Superflix',
  description:
    'Conheça a Superflix: filmes, séries, TV ao vivo e calendário de lançamentos. Entre com a sua conta para aceder ao catálogo completo.',
};

export default function WelcomeRoute() {
  return <LandingPage />;
}
