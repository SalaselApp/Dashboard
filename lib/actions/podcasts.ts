"use server";

import { requireSession } from "@/lib/auth/session";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { fetchVideo } from "@/lib/youtube/fetch";
import { fetchPodcastVideo } from "@/lib/youtube/podcast-source";
import { revalidatePublicContent } from "@/lib/revalidate-public";
import { createPodcastService } from "@/lib/podcasts/service";
import { extractPodcastVideoId } from "@/lib/podcasts/validation";
import type { ActionResult } from "./playlists";

const fetchPodcastSource = (id: string) => fetchPodcastVideo(id, fetchVideo);

function service() {
  return createPodcastService({
    requireSession,
    fetchVideo: fetchPodcastSource,
    async insertPodcast(payload) {
      const { error } = await getSupabaseAdmin().from("podcasts").insert(payload);
      return { error };
    },
    async getPublication(id) {
      const { data, error } = await getSupabaseAdmin().from("podcasts").select("published_at").eq("id", id).maybeSingle();
      return { data, error };
    },
    async deletePodcast(id) {
      const { data, error } = await getSupabaseAdmin().from("podcasts").delete().eq("id", id).select("id").maybeSingle();
      return { data, error };
    },
    async updatePodcast(id, payload) {
      const { onlyDraft, onlyPublished, ...changes } = payload as Record<string, unknown> & {
        onlyDraft?: boolean;
        onlyPublished?: boolean;
      };
      let query = getSupabaseAdmin().from("podcasts").update(changes).eq("id", id);
      if (onlyDraft) query = query.is("published_at", null);
      if (onlyPublished) query = query.not("published_at", "is", null);
      const { data, error } = await query.select("id").maybeSingle();
      return { data, error };
    },
    revalidatePublicContent: async () => {
      const outcome = await revalidatePublicContent("podcasts");
      return outcome.ok ? { delivered: true } : { delivered: false, error: outcome.error };
    },
  });
}

/** Fetch source metadata before saving, following the playlist add flow. */
export async function fetchPodcastDetails(input: string) {
  await requireSession();
  const id = extractPodcastVideoId(input);
  if (!id) return { ok: false, error: "Enter a valid YouTube video URL or ID." } as const;
  return fetchPodcastSource(id);
}

/** Save an independent episode and make it public in one authenticated write. */
export async function createPodcast(input: unknown) {
  return service().create(input);
}

/** Remove an episode, following the playlist edit/delete workflow. */
export async function deletePodcast(podcastId: string) {
  return service().remove(podcastId);
}

/** Creates an authenticated, unpublished independent YouTube episode. */
export async function createPodcastDraft(input: unknown): Promise<ActionResult<string>> {
  return service().createDraft(input);
}

/** Publishes a draft, preserving its stable pod_* identity and public URL. */
export async function publishPodcast(podcastId: string) {
  return service().publish(podcastId);
}

/** Validates and saves editable metadata and source information. */
export async function updatePodcast(podcastId: string, input: unknown) {
  return service().update(podcastId, input);
}

/** Withdraws public availability without deleting the stable podcast record. */
export async function withdrawPodcast(podcastId: string) {
  return service().withdraw(podcastId);
}
