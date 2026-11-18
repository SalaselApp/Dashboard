import type { VideoRow } from "@/lib/models/video";
import type { FetchedVideo, VideoDetail } from "./fetch";

/** Results from older fetch generations must not update a newer preview. */
export function isCurrentFetch(
  fetchGeneration: number,
  currentGeneration: number,
): boolean {
  return fetchGeneration === currentGeneration;
}

/** A date is usable only when it can also be rendered as a valid JS Date. */
export function isUsableUploadedAt(uploadedAt: number): boolean {
  if (!Number.isFinite(uploadedAt) || uploadedAt <= 0) return false;
  return Number.isFinite(new Date(uploadedAt * 1000).getTime());
}

/**
 * Finds requested videos that already belong to another playlist. Existing
 * rows in the target playlist are safe to update; cross-playlist rows are not.
 */
export function findVideoPlaylistConflicts(
  videoIds: string[],
  existingRows: Array<{ id: string; playlist_id: string }>,
  targetPlaylistId: string,
): string[] {
  const owners = new Map(existingRows.map((row) => [row.id, row.playlist_id]));
  const seen = new Set<string>();

  return videoIds.filter((id) => {
    if (seen.has(id)) return false;
    seen.add(id);
    const owner = owners.get(id);
    return owner !== undefined && owner !== targetPlaylistId;
  });
}

/**
 * Sorts only a new import preview. Invalid or unavailable upload timestamps
 * stay after dated videos while retaining their source-relative order.
 */
export function sortVideosOldestFirst<T extends { uploadedAt: number }>(
  videos: T[],
): T[] {
  return videos
    .map((video, sourceIndex) => ({ video, sourceIndex }))
    .sort((a, b) => {
      const aMissing = !isUsableUploadedAt(a.video.uploadedAt);
      const bMissing = !isUsableUploadedAt(b.video.uploadedAt);
      if (aMissing !== bMissing) return aMissing ? 1 : -1;
      if (aMissing && bMissing) return a.sourceIndex - b.sourceIndex;
      return a.video.uploadedAt - b.video.uploadedAt || a.sourceIndex - b.sourceIndex;
    })
    .map(({ video }) => video);
}

/**
 * Applies one or more fetched details without changing the current array
 * order. This is used after the editor may already have been manually
 * reordered while detail requests are still in flight.
 */
export function mergeVideoDetails<T extends FetchedVideo>(
  videos: T[],
  details: VideoDetail[],
): T[] {
  const detailsById = new Map(details.map((detail) => [detail.id, detail]));
  return videos.map((video) => {
    const detail = detailsById.get(video.id);
    if (!detail) return video;
    return {
      ...video,
      duration: video.duration || detail.duration,
      uploadedAt: isUsableUploadedAt(video.uploadedAt)
        ? video.uploadedAt
        : detail.uploadedAt,
    };
  });
}

export function preserveCurrentVideoDetails<T extends FetchedVideo>(
  nextVideos: T[],
  currentVideos: T[],
): T[] {
  const currentById = new Map(currentVideos.map((video) => [video.id, video]));
  return nextVideos.map((video) => {
    const current = currentById.get(video.id);
    if (!current) return video;
    return {
      ...video,
      duration: video.duration || current.duration,
      uploadedAt: isUsableUploadedAt(video.uploadedAt)
        ? video.uploadedAt
        : current.uploadedAt,
    };
  });
}

export function hasVideoOrderChanged(
  before: Array<{ id: string }>,
  after: Array<{ id: string }>,
): boolean {
  return (
    before.length !== after.length ||
    before.some((video, index) => video.id !== after[index]?.id)
  );
}

/** Build save rows in the exact sequence selected by the editor. */
export function buildPlaylistVideoRows(
  playlistId: string,
  videos: FetchedVideo[],
): VideoRow[] {
  return videos.map((video, position) => ({
    id: video.id,
    playlist_id: playlistId,
    title: video.title,
    duration: video.duration,
    uploaded_at: video.uploadedAt,
    position,
  }));
}
