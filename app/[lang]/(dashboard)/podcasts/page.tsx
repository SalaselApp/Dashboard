import { listPodcastsForAdmin } from "@/lib/queries/podcasts";
import { getLocaleConfig } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { PodcastList } from "./podcast-list";

export const dynamic = "force-dynamic";

export default async function PodcastsPage({ params, searchParams }: {
  params: Promise<{ lang: string }>;
  searchParams: Promise<{ saved?: string; deleted?: string; refresh?: string }>;
}) {
  const { lang } = await params;
  const locale = getLocaleConfig(lang).code;
  const [dict, podcasts, query] = await Promise.all([
    getDictionary(locale), listPodcastsForAdmin(), searchParams,
  ]);
  const notice = query.deleted === "1"
    ? query.refresh === "failed" ? dict.podcast.deleteRefreshWarning : dict.podcast.deletedNotice
    : query.saved === "1"
      ? query.refresh === "failed" ? dict.podcast.refreshWarning : dict.podcast.savedNotice
      : undefined;

  return <PodcastList podcasts={podcasts} locale={locale} dict={dict} notice={notice} />;
}
