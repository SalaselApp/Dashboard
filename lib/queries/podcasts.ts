import "server-only";

import { requireSession } from "@/lib/auth/session";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { rowToPodcast, type Podcast, type PodcastRow } from "@/lib/models/podcast";

/** Privileged list for the authenticated Podcasts section. */
export async function listPodcastsForAdmin(): Promise<Podcast[]> {
  await requireSession();

  const { data, error } = await getSupabaseAdmin()
    .from("podcasts")
    .select("*")
    .order("created_at", { ascending: false })
    .overrideTypes<PodcastRow[], { merge: false }>();

  if (error) {
    throw new Error(`Failed to list podcasts: ${error.message}`);
  }

  return (data ?? []).map(rowToPodcast);
}

/** Privileged read for an unpublished draft preview. */
export async function getPodcastForAdmin(id: string): Promise<Podcast | null> {
  await requireSession();

  const { data, error } = await getSupabaseAdmin()
    .from("podcasts")
    .select("*")
    .eq("id", id)
    .maybeSingle()
    .overrideTypes<PodcastRow | null, { merge: false }>();

  if (error) {
    throw new Error(`Failed to load podcast: ${error.message}`);
  }

  return data ? rowToPodcast(data as unknown as PodcastRow) : null;
}
