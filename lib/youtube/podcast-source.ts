import type { FetchResult, FetchedVideo } from "./fetch.ts";

/** Podcast import needs source identity/title, not streaming data. Some serverless
 * IPs receive an Innertube response without basic_info; verify YouTube's own
 * oEmbed identity instead. Unknown duration/date remain explicitly zero. */
export async function fetchPodcastVideo(
  id: string,
  primary: (id: string) => Promise<FetchResult<FetchedVideo>>,
  request: typeof fetch = fetch,
): Promise<FetchResult<FetchedVideo>> {
  if (!/^[A-Za-z0-9_-]{11}$/.test(id))
    return { ok: false, error: "Invalid YouTube video ID." };
  let original: FetchResult<FetchedVideo>;
  try {
    original = await primary(id);
    if (original.ok && original.data.id === id && original.data.title.trim())
      return original;
  } catch {
    original = { ok: false, error: "YouTube metadata unavailable." };
  }
  try {
    const url = new URL("https://www.youtube.com/oembed");
    url.searchParams.set("url", `https://www.youtube.com/watch?v=${id}`);
    url.searchParams.set("format", "json");
    const response = await request(url, {
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) throw new Error("Source unavailable.");
    const data: unknown = await response.json();
    if (!data || typeof data !== "object") throw new Error("Invalid metadata.");
    const value = data as Record<string, unknown>;
    if (
      value.type !== "video" || value.provider_name !== "YouTube" ||
      typeof value.title !== "string" || !value.title.trim() ||
      typeof value.html !== "string"
    ) throw new Error("Incomplete metadata.");
    // Never render this HTML. Only inspect the official, exact embed source.
    const matches = [...value.html.matchAll(/<iframe\b[^>]*\bsrc\s*=\s*(["'])(.*?)\1/gi)];
    if (matches.length !== 1) throw new Error("Ambiguous source.");
    const source = new URL(matches[0][2]);
    if (
      source.origin !== "https://www.youtube.com" ||
      source.username || source.password || source.pathname !== `/embed/${id}`
    ) throw new Error("Mismatched source.");
    return { ok: true, data: { id, title: value.title.trim(), duration: 0, uploadedAt: 0 } };
  } catch {
    return {
      ok: false,
      error: original.ok ? "YouTube source identity could not be verified." : original.error,
    };
  }
}
