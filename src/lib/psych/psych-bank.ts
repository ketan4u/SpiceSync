/**
 * SpiceSync — Section 3 question bank.
 *
 * Design brief was "thorough enough to be meaningful, light enough not to feel
 * daunting". Those pull against each other, so:
 *
 *   - ANCHORED, NOT INVENTED. Items are drawn from constructs with actual
 *     literature behind them — Big Five, adult attachment (anxiety/avoidance),
 *     and a set of relationship values that predict day-to-day friction. We
 *     rewrote them as situations; we did not make up new psychology.
 *
 *   - NO LIKERT GRIDS. Nobody has ever enjoyed rating "I am outgoing" from 1 to
 *     5. Every item is a concrete moment with 2-4 things you might actually do.
 *     Situational framing also blunts social desirability: it is easy to claim
 *     you are laid back, harder to pick the laid-back option when the scenario
 *     is your partner not replying for eight hours.
 *
 *   - 12 CORE, THEN DRIP. The core twelve are skippable at signup and take
 *     about ninety seconds. The remaining eighteen arrive one at a time between
 *     swipe sessions, exactly as the brief proposed. Depth grows to ~34 items
 *     over a few weeks without a wall of questions on day one.
 *
 * HOW THESE ARE USED, AND HOW THEY ARE NOT
 * ----------------------------------------
 * The best evidence here is discouraging: Joel, Eastwick & Finkel (2017) ran
 * machine learning over more than a hundred self-reported traits from both
 * members of thousands of pairs and could not predict pre-meeting compatibility
 * above chance. Anyone selling a personality-matching oracle is overselling.
 *
 * So these answers are used for three honest things instead:
 *   1. RULING OUT known friction — mismatched pace, opposite conflict styles,
 *      an anxious/avoidant pairing.
 *   2. Producing WHY-CHIPS. "Both night owls", "you both go quiet in an
 *      argument" is a reason to talk, and it is checkable by the user.
 *   3. Giving people language for what they want, which the brief identifies as
 *      the actual problem: people cannot articulate it unprompted.
 *
 * Never render a bare compatibility number off the back of this file.
 */

export type Trait =
  // Big Five
  | 'openness'
  | 'conscientiousness'
  | 'extraversion'
  | 'agreeableness'
  | 'emotional_volatility'
  // Adult attachment
  | 'attachment_anxiety'
  | 'attachment_avoidance'
  // Relationship values and lifestyle
  | 'conflict_engagement'
  | 'pace'
  | 'social_battery'
  | 'planning'
  | 'ambition_over_balance'
  | 'night_owl'
  | 'family_closeness'
  | 'spending'
  | 'pda'
  | 'independence';

/**
 * How each trait is treated when two people are scored.
 *   similarity  — closer is better (values, lifestyle, pace)
 *   flag        — only certain COMBINATIONS matter (attachment)
 *   context     — colours the why-chips, never moves the score on its own
 */
export type TraitUse = 'similarity' | 'flag' | 'context';

export interface TraitMeta {
  use: TraitUse;
  /** Weight within the psychological half of the match score. */
  weight: number;
  /** Describing ONE person: "takes it slow". Used on a profile. */
  lowChip: string;
  highChip: string;
  /**
   * Describing a PAIR: "both take it slow". English needs the plural verb, and
   * reusing the singular phrasing produced "both dives in" on real output.
   */
  lowPair: string;
  highPair: string;
}

