import { NextRequest, NextResponse } from 'next/server';
import { query, initializeDatabase } from '@/lib/db';
import bcrypt from 'bcryptjs';

export async function GET(request: NextRequest) {
  const secret = request.nextUrl.searchParams.get('secret');
  const expected = process.env.SETUP_SECRET;

  if (!expected || secret !== expected) {
    return NextResponse.json({ error: 'Acesso não autorizado' }, { status: 401 });
  }

  const logs: string[] = [];

  try {
    logs.push('Iniciando configuração do banco de dados…');
    await initializeDatabase();
    logs.push('Tabelas e patches verificados.');

    await query(`
      INSERT INTO system_settings (key, value, description) VALUES
        ('site_name', 'OpenStream', 'Nome do site'),
        ('site_description', 'Sua plataforma de streaming favorita', 'Descrição do site'),
        ('maintenance_mode', 'false', 'Modo de manutenção'),
        ('allow_registration', 'true', 'Permitir registro de novos usuários'),
        ('default_theme', 'dark', 'Tema padrão do site')
      ON CONFLICT (key) DO NOTHING
    `);
    logs.push('Configurações do sistema inseridas.');

    const adminEmail = process.env.SETUP_ADMIN_EMAIL;
    const adminPassword = process.env.SETUP_ADMIN_PASSWORD;
    const adminName = process.env.SETUP_ADMIN_NAME || 'Administrador';

    if (adminEmail && adminPassword) {
      const existingAdmin = await query<{ id: number }>('SELECT id FROM users WHERE email = $1', [
        adminEmail,
      ]);

      const passwordHash = await bcrypt.hash(adminPassword, 12);

      if (existingAdmin.rows.length > 0) {
        await query(
          'UPDATE users SET password_hash = $1, is_admin = TRUE, name = $2 WHERE email = $3',
          [passwordHash, adminName, adminEmail]
        );
        logs.push('Utilizador admin atualizado (credenciais não são devolvidas na resposta).');
      } else {
        await query(
          `INSERT INTO users (email, name, password_hash, is_admin, status)
           VALUES ($1, $2, $3, TRUE, 'active')`,
          [adminEmail, adminName, passwordHash]
        );
        logs.push('Utilizador admin criado (credenciais não são devolvidas na resposta).');
      }
    } else {
      logs.push('SETUP_ADMIN_EMAIL / SETUP_ADMIN_PASSWORD não definidos — utilizador admin não criado.');
    }

    logs.push('Setup concluído.');

    return NextResponse.json({
      success: true,
      message: 'Banco de dados configurado com sucesso.',
      logs,
    });
  } catch (error) {
    if (process.env.NODE_ENV === 'development') {
      console.error('[setup]', error);
    }
    logs.push('Erro durante o setup.');

    return NextResponse.json(
      {
        success: false,
        error: 'Falha na configuração',
        logs,
      },
      { status: 500 }
    );
  }
}
