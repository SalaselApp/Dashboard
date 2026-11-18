# Issue #53 evidence — new playlist import order

Status: `ready_for_qa`; overall mission remains `pending_gates` until consolidated review and user-managed QA.

## Engineering slice

- New playlist imports sort once, after video-date enrichment, oldest-to-newest using each video's YouTube upload/release date.
- Equal valid dates retain source order. Missing/invalid dates use timestamp `0`, remain in source order after dated videos, and show an inline icon plus translated text (`Date unavailable` / `التاريخ غير متاح`).
- Manual drag/reverse order sets an import-local manual-order guard. Later detail batches, title edits, stale event payloads, and stale fetch generations preserve the current order and retain newly enriched metadata.
- Save rows receive positions from the final editor sequence. Existing playlist management was not changed and remains position-ordered; no existing-catalog autosort was added.
- Playlist preview now enumerates every youtubei.js continuation page, rejects continuation/page failure instead of returning a partial source, and removes duplicate video IDs across pages before sorting.
- Save performs a server-side overlap preflight before playlist upsert. Videos already owned by another catalog playlist are held; videos already owned by the target playlist remain eligible for the existing upsert behavior.
- Video save validation now rejects non-finite duration/upload timestamps. No schema/model refactor or transaction/migration was added.
- No Discord or production/shared data changes.

## Consolidated review disposition

### Finding 1 — global video-ID upsert can move catalog membership: FIXED

Baseline verified in the shared schema: `videos.id` is the global primary key (`supabase/migrations/20260623000000_init_schema.sql`), while the prior `createPlaylist` path wrote the playlist row before globally upserting video rows.

`lib/actions/playlists.ts:117-145` now selects existing owners by requested video ID and blocks cross-playlist conflicts before any playlist write. Same-playlist rows remain allowed for the established re-create/upsert flow. Pure conflict behavior is covered by the focused test below.

### Finding 2 — playlist-first nontransactional save: NOT_APPLICABLE to #53

This is a pre-existing parent risk, not a regression from #53. Baseline and current code still write the playlist first (`lib/actions/playlists.ts:152-162`), then write videos (`:164-170`). The #53 ordering change only extracts row construction into `buildPlaylistVideoRows`; it does not change write ordering or widen the partial-save window.

The child write error path returns `{ ok: false, error: ... }` at `lib/actions/playlists.ts:168-170`; it does not report false success. No rollback/delete of published rows, transaction migration, or catalog-model redesign was introduced, per approved scope. Partial outcomes remain an explicit live/curation reconciliation limitation pending the parent architecture decision.

### Finding 3 — playlist listing previously stopped at `playlist.items`: FIXED

Bundled youtubei.js 17.2 sources/types confirm `Playlist.has_continuation` and `Playlist.getContinuation(): Promise<Playlist>`. `lib/youtube/fetch.ts:158-185` now uses the injectable `fetchPage` seam plus `collectPlaylistItems` to enumerate all pages. Continuation failure returns `Failed to fetch complete playlist: ...`; no partial preview reaches sorting or save. Duplicate IDs are removed in source order.

Focused tests cover continuation traversal, duplicate IDs, and continuation failure hold behavior.

## Self-review corrections

- Invalid dates (`NaN`, `Infinity`, negative, and out-of-range finite values) are treated as unavailable by the comparator and display path, preserving stable unavailable order and preventing invalid `toISOString()` calls. Server validation rejects non-finite values.
- Fetch generations are guarded in `add-playlist-form.tsx`; an older listing/detail request cannot overwrite a newer fetch or a reset-to-input state.
- Existing approved UI direction remains: inline missing-date text/icon, Arabic/English localization, manual order preservation, and no redesign of existing playlist management.

## TDD and focused verification

RED:

```text
node --experimental-strip-types --test tests/playlist-import-order.test.ts
SyntaxError: The requested module "../lib/youtube/fetch.ts" does not provide an export named "collectPlaylistItems"
```

GREEN and focused checks:

```text
node --experimental-strip-types --test tests/playlist-import-order.test.ts
7 pass, 0 fail
./node_modules/.bin/tsc --noEmit
exit 0
./node_modules/.bin/eslint 'app/[lang]/(dashboard)/playlists/new/add-playlist-form.tsx' 'app/[lang]/(dashboard)/playlists/new/video-list-editor.tsx' lib/actions/playlists.ts lib/youtube/fetch.ts lib/youtube/continuation.ts lib/youtube/detail.ts lib/youtube/order.ts tests/playlist-import-order.test.ts
exit 0
git diff --check
exit 0
```

Tests cover date sort/stability/invalid dates, YouTube detail mapping, enrichment/manual-reorder race reconciliation, stale-fetch guard, overlap preflight, full continuation enumeration, page failure hold, duplicate suppression, and final save payload order.

## Secret-free Admin QA packet