export const TRAITS: Record<Trait, TraitMeta> = {
  // Lifestyle and values do the real work — these are the things couples
  // actually argue about.
  pace: { use: 'similarity', weight: 1.0, lowChip: 'takes it slow', highChip: 'dives in', lowPair: 'take it slow', highPair: 'dive in' },
  conflict_engagement: { use: 'similarity', weight: 1.0, lowChip: 'needs space in a fight', highChip: 'talks it out immediately', lowPair: 'need space in a fight', highPair: 'talk things out immediately' },
  social_battery: { use: 'similarity', weight: 0.9, lowChip: 'quiet weekends', highChip: 'always out', lowPair: 'like quiet weekends', highPair: 'are always out' },
  family_closeness: { use: 'similarity', weight: 0.9, lowChip: 'keeps family at arm’s length', highChip: 'family is close by', lowPair: 'keep family at arm’s length', highPair: 'are close to family' },
  night_owl: { use: 'similarity', weight: 0.7, lowChip: 'early riser', highChip: 'night owl', lowPair: 'are early risers', highPair: 'are night owls' },
  planning: { use: 'similarity', weight: 0.7, lowChip: 'wings it', highChip: 'plans everything', lowPair: 'wing it', highPair: 'plan everything' },
  ambition_over_balance: { use: 'similarity', weight: 0.8, lowChip: 'protects their time', highChip: 'career first', lowPair: 'protect their time', highPair: 'put career first' },
  spending: { use: 'similarity', weight: 0.6, lowChip: 'careful with money', highChip: 'spends freely', lowPair: 'are careful with money', highPair: 'spend freely' },
  pda: { use: 'similarity', weight: 0.4, lowChip: 'private about it', highChip: 'affectionate in public', lowPair: 'are private about it', highPair: 'are affectionate in public' },
  independence: { use: 'similarity', weight: 0.8, lowChip: 'likes doing things together', highChip: 'needs their own space', lowPair: 'like doing things together', highPair: 'need their own space' },

  // Attachment is a combination effect, not a similarity one. Two secure people
  // do well; an anxious person with an avoidant one is the single most
  // documented bad pairing in this literature.
  attachment_anxiety: { use: 'flag', weight: 1.0, lowChip: 'secure when apart', highChip: 'needs reassurance', lowPair: 'are secure when apart', highPair: 'need reassurance' },
  attachment_avoidance: { use: 'flag', weight: 1.0, lowChip: 'comfortable getting close', highChip: 'guards their independence', lowPair: 'are comfortable getting close', highPair: 'guard their independence' },

  // Big Five is weak at predicting satisfaction. Kept light, mostly for chips.
  openness: { use: 'similarity', weight: 0.5, lowChip: 'sticks to what works', highChip: 'up for anything', lowPair: 'stick to what works', highPair: 'are up for anything' },
  conscientiousness: { use: 'similarity', weight: 0.5, lowChip: 'relaxed about structure', highChip: 'organised', lowPair: 'are relaxed about structure', highPair: 'are organised' },
  extraversion: { use: 'context', weight: 0.3, lowChip: 'reserved', highChip: 'outgoing', lowPair: 'are reserved', highPair: 'are outgoing' },
  agreeableness: { use: 'context', weight: 0.3, lowChip: 'blunt', highChip: 'accommodating', lowPair: 'are blunt', highPair: 'are accommodating' },
  emotional_volatility: { use: 'context', weight: 0.3, lowChip: 'even-keeled', highChip: 'feels things intensely', lowPair: 'are even-keeled', highPair: 'feel things intensely' },
};

export interface PsychOption {
  id: string;
  label: string;
  /** Trait deltas in -1..1. Most options move one or two traits. */
  scores: Partial<Record<Trait, number>>;
}

export interface PsychQuestion {
  id: string;
  /** `core` is the skippable set of 12 at signup; `drip` arrives between swipes. */
  tier: 'core' | 'drip';
  /** The construct this item primarily measures. */
  construct: Trait;
  prompt: string;
  options: PsychOption[];
}

