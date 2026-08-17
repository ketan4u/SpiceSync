import type { Setting } from './types.ts';

/**
 * Section 2b — a person's relationship with food.
 *
 * The photo taps measure preferences: how much heat, how far from the usual,
 * how rich. They are the only revealed-preference instrument in the product and
 * they earn their place, because everybody claims to love spicy food and the
 * taps find out.
 *
 * What taps cannot reach is what food MEANS to someone — whether it is central
 * to who they are, whether cooking is how they show care, and above all how much
 * they need a partner to share any of it. Those predict friction far better than
 * whether two people both like dosa.
 *
 * Three outputs, not one:
 *
 *   centrality  how much food matters to their identity
 *   archetype   the noun on their badge
 *   foodWeight  how heavily food should count in THEIR matching — a weight,
 *               not a trait, and the most consequential thing here
 *
 * `setting` is also derived here rather than probed by the taps. Where someone
 * eats — street stall, home, café, restaurant — is something people report
 * accurately, and three of these questions speak to it directly. The taps
 * measured it weakly and the budget is better spent on heat and novelty.
 */

export type Archetype = 'explorer' | 'feeder' | 'loyalist' | 'easygoer';

export const ARCHETYPE_LABELS: Record<Archetype, string> = {
  explorer: 'Explorer',
  feeder: 'Feeder',
  loyalist: 'Loyalist',
  easygoer: 'Easygoer',
};

export const ARCHETYPE_BLURBS: Record<Archetype, string> = {
  explorer: 'always one menu ahead',
  feeder: 'feeds people to say things',
  loyalist: 'has a place, and it is the place',
  easygoer: 'eats to live, and that is fine',
};

interface OptionScore {
  /** 0..1, how much this answer implies food matters to them. */
  centrality?: number;
  archetype?: Partial<Record<Archetype, number>>;
  setting?: Partial<Record<Setting, number>>;
  /** Only q6 sets this. */
  foodWeight?: number;
}

export interface FoodOption {
  id: string;
  label: string;
  scores: OptionScore;
}

export interface FoodQuestion {
  id: string;
  prompt: string;
  options: FoodOption[];
}

export const FOOD_QUESTIONS: FoodQuestion[] = [
  {
    id: 'dinner_party',
    prompt: "At a dinner party, the food isn't quite to your taste. You…",
    options: [
      { id: 'a', label: "Eat it anyway without mentioning it — it's polite", scores: { centrality: 0.35, archetype: { easygoer: 0.5 } } },
      { id: 'b', label: 'Leave some on your plate but stay positive', scores: { centrality: 0.5, archetype: { easygoer: 0.3 } } },
      { id: 'c', label: "Quietly ask the host if there's anything else", scores: { centrality: 0.7, archetype: { loyalist: 1 } } },
      { id: 'd', label: 'Make a lighthearted joke and move on', scores: { centrality: 0.5, archetype: { explorer: 0.2 } } },
    ],
  },
  {
    id: 'ideal_weekend',
    prompt: 'Your ideal weekend looks like…',
    options: [
      { id: 'a', label: 'Exploring a new restaurant or food market', scores: { centrality: 0.9, archetype: { explorer: 2 }, setting: { restaurant: 1 } } },
      { id: 'b', label: 'Cooking a long meal at home with people you love', scores: { centrality: 0.9, archetype: { feeder: 2 }, setting: { home: 1 } } },
      { id: 'c', label: 'A solo adventure with street food along the way', scores: { centrality: 0.85, archetype: { explorer: 2 }, setting: { street: 1 } } },
      { id: 'd', label: 'Relaxing with great food delivered to your door', scores: { centrality: 0.55, archetype: { loyalist: 2.5 }, setting: { home: 1 } } },
    ],
  },
  {
    id: 'first_date',
    prompt: 'Your perfect first date is…',
    options: [
      { id: 'a', label: 'A nice restaurant — food tells you everything about someone', scores: { centrality: 0.95, archetype: { explorer: 1 }, setting: { restaurant: 1 } } },
      { id: 'b', label: 'Something active, then eating after — shared experience first', scores: { centrality: 0.45, archetype: { explorer: 0.5 } } },
      { id: 'c', label: 'Coffee or drinks — low pressure, easy to extend', scores: { centrality: 0.3, archetype: { easygoer: 1 }, setting: { cafe: 1 } } },
      { id: 'd', label: 'Cooking together at home — intimate from the start', scores: { centrality: 0.85, archetype: { feeder: 2 }, setting: { home: 1 } } },
    ],
  },
  {
    id: 'shared_habits',
    prompt: 'How do you feel about shared eating habits with a partner?',
    options: [
      { id: 'a', label: 'Very important — it affects everyday life more than people realise', scores: { centrality: 0.85, foodWeight: 0.9 } },
      { id: 'b', label: 'Somewhat — we should be able to enjoy meals together', scores: { centrality: 0.65, foodWeight: 0.65 } },
      { id: 'c', label: 'Not very — we can make it work even if we eat differently', scores: { centrality: 0.45, foodWeight: 0.35 } },
      { id: 'd', label: 'Not at all — food is personal, not a compatibility test', scores: { centrality: 0.25, foodWeight: 0.12 } },
    ],
  },
  {
    id: 'stress',
    prompt: "When you're really stressed, you…",
    options: [
      { id: 'a', label: "Cook something from scratch — it's therapeutic", scores: { centrality: 0.9, archetype: { feeder: 2 }, setting: { home: 1 } } },
      { id: 'b', label: 'Order your favourite comfort food', scores: { centrality: 0.7, archetype: { loyalist: 2.5 }, setting: { home: 1 } } },
      { id: 'c', label: 'Lose your appetite until things feel better', scores: { centrality: 0.25, archetype: { easygoer: 1 } } },
      { id: 'd', label: 'Eat mindlessly — stress and food are connected for you', scores: { centrality: 0.6, archetype: { loyalist: 1.5 } } },
    ],
  },
  {
    id: 'friends_say',
    prompt: 'Your friends would describe you as…',
    options: [
      { id: 'a', label: 'The one who always knows the best places to eat', scores: { centrality: 0.9, archetype: { explorer: 2 }, setting: { restaurant: 1 } } },
      { id: 'b', label: 'The one who brings homemade food to every gathering', scores: { centrality: 0.9, archetype: { feeder: 2 }, setting: { home: 1 } } },
      { id: 'c', label: 'The adventurous one who tries everything at least once', scores: { centrality: 0.85, archetype: { explorer: 2 }, setting: { street: 0.5 } } },
      { id: 'd', label: "Honestly? Someone who doesn't make a big deal about food", scores: { centrality: 0.15, archetype: { easygoer: 3 } } },
    ],
  },
];

