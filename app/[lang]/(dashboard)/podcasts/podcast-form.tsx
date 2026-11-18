"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import {
  createPodcast,
  updatePodcast,
  deletePodcast,
} from "@/lib/actions/podcasts";
import type { Podcast } from "@/lib/models/podcast";
import type { Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import { localeHref } from "@/lib/i18n/navigation";
import { interpolate } from "@/lib/i18n/interpolate";
import { podcastErrorMessage } from "./podcast-errors";
import {
  PodcastArtwork,
  PodcastFields,
  PodcastClassifications,
  type PodcastFieldsState,
} from "./podcast-fields";

const primaryClasses =
  "inline-flex min-h-11 items-center gap-1.5 rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:opacity-60";

export function PodcastForm({
  initialValue,
  podcast,
  locale,
  dict,
  onBack,
}: {
  initialValue: PodcastFieldsState;
  podcast?: Podcast;
  locale: Locale;
  dict: Dictionary;
  onBack?: () => void;
}) {
  const router = useRouter();
  const t = dict.podcast;
  const [value, setValue] = useState(initialValue);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, startSaving] = useTransition();
  const [isDeleting, startDeleting] = useTransition();
  const busy = isSaving || isDeleting;

  function save() {
    setError(null);
    if (!value.title.trim()) {
      setError(t.titleRequired);
      return;
    }
    if (value.categories.size === 0) {
      setError(t.categoryRequired);
      return;
    }
    startSaving(async () => {
      try {
        const { type, style, ...details } = value;
        const input = {
          ...details,
          ...(type === null ? {} : { type }),
          ...(style === null ? {} : { style }),
          participants: value.participants
            .split(/[,،、]/)
            .map((name) => name.trim())
            .filter(Boolean),
          categories: Array.from(value.categories),
          classes: Array.from(value.classes),
        };
        const result = podcast
          ? await updatePodcast(podcast.id, input)
          : await createPodcast(input);
        if (!result.ok) {
          setError(podcastErrorMessage(result.error, dict, t.saveFailed));
          return;
        }
        const query =
          result.refresh?.delivered === false
            ? "?saved=1&refresh=failed"
            : "?saved=1";
        router.push(`${localeHref(locale, "/podcasts")}${query}`);
      } catch {
        setError(t.saveFailed);
      }
    });
  }

  function remove() {
    if (
      !podcast ||
      !confirm(interpolate(t.deleteConfirm, { name: podcast.title }))
    )
      return;
    setError(null);
    startDeleting(async () => {
      try {
        const result = await deletePodcast(podcast.id);
        if (!result.ok) {
          setError(podcastErrorMessage(result.error, dict, t.deleteFailed));
          return;
        }
        const query =
          result.refresh?.delivered === false
            ? "?deleted=1&refresh=failed"
            : "?deleted=1";
        router.push(`${localeHref(locale, "/podcasts")}${query}`);
      } catch {
        setError(t.deleteFailed);
      }
    });
  }

  return (
    <form
      action={save}
      className="flex flex-col gap-6 lg:flex-row lg:items-start"
      aria-busy={busy}
    >
      <div className="w-full shrink-0 lg:w-72">
        <PodcastArtwork
          value={value}
          onChange={setValue}
          disabled={busy}
          dict={dict}
        />
      </div>
      <div className="min-w-0 flex-1 space-y-6">
        <div className="rounded-xl border border-gray-200 bg-surface-light p-6 dark:border-slate-700 dark:bg-surface-dark">
          <PodcastFields
            value={value}
            onChange={setValue}
            disabled={busy}
            dict={dict}
          />
        </div>
        <PodcastClassifications
          value={value}
          onChange={setValue}
          disabled={busy}
          dict={dict}
        />
        {error && (
          <p role="alert" className="text-sm text-red-600 dark:text-red-400">
            {error}
          </p>
        )}
        <div className="flex flex-wrap items-center gap-3">
          <button type="submit" disabled={busy} className={primaryClasses}>
            <span aria-hidden="true" className="material-icons-round text-base">
              {isSaving ? "hourglass_empty" : "save"}
            </span>
            {isSaving ? t.saving : podcast ? t.saveChanges : t.savePodcast}
          </button>
          {onBack ? (
            <button
              type="button"
              onClick={onBack}
              disabled={busy}
              className="inline-flex min-h-11 items-center rounded-full border border-gray-300 px-5 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 focus-visible:outline-2 focus-visible:outline-primary disabled:opacity-60 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              {dict.add.back}
            </button>
          ) : (
            <Link
              href={localeHref(locale, "/podcasts")}
              aria-disabled={busy}
              tabIndex={busy ? -1 : undefined}
              className={`inline-flex min-h-11 items-center rounded-full border border-gray-300 px-5 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 focus-visible:outline-2 focus-visible:outline-primary dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800 ${busy ? "pointer-events-none opacity-60" : ""}`}
            >
              {t.cancel}
            </Link>
          )}
          {podcast && (
            <button
              type="button"
              onClick={remove}
              disabled={busy}
              className="ms-auto inline-flex min-h-11 items-center gap-1.5 rounded-full border border-red-300 px-5 py-2.5 text-sm font-medium text-red-600 transition-colors hover:bg-red-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600 disabled:opacity-60 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950/50"
            >
              <span
                aria-hidden="true"
                className="material-icons-round text-base"
              >
                {isDeleting ? "hourglass_empty" : "delete"}
              </span>
              {isDeleting ? t.deleting : t.deletePodcast}
            </button>
          )}
        </div>
      </div>
    </form>
  );
}
