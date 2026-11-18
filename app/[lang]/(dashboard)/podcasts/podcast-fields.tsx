"use client";

import type { ContentTypes, PresentationStyles } from "@/types";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import {
  ContentDetailsFields,
  ContentClassificationFields,
  type ManualFieldsState,
  inputClasses,
  labelClasses,
} from "../playlists/playlist-fields";
import { PlaylistThumbnail } from "../playlists/new/playlist-thumbnail";

export interface PodcastFieldsState extends Omit<
  ManualFieldsState,
  "type" | "style"
> {
  type: ContentTypes | null;
  style: PresentationStyles | null;
  title: string;
  youtubeVideoId: string;
  artworkVideoId: string;
}

function thumbnailVideoId(input: string): string {
  if (/^[a-zA-Z0-9_-]{11}$/.test(input.trim())) return input.trim();
  try {
    const url = new URL(input.trim());
    if (url.protocol !== "https:") return "";
    const id =
      url.hostname === "youtu.be"
        ? url.pathname.slice(1)
        : ["youtube.com", "www.youtube.com", "m.youtube.com"].includes(
              url.hostname,
            ) && url.pathname === "/watch"
          ? (url.searchParams.get("v") ?? "")
          : "";
    return /^[a-zA-Z0-9_-]{11}$/.test(id) ? id : "";
  } catch {
    return "";
  }
}

export function PodcastArtwork({
  value,
  onChange,
  disabled,
  dict,
}: {
  value: PodcastFieldsState;
  onChange: (next: PodcastFieldsState) => void;
  disabled: boolean;
  dict: Dictionary;
}) {
  const t = dict.podcast;
  const artworkId =
    thumbnailVideoId(value.artworkVideoId) ||
    thumbnailVideoId(value.youtubeVideoId);
  return (
    <div className="rounded-xl border border-gray-200 bg-surface-light p-4 dark:border-slate-700 dark:bg-surface-dark">
      <p className={`${labelClasses()} mb-2`}>{t.artwork}</p>
      <PlaylistThumbnail videoId={artworkId} alt={value.title} />
      <details
        className="mt-4"
        open={value.artworkVideoId.trim() !== "" || undefined}
      >
        <summary className="cursor-pointer rounded text-sm font-medium text-gray-700 focus-visible:outline-2 focus-visible:outline-primary dark:text-slate-300">
          {t.alternateArtwork}
        </summary>
        <div className="mt-3 flex flex-col gap-1.5">
          <p
            id="artwork-help"
            className="mb-2 text-xs leading-relaxed text-gray-500 dark:text-slate-400"
          >
            {t.artworkHelp}
          </p>
          <label htmlFor="podcast-artwork" className={labelClasses()}>
            {t.artworkVideo}
          </label>
          <input
            id="podcast-artwork"
            value={value.artworkVideoId}
            onChange={(event) =>
              onChange({ ...value, artworkVideoId: event.target.value })
            }
            disabled={disabled}
            dir="ltr"
            aria-describedby="artwork-help"
            placeholder={t.youtubeVideoPlaceholder}
            className={`${inputClasses()} w-full min-w-0`}
          />
        </div>
      </details>
    </div>
  );
}

export function PodcastFields({
  value,
  onChange,
  disabled,
  dict,
}: {
  value: PodcastFieldsState;
  onChange: (next: PodcastFieldsState) => void;
  disabled: boolean;
  dict: Dictionary;
}) {
  return (
    <fieldset disabled={disabled} className="flex min-w-0 flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="podcast-title" className={labelClasses()}>
          {dict.podcast.title}
        </label>
        <input
          id="podcast-title"
          required
          value={value.title}
          onChange={(event) =>
            onChange({ ...value, title: event.target.value })
          }
          className={inputClasses()}
        />
      </div>
      <ContentDetailsFields
        value={value}
        onChange={(manual) => onChange({ ...value, ...manual })}
        dict={dict}
      />
    </fieldset>
  );
}

export function PodcastClassifications({
  value,
  onChange,
  disabled,
  dict,
}: {
  value: PodcastFieldsState;
  onChange: (next: PodcastFieldsState) => void;
  disabled: boolean;
  dict: Dictionary;
}) {
  return (
    <fieldset
      disabled={disabled}
      className="min-w-0 rounded-xl border border-gray-200 bg-surface-light p-6 dark:border-slate-700 dark:bg-surface-dark"
    >
      <legend className="sr-only">{dict.podcast.classifications}</legend>
      <h2 className="mb-4 text-sm font-semibold text-gray-900 dark:text-slate-100">
        {dict.podcast.classifications}
      </h2>
      <ContentClassificationFields
        value={value}
        onChange={(manual) => onChange({ ...value, ...manual })}
        dict={dict}
      />
    </fieldset>
  );
}
