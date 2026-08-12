/**
 * The dealbreaker vocabulary.
 *
 * One tag list, read two ways. `selfLabel` is how someone declares it about
 * themselves; `avoidLabel` is how someone rules it out in a partner. The
 * scorer's gate compares one person's non-negotiables against the other's
 * attributes, in both directions, so a non-negotiable is inert unless the other
 * side has declared the matching attribute — which is why both have to be asked.
 *
 * WHAT IS DELIBERATELY ABSENT
 * ---------------------------
 * Caste, religion, and skin colour. Every one of them would be technically
 * trivial to add and each is a standard field on Indian matrimonial platforms.
 * That is the reason to leave them out rather than a reason to include them: a
 * structured filter is not a neutral container, it is the thing that makes
 * sorting people by those categories fast, repeatable and normal. Food, drink,
 * smoking, children and living arrangements are choices and circumstances
 * people can speak to. The three above are not, and SpiceSync's premise —
 * matching on what people actually do rather than what box they tick — is
 * weaker, not stronger, with them in.
 *
 * This is a product decision, not a technical constraint. If it is overruled,
 * overrule it knowingly.
 */
export interface Dealbreaker {
  id: string;
  /** "I smoke" */
  selfLabel: string;
  /** "Smokes" — shown under "I won't date someone who…" */
  avoidLabel: string;
}

export const DEALBREAKERS: Dealbreaker[] = [
  { id: 'smokes', selfLabel: 'I smoke', avoidLabel: 'Smokes' },
  { id: 'drinks_often', selfLabel: 'I drink often', avoidLabel: 'Drinks often' },
  { id: 'never_drinks', selfLabel: 'I never drink', avoidLabel: 'Never drinks' },
  { id: 'recreational_drugs', selfLabel: 'I use recreational drugs', avoidLabel: 'Uses recreational drugs' },
  { id: 'has_children', selfLabel: 'I have children', avoidLabel: 'Has children' },
  { id: 'wants_children', selfLabel: 'I want children', avoidLabel: 'Wants children' },
  { id: 'no_children_ever', selfLabel: 'I do not want children', avoidLabel: 'Does not want children' },
  { id: 'has_pets', selfLabel: 'I have pets', avoidLabel: 'Has pets' },
  { id: 'lives_with_family', selfLabel: 'I live with family', avoidLabel: 'Lives with family' },
  { id: 'works_nights', selfLabel: 'I work nights or odd hours', avoidLabel: 'Works nights or odd hours' },
  { id: 'will_not_relocate', selfLabel: 'I will not relocate', avoidLabel: 'Will not relocate' },
];

const IDS = new Set(DEALBREAKERS.map((d) => d.id));

export function isKnownDealbreaker(id: string): boolean {
  return IDS.has(id);
}

/** Drops anything not in the vocabulary. Used on every write path. */
export function sanitiseTags(tags: unknown): string[] {
  if (!Array.isArray(tags)) return [];
  return [...new Set(tags.filter((t): t is string => typeof t === 'string' && IDS.has(t)))];
}

export function avoidLabel(id: string): string {
  return DEALBREAKERS.find((d) => d.id === id)?.avoidLabel ?? id;
}
