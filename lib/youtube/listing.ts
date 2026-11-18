import { YTNodes } from "youtubei.js";
import { parseDurationText } from "./parse.ts";

type LockupView = InstanceType<typeof YTNodes.LockupView>;
type PlaylistVideo = InstanceType<typeof YTNodes.PlaylistVideo>;
type ReelItem = InstanceType<typeof YTNodes.ReelItem>;
type ShortsLockupView = InstanceType<typeof YTNodes.ShortsLockupView>;
export type PlaylistItem =
  | LockupView
  | PlaylistVideo
  | ReelItem
  | ShortsLockupView;

function extractLockupDuration(item: LockupView): number {
  const content = item.content_image;
  if (!(content instanceof YTNodes.ThumbnailView)) return 0;
  const overlays = content.overlays ?? [];
  for (const overlay of overlays) {
    if (overlay instanceof YTNodes.ThumbnailBottomOverlayView) {
      for (const badge of overlay.badges ?? []) {
        const seconds = parseDurationText(badge.text);
        if (seconds > 0) return seconds;
      }
    }
  }
  return 0;
}

/** Extracts { id, title, duration } from a playlist listing item. Items
 * can use modern LockupView, legacy PlaylistVideo, Reel or Shorts shapes.
 * Unknown shapes return null so complete enumeration can hold them. */
export function parseListingItem(
  item: PlaylistItem,
): { id: string; title: string; duration: number } | null {
  if (item instanceof YTNodes.LockupView) {
    if (item.content_type !== "VIDEO" || !item.content_id) return null;
    return {
      id: item.content_id,
      title: item.metadata?.title?.text ?? "Untitled",
      // Read duration from the listing overlay; the per-video fetch still
      // backfills it as a fallback for any item missing the badge.
      duration: extractLockupDuration(item),
    };
  }

  if (item instanceof YTNodes.PlaylistVideo) {
    if (!item.id) return null;
    return {
      id: item.id,
      title: item.title?.text ?? "Untitled",
      duration: item.duration?.seconds ?? 0,
    };
  }

  if (item instanceof YTNodes.ReelItem) {
    return item.id
      ? { id: item.id, title: item.title?.text ?? "Untitled", duration: 0 }
      : null;
  }
  if (item instanceof YTNodes.ShortsLockupView) {
    const id = item.on_tap_endpoint?.payload?.videoId;
    return typeof id === "string"
      ? {
          id,
          title: item.overlay_metadata?.primary_text?.text ?? "Untitled",
          duration: 0,
        }
      : null;
  }
  return null;
}