- **Entry/role:** authenticated Admin editor at `/{lang}/playlists/new`; run once with `ar` (RTL) and once with `en` (LTR).
- **Setup/data:** use an authorized YouTube playlist fixture whose source order differs from upload-date order and includes, where available, equal-date and unavailable-date videos. Do not use credentials in notes or screenshots. Production writes require separate explicit approval.
- **Happy path:** fetch playlist; expect all source pages represented, oldest dated video first, newest dated video last, equal dates source-relative, unavailable dates last and visibly flagged with text/icon; reverse or drag to a custom order; edit a title while detail loading; wait for enrichment; save.
- **Overlap hold:** use a fixture containing a video already owned by another catalog playlist; expect save to stop with an overlap error before playlist metadata changes. Do not force an overlapping production write.
- **Continuation failure:** automated seam coverage proves partial pages are held; no live failure injection is claimed.
- **Save/public comparison:** read the saved Admin playlist and corresponding public playlist; expect exact final selected sequence. This is user-operated browser verification and was not run by this implementation slice.
- **Existing catalog:** open an existing playlist with known non-date order; expect its saved order unchanged after visiting/editing metadata. Do not save changes unless authorized.
- **Responsive/locales:** check Arabic RTL and English LTR on desktop and narrow mobile widths; expect logical control placement, wrapping without horizontal scrolling, keyboard focus/drag controls, and missing-date meaning conveyed by text plus icon rather than color alone.
- **Cleanup:** remove only an explicitly authorized test playlist through the existing Admin flow; otherwise leave data untouched. No production cleanup was performed.

### Risks and limits

- Browser rendering, live YouTube fetch reliability, saved/public live verification, production writes, mobile/RTL behavior, and partial-save recovery remain unverified pending user QA and parent architecture decisions.
- Context7 MCP documentation lookup was unavailable in this terminal session; exact installed youtubei.js 17.2 bundled declarations/source were inspected instead.
- No full build, full-system suite, live catalog write, or service operation was performed.

### Out of scope

Transactional catalog saving, rollback/delete of published rows, schema changes, migrations, existing-catalog autosort, browser QA, live YouTube fetches, production writes, and full-system test suites.

## Codex verification continuation — 18 November 2026

Rechecked Pi's work and retained its oldest-first import behavior. Added complete Shorts/Reel identity parsing and failure on unknown entries/continuation loops instead of silently calling a partial preview complete. New focused total: **9 tests passed**; TypeScript, scoped ESLint and diff checks passed.

The local curation browser binding additionally needs these reviewable Admin UI changes: visible read-only podcast source/publication state, associated playlist source/name labels, video identity/title controls, and accessible import up/down buttons. Existing styling and Arabic/English copy are retained. Real Chromium curation fixtures exercise approved course order/exclusions and overlap prevention, plus podcast create/readback/public verification. These fixtures intercept production origins and do not prove the new UI is deployed.

Read-only production inspection authenticated successfully and observed 92 playlist cards and 0 podcast cards. An existing playlist edit page did not expose the new readback controls. **Deployment and live Arabic/English desktop/mobile QA remain pending.** No production save, deletion, deployment, commit or push was performed. See sibling `Salasel/docs/features/local-discord-curation/engineering-qa.md` for current runtime evidence and controlled exercise gates.

## Release verification — 18 November 2026

All Admin tests: `node --experimental-strip-types --test tests/*.test.ts` — **35 passed**. Playlist source enumeration tests now live in `tests/youtube-playlist-source.test.ts`; import order/ownership tests remain in `tests/playlist-import-order.test.ts` (nine combined). TypeScript and full ESLint passed. `npm run build` completed successfully with Next.js 16.2.10, including production compilation, type checking and route generation. No catalog data was changed by these checks.

Release scope also includes read-only authenticated podcast source/publication status, playlist name/source labels, video identity controls and accessible up/down import buttons, in Arabic and English. Production deploys are Git-connected to `SalaselApp/Dashboard` main on Netlify project `salasel-admin`.

### Final release safety correction

Release review identified a check/write race and REST result truncation in the initial ownership preflight. `lib/videos/import.ts` now chunks reads into at most 200 exact primary keys, inserts new videos with `ignoreDuplicates: true`, and updates existing same-playlist rows only under matching `id` and `playlist_id` predicates while omitting ownership from the update payload. Full chunked readback compares all requested metadata and positions. A racing conflict reports a partial-save error; it never falls back to ownership-changing upsert.

Five additional regressions exercise actual Supabase client requests against an intercepted in-memory REST fixture: racing competing inserts, deletion/reinsertion under another owner, safe same-playlist recreation, same-owner metadata conflict, and 1,201-row ownership lookup. Final verification: **40 Admin tests passed; full ESLint passed; production build/type checking passed.** Independent follow-up review approved the race and row-cap fixes. Playlist/video writes remain nontransactional; a reported partial outcome still requires inspection rather than automatic retry.
