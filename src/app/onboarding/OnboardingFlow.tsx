'use client';

import { useRouter } from 'next/navigation';
import { useMemo, useState, useTransition } from 'react';
import { CITIES } from '@/lib/cities.ts';
import { DEALBREAKERS } from '@/lib/dealbreakers.ts';
import { INTENTS, INTENT_LABELS, type Intent } from '@/lib/match/types.ts';
import { createClient } from '@/lib/supabase/client.ts';
import { useHydrated, useStoredPrefs, useStoredPsych, useStoredQuiz } from '@/lib/quiz-storage.ts';
import { completeOnboarding } from './actions.ts';

/**
 * The essentials, and nothing else.
 *
 * The brief lists a long Section 1. Most of it — non-negotiables, red flags,
 * prompts, past-relationship learnings — is deferred, because the length of
 * this flow is the single biggest thing standing between someone and the app.
 * What is here is only what the scorer cannot run without.
 *
 * Anything already answered before signing up is carried across silently rather
 * than asked again.
 */
const GENDERS = [
  { id: 'woman', label: 'Woman' },
  { id: 'man', label: 'Man' },
  { id: 'non-binary', label: 'Non-binary' },
];

type Step = 'about' | 'seeking' | 'intent' | 'place' | 'limits' | 'photos';
const STEPS: Step[] = ['about', 'seeking', 'intent', 'place', 'limits', 'photos'];

