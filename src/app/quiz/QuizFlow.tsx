'use client';

import { useCallback, useMemo, useRef, useState, useTransition } from 'react';
import { joinWaitlist } from './actions.ts';
import { saveQuiz } from '@/lib/quiz-storage.ts';
import { CITIES, joinedMessage } from '@/lib/cities.ts';
import { getItem, poolFor } from '@/lib/food/food-catalog.ts';
import {
  DEFAULT_ROUNDS,
  mulberry32,
  nextPair,
  representativeItem,
} from '@/lib/food/pair-generator.ts';
import {
  applyChoice,
  createAccumulator,
  finalise,
  foodIdentityLabel,
  tasteTraits,
  type TasteAccumulator,
} from '@/lib/food/score-taste.ts';
import type { QuizChoice } from '@/lib/food/types.ts';
import {
  CUISINE_LABELS,
  DIET_BAND_LABELS,
  DIET_BAND_ORDER,
  type Cuisine,
  type DietBand,
  type QuizPair,
  type TasteVector,
} from '@/lib/food/types.ts';

const DIET_BLURBS: Record<DietBand, string> = {
  vegan: 'No dairy, no ghee, none of it',
  all_veg: 'Vegetarian, and that includes egg',
  mostly_veg: 'Veg by default, non-veg rarely',
  mostly_non_veg: 'A bit of both, leaning meat',
  generally_non_veg: 'Non-veg most days',
  eats_anything: 'The true explorer',
};

const DIET_EMOJI: Record<DietBand, string> = {
  vegan: '🌱',
  all_veg: '🥬',
  mostly_veg: '🥗',
  mostly_non_veg: '🍳',
  generally_non_veg: '🍗',
  eats_anything: '🌍',
};

const CUISINE_ORDER: Cuisine[] = [
  'north_indian',
  'south_indian',
  'street',
  'mughlai',
  'bengali_east',
  'west_indian',
  'indo_chinese',
  'continental',
  'pan_asian',
];

type Step = 'diet' | 'cuisine' | 'rounds' | 'result';

interface Outcome {
  vector: TasteVector;
  label: string;
  traits: string[];
  dishName: string;
  dishEmoji: string;
  /** Carried so the waitlist row arrives already scored. */
  dietBand: DietBand;
  declaredCuisines: Cuisine[];
  choices: QuizChoice[];
}