export const PSYCH_BANK: PsychQuestion[] = [
  // ============================================================ CORE (12)
  {
    id: 'free_evening',
    tier: 'core',
    construct: 'openness',
    prompt: 'One free evening in a city you have never been to. You:',
    options: [
      { id: 'wander', label: 'Walk out with no plan and see where you end up', scores: { openness: 0.9, planning: -0.6 } },
      { id: 'researched', label: 'Go to the place you researched three days ago', scores: { openness: 0.1, planning: 0.9, conscientiousness: 0.5 } },
      { id: 'ask_local', label: 'Ask someone local where they actually eat', scores: { openness: 0.7, extraversion: 0.5 } },
      { id: 'familiar', label: 'Find something familiar — you are tired', scores: { openness: -0.7, social_battery: -0.4 } },
    ],
  },
  {
    id: 'deadline_night',
    tier: 'core',
    construct: 'conscientiousness',
    prompt: 'It is 11pm. Tomorrow morning is a deadline you could technically still hit. You:',
    options: [
      { id: 'finish_now', label: 'Finish it tonight, sleep properly', scores: { conscientiousness: 0.9, planning: 0.5, night_owl: 0.3 } },
      { id: 'early_alarm', label: 'Set a 5am alarm and back yourself', scores: { conscientiousness: 0.2, emotional_volatility: 0.3, night_owl: -0.6 } },
      { id: 'wing_it', label: 'It will come together. It always does', scores: { conscientiousness: -0.8, planning: -0.6 } },
    ],
  },
  {
    id: 'house_party',
    tier: 'core',
    construct: 'extraversion',
    prompt: 'You arrive at a house party. You know exactly one person there and they have not shown up yet.',
    options: [
      { id: 'talk_to_strangers', label: 'Start talking to whoever is nearest', scores: { extraversion: 0.9, social_battery: 0.7 } },
      { id: 'find_kitchen', label: 'Find the kitchen and make yourself useful', scores: { extraversion: 0.1, agreeableness: 0.5 } },
      { id: 'phone', label: 'Phone. Text them asking how far away they are', scores: { extraversion: -0.7, attachment_anxiety: 0.3 } },
      { id: 'leave', label: 'Honestly, consider leaving', scores: { extraversion: -0.9, social_battery: -0.8 } },
    ],
  },
  {
    id: 'friends_bad_work',
    tier: 'drip',
    construct: 'agreeableness',
    prompt: 'A close friend shows you something they made and asks what you think. It is not good.',
    options: [
      { id: 'honest', label: 'Tell them straight — that is what they asked for', scores: { agreeableness: -0.7, conflict_engagement: 0.6 } },
      { id: 'soften', label: 'Lead with what works, then the problems', scores: { agreeableness: 0.5, conflict_engagement: 0.4 } },
      { id: 'encourage', label: 'Encourage them. They need momentum more than critique', scores: { agreeableness: 0.8, conflict_engagement: -0.5 } },
    ],
  },
  {
    id: 'day_after_argument',
    tier: 'core',
    construct: 'emotional_volatility',
    prompt: 'The day after a big argument, you mostly feel:',
    options: [
      { id: 'resolved', label: 'Fine. It was said, it is done', scores: { emotional_volatility: -0.8, attachment_anxiety: -0.5 } },
      { id: 'replaying', label: 'Still replaying it, sentence by sentence', scores: { emotional_volatility: 0.8, attachment_anxiety: 0.6 } },
      { id: 'distant', label: 'Flat. You need a couple of days before you are warm again', scores: { attachment_avoidance: 0.7, emotional_volatility: 0.3 } },
      { id: 'urgent_fix', label: 'Desperate to fix it before anything else happens', scores: { attachment_anxiety: 0.9, conflict_engagement: 0.5 } },
    ],
  },
  {
    id: 'slow_reply',
    tier: 'core',
    construct: 'attachment_anxiety',
    prompt: 'Someone you have been seeing a month takes eight hours to reply to a message that mattered to you.',
    options: [
      { id: 'unbothered', label: 'They are busy. You barely noticed', scores: { attachment_anxiety: -0.9 } },
      { id: 'noticed', label: 'You noticed, but you let it go', scores: { attachment_anxiety: -0.2 } },
      { id: 'rereading', label: 'You reread your message wondering what was wrong with it', scores: { attachment_anxiety: 0.8 } },
      { id: 'withdraw', label: 'You take just as long to reply next time', scores: { attachment_anxiety: 0.6, attachment_avoidance: 0.6 } },
    ],
  },
  {
    id: 'what_is_this',
    tier: 'core',
    construct: 'attachment_avoidance',
    prompt: 'A few weeks in, they say they want to talk about what this is.',
    options: [
      { id: 'relieved', label: 'Relief — you were going to bring it up anyway', scores: { attachment_avoidance: -0.8, pace: 0.6 } },
      { id: 'happy_to', label: 'Happy to talk, no strong feelings either way', scores: { attachment_avoidance: -0.2 } },
      { id: 'early', label: 'It feels early. Why label it now?', scores: { attachment_avoidance: 0.6, pace: -0.6 } },
      { id: 'trapped', label: 'Something in you tightens up', scores: { attachment_avoidance: 0.9, pace: -0.7 } },
    ],
  },
  {
    id: 'week_four',
    tier: 'core',
    construct: 'pace',
    prompt: 'Three genuinely good dates in. What does week four look like?',
    options: [
      { id: 'most_days', label: 'Talking most days, seeing each other twice a week', scores: { pace: 0.9, independence: -0.5 } },
      { id: 'steady', label: 'Once a week, building steadily', scores: { pace: 0.2 } },
      { id: 'unhurried', label: 'Whenever it happens. No schedule', scores: { pace: -0.6, planning: -0.5 } },
      { id: 'still_open', label: 'Still seeing how you feel — and seeing other people', scores: { pace: -0.9, attachment_avoidance: 0.5 } },
    ],
  },
  {
    id: 'ideal_sunday',
    tier: 'core',
    construct: 'social_battery',
    prompt: 'Your ideal Sunday:',
    options: [
      { id: 'people', label: 'Long lunch that turns into eight people and evening plans', scores: { social_battery: 0.9, extraversion: 0.8 } },
      { id: 'one_person', label: 'One person, one long walk, nowhere to be', scores: { social_battery: -0.3, independence: -0.3 } },
      { id: 'alone', label: 'Entirely alone and entirely unreachable', scores: { social_battery: -0.9, independence: 0.8 } },
      { id: 'errands', label: 'Getting the week ahead sorted', scores: { conscientiousness: 0.7, planning: 0.7 } },
    ],
  },
  {
    id: 'trip_planning',
    tier: 'core',
    construct: 'planning',
    prompt: 'A four-day trip starts in two days. Your itinerary is:',
    options: [
      { id: 'spreadsheet', label: 'A document. With timings', scores: { planning: 0.9, conscientiousness: 0.8 } },
      { id: 'shortlist', label: 'Flights booked, a shortlist of places, rest is open', scores: { planning: 0.3 } },
      { id: 'nothing', label: 'You have the tickets. That is the itinerary', scores: { planning: -0.9, openness: 0.5 } },
    ],
  },
  {
    id: 'small_annoyance',
    tier: 'core',
    construct: 'conflict_engagement',
    prompt: 'They did something small that annoyed you. By that evening:',
    options: [
      { id: 'say_it', label: 'You have said it. It is not worth carrying', scores: { conflict_engagement: 0.9 } },
      { id: 'wait_pattern', label: 'You are waiting to see if it becomes a pattern', scores: { conflict_engagement: -0.2, conscientiousness: 0.3 } },
      { id: 'let_go', label: 'You have genuinely let it go', scores: { conflict_engagement: -0.6, agreeableness: 0.6 } },
      { id: 'quiet', label: 'You have not said anything, but they can tell', scores: { conflict_engagement: -0.8, emotional_volatility: 0.6 } },
    ],
  },
  {
    id: 'job_offer',
    tier: 'core',
    construct: 'ambition_over_balance',
    prompt: 'A job offers 40% more money and twenty more hours a week.',
    options: [
      { id: 'take_it', label: 'Take it. This is the decade to push', scores: { ambition_over_balance: 0.9 } },
      { id: 'negotiate', label: 'Take it, but negotiate the hours down', scores: { ambition_over_balance: 0.3, conscientiousness: 0.4 } },
      { id: 'decline', label: 'Decline. Your evenings are not for sale', scores: { ambition_over_balance: -0.9 } },
    ],
  },

  // ============================================================ DRIP (18)
  {
    id: 'one_am',
    tier: 'drip',
    construct: 'night_owl',
    prompt: 'It is 1am on a Tuesday. You are:',
    options: [
      { id: 'asleep', label: 'Asleep. Have been for a while', scores: { night_owl: -0.9 } },
      { id: 'winding', label: 'Winding down, about to sleep', scores: { night_owl: -0.3 } },
      { id: 'awake', label: 'Wide awake and at your best', scores: { night_owl: 0.9 } },
    ],
  },
  {
    id: 'parents_call',
    tier: 'core',
    construct: 'family_closeness',
    prompt: 'How often do you speak to your parents?',
    options: [
      { id: 'daily', label: 'Most days', scores: { family_closeness: 0.9 } },
      { id: 'weekly', label: 'Every week or so', scores: { family_closeness: 0.3 } },
      { id: 'occasionally', label: 'When there is something to say', scores: { family_closeness: -0.4 } },
      { id: 'rarely', label: 'Rarely, and that is deliberate', scores: { family_closeness: -0.9, independence: 0.5 } },
    ],
  },
  {
    id: 'unexpected_money',
    tier: 'drip',
    construct: 'spending',
    prompt: '₹50,000 you were not expecting lands in your account.',
    options: [
      { id: 'save', label: 'Straight into savings', scores: { spending: -0.9, conscientiousness: 0.6 } },
      { id: 'split', label: 'Half away, half on something you have wanted', scores: { spending: 0 } },
      { id: 'trip', label: 'Book the trip', scores: { spending: 0.8, openness: 0.5 } },
      { id: 'gift', label: 'Spend most of it on people you love', scores: { spending: 0.6, agreeableness: 0.8 } },
    ],
  },
  {
    id: 'crowded_market',
    tier: 'drip',
    construct: 'pda',
    prompt: 'Walking through a crowded market together, hand in hand.',
    options: [
      { id: 'natural', label: 'Completely natural', scores: { pda: 0.8 } },
      { id: 'depends', label: 'Depends who might see', scores: { pda: -0.2 } },
      { id: 'private', label: 'You would rather save it for later', scores: { pda: -0.8 } },
    ],
  },
  {
    id: 'solo_trip',
    tier: 'drip',
    construct: 'independence',
    prompt: 'They want to take a two-week trip on their own.',
    options: [
      { id: 'great', label: 'Genuinely happy for them', scores: { independence: 0.8, attachment_anxiety: -0.6 } },
      { id: 'fine_miss', label: 'Fine, and you will miss them loudly', scores: { independence: -0.2 } },
      { id: 'sting', label: 'It stings a little that they did not suggest going together', scores: { attachment_anxiety: 0.7, independence: -0.7 } },
    ],
  },
  {
    id: 'unknown_dish',
    tier: 'drip',
    construct: 'openness',
    prompt: 'The menu has one thing on it you have never heard of.',
    options: [
      { id: 'order_it', label: 'That is what you are ordering', scores: { openness: 0.9 } },
      { id: 'ask', label: 'Ask what it is, then decide', scores: { openness: 0.3 } },
      { id: 'usual', label: 'You are getting your usual', scores: { openness: -0.8 } },
    ],
  },
  {
    id: 'room_right_now',
    tier: 'drip',
    construct: 'conscientiousness',
    prompt: 'Your room, right now, with no warning:',
    options: [
      { id: 'tidy', label: 'Someone could walk in', scores: { conscientiousness: 0.8 } },
      { id: 'lived_in', label: 'Lived in, not embarrassing', scores: { conscientiousness: 0.2 } },
      { id: 'chaos', label: 'Please give me ten minutes', scores: { conscientiousness: -0.8 } },
    ],
  },
  {
    id: 'free_friday',
    tier: 'drip',
    construct: 'extraversion',
    prompt: 'Friday, no plans, nobody expecting anything from you.',
    options: [
      { id: 'make_plans', label: 'You start texting people', scores: { extraversion: 0.9, social_battery: 0.7 } },
      { id: 'wait', label: 'You will go if something comes up', scores: { extraversion: 0.1 } },
      { id: 'protect', label: 'That empty evening is the best news all week', scores: { extraversion: -0.8, social_battery: -0.8 } },
    ],
  },
  {
    id: 'queue_cutter',
    tier: 'drip',
    construct: 'agreeableness',
    prompt: 'Someone cuts the queue right in front of you.',
    options: [
      { id: 'say_something', label: 'You say something', scores: { agreeableness: -0.6, conflict_engagement: 0.8 } },
      { id: 'loud_sigh', label: 'A very audible sigh', scores: { agreeableness: -0.2, conflict_engagement: -0.3 } },
      { id: 'let_it', label: 'Not worth the energy', scores: { agreeableness: 0.7, conflict_engagement: -0.6 } },
    ],
  },
  {
    id: 'read_no_reply',
    tier: 'drip',
    construct: 'emotional_volatility',
    prompt: 'Read three hours ago. No reply.',
    options: [
      { id: 'nothing', label: 'You genuinely have not thought about it', scores: { emotional_volatility: -0.8, attachment_anxiety: -0.7 } },
      { id: 'mild', label: 'Mildly aware of it', scores: { emotional_volatility: 0 } },
      { id: 'spiral', label: 'You have constructed several theories', scores: { emotional_volatility: 0.8, attachment_anxiety: 0.8 } },
    ],
  },
  {
    id: 'out_with_friends',
    tier: 'drip',
    construct: 'attachment_anxiety',
    prompt: 'They are out with a group of friends you have never met.',
    options: [
      { id: 'fine', label: 'Hope they are having a good night', scores: { attachment_anxiety: -0.8 } },
      { id: 'curious', label: 'Curious, and you will ask about it tomorrow', scores: { attachment_anxiety: -0.1 } },
      { id: 'left_out', label: 'A small feeling of being left out', scores: { attachment_anxiety: 0.8 } },
    ],
  },
  {
    id: 'drawer',
    tier: 'drip',
    construct: 'attachment_avoidance',
    prompt: 'They ask if they can keep a drawer at your place.',
    options: [
      { id: 'yes', label: 'Yes — you had been meaning to offer', scores: { attachment_avoidance: -0.8, pace: 0.6 } },
      { id: 'sure', label: 'Sure, why not', scores: { attachment_avoidance: -0.2 } },
      { id: 'hesitate', label: 'You hesitate before saying yes', scores: { attachment_avoidance: 0.7 } },
      { id: 'no', label: 'Your place is your place', scores: { attachment_avoidance: 0.9, independence: 0.8 } },
    ],
  },
  {
    id: 'they_go_quiet',
    tier: 'drip',
    construct: 'conflict_engagement',
    prompt: 'Mid-argument, they stop talking and go quiet.',
    options: [
      { id: 'push', label: 'You keep going — silence solves nothing', scores: { conflict_engagement: 0.9, attachment_anxiety: 0.5 } },
      { id: 'pause', label: 'You suggest picking it up in an hour', scores: { conflict_engagement: 0.2, conscientiousness: 0.4 } },
      { id: 'match', label: 'You go quiet too', scores: { conflict_engagement: -0.9, attachment_avoidance: 0.6 } },
    ],
  },
  {
    id: 'kind_of_funny',
    tier: 'drip',
    construct: 'openness',
    prompt: 'The kind of funny you actually fall for:',
    options: [
      { id: 'dry', label: 'Dry, delivered flat', scores: { openness: 0.4, extraversion: -0.3 } },
      { id: 'silly', label: 'Properly silly', scores: { openness: 0.5, extraversion: 0.6 } },
      { id: 'sharp', label: 'Sharp and a little mean', scores: { agreeableness: -0.6, openness: 0.3 } },
      { id: 'warm', label: 'Warm — the kind that includes everyone', scores: { agreeableness: 0.8 } },
    ],
  },
  {
    id: 'where_to_eat',
    tier: 'drip',
    construct: 'planning',
    prompt: 'Deciding where to eat, the two of you:',
    options: [
      { id: 'i_decide', label: 'You will decide. You always decide', scores: { planning: 0.7, extraversion: 0.4 } },
      { id: 'they_decide', label: 'You would rather they picked', scores: { planning: -0.5, agreeableness: 0.6 } },
      { id: 'forty_min', label: 'Forty minutes of "I do not mind"', scores: { planning: -0.7 } },
    ],
  },
  {
    id: 'clearly_wrong',
    tier: 'drip',
    construct: 'conflict_engagement',
    prompt: 'You were clearly in the wrong.',
    options: [
      { id: 'apologise_fast', label: 'You apologise quickly and mean it', scores: { conflict_engagement: 0.7, agreeableness: 0.7 } },
      { id: 'need_time', label: 'You need a day before you can say it', scores: { conflict_engagement: -0.5, attachment_avoidance: 0.4 } },
      { id: 'make_up_for', label: 'You do something nice instead of saying it', scores: { conflict_engagement: -0.7, agreeableness: 0.5 } },
    ],
  },
  {
    id: 'cofound',
    tier: 'drip',
    construct: 'ambition_over_balance',
    prompt: 'A friend wants you to quit and start something with them.',
    options: [
      { id: 'in', label: 'You are already thinking about how', scores: { ambition_over_balance: 0.8, openness: 0.8, spending: 0.3 } },
      { id: 'numbers', label: 'You want to see eighteen months of numbers first', scores: { conscientiousness: 0.8, ambition_over_balance: 0.4 } },
      { id: 'no', label: 'You like knowing what next month looks like', scores: { ambition_over_balance: -0.6, openness: -0.6 } },
    ],
  },
  {
    id: 'five_years',
    tier: 'drip',
    construct: 'pace',
    prompt: 'Five years out, the version of your life you would be happiest with:',
    options: [
      { id: 'settled', label: 'Settled, with someone, maybe a kid', scores: { pace: 0.8, family_closeness: 0.6, ambition_over_balance: -0.3 } },
      { id: 'partner_no_kids', label: 'A person you are sure about, and no kids', scores: { pace: 0.5, independence: 0.3 } },
      { id: 'built_something', label: 'Something you built that works', scores: { ambition_over_balance: 0.8, pace: -0.3 } },
      { id: 'open', label: 'Somewhere you have not been, doing something you cannot predict', scores: { openness: 0.9, independence: 0.7, pace: -0.6 } },
    ],
  },
  {
    id: 'saturday_alarm',
    tier: 'drip',
    construct: 'night_owl',
    prompt: 'Saturday, nothing on. You are up at:',
    options: [
      { id: 'early', label: 'Before 8, or the day feels wasted', scores: { night_owl: -0.9, conscientiousness: 0.5 } },
      { id: 'mid', label: 'Somewhere around 9 or 10', scores: { night_owl: -0.2 } },
      { id: 'late', label: 'Whenever. Possibly afternoon', scores: { night_owl: 0.8, conscientiousness: -0.4 } },
    ],
  },
  {
    id: 'the_bill',
    tier: 'drip',
    construct: 'spending',
    prompt: 'The bill arrives on a first date.',
    options: [
      { id: 'i_pay', label: 'You are paying, and you mean it', scores: { spending: 0.6, agreeableness: 0.4 } },
      { id: 'split', label: 'Split it, no discussion', scores: { spending: -0.3, independence: 0.5 } },
      { id: 'whoever', label: 'Whoever picked the place', scores: { spending: 0 } },
      { id: 'awkward', label: 'You would rather it never came up', scores: { spending: -0.5, conflict_engagement: -0.5 } },
    ],
  },
  {
    id: 'cousins_wedding',
    tier: 'drip',
    construct: 'family_closeness',
    prompt: 'A cousin is getting married. Three days, other end of the country, middle of a work week.',
    options: [
      { id: 'obviously', label: 'Obviously you are going', scores: { family_closeness: 0.9, ambition_over_balance: -0.4 } },
      { id: 'one_day', label: 'You will fly in for the one day that matters', scores: { family_closeness: 0.2, planning: 0.5 } },
      { id: 'skip', label: 'You will send something and skip it', scores: { family_closeness: -0.8, ambition_over_balance: 0.4 } },
    ],
  },
  {
    id: 'posting_photo',
    tier: 'drip',
    construct: 'pda',
    prompt: 'Putting a photo of the two of you somewhere everyone can see it.',
    options: [
      { id: 'already', label: 'Already done', scores: { pda: 0.9 } },
      { id: 'eventually', label: 'Eventually, once it is settled', scores: { pda: 0.1, pace: -0.2 } },
      { id: 'never', label: 'Your relationship is not content', scores: { pda: -0.9, independence: 0.4 } },
    ],
  },
];

