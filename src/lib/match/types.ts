import type { TasteVector } from '../food/types.ts';
import type { PsychProfile } from '../psych/psych-bank.ts';

/**
 * Dating intentions, exactly as the brief specifies them.
 *
 * All are multi-select EXCEPT `exploring`, which is exclusive — selecting it
 * clears the others. Semantically it means "I have not decided yet", which is
 * why it is treated as a wildcard when two people's intentions are compared
 * rather than as a sixth category that only matches itself.
 */
export type Intent = 'marriage' | 'long_term' | 'short_term' | 'casual' | 'exploring';

export const INTENTS: Intent[] = ['marriage', 'long_term', 'short_term', 'casual', 'exploring'];

export const INTENT_LABELS: Record<Intent, string> = {
  marriage: 'Marriage',
  long_term: 'Long-term',
  short_term: 'Short-term',
  casual: 'Casual',
  exploring: 'Exploring',
};

/** Everything the scorer needs about one person. */
export interface MatchProfile {
  id: string;
  age: number;
  /** Free-form so it is not baked into the matching logic. */
  gender: string;
  /** Genders this person wants to see. */
  seeking: string[];
  ageMin: number;
  ageMax: number;
  city: string;
  intents: Intent[];
  /** The brief's checkbox: show me good matches further away if the score is high. */
  openToDistance: boolean;

  /** Section 2. */
  taste: TasteVector;
  /** The dish on their card — used for the "you both picked X" chip. */
  representativeDish?: string;

  /** Section 3. May be empty; the scorer degrades rather than guesses. */
  psych: PsychProfile;

  /**
   * Dealbreakers. `nonNegotiables` are tags this person will not accept in
   * someone else; `attributes` are tags true of them. A conflict in EITHER
   * direction blocks the pair — the brief's second priority, "no overlapping
   * non-negotiables".
   */
  nonNegotiables: string[];
  attributes: string[];
}

export type BlockReason =
  | 'gender'
  | 'age'
  | 'intent'
  | 'distance'
  | 'dealbreaker'
  | 'self';

export interface ScoreComponents {
  food: number;
  psych: number;
  profile: number;
}

export interface ScoredMatch {
  profile: MatchProfile;
  /** Absolute compatibility, 0..1. Independent of who else is available. */
  raw: number;
  components: ScoreComponents;
  /**
   * What the user sees, 0..100. Derived partly from where this person sits in
   * the pool, so Explore is populated on day one — see score.ts.
   */
  displayScore: number;
  /** Suppress the number entirely while the pool is too thin to mean anything. */
  showScore: boolean;
  /** "We think you'll be a great match — you should try to meet." */
  banner: boolean;
  /** Why this person. Never render a score without these. */
  chips: string[];
}

export interface BlockedMatch {
  profile: MatchProfile;
  blocked: BlockReason;
}
