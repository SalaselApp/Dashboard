import { parseUploadedAt } from "./parse.ts";

export interface YoutubeVideoInfoShape {
  basic_info?: {
    duration?: number;
  } | null;
  primary_info?: {
    published?: {
      text?: string | null;
    } | null;
  } | null;
}

/** Maps YouTube's video-page metadata to the app's explicit detail shape. */
export function videoDetailFromInfo(
  info: YoutubeVideoInfoShape,
): { uploadedAt: number; duration: number } {
  return {
    uploadedAt: parseUploadedAt(info.primary_info?.published?.text),
    duration: info.basic_info?.duration ?? 0,
  };
}
