import { NextRequest, NextResponse } from 'next/server';
import { sql, isOfflineMode, inMemoryData } from '@/lib/db';
import { getCurrentUser, verifyPassword, hashPassword } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const authUser = await getCurrentUser(request);
    if (!authUser) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
    }

    const { currentPassword, newPassword } = await request.json();
    if (!currentPassword || !newPassword || String(newPassword).length < 6) {
      return NextResponse.json(
        { error: 'Senha atual e nova senha (mín. 6 caracteres) são obrigatórias' },
        { status: 400 }
      );
    }

    if (isOfflineMode) {
      const u = inMemoryData.users.find((x) => x.id === authUser.userId);
      if (!u) return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 });
      const ok = await verifyPassword(currentPassword, u.password_hash);
      if (!ok) return NextResponse.json({ error: 'Senha atual incorreta' }, { status: 400 });
      u.password_hash = await hashPassword(newPassword);
      u.updated_at = new Date();
      return NextResponse.json({ message: 'Senha alterada' });
    }

    const row = await sql`
      SELECT password_hash FROM users WHERE id = ${authUser.userId}
    `;
    if (row.rows.length === 0) {
      return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 });
    }
    const hash = (row.rows[0] as { password_hash: string }).password_hash;
    const ok = await verifyPassword(currentPassword, hash);
    if (!ok) {
      return NextResponse.json({ error: 'Senha atual incorreta' }, { status: 400 });
    }

    const newHash = await hashPassword(newPassword);
    await sql`
      UPDATE users SET password_hash = ${newHash}, updated_at = CURRENT_TIMESTAMP
      WHERE id = ${authUser.userId}
    `;

    return NextResponse.json({ message: 'Senha alterada com sucesso' });
  } catch (error) {
    console.error('Change password error:', error);
    return NextResponse.json({ error: 'Erro ao alterar senha' }, { status: 500 });
  }
}
