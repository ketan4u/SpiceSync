import { notFound, redirect } from 'next/navigation';
import AppHeader from '../AppHeader.tsx';
import ReportRow from './ReportRow.tsx';
import { getReportQueue } from './data.ts';
import { isAdminEmail } from '@/lib/admin/guard.ts';
import { createClient } from '@/lib/supabase/server.ts';

export const metadata = { title: 'Moderation — SpiceSync' };

export default async function AdminPage() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect('/auth?next=/admin');

  // notFound rather than a refusal: a signed-in stranger should not learn that
  // a moderation page exists at all.
  if (!isAdminEmail(auth.user.email)) notFound();

  const reports = await getReportQueue();
  const open = reports.filter((r) => r.status === 'open');
  const rest = reports.filter((r) => r.status !== 'open');

  return (
    <main className="shell">
      <AppHeader />
      <h1>Moderation</h1>
      <p className="lede">
        {open.length === 0
          ? 'Nothing open.'
          : `${open.length} report${open.length === 1 ? '' : 's'} waiting.`}
      </p>

      {open.map((r) => <ReportRow key={r.id} report={r} />)}

      {rest.length > 0 && (
        <>
          <h2 className="settings-h">Handled</h2>
          {rest.map((r) => <ReportRow key={r.id} report={r} />)}
        </>
      )}

      <p className="note">
        Suspending hides the account from every feed and revokes sign-in. It is reversible — which
        matters, because you are acting on one person&apos;s account over another person&apos;s
        word. Deleting an account is deliberately not available here.
      </p>
    </main>
  );
}
