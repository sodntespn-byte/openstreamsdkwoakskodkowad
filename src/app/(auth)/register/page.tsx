'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { OpenStreamLogo } from '@/components/branding/OpenStreamLogo';
import { Mail, Lock, Eye, EyeOff, User, Sparkles } from 'lucide-react';

export default function RegisterPage() {
  const router = useRouter();
  const { register } = useAuth();
  const { showToast } = useToast();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<{
    name?: string;
    email?: string;
    password?: string;
    confirmPassword?: string;
  }>({});

  const validate = () => {
    const newErrors: typeof errors = {};

    if (!name || name.trim().length < 2) {
      newErrors.name = 'Nome deve ter pelo menos 2 caracteres';
    }

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

    if (password !== confirmPassword) {
      newErrors.confirmPassword = 'As senhas não coincidem';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validate()) return;

    setIsLoading(true);

    try {
      await register(email.trim(), password, name.trim());
      showToast('Conta criada. Bem-vindo!', 'success');
      router.push('/profiles');
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Erro ao criar conta';
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
            Criar conta
          </span>
        </Link>
      </div>

      <div className="mb-6 flex items-center justify-center gap-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-tertiary)]/50 px-3 py-2 text-xs text-[var(--text-secondary)]">
        <Sparkles className="h-4 w-4 shrink-0 text-[var(--accent-primary)]" />
        <span>Senha armazenada com bcrypt (custo elevado). Sem registo de IP em comentários.</span>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-5">
        <Input
          label="Nome"
          type="text"
          autoComplete="name"
          placeholder="Como quer ser chamado"
          value={name}
          onChange={(e) => setName(e.target.value)}
          error={errors.name}
          icon={<User size={18} />}
        />

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
            autoComplete="new-password"
            placeholder="Mínimo 6 caracteres"
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

        <Input
          label="Confirmar senha"
          type={showPassword ? 'text' : 'password'}
          autoComplete="new-password"
          placeholder="Repita a senha"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          error={errors.confirmPassword}
          icon={<Lock size={18} />}
        />

        <Button type="submit" className="w-full" size="lg" loading={isLoading}>
          Criar conta
        </Button>
      </form>

      <div className="mt-8 border-t border-[var(--border-subtle)] pt-6 text-center text-sm">
        <p className="text-[var(--text-secondary)]">
          Já tens conta?{' '}
          <Link
            href="/login"
            className="font-semibold text-[var(--accent-primary)] underline-offset-4 hover:underline"
          >
            Entrar
          </Link>
        </p>
      </div>
    </div>
  );
}
