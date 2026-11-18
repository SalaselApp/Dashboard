import { redirect } from "next/navigation";

import { getLocaleConfig } from "@/lib/i18n/config";
import { localeHref } from "@/lib/i18n/navigation";

export default async function PodcastPreviewPage({ params }: { params: Promise<{ lang: string; id: string }> }) {
  const { lang, id } = await params;
  const locale = getLocaleConfig(lang).code;
  redirect(localeHref(locale, `/podcasts/${encodeURIComponent(id)}/edit`));
}
