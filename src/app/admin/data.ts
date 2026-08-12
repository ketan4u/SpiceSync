import 'server-only';

import { createAdminClient } from '@/lib/supabase/admin.ts';

export interface QueuedReport {
  id: string;
  reason: string;
  detail: string | null;
  createdAt: string;
  status: string;
  reportedId: string;
  reportedName: string;
  reportedSuspended: boolean;
  reporterName: string;
  /** How many separate people have reported this account. */
  reportsAgainst: number;
}

export async function getReportQueue(): Promise<QueuedReport[]> {
  const admin = createAdminClient();
  if (!admin) return [];

  const { data: reports } = await admin
    .from('reports')
    .select('id,reason,detail,created_at,status,reported_id,reporter_id')
    .order('created_at', { ascending: false })
    .limit(200);
  if (!reports || reports.length === 0) return [];

  const ids = [
    ...new Set(reports.flatMap((r) => [r.reported_id as string, r.reporter_id as string])),
  ];
  const { data: people } = await admin
    .from('profiles')
    .select('id,name,suspended_at')
    .in('id', ids);
  const byId = new Map((people ?? []).map((p) => [p.id as string, p]));

  // A single complaint and five separate complaints are very different signals,
  // and the queue should not make you count rows to tell them apart.
  const counts = new Map<string, number>();
  for (const r of reports) {
    const id = r.reported_id as string;
    counts.set(id, (counts.get(id) ?? 0) + 1);
  }

  return reports.map((r) => {
    const reported = byId.get(r.reported_id as string);
    return {
      id: r.id as string,
      reason: r.reason as string,
      detail: (r.detail as string) ?? null,
      createdAt: r.created_at as string,
      status: r.status as string,
      reportedId: r.reported_id as string,
      reportedName: (reported?.name as string) ?? '(deleted account)',
      reportedSuspended: Boolean(reported?.suspended_at),
      reporterName: (byId.get(r.reporter_id as string)?.name as string) ?? '(deleted account)',
      reportsAgainst: counts.get(r.reported_id as string) ?? 1,
    };
  });
}
