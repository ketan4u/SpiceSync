import type { Cuisine, DietBand, TasteVector } from './food/types.ts';

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

export interface StoredPrefs {
  gender: string;
  seeking: string[];
}

export function savePrefs(p: StoredPrefs): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(PREFS_KEY, JSON.stringify(p));
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
