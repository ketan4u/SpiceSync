import 'server-only';

import { createAdminClient } from '../supabase/admin.ts';

/**
 * Loading one conversation.
 *
 * The admin client is used only to fetch the other person's display fields and
 * the message rows; whether the two are matched is decided by the caller with
 * the ordinary client, so the database's own policies remain the authority.
 */
export interface Message {
  id: string;
  senderId: string;
  body: string;
  createdAt: string;
}

export interface ThreadPartner {
  id: string;
  name: string;
  foodLabel: string | null;
  photoUrl: string | null;
}

const SIGNED_URL_TTL_SECONDS = 60 * 30;

export async function getPartner(otherId: string): Promise<ThreadPartner | null> {
  const admin = createAdminClient();
  if (!admin) return null;

  const { data } = await admin
    .from('profiles')
    .select('id,name,food_label,photo_paths')
    .eq('id', otherId)
    .maybeSingle();
  if (!data) return null;

  const paths = (data.photo_paths as string[]) ?? [];
  let photoUrl: string | null = null;
  if (paths[0]) {
    const { data: signed } = await admin.storage
      .from('photos')
      .createSignedUrl(paths[0], SIGNED_URL_TTL_SECONDS);
    photoUrl = signed?.signedUrl ?? null;
  }

  return {
    id: data.id as string,
    name: data.name as string,
    foodLabel: (data.food_label as string) ?? null,
    photoUrl,
  };
}
