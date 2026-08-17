'use server';

import { revalidatePath } from 'next/cache';
import { isAdminEmail } from '@/lib/admin/guard.ts';
import { createAdminClient } from '@/lib/supabase/admin.ts';
import { createClient } from '@/lib/supabase/server.ts';

type Result = { ok: boolean; error?: string };

/**
 * Every action re-checks admin status.
 *
 * The page already refuses non-admins, but a server action is a public
 * endpoint — anyone who knows its id can call it directly. Guarding only the
 * page would leave moderation one crafted request away from anybody.
 */
async function requireAdmin() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user || !isAdminEmail(auth.user.email)) return null;
  return auth.user;
}

export async function dismissReport(reportId: string): Promise<Result> {
  if (!(await requireAdmin())) return { ok: false, error: 'Not allowed.' };
  const admin = createAdminClient();
  if (!admin) return { ok: false, error: 'Not configured.' };

  const { error } = await admin.from('reports').update({ status: 'dismissed' }).eq('id', reportId);
  if (error) return { ok: false, error: 'Could not update the report.' };
  revalidatePath('/admin');
  return { ok: true };
}

/**
 * Suspending does two things, and both are needed.
 *
 * The column takes them out of every feed. The auth ban is what actually
 * revokes access — a flag on a profile row cannot stop somebody signing in.
 */
export async function suspendAccount(
  userId: string,
  reportId: string,
  reason: string,
): Promise<Result> {
  if (!(await requireAdmin())) return { ok: false, error: 'Not allowed.' };
  const admin = createAdminClient();
  if (!admin) return { ok: false, error: 'Not configured.' };

  const { error: profileError } = await admin
    .from('profiles')
    .update({ suspended_at: new Date().toISOString(), suspended_reason: reason })
    .eq('id', userId);
  if (profileError) return { ok: false, error: 'Could not suspend the profile.' };

  // 100 years, i.e. indefinite. Reversible, because acting on one person's
  // account over another person's word should always be undoable.
  const { error: banError } = await admin.auth.admin.updateUserById(userId, {
    ban_duration: '876000h',
  });
  if (banError) {
    console.error('[admin] ban failed', banError.message);
    return { ok: false, error: 'Profile hidden, but sign-in was not revoked. Try again.' };
  }

  await admin.from('reports').update({ status: 'actioned' }).eq('id', reportId);
  revalidatePath('/admin');
  return { ok: true };
}

export async function unsuspendAccount(userId: string): Promise<Result> {
  if (!(await requireAdmin())) return { ok: false, error: 'Not allowed.' };
  const admin = createAdminClient();
  if (!admin) return { ok: false, error: 'Not configured.' };

  const { error } = await admin
    .from('profiles')
    .update({ suspended_at: null, suspended_reason: null })
    .eq('id', userId);
  if (error) return { ok: false, error: 'Could not lift the suspension.' };

  const { error: banError } = await admin.auth.admin.updateUserById(userId, { ban_duration: 'none' });
  if (banError) return { ok: false, error: 'Profile restored, but sign-in is still revoked.' };

  revalidatePath('/admin');
  return { ok: true };
}