export default function QuizFlow() {
  const [step, setStep] = useState<Step>('diet');
  const [dietBand, setDietBand] = useState<DietBand | null>(null);
  const [cuisines, setCuisines] = useState<Cuisine[]>([]);
  const [pair, setPair] = useState<QuizPair | null>(null);
  const [round, setRound] = useState(1);
  const [skipsLeft, setSkipsLeft] = useState(1);
  const [outcome, setOutcome] = useState<Outcome | null>(null);

  // The accumulator is mutable and holds a Set, so it lives in a ref rather
  // than in state. The RNG is seeded on first interaction, not at module load,
  // so the server and client never disagree during hydration.
  const acc = useRef<TasteAccumulator | null>(null);
  const rng = useRef<(() => number) | null>(null);

  const advance = useCallback((current: TasteAccumulator, nextRound: number) => {
    // Past the last round there is nothing to pick, and the pool can also run
    // dry early for a narrow diet band — both end the quiz.
    const next = nextRound <= DEFAULT_ROUNDS ? nextPair(current, nextRound, rng.current!) : null;
    if (!next) {
      const vector = finalise(current);
      const rep = representativeItem(current, getItem);
      const result = {
        vector,
        label: foodIdentityLabel(vector),
        traits: tasteTraits(vector),
        dishName: rep?.name ?? '',
        dishEmoji: rep?.emoji ?? '🍽️',
        dietBand: current.dietBand,
        declaredCuisines: current.declaredCuisines,
        choices: [...current.choices],
      };
      setOutcome(result);
      // Carries this person into Explore, and later into their account.
      saveQuiz({
        dietBand: result.dietBand,
        declaredCuisines: result.declaredCuisines,
        vector: result.vector,
        label: result.label,
        dishName: result.dishName,
        dishEmoji: result.dishEmoji,
      });
      setStep('result');
      return;
    }
    setPair(next);
    setRound(nextRound);
  }, []);

  const startRounds = useCallback(() => {
    if (!dietBand) return;
    rng.current = mulberry32((Date.now() ^ (Math.random() * 0xffffffff)) >>> 0);
    const created = createAccumulator(dietBand, cuisines);
    acc.current = created;
    advance(created, 1);
    setStep('rounds');
  }, [advance, cuisines, dietBand]);

  const pick = useCallback(
    (winnerId: string, loserId: string, skipped = false) => {
      const current = acc.current;
      if (!current || !pair) return;
      applyChoice(
        current,
        { round, winnerId, loserId, skipped, probing: pair.probing },
        getItem(winnerId),
        getItem(loserId),
      );
      advance(current, round + 1);
    },
    [advance, pair, round],
  );

  /**
   * Navigating to /quiz from /quiz is a no-op — the router matches the same
   * route and never remounts, so the finished state would just sit there. A
   * retake has to tear the run down by hand, including the refs, which live
   * outside React state and would otherwise carry the old accumulator over.
   */
  const restart = useCallback(() => {
    acc.current = null;
    rng.current = null;
    setDietBand(null);
    setCuisines([]);
    setPair(null);
    setRound(1);
    setSkipsLeft(1);
    setOutcome(null);
    setStep('diet');
  }, []);

  const poolSize = useMemo(() => (dietBand ? poolFor(dietBand).length : 0), [dietBand]);

  // ------------------------------------------------------------ diet gate
  if (step === 'diet') {
    return (
      <>
        <p className="step-label">Step 1 of 3</p>
        <h1>First — how do you eat?</h1>
        <p className="lede">
          This decides what we can put in front of you. Pick the one that is actually true, not the
          one that sounds good.
        </p>
        <div style={{ marginTop: 22 }}>
          {DIET_BAND_ORDER.map((band) => (
            <button
              key={band}
              className="option"
              data-selected={dietBand === band}
              onClick={() => setDietBand(band)}
              aria-pressed={dietBand === band}
            >
              <span className="option-emoji" aria-hidden>
                {DIET_EMOJI[band]}
              </span>
              <span>
                <span className="option-title">{DIET_BAND_LABELS[band]}</span>
                <span className="option-sub">{DIET_BLURBS[band]}</span>
              </span>
            </button>
          ))}
        </div>
        <div className="spacer" />
        <button className="btn" disabled={!dietBand} onClick={() => setStep('cuisine')}>
          Continue
        </button>
        {dietBand && (
          <p className="foot">{poolSize} dishes on your menu</p>
        )}
      </>
    );
  }

  // --------------------------------------------------------- cuisine tiles
  if (step === 'cuisine') {
    const toggle = (c: Cuisine) =>
      setCuisines((prev) => (prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]));

    return (
      <>
        <p className="step-label">Step 2 of 3</p>
        <h1>What do you actually eat?</h1>
        <p className="lede">
          Pick as many as are true. We ask this outright because it is the one thing people get
          right about themselves — the quiz is for everything they don&apos;t.
        </p>
        <div className="tiles" style={{ marginTop: 22 }}>
          {CUISINE_ORDER.map((c) => (
            <button
              key={c}
              className="tile"
              data-selected={cuisines.includes(c)}
              onClick={() => toggle(c)}
              aria-pressed={cuisines.includes(c)}
            >
              {CUISINE_LABELS[c]}
            </button>
          ))}
        </div>
        <div className="spacer" />
        <button className="btn" disabled={cuisines.length === 0} onClick={startRounds}>
          Start the quiz
        </button>
        <button className="btn-text" style={{ margin: '4px auto 0', display: 'block' }} onClick={startRounds}>
          Skip — surprise me
        </button>
      </>
    );
  }

  // --------------------------------------------------------------- rounds
  if (step === 'rounds' && pair) {
    return (
      <>
        <div className="progress" aria-label={`Round ${round} of ${DEFAULT_ROUNDS}`}>
          {Array.from({ length: DEFAULT_ROUNDS }, (_, i) => (
            <span
              key={i}
              className="pip"
              data-state={i + 1 < round ? 'done' : i + 1 === round ? 'current' : 'todo'}
            />
          ))}
        </div>
        <h2>Which one, right now?</h2>
        <p style={{ marginBottom: 20 }}>No overthinking. Go with your gut.</p>

        <div className="versus">
          {[pair.left, pair.right].map((item, i) => {
            const other = i === 0 ? pair.right : pair.left;
            return (
              <button key={item.id} className="dish" onClick={() => pick(item.id, other.id)}>
                <span className="dish-art" aria-hidden>
                  {item.emoji}
                </span>
                <span className="dish-name">{item.name}</span>
                <span className="dish-blurb">{item.blurb}</span>
              </button>
            );
          })}
        </div>

        {skipsLeft > 0 && (
          <p className="round-q">
            <button
              className="btn-text"
              onClick={() => {
                setSkipsLeft(0);
                pick(pair.left.id, pair.right.id, true);
              }}
            >
              Neither, honestly
            </button>
          </p>
        )}
      </>
    );
  }

  // --------------------------------------------------------------- result
  if (step === 'result' && outcome) {
    return <Result outcome={outcome} onRestart={restart} />;
  }

  return null;
}

// ---------------------------------------------------------------- result view

const AXES: Array<{ key: 'spice' | 'richness' | 'novelty' | 'sweetness'; low: string; high: string }> = [
  { key: 'spice', low: 'Mild', high: 'Extra spicy' },
  { key: 'richness', low: 'Light', high: 'Rich' },
  { key: 'novelty', low: 'Your usual', high: 'Anything new' },
  { key: 'sweetness', low: 'Savoury', high: 'Sweet tooth' },
];

