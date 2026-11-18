const VIDEO_ID_PATTERN = /^[a-zA-Z0-9_-]{11}$/;
const SUPPORTED_LANGUAGES = ["ar", "en", "ja"] as const;
const SUPPORTED_CATEGORIES = [0, 1, 2] as const;

export type PodcastLanguage = (typeof SUPPORTED_LANGUAGES)[number];
export type PodcastCategory = (typeof SUPPORTED_CATEGORIES)[number];

export interface PodcastDraftInput {
  title: string;
  description: string;
  artworkVideoId: string;
  youtubeVideoId: string;
  language: PodcastLanguage;
  categories: PodcastCategory[];
  participants?: string[];
  type?: 0 | 1 | 2;
  style?: 0 | 1 | 2 | 3;
  classes?: (0 | 1 | 2 | 3)[];
}

export type PodcastValidationResult =
  | { valid: true; data: PodcastDraftInput }
  | { valid: false; error: string };

export function extractPodcastVideoId(input: unknown): string | null {
  if (typeof input !== "string") return null;
  const trimmed = input.trim();
  if (VIDEO_ID_PATTERN.test(trimmed)) return trimmed;

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return null;
  }

  if (url.protocol !== "https:" || url.username || url.password || url.port)
    return null;
  const host = url.hostname.toLowerCase();
  if (host === "youtu.be") {
    const videoId = url.pathname.slice(1);
    return VIDEO_ID_PATTERN.test(videoId) ? videoId : null;
  }

  if (
    !new Set(["youtube.com", "www.youtube.com", "m.youtube.com"]).has(host) ||
    url.pathname !== "/watch"
  )
    return null;
  const videoId = url.searchParams.get("v");
  return videoId && VIDEO_ID_PATTERN.test(videoId) ? videoId : null;
}

function isCategory(value: unknown): value is PodcastCategory {
  return (
    typeof value === "number" &&
    SUPPORTED_CATEGORIES.includes(value as PodcastCategory)
  );
}

/**
 * Validates the fields shared by draft creation and future podcast editing.
 * Artwork stays YouTube-derived: no uploaded files, storage, or arbitrary
 * image URLs are accepted in this release.
 */
export function validatePodcastInput(input: unknown): PodcastValidationResult {
  if (typeof input !== "object" || input === null) {
    return { valid: false, error: "Invalid podcast data." };
  }

  const {
    title,
    description = "",
    artworkVideoId,
    youtubeVideoId,
    language,
    categories,
    participants,
    type,
    style,
    classes,
  } = input as Record<string, unknown>;
  const normalizedVideoId = extractPodcastVideoId(youtubeVideoId);

  if (!normalizedVideoId) {
    return { valid: false, error: "Enter a valid YouTube video URL or ID." };
  }
  if (typeof title !== "string" || title.trim().length === 0) {
    return { valid: false, error: "Title is required." };
  }
  if (typeof description !== "string") {
    return { valid: false, error: "Description must be text." };
  }

  const useSourceArtwork =
    artworkVideoId === undefined ||
    (typeof artworkVideoId === "string" && artworkVideoId.trim() === "");
  const normalizedArtworkId = useSourceArtwork
    ? normalizedVideoId
    : extractPodcastVideoId(artworkVideoId);
  if (!normalizedArtworkId) {
    return {
      valid: false,
      error: "Enter a valid YouTube artwork video URL or ID.",
    };
  }
  if (
    typeof language !== "string" ||
    !SUPPORTED_LANGUAGES.includes(language as PodcastLanguage)
  ) {
    return { valid: false, error: "Select a valid language." };
  }
  if (
    !Array.isArray(categories) ||
    categories.length === 0 ||
    !categories.every(isCategory)
  ) {
    return { valid: false, error: "Select at least one valid category." };
  }

  if (
    participants !== undefined &&
    (!Array.isArray(participants) ||
      !participants.every((name) => typeof name === "string"))
  ) {
    return { valid: false, error: "Enter valid participant names." };
  }
  if (
    type !== undefined &&
    (typeof type !== "number" || ![0, 1, 2].includes(type))
  ) {
    return { valid: false, error: "Select a valid content type." };
  }
  if (
    style !== undefined &&
    (typeof style !== "number" || ![0, 1, 2, 3].includes(style))
  ) {
    return { valid: false, error: "Select a valid presentation style." };
  }
  if (
    classes !== undefined &&
    (!Array.isArray(classes) ||
      !classes.every(
        (value) => typeof value === "number" && [0, 1, 2, 3].includes(value),
      ))
  ) {
    return { valid: false, error: "Select valid audience classes." };
  }

  return {
    valid: true,
    data: {
      title: title.trim(),
      description: description.trim(),
      artworkVideoId: normalizedArtworkId,
      youtubeVideoId: normalizedVideoId,
      language: language as PodcastLanguage,
      categories,
      ...(participants !== undefined
        ? {
            participants: (participants as string[])
              .map((name) => name.trim())
              .filter(Boolean),
          }
        : {}),
      ...(type !== undefined ? { type: type as 0 | 1 | 2 } : {}),
      ...(style !== undefined ? { style: style as 0 | 1 | 2 | 3 } : {}),
      ...(classes !== undefined
        ? { classes: classes as (0 | 1 | 2 | 3)[] }
        : {}),
    },
  };
}
