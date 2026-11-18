import type { SupabaseClient } from "@supabase/supabase-js";
import type { VideoRow } from "../models/video.ts";

type Result<T> = { ok: true; data: T } | { ok: false; error: string };
/** Bound each primary-key read below the server row cap; never truncate a large import check. */
export async function readImportVideos(
  client: SupabaseClient,
  ids: string[],
): Promise<Result<VideoRow[]>> {
  const unique = [...new Set(ids)],
    rows: VideoRow[] = [];
  for (let offset = 0; offset < unique.length; offset += 200) {
    const chunk = unique.slice(offset, offset + 200);
    const { data, error } = await client
      .from("videos")
      .select("id, playlist_id, title, duration, uploaded_at, position")
      .in("id", chunk)
      .limit(chunk.length)
      .overrideTypes<VideoRow[], { merge: false }>();
    if (error)
      return {
        ok: false,
        error: `Failed to check existing videos: ${error.message}`,
      };
    rows.push(...(data ?? []));
  }
  return { ok: true, data: rows };
}
/** Conflict inserts never merge ownership. Existing rows can only update under their current owner. */
export async function writeImportVideos(
  client: SupabaseClient,
  target: string,
  rows: VideoRow[],
  existing: VideoRow[],
): Promise<Result<undefined>> {
  if (rows.some((row) => row.playlist_id !== target))
    return { ok: false, error: "Video target does not match playlist." };
  const { error } = await client
    .from("videos")
    .upsert(rows, { onConflict: "id", ignoreDuplicates: true });
  if (error)
    return { ok: false, error: `Failed to save videos: ${error.message}` };
  const previous = new Set(
    existing.filter((r) => r.playlist_id === target).map((r) => r.id),
  );
  for (const row of rows) {
    if (!previous.has(row.id)) continue;
    const { id, playlist_id, ...metadata } = row;
    if (playlist_id !== target)
      return { ok: false, error: "Video target does not match playlist." };
    const updated = await client
      .from("videos")
      .update(metadata)
      .eq("id", id)
      .eq("playlist_id", target)
      .select("id");
    if (updated.error || updated.data?.length !== 1)
      return {
        ok: false,
        error:
          "Video membership changed during import; inspect the partial save before retrying.",
      };
  }
  const saved = await readImportVideos(
    client,
    rows.map((r) => r.id),
  );
  if (!saved.ok) return saved;
  const byId = new Map(saved.data.map((r) => [r.id, r]));
  const exact = rows.every((expected) => {
    const actual = byId.get(expected.id);
    return (
      actual &&
      (
        [
          "id",
          "playlist_id",
          "title",
          "duration",
          "uploaded_at",
          "position",
        ] as const
      ).every((key) => actual[key] === expected[key])
    );
  });
  if (!exact)
    return {
      ok: false,
      error:
        "Video membership or metadata changed during import; inspect the partial save before retrying.",
    };
  return { ok: true, data: undefined };
}