export default function OnboardingFlow({ userId }: { userId: string }) {
  const router = useRouter();
  const hydrated = useHydrated();
  const quiz = useStoredQuiz();
  const psych = useStoredPsych();
  const storedPrefs = useStoredPrefs();

  const [step, setStep] = useState<Step>('about');
  const [name, setName] = useState('');
  const [dob, setDob] = useState('');
  const [gender, setGender] = useState('');
  const [seeking, setSeeking] = useState<string[]>([]);
  const [intents, setIntents] = useState<Intent[]>([]);
  const [city, setCity] = useState('');
  const [openToDistance, setOpenToDistance] = useState(false);
  const [attributes, setAttributes] = useState<string[]>([]);
  const [nonNegotiables, setNonNegotiables] = useState<string[]>([]);
  const [photoPaths, setPhotoPaths] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // Whatever they picked in the Explore demo is a sensible default here.
  const prefilled = useMemo(() => storedPrefs, [storedPrefs]);
  const [prefilledApplied, setPrefilledApplied] = useState(false);
  if (hydrated && prefilled && !prefilledApplied) {
    setPrefilledApplied(true);
    if (!gender) setGender(prefilled.gender);
    if (seeking.length === 0) setSeeking(prefilled.seeking);
  }

  const age = dob ? ageFrom(dob) : null;
  const index = STEPS.indexOf(step);

  const toggle = <T extends string>(list: T[], set: (v: T[]) => void, value: T) =>
    set(list.includes(value) ? list.filter((x) => x !== value) : [...list, value]);

  /** The brief's rule: Exploring is exclusive and clears everything else. */
  const toggleIntent = (value: Intent) => {
    if (value === 'exploring') {
      setIntents(intents.includes('exploring') ? [] : ['exploring']);
      return;
    }
    const without = intents.filter((i) => i !== 'exploring');
    setIntents(without.includes(value) ? without.filter((i) => i !== value) : [...without, value]);
  };

  const upload = async (file: File, slot: number) => {
    setUploading(true);
    setError(null);
    const supabase = createClient();
    // Storage RLS only permits writes inside a folder named after the user id.
    const path = `${userId}/${slot}-${Date.now()}.${file.name.split('.').pop() ?? 'jpg'}`;
    const { error: err } = await supabase.storage.from('photos').upload(path, file, {
      upsert: true,
      contentType: file.type,
    });
    setUploading(false);
    if (err) {
      setError(err.message);
      return;
    }
    setPhotoPaths((prev) => {
      const next = [...prev];
      next[slot] = path;
      return next;
    });
  };

  const finish = () => {
    setError(null);
    startTransition(async () => {
      const result = await completeOnboarding({
        name,
        dateOfBirth: dob,
        gender,
        seeking,
        intents,
        city,
        openToDistance,
        photoPaths: photoPaths.filter(Boolean),
        attributes,
        nonNegotiables,
        dietBand: quiz?.dietBand,
        declaredCuisines: quiz?.declaredCuisines,
        taste: quiz?.vector,
        foodLabel: quiz?.label,
        representativeDish: quiz?.dishName,
        psychAnswers: psych,
        foodAnswers: quiz?.foodAnswers,
      });
      if (!result.ok) {
        setError(result.reason);
        return;
      }
      router.replace('/explore');
      router.refresh();
    });
  };

  if (!hydrated) return <p className="foot">Loading…</p>;

  return (
    <>
      <div className="progress" aria-label={`Step ${index + 1} of ${STEPS.length}`}>
        {STEPS.map((s, i) => (
          <span key={s} className="pip" data-state={i < index ? 'done' : i === index ? 'current' : 'todo'} />
        ))}
      </div>

      {step === 'about' && (
        <>
          <p className="step-label">Step 1 of {STEPS.length}</p>
          <h1>What should we call you?</h1>
          <input
            className="text-input"
            style={{ marginTop: 18 }}
            placeholder="First name"
            maxLength={60}
            value={name}
            onChange={(e) => setName(e.target.value)}
            aria-label="First name"
          />
          <p className="ask" style={{ marginTop: 14 }}>Date of birth</p>
          <input
            className="text-input"
            type="date"
            value={dob}
            onChange={(e) => setDob(e.target.value)}
            aria-label="Date of birth"
          />
          {age !== null && age < 18 && (
            <p className="err">SpiceSync is 18+. We cannot create an account for you.</p>
          )}
          <p className="consent">
            Your date of birth sets your age on your profile. The date itself is never shown.
          </p>
          <div className="spacer" />
          <button
            className="btn"
            disabled={!name.trim() || age === null || age < 18 || age > 120}
            onClick={() => setStep('seeking')}
          >
            Continue
          </button>
        </>
      )}

      {step === 'seeking' && (
        <>
          <p className="step-label">Step 2 of {STEPS.length}</p>
          <h1>Who are you, and who do you want to see?</h1>
          <p className="lede">
            We only show people where you both want to see each other.
          </p>
          <p className="step-label" style={{ marginTop: 20 }}>I am</p>
          <div className="tiles">
            {GENDERS.map((g) => (
              <button key={g.id} className="tile" data-selected={gender === g.id}
                onClick={() => setGender(g.id)} aria-pressed={gender === g.id}>
                {g.label}
              </button>
            ))}
          </div>
          <p className="step-label">Show me</p>
          <div className="tiles">
            {GENDERS.map((g) => (
              <button key={g.id} className="tile" data-selected={seeking.includes(g.id)}
                onClick={() => toggle(seeking, setSeeking, g.id)} aria-pressed={seeking.includes(g.id)}>
                {g.label}
              </button>
            ))}
          </div>
          <div className="spacer" />
          <button className="btn" disabled={!gender || seeking.length === 0} onClick={() => setStep('intent')}>
            Continue
          </button>
          <button className="btn-text" style={{ margin: '0 auto', display: 'block' }} onClick={() => setStep('about')}>
            Back
          </button>
        </>
      )}

      {step === 'intent' && (
        <>
          <p className="step-label">Step 3 of {STEPS.length}</p>
          <h1>What are you here for?</h1>
          <p className="lede">Pick as many as are true — unless you are still working it out.</p>
          <div style={{ marginTop: 20 }}>
            {INTENTS.map((i) => (
              <button key={i} className="option" data-selected={intents.includes(i)}
                onClick={() => toggleIntent(i)} aria-pressed={intents.includes(i)}>
                <span>
                  <span className="option-title">{INTENT_LABELS[i]}</span>
                  {i === 'exploring' && (
                    <span className="option-sub">Clears the others — you are not sure yet</span>
                  )}
                </span>
              </button>
            ))}
          </div>
          <div className="spacer" />
          <button className="btn" disabled={intents.length === 0} onClick={() => setStep('place')}>
            Continue
          </button>
          <button className="btn-text" style={{ margin: '0 auto', display: 'block' }} onClick={() => setStep('seeking')}>
            Back
          </button>
        </>
      )}

      {step === 'place' && (
        <>
          <p className="step-label">Step 4 of {STEPS.length}</p>
          <h1>Where are you?</h1>
          <select className="select" style={{ marginTop: 18 }} value={city}
            onChange={(e) => setCity(e.target.value)} aria-label="Your city">
            <option value="" disabled>Pick your city</option>
            {CITIES.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
          </select>
          <button className="option" data-selected={openToDistance}
            onClick={() => setOpenToDistance(!openToDistance)} aria-pressed={openToDistance}>
            <span>
              <span className="option-title">Show me great matches further away</span>
              <span className="option-sub">
                Only when the match is strong, and only if they said yes too
              </span>
            </span>
          </button>
          <div className="spacer" />
          <button className="btn" disabled={!city} onClick={() => setStep('limits')}>Continue</button>
          <button className="btn-text" style={{ margin: '0 auto', display: 'block' }} onClick={() => setStep('intent')}>
            Back
          </button>
        </>
      )}

      {step === 'limits' && (
        <>
          <p className="step-label">Step 5 of {STEPS.length}</p>
          <h1>Anything that would rule someone out?</h1>
          <p className="lede">
            Both halves matter. What you tick about yourself is what lets other people&apos;s
            limits work — and theirs only work on you if you have said so too. All optional.
          </p>

          <p className="step-label" style={{ marginTop: 22 }}>True about me</p>
          <div className="tiles">
            {DEALBREAKERS.map((d) => (
              <button key={d.id} className="tile" data-selected={attributes.includes(d.id)}
                onClick={() => toggle(attributes, setAttributes, d.id)}
                aria-pressed={attributes.includes(d.id)}>
                {d.selfLabel}
              </button>
            ))}
          </div>

          <p className="step-label">I will not date someone who</p>
          <div className="tiles">
            {DEALBREAKERS.map((d) => (
              <button key={d.id} className="tile" data-selected={nonNegotiables.includes(d.id)}
                onClick={() => toggle(nonNegotiables, setNonNegotiables, d.id)}
                aria-pressed={nonNegotiables.includes(d.id)}>
                {d.avoidLabel}
              </button>
            ))}
          </div>

          <p className="consent">
            A non-negotiable is absolute — it removes people entirely, however well you match
            otherwise. Use it for things you would actually end a date over.
          </p>

          <div className="spacer" />
          <button className="btn" onClick={() => setStep('photos')}>Continue</button>
          <button className="btn-text" style={{ margin: '0 auto', display: 'block' }} onClick={() => setStep('place')}>
            Back
          </button>
        </>
      )}

      {step === 'photos' && (
        <>
          <p className="step-label">Step 6 of {STEPS.length}</p>
          <h1>Two photos</h1>
          <p className="lede">One of you, and one of a dish you love. Both are optional for now.</p>

          <div className="uploads">
            <PhotoSlot label="You" done={Boolean(photoPaths[0])} disabled={uploading}
              onPick={(f) => upload(f, 0)} />
            <PhotoSlot label="A dish you love" done={Boolean(photoPaths[1])} disabled={uploading}
              onPick={(f) => upload(f, 1)} />
          </div>

          <p className="consent">
            Photos are stored privately and shown only to people you can match with. Nothing here
            is verified yet, so treat other people&apos;s photos with the same caution you would
            anywhere else.
          </p>

          {error && <p className="err">{error}</p>}
          <div className="spacer" />
          <button className="btn" onClick={finish} disabled={pending || uploading}>
            {pending ? 'Saving…' : 'Finish'}
          </button>
          <button className="btn-text" style={{ margin: '0 auto', display: 'block' }} onClick={() => setStep('limits')}>
            Back
          </button>
        </>
      )}

      {quiz && (
        <p className="foot">
          Carrying over your food identity ({quiz.label})
          {psych.length > 0 ? ` and ${psych.length} personality answers` : ''}.
        </p>
      )}
    </>
  );
}

function PhotoSlot({
  label, done, disabled, onPick,
}: { label: string; done: boolean; disabled: boolean; onPick: (f: File) => void }) {
  return (
    <label className="upload" data-done={done}>
      <input
        type="file"
        accept="image/*"
        disabled={disabled}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onPick(f);
        }}
      />
      <span className="upload-art" aria-hidden>{done ? '✓' : '＋'}</span>
      <span className="upload-label">{label}</span>
    </label>
  );
}

function ageFrom(dob: string): number {
  const birth = new Date(`${dob}T00:00:00Z`);
  if (Number.isNaN(birth.getTime())) return -1;
  const now = new Date();
  let age = now.getUTCFullYear() - birth.getUTCFullYear();
  const m = now.getUTCMonth() - birth.getUTCMonth();
  if (m < 0 || (m === 0 && now.getUTCDate() < birth.getUTCDate())) age--;
  return age;
}
