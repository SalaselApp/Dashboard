"use client";

import type { Podcast } from "@/lib/models/podcast";
import type { Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import { PodcastForm } from "../../podcast-form";

export function EditPodcastForm({
  locale,
  dict,
  podcast,
}: {
  locale: Locale;
  dict: Dictionary;
  podcast: Podcast;
}) {
  return (
    <PodcastForm
      podcast={podcast}
      locale={locale}
      dict={dict}
      initialValue={{
        title: podcast.title,
        description: podcast.description,
        youtubeVideoId: podcast.youtubeVideoId,
        artworkVideoId:
          podcast.thumbnailId === podcast.youtubeVideoId
            ? ""
            : podcast.thumbnailId,
        language: podcast.language,
        participants: podcast.participants.join(", "),
        type: podcast.type,
        style: podcast.style,
        categories: new Set(podcast.categories),
        classes: new Set(podcast.classes),
      }}
    />
  );
}
