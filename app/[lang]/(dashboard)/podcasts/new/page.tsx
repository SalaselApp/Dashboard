import Link from "next/link";
import { DirectionalIcon } from "@/app/[lang]/directional-icon";

import { getLocaleConfig } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { localeHref } from "@/lib/i18n/navigation";
import { AddPodcastForm } from "./add-podcast-form";

export default async function NewPodcastPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  const locale = getLocaleConfig(lang).code;
  const dict = await getDictionary(locale);

  return (
    <div className="mx-auto w-full max-w-5xl px-6 py-10">
      <Link href={localeHref(locale, "/podcasts")} className="mb-6 inline-flex min-h-11 items-center gap-1 text-sm font-medium text-primary hover:underline">
        <DirectionalIcon className="text-base">arrow_back</DirectionalIcon>
        {dict.podcast.backToPodcasts}
      </Link>
      <h1 className="mb-6 text-2xl font-bold text-gray-900 dark:text-slate-100">{dict.podcast.newHeading}</h1>
      <AddPodcastForm locale={locale} dict={dict} />
    </div>
  );
}
