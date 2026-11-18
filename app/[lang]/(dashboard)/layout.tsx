import { redirect } from "next/navigation";

import { hasValidSession } from "@/lib/auth/session";
import { getLocaleConfig } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { localeHref } from "@/lib/i18n/navigation";
import { DashboardHeader } from "./dashboard-header";

export default async function DashboardLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  const locale = getLocaleConfig(lang).code;

  const signedIn = await hasValidSession();
  if (!signedIn) {
    redirect(localeHref(locale, "/login"));
  }

  const dict = await getDictionary(locale);

  return (
    <div className="flex flex-1 flex-col bg-background-light dark:bg-background-dark">
      <DashboardHeader locale={locale} dict={dict} />
      <main className="flex flex-1 flex-col">{children}</main>
    </div>
  );
}
