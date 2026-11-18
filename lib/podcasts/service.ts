import { validatePodcastInput, type PodcastDraftInput } from "./validation.ts";
import type { ActionResult } from "../actions/playlists";

export interface RefreshResult {
  delivered: boolean;
  error?: string;
}

interface VideoSource {
  ok: true;
  data: { id: string; duration: number; uploadedAt: number };
}
interface VideoFailure {
  ok: false;
  error: string;
}

export interface PodcastServiceDependencies {
  requireSession(): Promise<void>;
  fetchVideo(id: string): Promise<VideoSource | VideoFailure>;
  insertPodcast(
    payload: Record<string, unknown>,
  ): Promise<{ error: { message: string } | null }>;
  getPublication(
    id: string,
  ): Promise<{
    data: { published_at: string | null } | null;
    error: { message: string } | null;
  }>;
  deletePodcast(
    id: string,
  ): Promise<{
    data: { id: string } | null;
    error: { message: string } | null;
  }>;
  updatePodcast(
    id: string,
    payload: Record<string, unknown>,
  ): Promise<{
    data: { id: string } | null;
    error: { message: string } | null;
  }>;
  revalidatePublicContent(): Promise<RefreshResult>;
  now?(): string;
  createId?(): string;
}

export type PodcastActionResult = ActionResult & { refresh?: RefreshResult };
export type PodcastCreateResult = ActionResult<string> & {
  refresh?: RefreshResult;
};
type PodcastValidationFailure = { ok: false; error: string };

function validPodcastId(id: unknown): id is string {
  return typeof id === "string" && /^pod_[A-Za-z0-9_-]+$/.test(id);
}

function isValidationFailure(
  value: Record<string, unknown> | PodcastValidationFailure,
): value is PodcastValidationFailure {
  return "ok" in value && value.ok === false;
}

async function sourcePayload(
  input: PodcastDraftInput,
  deps: PodcastServiceDependencies,
): Promise<Record<string, unknown> | PodcastValidationFailure> {
  const source = await deps.fetchVideo(input.youtubeVideoId);
  if (!source.ok)
    return {
      ok: false,
      error: `Could not use this YouTube video: ${source.error}`,
    };
  return {
    title: input.title,
    description: input.description,
    thumbnail_id: input.artworkVideoId,
    youtube_video_id: source.data.id,
    language: input.language,
    categories: input.categories,
    ...(input.participants !== undefined
      ? { participants: input.participants }
      : {}),
    ...(input.type !== undefined ? { type: input.type } : {}),
    ...(input.style !== undefined ? { style: input.style } : {}),
    ...(input.classes !== undefined ? { classes: input.classes } : {}),
    duration: source.data.duration,
    uploaded_at: source.data.uploadedAt,
  };
}

export function createPodcastService(deps: PodcastServiceDependencies) {
  async function validateAndLoad(
    input: unknown,
  ): Promise<Record<string, unknown> | PodcastValidationFailure> {
    const validated = validatePodcastInput(input);
    if (!validated.valid) return { ok: false, error: validated.error };
    return sourcePayload(validated.data, deps);
  }

  async function refresh(): Promise<RefreshResult> {
    return deps.revalidatePublicContent();
  }

  return {
    async create(input: unknown): Promise<PodcastCreateResult> {
      await deps.requireSession();
      const payload = await validateAndLoad(input);
      if (isValidationFailure(payload)) return payload;
      const id = deps.createId?.() ?? `pod_${crypto.randomUUID()}`;
      const { error } = await deps.insertPodcast({
        id,
        ...payload,
        published_at: deps.now?.() ?? new Date().toISOString(),
      });
      if (error)
        return {
          ok: false,
          error: `Failed to create podcast: ${error.message}`,
        };
      return { ok: true, data: id, refresh: await refresh() };
    },

    // Kept for older callers; the management UI uses create() to save once.
    async createDraft(input: unknown): Promise<PodcastCreateResult> {
      await deps.requireSession();
      const payload = await validateAndLoad(input);
      if (isValidationFailure(payload)) return payload;
      const id = deps.createId?.() ?? `pod_${crypto.randomUUID()}`;
      const { error } = await deps.insertPodcast({ id, ...payload });
      return error
        ? {
            ok: false,
            error: `Failed to create podcast draft: ${error.message}`,
          }
        : { ok: true, data: id };
    },

    async update(id: unknown, input: unknown): Promise<PodcastActionResult> {
      await deps.requireSession();
      if (!validPodcastId(id))
        return { ok: false, error: "Invalid podcast ID." };
      const payload = await validateAndLoad(input);
      if (isValidationFailure(payload)) return payload;
      const current = await deps.getPublication(id);
      if (current.error)
        return {
          ok: false,
          error: `Failed to load podcast: ${current.error.message}`,
        };
      if (!current.data) return { ok: false, error: "Podcast was not found." };
      const now = deps.now?.() ?? new Date().toISOString();
      const { data, error } = await deps.updatePodcast(id, {
        ...payload,
        updated_at: now,
        published_at: current.data.published_at ?? now,
      });
      if (error)
        return {
          ok: false,
          error: `Failed to update podcast: ${error.message}`,
        };
      if (!data) return { ok: false, error: "Podcast was not found." };
      return { ok: true, data: undefined, refresh: await refresh() };
    },

    async remove(id: unknown): Promise<PodcastActionResult> {
      await deps.requireSession();
      if (!validPodcastId(id))
        return { ok: false, error: "Invalid podcast ID." };
      const { data, error } = await deps.deletePodcast(id);
      if (error)
        return {
          ok: false,
          error: `Failed to delete podcast: ${error.message}`,
        };
      if (!data) return { ok: false, error: "Podcast was not found." };
      return { ok: true, data: undefined, refresh: await refresh() };
    },

    async publish(id: unknown): Promise<PodcastActionResult> {
      await deps.requireSession();
      if (!validPodcastId(id))
        return { ok: false, error: "Invalid podcast ID." };
      const { data, error } = await deps.updatePodcast(id, {
        published_at: deps.now?.() ?? new Date().toISOString(),
        updated_at: deps.now?.() ?? new Date().toISOString(),
        onlyDraft: true,
      });
      if (error)
        return {
          ok: false,
          error: `Failed to publish podcast: ${error.message}`,
        };
      if (!data)
        return {
          ok: false,
          error: "Podcast draft was not found or is already published.",
        };
      return { ok: true, data: undefined, refresh: await refresh() };
    },

    async withdraw(id: unknown): Promise<PodcastActionResult> {
      await deps.requireSession();
      if (!validPodcastId(id))
        return { ok: false, error: "Invalid podcast ID." };
      const { data, error } = await deps.updatePodcast(id, {
        published_at: null,
        updated_at: deps.now?.() ?? new Date().toISOString(),
        onlyPublished: true,
      });
      if (error)
        return {
          ok: false,
          error: `Failed to withdraw podcast: ${error.message}`,
        };
      if (!data)
        return { ok: false, error: "Published podcast was not found." };
      return { ok: true, data: undefined, refresh: await refresh() };
    },
  };
}
