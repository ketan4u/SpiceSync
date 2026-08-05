/**
 * Cities the waitlist collects.
 *
 * Shared by the form and the server action so the two can never drift — the
 * action validates against exactly the list the user was offered, which stops a
 * hand-crafted request writing junk into the `city` column that later has to be
 * cleaned out of a launch decision.
 *
 * Ordered by where the demand is most likely to be, not alphabetically. The
 * point of asking is to learn which city crosses the density threshold first.
 */
export interface City {
  id: string;
  label: string;
}

export const CITIES: City[] = [
  { id: 'bangalore', label: 'Bangalore' },
  { id: 'delhi', label: 'Delhi' },
  { id: 'mumbai', label: 'Mumbai' },
  { id: 'hyderabad', label: 'Hyderabad' },
  { id: 'pune', label: 'Pune' },
  { id: 'chennai', label: 'Chennai' },
  { id: 'kolkata', label: 'Kolkata' },
  { id: 'ahmedabad', label: 'Ahmedabad' },
  { id: 'jaipur', label: 'Jaipur' },
  { id: 'chandigarh', label: 'Chandigarh' },
  { id: 'kochi', label: 'Kochi' },
  { id: 'lucknow', label: 'Lucknow' },
  { id: 'indore', label: 'Indore' },
  { id: 'other_india', label: 'Somewhere else in India' },
  // The brief is explicit that an Indian in London should be able to match with
  // someone in Bangalore, so the waitlist has to be able to hear from them.
  { id: 'outside_india', label: 'Outside India' },
];

const BY_ID = new Map(CITIES.map((c) => [c.id, c]));

export function isKnownCity(id: string): boolean {
  return BY_ID.has(id);
}

export function cityLabel(id: string): string | null {
  return BY_ID.get(id)?.label ?? null;
}

/**
 * The confirmation line shown after signing up.
 *
 * A named city gets named back — "We'll be in touch when Delhi opens" is a
 * concrete promise and reads like it was written for that person. The two
 * catch-all options have no city to name, so they get a truthful variant
 * instead of the nonsense of "when Somewhere else in India opens".
 */
export function joinedMessage(cityId: string): string {
  if (cityId === 'other_india' || cityId === 'outside_india') {
    return 'You’re on the list. We’ll be in touch as we open up new cities.';
  }
  const label = cityLabel(cityId);
  return label
    ? `You’re on the list. We’ll be in touch when ${label} opens.`
    : 'You’re on the list. We’ll be in touch soon.';
}
