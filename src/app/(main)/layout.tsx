import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { MobileNav } from '@/components/layout/MobileNav';
import { RequireActiveProfile } from '@/components/auth/RequireActiveProfile';

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex flex-col bg-[var(--bg-primary)]">
      <Header />
      <RequireActiveProfile>
        <main className="flex-1 pb-[var(--mobile-nav-offset)] md:pb-0">{children}</main>
      </RequireActiveProfile>
      <Footer />
      <MobileNav />
    </div>
  );
}
