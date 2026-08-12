'use client';

import { useState, useTransition } from 'react';
import { CITIES } from '@/lib/cities.ts';
import { DEALBREAKERS } from '@/lib/dealbreakers.ts';
import { INTENTS, INTENT_LABELS, type Intent } from '@/lib/match/types.ts';
import { useHydrated, useStoredPsych, useStoredQuiz } from '@/lib/quiz-storage.ts';
import type { BlockedPerson, EditableProfile } from './data.ts';
import { deleteAccount, syncFromDevice, unblock, updateProfile } from './actions.ts';

const GENDERS = [
  { id: 'woman', label: 'Woman' },
  { id: 'man', label: 'Man' },
  { id: 'non-binary', label: 'Non-binary' },
];

export default function SettingsForm({
  profile,
  blocked,
  email,
}: {
  profile: EditableProfile;
  blocked: BlockedPerson[];
  email: string;
}) {
  const [name, setName] = useState(profile.name);
  const [gender, setGender] = useState(profile.gender);
  const [seeking, setSeeking] = useState<string[]>(profile.seeking);
  const [intents, setIntents] = useState<Intent[]>(profile.intents as Intent[]);
  const [city, setCity] = useState(profile.city);
  const [openToDistance, setOpenToDistance] = useState(profile.openToDistance);
  const [ageMin, setAgeMin] = useState(profile.ageMin);
  const [ageMax, setAgeMax] = useState(profile.ageMax);
  const [attributes, setAttributes] = useState<string[]>(profile.attributes);
  const [nonNegotiables, setNonNegotiables] = useState<string[]>(profile.nonNegotiables);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const toggleSeeking = (id: string) =>
    setSeeking((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const toggleIntent = (value: Intent) => {
    if (value === 'exploring') {
      setIntents(intents.includes('exploring') ? [] : ['exploring']);
      return;
    }
    const without = intents.filter((i) => i !== 'exploring');
    setIntents(without.includes(value) ? without.filter((i) => i !== value) : [...without, value]);
  };

  const save = () => {
    setError(null);
    setSaved(false);
    startTransition(async () => {
      const result = await updateProfile({
        name, gender, seeking, intents, city, openToDistance, ageMin, ageMax,
        attributes, nonNegotiables,
      });
      if (!result.ok) setError(result.error ?? 'Could not save.');
      else setSaved(true);
    });
  };

  return (
    <>
      <p className="step-label">Signed in as</p>
      <p className="settings-email">{email}</p>

      <h2 className="settings-h">Your profile</h2>

      <p className="ask">Name</p>
      <input className="text-input" value={name} maxLength={60}
        onChange={(e) => setName(e.target.value)} aria-label="Name" />

      <p className="ask">I am</p>
      <div className="tiles">
        {GENDERS.map((g) => (
          <button key={g.id} className="tile" data-selected={gender === g.id}
            onClick={() => setGender(g.id)} aria-pressed={gender === g.id}>{g.label}</button>
        ))}
      </div>

      <p className="ask">Show me</p>
      <div className="tiles">
        {GENDERS.map((g) => (
          <button key={g.id} className="tile" data-selected={seeking.includes(g.id)}
            onClick={() => toggleSeeking(g.id)} aria-pressed={seeking.includes(g.id)}>{g.label}</button>
        ))}
      </div>

      <p className="ask">Here for</p>
      <div className="tiles">
        {INTENTS.map((i) => (
          <button key={i} className="tile" data-selected={intents.includes(i)}
            onClick={() => toggleIntent(i)} aria-pressed={intents.includes(i)}>{INTENT_LABELS[i]}</button>
        ))}
      </div>

      <p className="ask">City</p>
      <select className="select" value={city} onChange={(e) => setCity(e.target.value)} aria-label="City">
        {CITIES.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
      </select>

      <p className="ask">Ages you want to see</p>
      <div className="age-range">
        <input className="text-input" type="number" min={18} max={99} value={ageMin}
          onChange={(e) => setAgeMin(Number(e.target.value))} aria-label="Minimum age" />
        <span>to</span>
        <input className="text-input" type="number" min={18} max={99} value={ageMax}
          onChange={(e) => setAgeMax(Number(e.target.value))} aria-label="Maximum age" />
      </div>

      <button className="option" data-selected={openToDistance}
        onClick={() => setOpenToDistance(!openToDistance)} aria-pressed={openToDistance}>
        <span>
          <span className="option-title">Show me great matches further away</span>
          <span className="option-sub">Only when the match is strong, and only if they agreed too</span>
        </span>
      </button>

      <h2 className="settings-h">Non-negotiables</h2>
      <p className="settings-note">
        What you tick about yourself is what makes other people&apos;s limits work, and theirs
        only apply to you if you have said so. A non-negotiable removes people entirely, however
        well you match otherwise.
      </p>

      <p className="ask">True about me</p>
      <div className="tiles">
        {DEALBREAKERS.map((d) => (
          <button key={d.id} className="tile" data-selected={attributes.includes(d.id)}
            onClick={() => setAttributes((p) => p.includes(d.id) ? p.filter((x) => x !== d.id) : [...p, d.id])}
            aria-pressed={attributes.includes(d.id)}>{d.selfLabel}</button>
        ))}
      </div>

      <p className="ask">I will not date someone who</p>
      <div className="tiles">
        {DEALBREAKERS.map((d) => (
          <button key={d.id} className="tile" data-selected={nonNegotiables.includes(d.id)}
            onClick={() => setNonNegotiables((p) => p.includes(d.id) ? p.filter((x) => x !== d.id) : [...p, d.id])}
            aria-pressed={nonNegotiables.includes(d.id)}>{d.avoidLabel}</button>
        ))}
      </div>

      {error && <p className="err">{error}</p>}
      {saved && <p className="ok">Saved.</p>}
      <button className="btn" onClick={save} disabled={pending}>
        {pending ? 'Saving…' : 'Save changes'}
      </button>

      <SyncSection profile={profile} />
      <BlockedSection blocked={blocked} />
      <DangerZone />
    </>
  );
}

/**
 * Retaking the quiz updates the copy on the device, not the profile. Without
 * this, someone could retake it, see a new food identity on screen, and still
 * be matched on the old one indefinitely.
 */
function SyncSection({ profile }: { profile: EditableProfile }) {
  const hydrated = useHydrated();
  const quiz = useStoredQuiz();
  const psych = useStoredPsych();
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (!hydrated) return null;

  const deviceDiffers =
    (quiz && quiz.label !== profile.foodLabel) || psych.length > profile.psychAnswered;
  if (!deviceDiffers) {
    return (
      <>
        <h2 className="settings-h">Your answers</h2>
        <p className="settings-note">
          Food identity: <strong>{profile.foodLabel ?? 'not set'}</strong> ·{' '}
          {profile.psychAnswered} personality answers.
        </p>
        <div className="stack">
          <a className="btn btn-ghost" href="/quiz" style={{ textDecoration: 'none' }}>Retake the food quiz</a>
          <a className="btn btn-ghost" href="/questions" style={{ textDecoration: 'none' }}>Answer more questions</a>
        </div>
      </>
    );
  }

  return (
    <>
      <h2 className="settings-h">Your answers</h2>
      <p className="settings-note">
        This device has newer answers than your profile
        {quiz?.label ? ` — ${quiz.label}` : ''}
        {psych.length > profile.psychAnswered ? `, ${psych.length} personality answers` : ''}.
        Matching still uses the older set until you apply them.
      </p>
      {error && <p className="err">{error}</p>}
      {done ? <p className="ok">Applied. Matching now uses these.</p> : (
        <button
          className="btn"
          disabled={pending}
          onClick={() => startTransition(async () => {
            const result = await syncFromDevice({
              dietBand: quiz?.dietBand,
              declaredCuisines: quiz?.declaredCuisines,
              taste: quiz?.vector,
              foodLabel: quiz?.label,
              representativeDish: quiz?.dishName,
              foodAnswers: quiz?.foodAnswers,
              psychAnswers: psych,
            });
            if (!result.ok) setError(result.error ?? 'Could not sync.');
            else setDone(true);
          })}
        >
          {pending ? 'Applying…' : 'Use my latest answers'}
        </button>
      )}
    </>
  );
}

function BlockedSection({ blocked }: { blocked: BlockedPerson[] }) {
  const [removed, setRemoved] = useState<string[]>([]);
  const [pending, startTransition] = useTransition();
  const visible = blocked.filter((b) => !removed.includes(b.id));

  return (
    <>
      <h2 className="settings-h">Blocked</h2>
      {visible.length === 0 ? (
        <p className="settings-note">Nobody.</p>
      ) : (
        visible.map((b) => (
          <div key={b.id} className="blocked-row">
            <span>{b.name}</span>
            <button
              className="btn-text"
              disabled={pending}
              onClick={() => startTransition(async () => {
                const r = await unblock(b.id);
                if (r.ok) setRemoved((prev) => [...prev, b.id]);
              })}
            >
              Unblock
            </button>
          </div>
        ))
      )}
      <p className="settings-note">
        Unblocking lets them contact you again. It does not put them back in your feed — you had
        already decided about them.
      </p>
    </>
  );
}

function DangerZone() {
  const [open, setOpen] = useState(false);
  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <>
      <h2 className="settings-h danger">Delete your account</h2>
      {!open ? (
        <>
          <p className="settings-note">
            Removes your profile, photos, likes, matches and messages. It cannot be undone.
          </p>
          <button className="btn btn-danger" onClick={() => setOpen(true)}>Delete my account</button>
        </>
      ) : (
        <>
          <p className="settings-note">
            This deletes everything permanently — your profile, your photos, every match and every
            conversation, for the other person too. Type <strong>DELETE</strong> to confirm.
          </p>
          <input className="text-input" value={confirmation} placeholder="DELETE"
            onChange={(e) => setConfirmation(e.target.value)} aria-label="Type DELETE to confirm" />
          {error && <p className="err">{error}</p>}
          <button
            className="btn btn-danger"
            disabled={pending || confirmation.trim().toUpperCase() !== 'DELETE'}
            onClick={() => startTransition(async () => {
              const r = await deleteAccount(confirmation);
              if (r && !r.ok) setError(r.error ?? 'Could not delete.');
            })}
          >
            {pending ? 'Deleting…' : 'Permanently delete'}
          </button>
          <button className="btn-text" style={{ margin: '0 auto', display: 'block' }}
            onClick={() => { setOpen(false); setConfirmation(''); setError(null); }}>
            Cancel
          </button>
        </>
      )}
    </>
  );
}
