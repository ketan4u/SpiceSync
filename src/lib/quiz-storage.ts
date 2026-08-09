'use client';

import { useSyncExternalStore } from 'react';
import type { Cuisine, DietBand, TasteVector } from './food/types.ts';
import type { PsychAnswer } from './psych/psych-bank.ts';

/**
 * The quiz result, kept on the device.
 *
 * There is no account yet, so this is what carries a person from the public quiz
 * into Explore. When onboarding lands, this same object is what gets merged into
 * the new account — the plan's "anonymous results persist by cookie and merge on
 * signup", one step simpler because nothing here needs to reach the server.
 *
 * Versioned because the taste vector's shape is still moving. A stored result
 * from an older shape is discarded rather than half-read, which is the
 * difference between "retake the quiz" and a card rendering NaN.
 */
const KEY = 'spicesync.quiz';
const VERSION = 1;

export interface StoredQuiz {
  version: number;
  dietBand: DietBand;
  declaredCuisines: Cuisine[];
  vector: TasteVector;
  label: string;
  dishName: string;
  dishEmoji: string;
  takenAt: string;
}

export function saveQuiz(q: Omit<StoredQuiz, 'version' | 'takenAt'>): void {
  if (typeof window === 'undefined') return;
  try {
    const payload: StoredQuiz = { ...q, version: VERSION, takenAt: new Date().toISOString() };
    window.localStorage.setItem(KEY, JSON.stringify(payload));
    emit();
  } catch {
    // Private browsing, storage full, or storage disabled. The quiz result is
    // still on screen; only the handoff to Explore is lost.
  }
}

export function loadQuiz(): StoredQuiz | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredQuiz;
    if (parsed?.version !== VERSION || !parsed.vector) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function clearQuiz(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    /* nothing to do */
  }
}

// ---------------------------------------------------------------- preferences

/**
 * Gender and who you want to see.
 *
 * Real onboarding will collect these, but the scorer fails closed without them,
 * so the demo has to ask too — otherwise Explore either shows nothing or, worse,
 * shows everyone.
 */
const PREFS_KEY = 'spicesync.prefs';
const PSYCH_KEY = 'spicesync.psych';

export interface StoredPrefs {
  gender: string;
  seeking: string[];
}

export function savePrefs(p: StoredPrefs): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(PREFS_KEY, JSON.stringify(p));
    emit();
  } catch {
    /* storage unavailable */
  }
}

export function loadPrefs(): StoredPrefs | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(PREFS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredPrefs;
    if (!parsed?.gender || !Array.isArray(parsed.seeking) || parsed.seeking.length === 0) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

// ------------------------------------------------------- reading it in React

/**
 * localStorage as a proper external store.
 *
 * The obvious approach — read it in an effect and call setState — works but is
 * the pattern React now lints against, because it schedules a second render on
 * every mount. `useSyncExternalStore` is built for exactly this: a value that
 * lives outside React, with a distinct server snapshot so hydration does not
 * mismatch.
 *
 * Snapshots must be referentially stable or React re-renders forever, so the
 * parsed object is cached and only rebuilt when the underlying string changes.
 */
type Listener = () => void;
const listeners = new Set<Listener>();

function emit(): void {
  for (const l of listeners) l();
}

function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  // Also react to writes from another tab.
  window.addEventListener('storage', listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener('storage', listener);
  };
}

function makeSnapshot<T>(key: string, validate: (v: unknown) => T | null) {
  let lastRaw: string | null | undefined;
  let lastValue: T | null = null;
  return (): T | null => {
    const raw = window.localStorage.getItem(key);
    if (raw !== lastRaw) {
      lastRaw = raw;
      try {
        lastValue = raw ? validate(JSON.parse(raw)) : null;
      } catch {
        lastValue = null;
      }
    }
    return lastValue;
  };
}

const quizSnapshot = makeSnapshot<StoredQuiz>(KEY, (v) => {
  const q = v as StoredQuiz;
  return q?.version === VERSION && q.vector ? q : null;
});

const prefsSnapshot = makeSnapshot<StoredPrefs>(PREFS_KEY, (v) => {
  const p = v as StoredPrefs;
  return p?.gender && Array.isArray(p.seeking) && p.seeking.length > 0 ? p : null;
});

const psychSnapshot = makeSnapshot<PsychAnswer[]>(PSYCH_KEY, (v) =>
  Array.isArray(v) ? (v as PsychAnswer[]) : null,
);

const nullSnapshot = () => null;
/** Stable empty array — returning a fresh [] each call would re-render forever. */
const EMPTY: PsychAnswer[] = [];
const emptySnapshot = () => EMPTY;

export function useStoredQuiz(): StoredQuiz | null {
  return useSyncExternalStore(subscribe, quizSnapshot, nullSnapshot);
}

export function useStoredPrefs(): StoredPrefs | null {
  return useSyncExternalStore(subscribe, prefsSnapshot, nullSnapshot);
}

/**
 * True once the browser has taken over from the server-rendered HTML.
 *
 * Lets a component show a placeholder for the first paint instead of flashing
 * the signed-out state before the stored values are visible.
 */
const noopSubscribe = () => () => {};
const alwaysTrue = () => true;
const alwaysFalse = () => false;

export function useHydrated(): boolean {
  return useSyncExternalStore(noopSubscribe, alwaysTrue, alwaysFalse);
}

export function useStoredPsych(): PsychAnswer[] {
  return useSyncExternalStore(subscribe, () => psychSnapshot() ?? EMPTY, emptySnapshot);
}

/**
 * Records one answer, replacing any previous answer to the same question.
 *
 * Answers arrive a few at a time — twelve up front if someone sits through
 * them, then one at a time between swipes — so this appends rather than
 * writing a whole set.
 */
export function savePsychAnswer(answer: PsychAnswer): void {
  if (typeof window === 'undefined') return;
  try {
    const existing = psychSnapshot() ?? [];
    const next = [...existing.filter((a) => a.questionId !== answer.questionId), answer];
    window.localStorage.setItem(PSYCH_KEY, JSON.stringify(next));
    emit();
  } catch {
    /* storage unavailable */
  }
}

export function clearPsych(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(PSYCH_KEY);
  } catch {
    /* storage unavailable */
  }
  emit();
}

export function clearPrefs(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(PREFS_KEY);
  } catch {
    /* storage unavailable */
  }
  emit();
}
