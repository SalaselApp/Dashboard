export type ContinuationResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };

export interface ContinuationPage<T> {
  items?: Iterable<T> | null;
  has_continuation: boolean;
  getContinuation(): Promise<ContinuationPage<T>>;
}

/**
 * Enumerates every page. A continuation failure is an error, not a partial
 * result, because sorting or saving an incomplete source is unsafe. Optional
 * keys make the seam useful for testing and remove duplicate items that a
 * source can repeat across page boundaries.
 */
export async function collectPlaylistItems<T>(
  firstPage: ContinuationPage<T>,
  getKey?: (item: T) => string | null | undefined,
): Promise<ContinuationResult<T[]>> {
  const items: T[] = [];
  const seen = new Set<string>();
  let page = firstPage;
  const visited = new Set<ContinuationPage<T>>();

  try {
    while (true) {
      if (visited.has(page)) throw new Error("Playlist continuation loop.");
      visited.add(page);
      for (const item of page.items ?? []) {
        const key = getKey?.(item);
        if (getKey && !key)
          throw new Error(
            "Playlist contains an unidentifiable or unsupported source entry; inspect it before import.",
          );
        if (key) {
          if (seen.has(key)) continue;
          seen.add(key);
        }
        items.push(item);
      }

      if (!page.has_continuation) {
        return { ok: true, data: items };
      }

      const nextPage = await page.getContinuation();
      if (!nextPage) throw new Error("Continuation returned no page.");
      page = nextPage;
    }
  } catch (err) {
    return {
      ok: false,
      error: `Failed to fetch complete playlist: ${
        err instanceof Error ? err.message : "continuation request failed."
      }`,
    };
  }
}
