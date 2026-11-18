"use client";

import Image from "next/image";
import brandMark from "@/public/salasel-logo.png";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { logout } from "@/lib/actions/auth";
import type { Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import { localeHref } from "@/lib/i18n/navigation";
import { LanguageSwitcher } from "../language-switcher";

export function DashboardHeader({ locale, dict }: { locale: Locale; dict: Dictionary }) {
  const pathname = usePathname();
  const podcastsActive = pathname.startsWith(localeHref(locale, "/podcasts"));
  const sections = [
    { href: "/", label: dict.navigation.playlists, active: !podcastsActive },
    { href: "/podcasts", label: dict.navigation.podcasts, active: podcastsActive },
  ];

  return (
    <header className="border-b border-gray-200 bg-surface-light px-4 py-3 sm:px-6 dark:border-slate-700 dark:bg-surface-dark">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
        <Link href={localeHref(locale, "/")} className="flex shrink-0 items-center gap-2 rounded-md focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary">
          <Image src={brandMark} width={32} height={32} alt="" className="h-8 w-8 object-contain" />
          <span className="font-bold text-slate-900 dark:text-slate-100">{dict.appTitle}</span>
        </Link>
        <nav aria-label={dict.navigation.label} className="order-3 flex w-full items-center gap-1 text-sm font-medium sm:order-none sm:w-auto sm:me-auto">
          {sections.map((section) => (
            <Link key={section.href} href={localeHref(locale, section.href)} aria-current={section.active ? "page" : undefined} className={`inline-flex min-h-11 items-center rounded-full px-4 py-2 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${section.active ? "bg-teal-50 text-teal-800 dark:bg-teal-950 dark:text-teal-200" : "text-gray-600 hover:bg-gray-50 hover:text-primary dark:text-slate-300 dark:hover:bg-slate-800"}`}>
              {section.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-3 sm:gap-4">
          <LanguageSwitcher currentLocale={locale} label={dict.languageSwitcherLabel} />
          <form action={logout}>
            <input type="hidden" name="locale" value={locale} />
            <button type="submit" className="flex min-h-11 cursor-pointer items-center gap-1 rounded-md text-sm text-gray-600 hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary dark:text-slate-300">
              <span aria-hidden="true" className="material-icons-round text-base">logout</span>
              {dict.signOut}
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}
