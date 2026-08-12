import 'server-only';

import { createAdminClient } from '@/lib/supabase/admin.ts';

export interface EditableProfile {
  name: string;
  gender: string;
  seeking: string[];
  intents: string[];
  city: string;
  openToDistance: boolean;
  ageMin: number;
  ageMax: number;
  foodLabel: string | null;
  photoPaths: string[];
  psychAnswered: number;
}

export interface BlockedPerson {
  id: string;
  name: string;
}

export async function getEditableProfile(userId: string): Promise<EditableProfile | null> {
  const admin = createAdminClient();
  if (!admin) return null;
  const { data } = await admin
    .from('profiles')
    .select('name,gender,seeking,intents,city,open_to_distance,age_min,age_max,food_label,photo_paths,psych_answers')
    .eq('id', userId)
    .maybeSingle();
  if (!data) return null;
  return {
    name: data.name as string,
    gender: data.gender as string,
    seeking: (data.seeking as string[]) ?? [],
    intents: (data.intents as string[]) ?? [],
    city: data.city as string,
    openToDistance: data.open_to_distance as boolean,
    ageMin: data.age_min as number,
    ageMax: data.age_max as number,
    foodLabel: (data.food_label as string) ?? null,
    photoPaths: (data.photo_paths as string[]) ?? [],
    psychAnswered: ((data.psych_answers as unknown[]) ?? []).length,
  };
}

/**
 * Who this person has blocked.
 *
 * Names come from the admin client because the blocker cannot read the blocked
 * person's profile row — quite right, but it would leave the list unreadable.
 */
export async function getBlocked(userId: string): Promise<BlockedPerson[]> {
  const admin = createAdminClient();
  if (!admin) return [];
  const { data: rows } = await admin.from('blocks').select('blocked_id').eq('blocker_id', userId);
  const ids = (rows ?? []).map((r) => r.blocked_id as string);
  if (ids.length === 0) return [];
  const { data: people } = await admin.from('profiles').select('id,name').in('id', ids);
  return (people ?? []).map((p) => ({ id: p.id as string, name: p.name as string }));
}
