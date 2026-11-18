"use client";

import { useState, useTransition } from "react";

import { fetchPodcastDetails } from "@/lib/actions/podcasts";
import type { Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import {
  emptyManualFields,
  inputClasses,
  labelClasses,
} from "../../playlists/playlist-fields";
import { podcastErrorMessage } from "../podcast-errors";
import { PodcastForm } from "../podcast-form";
import type { PodcastFieldsState } from "../podcast-fields";

export function AddPodcastForm({
  locale,
  dict,
}: {
  locale: Locale;
  dict: Dictionary;
}) {
  const [source, setSource] = useState("");
  const [initialValue, setInitialValue] = useState<PodcastFieldsState | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  const [isFetching, startFetching] = useTransition();

  function fetchSource() {
    setError(null);
    startFetching(async () => {
      try {
        const result = await fetchPodcastDetails(source);
        if (!result.ok) {
          setError(
            podcastErrorMessage(result.error, dict, dict.podcast.fetchFailed),
          );
          return;
        }
        setInitialValue({
          ...emptyManualFields(),
          title: result.data.title,
          youtubeVideoId: result.data.id,
          artworkVideoId: "",
        });
      } catch {
        setError(dict.podcast.fetchFailed);
      }
    });
  }

  if (initialValue)
    return (
      <PodcastForm
        initialValue={initialValue}
        locale={locale}
        dict={dict}
        onBack={() => setInitialValue(null)}
      />
    );

  return (
    <form
      action={fetchSource}
      aria-busy={isFetching}
      className="mx-auto flex w-full max-w-md flex-col gap-4 rounded-xl border border-gray-200 bg-surface-light p-6 dark:border-slate-700 dark:bg-surface-dark"
    >
      <div className="flex flex-col gap-1.5">
        <label htmlFor="podcast-url" className={labelClasses()}>
          {dict.podcast.youtubeVideo}
        </label>
        <input
          id="podcast-url"
          required
          value={source}
          onChange={(event) => setSource(event.target.value)}
          disabled={isFetching}
          placeholder={dict.podcast.youtubeVideoPlaceholder}
          dir="ltr"
          className={inputClasses()}
        />
      </div>
      {error && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={isFetching}
        className="inline-flex min-h-11 items-center justify-center gap-1.5 self-start rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:opacity-60"
      >
        <span aria-hidden="true" className="material-icons-round text-base">
          {isFetching ? "hourglass_empty" : "cloud_download"}
        </span>
        {isFetching ? dict.add.fetching : dict.add.fetchFromYoutube}
      </button>
    </form>
  );
}