type JoinState =
  | { status: 'idle' }
  | { status: 'joined'; already?: boolean; city: string }
  | { status: 'error'; message: string };

function Result({ outcome, onRestart }: { outcome: Outcome; onRestart: () => void }) {
  const [email, setEmail] = useState('');
  const [city, setCity] = useState('');
  const [join, setJoin] = useState<JoinState>({ status: 'idle' });
  const [pending, startTransition] = useTransition();

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      const result = await joinWaitlist({
        email,
        city,
        dietBand: outcome.dietBand,
        declaredCuisines: outcome.declaredCuisines,
        vector: outcome.vector,
        label: outcome.label,
        representativeDish: outcome.dishName,
        choices: outcome.choices,
      });
      if (result.ok) {
        setJoin({ status: 'joined', already: result.already, city });
        return;
      }
      setJoin({
        status: 'error',
        message:
          result.reason === 'invalid_email'
            ? 'That email does not look right.'
            : result.reason === 'invalid_city'
              ? 'Pick a city so we know where to open next.'
              : result.reason === 'unconfigured'
                ? 'The waitlist is not connected yet — nothing was saved.'
                : 'Could not save that. Try again in a moment.',
      });
    });
  };

  const shareUrl = useMemo(() => {
    if (typeof window === 'undefined') return '';
    const params = new URLSearchParams({
      l: outcome.label,
      e: outcome.dishEmoji,
      d: outcome.dishName,
    });
    return `${window.location.origin}/r?${params.toString()}`;
  }, [outcome]);

  const share = async () => {
    const text = `I'm "${outcome.label}" on SpiceSync. What are you?`;
    if (navigator.share) {
      try {
        await navigator.share({ title: 'SpiceSync', text, url: shareUrl });
        return;
      } catch {
        /* user dismissed the sheet — fall through to copy */
      }
    }
    await navigator.clipboard.writeText(`${text} ${shareUrl}`);
  };

  return (
    <>
      <p className="step-label">Your food identity</p>
      <div className="identity">
        <div className="identity-art" aria-hidden>
          {outcome.dishEmoji}
        </div>
        <div className="identity-label">{outcome.label}</div>
        {outcome.dishName && <div className="identity-dish">The dish that gave you away: {outcome.dishName}</div>}
        {outcome.traits.length > 0 && (
          <div className="traits">
            {outcome.traits.map((t) => (
              <span key={t} className="chip">
                {t}
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="bars">
        {AXES.map(({ key, low, high }) => {
          const value = outcome.vector[key];
          const confident = outcome.vector.confidence[key] > 0.35;
          return (
            <div className="bar-row" key={key}>
              <span>{low}</span>
              <span className="bar" data-low={!confident}>
                <span className="bar-fill" style={{ width: `${value * 100}%` }} />
                <span className="bar-dot" style={{ left: `${value * 100}%` }} />
              </span>
              <span className="r">{high}</span>
            </div>
          );
        })}
      </div>

      <p className="note">
        This is where matching starts, not ends. SpiceSync weighs how you eat alongside how you
        handle a disagreement, how fast you like things to move, and what you will not compromise
        on — and it tells you which of those you actually share with someone. That second half is
        twelve situations, about ninety seconds, and you can stop whenever.
      </p>

      <div className="stack">
        <button className="btn" onClick={share}>
          Share your identity
        </button>

        {join.status === 'joined' ? (
          <p className="ok">
            {join.already ? 'You were already on the list — we have you.' : joinedMessage(join.city)}
          </p>
        ) : (
          <>
            <p className="ask">Where are you? We open one city at a time.</p>
            <select
              className="select"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              disabled={pending}
              aria-label="Your city"
            >
              <option value="" disabled>
                Pick your city
              </option>
              {CITIES.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
            <form className="field" onSubmit={submit}>
              <input
                type="email"
                required
                placeholder="you@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={pending}
                aria-label="Email address for the waitlist"
              />
              <button
                className="btn"
                type="submit"
                disabled={pending || email.length === 0 || city === ''}
              >
                {pending ? 'Saving…' : 'Join'}
              </button>
            </form>
            {join.status === 'error' && <p className="err">{join.message}</p>}
            <p className="consent">
              We store your email, your city and your quiz answers so we can match you when your city opens.
              Nothing else, and you can ask us to delete both at any time.
            </p>
          </>
        )}

        <a className="btn btn-ghost" href="/questions" style={{ textDecoration: 'none' }}>
          Answer twelve questions
        </a>

        <a className="btn btn-ghost" href="/explore" style={{ textDecoration: 'none' }}>
          See who you&apos;d match with
        </a>

        <button className="btn-text" style={{ margin: '0 auto', display: 'block' }} onClick={onRestart}>
          Take it again
        </button>
      </div>

      <p className="foot">Opening one city at a time.</p>
    </>
  );
}
