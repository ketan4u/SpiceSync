'use client';

import { useState, useTransition } from 'react';
import { REPORT_REASONS } from '@/lib/safety-reasons.ts';
import type { QueuedReport } from './data.ts';
import { dismissReport, suspendAccount, unsuspendAccount } from './actions.ts';

const REASON_LABEL = Object.fromEntries(REPORT_REASONS.map((r) => [r.id, r.label]));

export default function ReportRow({ report }: { report: QueuedReport }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>) =>
    startTransition(async () => {
      setError(null);
      const r = await fn();
      if (!r.ok) setError(r.error ?? 'Failed.');
    });

  const open = report.status === 'open';

  return (
    <div className="report" data-status={report.status}>
      <div className="report-head">
        <span className="report-reason">{REASON_LABEL[report.reason] ?? report.reason}</span>
        <span className="report-status">{report.status}</span>
      </div>

      <p className="report-meta">
        <strong>{report.reportedName}</strong>
        {report.reportedSuspended && <span className="report-flag">suspended</span>}
        {report.reportsAgainst > 1 && (
          <span className="report-flag warn">{report.reportsAgainst} reports</span>
        )}
        <br />
        reported by {report.reporterName} · {new Date(report.createdAt).toLocaleString()}
      </p>

      {report.detail && <p className="report-detail">{report.detail}</p>}

      {error && <p className="err">{error}</p>}

      <div className="report-actions">
        {open && !report.reportedSuspended && (
          <button
            className="btn btn-danger"
            disabled={pending}
            onClick={() => run(() => suspendAccount(report.reportedId, report.id, report.reason))}
          >
            Suspend account
          </button>
        )}
        {report.reportedSuspended && (
          <button
            className="btn btn-ghost"
            disabled={pending}
            onClick={() => run(() => unsuspendAccount(report.reportedId))}
          >
            Lift suspension
          </button>
        )}
        {open && (
          <button className="btn btn-ghost" disabled={pending} onClick={() => run(() => dismissReport(report.id))}>
            Dismiss
          </button>
        )}
      </div>
    </div>
  );
}
