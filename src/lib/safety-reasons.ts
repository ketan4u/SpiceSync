/**
 * Report reasons.
 *
 * These live outside the server-action file on purpose: a `'use server'` module
 * may only export async functions, and exporting this array from there made
 * every call into that module fail at runtime with "A 'use server' file can
 * only export async functions, found object."
 */
export const REPORT_REASONS = [
  { id: 'fake_profile', label: 'Fake profile or impersonation' },
  { id: 'harassment', label: 'Harassment or abuse' },
  { id: 'inappropriate_photos', label: 'Inappropriate photos' },
  { id: 'underage', label: 'They appear to be under 18' },
  { id: 'spam_or_scam', label: 'Spam or a scam' },
  { id: 'other', label: 'Something else' },
] as const;

export type ReportReason = (typeof REPORT_REASONS)[number]['id'];
