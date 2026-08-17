import 'server-only';

/**
 * Who may moderate.
 *
 * An env allowlist rather than a column, on purpose: there is nothing in the
 * database to escalate to, and no code path in the app can grant it. Changing
 * the list needs a deploy, which is the right amount of friction for a handful
 * of people.
 */
export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  const raw = process.env.ADMIN_EMAILS;
  // Unset must mean nobody. A default that opens the door is how these go wrong.
  if (!raw) return false;
  return raw
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)
    .includes(email.trim().toLowerCase());
}
