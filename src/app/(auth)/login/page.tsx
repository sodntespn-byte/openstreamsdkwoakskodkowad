'use client';

import { useState, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { OpenStreamLogo } from '@/components/branding/OpenStreamLogo';
import { Mail, Lock, Eye, EyeOff, ShieldCheck } from 'lucide-react';

function safeRedirect(path: string | null): string {
  if (!path || !path.startsWith('/') || path.startsWith('//')) return '/profiles';
  if (path.startsWith('/sala')) return path;
  return path;
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = safeRedirect(searchParams.get('redirect'));
  const { login } = useAuth();
  const { showToast } = useToast();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});

  const validate = () => {
    const newErrors: { email?: string; password?: string } = {};

    if (!email) {
      newErrors.email = 'E-mail é obrigatório';
    } else if (!/\S+@\S+\.\S+/.test(email)) {
      newErrors.email = 'E-mail inválido';
    }

    if (!password) {
      newErrors.password = 'Senha é obrigatória';
    } else if (password.length < 6) {
      newErrors.password = 'Senha deve ter pelo menos 6 caracteres';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validate()) return;

    setIsLoading(true);

    try {
      await login(email.trim(), password);
      showToast('Sessão iniciada com sucesso.', 'success');
      router.push(redirectTo);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Erro ao fazer login';
      showToast(msg, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div>
      <div className="mb-8 text-center">
        <Link href="/welcome" className="inline-flex flex-col items-center gap-2">
          <OpenStreamLogo href={null} className="text-3xl sm:text-4xl" />
          <span className="text-sm font-medium text-[var(--text-secondary)]">
            Entrar na conta
          </span>
        </Link>
      </div>

      <div className="mb-6 flex items-center justify-center gap-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-tertiary)]/50 px-3 py-2 text-xs text-[var(--text-secondary)]">
        <ShieldCheck className="h-4 w-4 shrink-0 text-[var(--accent-primary)]" />
        <span>Protegido por limite de tentativas e cookies HttpOnly.</span>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <Input
          label="E-mail"
          type="email"
          icon={<Mail size={18} />}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          error={errors.email}
          placeholder="tu@email.com"
          autoComplete="email"
        />

        <div className="relative">
          <Input
            label="Senha"
            type={showPassword ? 'text' : 'password'}
            icon={<Lock size={18} />}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            error={errors.password}
            placeholder="••••••••"
            autoComplete="current-password"
            className="pr-12"
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 top-[38px] text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"
            aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
          >
            {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        </div>

        <Button type="submit" className="w-full" loading={isLoading}>
          Entrar
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-[var(--text-secondary)]">
        Não tens conta?{' '}
        <Link href="/register" className="text-[var(--accent-primary)] hover:underline">
          Registar
        </Link>
      </p>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="loading-spinner mx-auto" aria-hidden />}>
      <LoginForm />
    </Suspense>
  );
}
