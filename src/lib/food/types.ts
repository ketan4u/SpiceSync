/**
 * SpiceSync — Section 2 (food identity) type definitions.
 *
 * The quiz surface is exactly as specced in the brief: two photos, tap one,
 * 6-8 rounds. What changed is the model underneath. Instead of king-of-the-hill
 * (winner carries forward, last item standing = "your food"), each pair is a
 * deliberate contrast along one axis and we accumulate a taste VECTOR.
 *
 * Reason: the Explore card promises "North Indian, Extra Spicy" — an independent
 * cuisine reading AND a spice reading. A single surviving photo cannot produce
 * that, and its result is order-dependent.
 */

/** The six diet bands asked upfront, before the quiz begins. */
export type DietBand =
  | 'vegan'
  | 'all_veg'
  | 'mostly_veg'
  | 'mostly_non_veg'
  | 'generally_non_veg'
  | 'eats_anything';

export const DIET_BAND_LABELS: Record<DietBand, string> = {
  vegan: 'Vegan',
  all_veg: 'All Veg',
  mostly_veg: 'Mostly Veg',
  mostly_non_veg: 'Mostly Non-Veg',
  generally_non_veg: 'Generally Non-Veg',
  eats_anything: 'Eats Anything and Everything',
};

/** Order matters — rendered top-to-bottom on the gate screen, and used for
 *  the asymmetric diet-compatibility distance in match scoring. */
export const DIET_BAND_ORDER: DietBand[] = [
  'vegan',
  'all_veg',
  'mostly_veg',
  'mostly_non_veg',
  'generally_non_veg',
  'eats_anything',
];

/** What a food item actually contains. Indian convention: "vegetarian" excludes
 *  egg, so egg is its own class. */
export type ItemDiet = 'vegan' | 'vegetarian' | 'egg' | 'non_veg';

export type Cuisine =
  | 'north_indian'
  | 'south_indian'
  | 'bengali_east'
  | 'west_indian'
  | 'mughlai'
  | 'indo_chinese'
  | 'continental'
  | 'pan_asian'
  | 'street';

export const CUISINE_LABELS: Record<Cuisine, string> = {
  north_indian: 'North Indian',
  south_indian: 'South Indian',
  bengali_east: 'Bengali & East',
  west_indian: 'Maharashtrian & West',
  mughlai: 'Mughlai',
  indo_chinese: 'Indo-Chinese',
  continental: 'Continental & Café',
  pan_asian: 'Pan-Asian',
  street: 'Street Food',
};

/** Where the dish lives. Correlates with spending and date-planning style. */
export type Setting = 'street' | 'home' | 'cafe' | 'restaurant';

/** Continuous axes, all normalised 0..1. */
export type ContinuousAxis = 'spice' | 'richness' | 'novelty' | 'sweetness';

export const CONTINUOUS_AXES: ContinuousAxis[] = [
  'spice',
  'richness',
  'novelty',
  'sweetness',
];

export interface FoodItem {
  id: string;
  name: string;
  /** One line shown under the name while photos are placeholders. */
  blurb: string;
  /** Placeholder art until real photography lands (Phase 2). */
  emoji: string;
  diet: ItemDiet;
  cuisine: Cuisine;
  /** 0 = no heat, 1 = extra spicy. */
  spice: number;
  /** 0 = light and clean, 1 = fried, creamy, heavy. */
  richness: number;
  /** 0 = everyone in India has eaten this, 1 = you have to seek it out. */
  novelty: number;
  /** 0 = fully savoury, 1 = dessert. */
  sweetness: number;
  setting: Setting;
}

/** The output of the quiz: a person's food identity. */
export interface TasteVector {
  dietBand: DietBand;
  /** Estimated ideal point per continuous axis, 0..1. */
  spice: number;
  richness: number;
  novelty: number;
  sweetness: number;
  /** Affinity weight per cuisine, normalised to sum 1 across cuisines seen. */
  cuisine: Record<Cuisine, number>;
  /** Affinity weight per setting, normalised. */
  setting: Record<Setting, number>;
  /** Accumulated evidence per axis. Low confidence => don't show it on the card. */
  confidence: Record<ContinuousAxis | 'cuisine' | 'setting', number>;
}

export interface QuizChoice {
  round: number;
  winnerId: string;
  loserId: string;
  /** The user tapped "neither". Recorded but contributes no evidence. */
  skipped?: boolean;
  /** Which axis this pair was built to probe (for debugging/analytics). */
  probing: ContinuousAxis | 'cuisine' | 'setting';
}

export interface QuizPair {
  round: number;
  left: FoodItem;
  right: FoodItem;
  probing: ContinuousAxis | 'cuisine' | 'setting';
}