export const CORE_QUESTIONS = PSYCH_BANK.filter((q) => q.tier === 'core');
export const DRIP_QUESTIONS = PSYCH_BANK.filter((q) => q.tier === 'drip');

// ------------------------------------------------------------------ scoring

export interface PsychAnswer {
  questionId: string;
  optionId: string;
}

export interface PsychProfile {
  /** Trait estimates, 0..1. 0.5 means no evidence either way. */
  traits: Record<Trait, number>;
  /** How many items informed each trait. Low counts must not drive a match. */
  evidence: Record<Trait, number>;
  answered: number;
}

const QUESTIONS_BY_ID = new Map(PSYCH_BANK.map((q) => [q.id, q]));

export function scorePsych(answers: PsychAnswer[]): PsychProfile {
  const sums = {} as Record<Trait, number>;
  const counts = {} as Record<Trait, number>;
  for (const trait of Object.keys(TRAITS) as Trait[]) {
    sums[trait] = 0;
    counts[trait] = 0;
  }

  let answered = 0;
  for (const answer of answers) {
    const question = QUESTIONS_BY_ID.get(answer.questionId);
    if (!question) continue;
    const option = question.options.find((o) => o.id === answer.optionId);
    if (!option) continue;
    answered++;
    for (const [trait, delta] of Object.entries(option.scores) as Array<[Trait, number]>) {
      sums[trait] += delta;
      counts[trait] += 1;
    }
  }

  const traits = {} as Record<Trait, number>;
  for (const trait of Object.keys(TRAITS) as Trait[]) {
    // Map mean delta from -1..1 into 0..1; no evidence lands at neutral.
    traits[trait] = counts[trait] === 0 ? 0.5 : (sums[trait] / counts[trait] + 1) / 2;
  }

  return { traits, evidence: counts, answered };
}

/**
 * Traits worth showing on a profile: the ones with enough evidence AND far
 * enough from neutral to actually say something about a person.
 */
export function psychChips(profile: PsychProfile, limit = 3): string[] {
  return (Object.keys(TRAITS) as Trait[])
    .filter((trait) => profile.evidence[trait] >= 2)
    .map((trait) => ({ trait, deviation: Math.abs(profile.traits[trait] - 0.5) }))
    .filter((t) => t.deviation > 0.2)
    .sort((a, b) => b.deviation - a.deviation)
    .slice(0, limit)
    .map(({ trait }) =>
      profile.traits[trait] > 0.5 ? TRAITS[trait].highChip : TRAITS[trait].lowChip,
    );
}
