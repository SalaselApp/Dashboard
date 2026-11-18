"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";

import type { Podcast } from "@/lib/models/podcast";
import { Categories, LANGUAGES, type Language } from "@/types";
import type { Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import { localeHref } from "@/lib/i18n/navigation";
import { categoryLabel } from "@/lib/i18n/labels";
import { interpolate } from "@/lib/i18n/interpolate";
import { videoThumbnailUrl, fallbackThumbnailUrl } from "@/lib/youtube/thumbnail";

const CATEGORY_OPTIONS = Object.values(Categories).filter((value): value is Categories => typeof value === "number");
const filterClasses = "min-h-11 rounded-full border border-gray-300 bg-white px-4 py-2.5 text-sm text-gray-900 outline-none focus:border-primary focus:ring-1 focus:ring-primary dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100";

export function PodcastList({ podcasts, locale, dict, notice }: { podcasts: Podcast[]; locale: Locale; dict: Dictionary; notice?: string }) {
  const t = dict.podcast;
  const [query, setQuery] = useState("");
  const [language, setLanguage] = useState<Language | "all">("all");
  const [category, setCategory] = useState<Categories | "all">("all");
  const filtered = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase(locale);
    return podcasts.filter((podcast) =>
      (!normalized || podcast.title.toLocaleLowerCase(locale).includes(normalized)) &&
      (language === "all" || podcast.language === language) &&
      (category === "all" || podcast.categories.includes(category)),
    );
  }, [podcasts, query, language, category, locale]);
  const hasFilters = query.trim() !== "" || language !== "all" || category !== "all";

  return (
    <div className="mx-auto w-full max-w-5xl flex-1 px-6 py-10">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-slate-100">{t.heading}</h1>
        <Link href={localeHref(locale, "/podcasts/new")} className="inline-flex min-h-11 items-center gap-1.5 rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
          <span aria-hidden="true" className="material-icons-round text-base">add</span>{t.addPodcast}
        </Link>
      </div>
      {notice && <p role="status" className="mb-6 text-sm text-gray-700 dark:text-slate-300">{notice}</p>}
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        <div className="relative min-w-0 flex-1">
          <span aria-hidden="true" className="material-icons-round pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-lg text-gray-500">search</span>
          <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} aria-label={t.searchPlaceholder} placeholder={t.searchPlaceholder} className={`${filterClasses} w-full pe-4 ps-10`} />
        </div>
        <select value={language} onChange={(event) => setLanguage(event.target.value as Language | "all")} aria-label={dict.dashboard.filterByLanguage} className={filterClasses}>
          <option value="all">{dict.dashboard.allLanguages}</option>
          {LANGUAGES.map((value) => <option key={value} value={value}>{value.toUpperCase()}</option>)}
        </select>
        <select value={category} onChange={(event) => setCategory(event.target.value === "all" ? "all" : Number(event.target.value) as Categories)} aria-label={t.filterByCategory} className={filterClasses}>
          <option value="all">{t.allCategories}</option>
          {CATEGORY_OPTIONS.map((value) => <option key={value} value={value}>{categoryLabel(dict, value)}</option>)}
        </select>
        {hasFilters && <button type="button" onClick={() => { setQuery(""); setLanguage("all"); setCategory("all"); }} className="inline-flex min-h-11 items-center gap-1 self-start rounded-full px-3 py-2.5 text-sm font-medium text-gray-600 hover:text-primary focus-visible:outline-2 focus-visible:outline-primary dark:text-slate-300"><span aria-hidden="true" className="material-icons-round text-base">close</span>{dict.dashboard.clear}</button>}
      </div>
      {filtered.length === 0 ? (
        <p className="py-16 text-center text-gray-500 dark:text-slate-400">{podcasts.length === 0 ? t.empty : t.emptyNoMatches}</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((podcast) => <PodcastCard key={podcast.id} podcast={podcast} locale={locale} dict={dict} />)}
        </div>
      )}
    </div>
  );
}

function PodcastCard({ podcast, locale, dict }: { podcast: Podcast; locale: Locale; dict: Dictionary }) {
  const [failed, setFailed] = useState(false);
  const totalMinutes = Math.max(0, Math.round(podcast.duration / 60));
  const hours = Math.floor(totalMinutes / 60);
  const number = new Intl.NumberFormat(locale);
  const duration = hours > 0
    ? interpolate(dict.podcast.hoursMinutes, { hours: number.format(hours), minutes: number.format(totalMinutes % 60) })
    : interpolate(dict.podcast.minutes, { count: number.format(totalMinutes) });

  return (
    <Link href={localeHref(locale, `/podcasts/${podcast.id}/edit`)} className="group flex flex-col overflow-hidden rounded-xl border border-gray-200 bg-surface-light transition-colors hover:border-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary dark:border-slate-700 dark:bg-surface-dark">
      <div className="relative aspect-video w-full overflow-hidden bg-gray-100 dark:bg-slate-800">
        <Image src={failed ? fallbackThumbnailUrl(podcast.thumbnailId) : videoThumbnailUrl(podcast.thumbnailId)} alt="" fill sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw" className="object-cover" onError={() => setFailed(true)} />
        {podcast.duration > 0 && <span className="absolute bottom-2 end-2 rounded bg-black/70 px-1.5 py-0.5 text-xs font-medium text-white">{duration}</span>}
      </div>
      <div className="flex flex-1 flex-col gap-2 p-4">
        <h2 className="line-clamp-2 break-words font-semibold text-gray-900 group-hover:text-primary dark:text-slate-100">{podcast.title}</h2>
        {podcast.description && <p className="line-clamp-2 break-words text-sm text-gray-500 dark:text-slate-400">{podcast.description}</p>}
        <div className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-1 pt-2 text-xs text-gray-500 dark:text-slate-400">
          <span className="inline-flex items-center gap-1"><span aria-hidden="true" className="material-icons-round text-sm">translate</span>{podcast.language.toUpperCase()}</span>
          <span className="inline-flex items-center gap-1"><span aria-hidden="true" className="material-icons-round text-sm">category</span>{podcast.categories.map((value) => categoryLabel(dict, value)).join(locale === "ar" ? "، " : ", ")}</span>
        </div>
      </div>
    </Link>
  );
}
