import { Header } from '@/components/layout/Header';
import { MobileNav } from '@/components/layout/MobileNav';

/** Sala VM: não exige perfil de visionamento (convite direto). */
export default function SalaLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-[var(--bg-primary)]">
      <Header />
      <main className="flex-1 pb-[var(--mobile-nav-offset)] md:pb-0">{children}</main>
      <MobileNav />
    </div>
  );
}
