'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { OpenStreamLogo } from '@/components/branding/OpenStreamLogo';
import { Mail, Lock, Eye, EyeOff, ShieldCheck } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
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
      router.push('/profiles');
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
        <Link href="/" className="inline-flex flex-col items-center gap-2">
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
          autoComplete="email"
          placeholder="nome@exemplo.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          error={errors.email}
          icon={<Mail size={18} />}
        />

        <div className="relative">
          <Input
            label="Senha"
            type={showPassword ? 'text' : 'password'}
            autoComplete="current-password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            error={errors.password}
            icon={<Lock size={18} />}
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 top-[2.35rem] rounded-lg p-1.5 text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)]"
            aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
          >
            {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        </div>

        <Button type="submit" className="w-full" size="lg" loading={isLoading}>
          Entrar
        </Button>
      </form>

      <div className="mt-8 border-t border-[var(--border-subtle)] pt-6 text-center text-sm">
        <p className="text-[var(--text-secondary)]">
          Novo por aqui?{' '}
          <Link
            href="/register"
            className="font-semibold text-[var(--accent-primary)] underline-offset-4 hover:underline"
          >
            Criar conta
          </Link>
        </p>
      </div>
    </div>
  );
}