export interface FoodAnswer {
  questionId: string;
  optionId: string;
}

export interface FoodRelationship {
  centrality: number;
  archetype: Archetype | null;
  /** How heavily food should count in this person's matching. */
  foodWeight: number;
  setting: Record<string, number>;
  answered: number;
}

/** What the scorer used before any of this existed. Unanswered stays neutral. */
export const DEFAULT_FOOD_WEIGHT = 0.5;

const BY_ID = new Map(FOOD_QUESTIONS.map((q) => [q.id, q]));

/**
 * Loyalist carries heavier points than its rivals because it has fewer paths
 * through these six questions — there is no "the one with a usual spot" option
 * in the friends-describe-you question, where Explorer and Feeder both score.
 * Left unweighted it was reachable about 6% of the time under even answering,
 * which is a badge almost nobody would ever see.
 */

/** Ties break in this order, so the same answers always give the same badge. */
const ARCHETYPE_PRIORITY: Archetype[] = ['feeder', 'explorer', 'loyalist', 'easygoer'];

export function scoreFoodRelationship(answers: FoodAnswer[]): FoodRelationship {
  const archetypeScores: Record<Archetype, number> = {
    explorer: 0, feeder: 0, loyalist: 0, easygoer: 0,
  };
  const setting: Record<string, number> = {};
  let centralitySum = 0;
  let centralityCount = 0;
  let foodWeight: number | null = null;
  let answered = 0;

  for (const answer of answers) {
    const question = BY_ID.get(answer.questionId);
    if (!question) continue;
    const option = question.options.find((o) => o.id === answer.optionId);
    if (!option) continue;
    answered++;

    const s = option.scores;
    if (s.centrality !== undefined) {
      centralitySum += s.centrality;
      centralityCount++;
    }
    for (const [a, v] of Object.entries(s.archetype ?? {})) {
      archetypeScores[a as Archetype] += v;
    }
    for (const [k, v] of Object.entries(s.setting ?? {})) {
      setting[k] = (setting[k] ?? 0) + v;
    }
    if (s.foodWeight !== undefined) foodWeight = s.foodWeight;
  }

  const centrality = centralityCount > 0 ? centralitySum / centralityCount : 0.5;

  let archetype: Archetype | null = null;
  if (answered > 0) {
    // Someone who told us food is not the point is an Easygoer whatever else
    // they ticked — otherwise a single "cooking at home" answer can crown a
    // Feeder who does not care about food at all.
    if (centrality < 0.32) {
      archetype = 'easygoer';
    } else {
      const best = Math.max(...Object.values(archetypeScores));
      archetype = best <= 0
        ? 'easygoer'
        : ARCHETYPE_PRIORITY.find((a) => archetypeScores[a] === best) ?? 'easygoer';
    }
  }

  const total = Object.values(setting).reduce((a, b) => a + b, 0);
  const normalisedSetting = total > 0
    ? Object.fromEntries(Object.entries(setting).map(([k, v]) => [k, v / total]))
    : {};

  return {
    centrality,
    archetype,
    foodWeight: foodWeight ?? DEFAULT_FOOD_WEIGHT,
    setting: normalisedSetting,
    answered,
  };
}

export function isKnownFoodAnswer(a: FoodAnswer): boolean {
  const q = BY_ID.get(a.questionId);
  return Boolean(q && q.options.some((o) => o.id === a.optionId));
}

export function sanitiseFoodAnswers(raw: unknown): FoodAnswer[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: FoodAnswer[] = [];
  for (const item of raw) {
    const a = item as FoodAnswer;
    if (!a || typeof a.questionId !== 'string' || typeof a.optionId !== 'string') continue;
    if (seen.has(a.questionId) || !isKnownFoodAnswer(a)) continue;
    seen.add(a.questionId);
    out.push({ questionId: a.questionId, optionId: a.optionId });
  }
  return out;
}
