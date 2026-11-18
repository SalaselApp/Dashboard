import Link from "next/link";
import { DirectionalIcon } from "@/app/[lang]/directional-icon";
import { localeHref } from "@/lib/i18n/navigation";
import { notFound } from "next/navigation";

import { getPodcastForAdmin } from "@/lib/queries/podcasts";
import { getLocaleConfig } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { EditPodcastForm } from "./edit-podcast-form";

export const dynamic = "force-dynamic";

export default async function EditPodcastPage({ params }: { params: Promise<{ lang: string; id: string }> }) {
  const { lang, id } = await params;
  const locale = getLocaleConfig(lang).code;
  const [dict, podcast] = await Promise.all([getDictionary(locale), getPodcastForAdmin(id)]);
  if (!podcast) notFound();
  return (
    <div className="mx-auto w-full max-w-5xl px-6 py-10">
      <Link href={localeHref(locale, "/podcasts")} className="mb-6 inline-flex min-h-11 items-center gap-1 text-sm font-medium text-primary hover:underline">
        <DirectionalIcon className="text-base">arrow_back</DirectionalIcon>
        {dict.podcast.backToPodcasts}
      </Link>
      <h1 className="mb-6 text-2xl font-bold text-gray-900 dark:text-slate-100">{dict.podcast.editHeading}</h1>
      <EditPodcastForm locale={locale} dict={dict} podcast={podcast} />
    </div>
  );
}
