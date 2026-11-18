import type { Dictionary } from "@/lib/i18n/dictionaries";

/** Translate actionable server errors without showing database diagnostics in the form. */
export function podcastErrorMessage(error: string, dict: Dictionary, fallback: string): string {
  const t = dict.podcast;
  const messages: Record<string, string> = {
    "Enter a valid YouTube video URL or ID.": t.invalidSource,
    "Enter a valid YouTube artwork video URL or ID.": t.invalidArtwork,
    "Title is required.": t.titleRequired,
    "Description is required.": t.descriptionRequired,
    "Description must be text.": t.descriptionInvalid,
    "Enter valid participant names.": t.participantsInvalid,
    "Select a valid content type.": t.contentTypeInvalid,
    "Select a valid presentation style.": t.presentationStyleInvalid,
    "Select valid audience classes.": t.classesInvalid,
    "Select a valid language.": t.invalidLanguage,
    "Select at least one valid category.": t.categoryRequired,
    "Podcast was not found.": t.notFound,
  };
  if (messages[error]) return messages[error];
  if (/duplicate key|already exists/i.test(error)) return t.alreadyExists;
  if (error.startsWith("Could not use this YouTube video:")) return t.sourceUnavailable;
  return fallback;
}
