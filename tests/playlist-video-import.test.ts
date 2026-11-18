import assert from "node:assert/strict";
import test from "node:test";
import { createClient } from "@supabase/supabase-js";
import type { VideoRow } from "../lib/models/video.ts";
import { readImportVideos, writeImportVideos } from "../lib/videos/import.ts";
const row = (id: string, playlist_id = "target"): VideoRow => ({
  id,
  playlist_id,
  title: id,
  duration: 60,
  uploaded_at: 100,
  position: 0,
});
function fixture(
  initial: VideoRow[] = [],
  beforeWrite?: (rows: Map<string, VideoRow>) => void,
) {
  const rows = new Map(initial.map((r) => [r.id, structuredClone(r)])),
    calls: Array<{ method: string; url: URL; body: unknown; prefer: string }> =
      [];
  const client = createClient("https://catalog.test", "fake", {
    auth: { persistSession: false },
    global: {
      fetch: async (input, init) => {
        const url = new URL(String(input)),
          method = init?.method ?? "GET",
          body = init?.body ? JSON.parse(String(init.body)) : undefined,
          prefer = new Headers(init?.headers).get("prefer") ?? "";
        calls.push({ method, url, body, prefer });
        if (method === "POST") {
          beforeWrite?.(rows);
          for (const r of body as VideoRow[]) {
            if (
              !rows.has(r.id) ||
              !prefer.includes("resolution=ignore-duplicates")
            )
              rows.set(r.id, structuredClone(r));
          }
          return new Response(null, { status: 201 });
        }
        if (method === "PATCH") {
          const id = url.searchParams.get("id")?.slice(3),
            owner = url.searchParams.get("playlist_id")?.slice(3),
            r = id ? rows.get(id) : undefined;
          if (r && r.playlist_id === owner) {
            Object.assign(r, body);
            return new Response(JSON.stringify([{ id }]));
          }
          return new Response("[]");
        }
        const filter = url.searchParams.get("id") ?? "",
          ids = filter.startsWith("in.(")
            ? filter
                .slice(4, -1)
                .split(",")
                .map((s) => s.replaceAll('"', ""))
            : [];
        return new Response(
          JSON.stringify(
            ids
              .flatMap((id) => (rows.has(id) ? [rows.get(id)] : []))
              .slice(0, 1000),
          ),
          { headers: { "content-type": "application/json" } },
        );
      },
    },
  });
  return { client, rows, calls };
}
test("racing new import never takes ownership of a video inserted after preflight", async () => {
  const f = fixture([], (rows) => rows.set("video", row("video", "other")));
  const result = await writeImportVideos(
    f.client,
    "target",
    [row("video")],
    [],
  );
  assert.equal(result.ok, false);
  assert.equal(f.rows.get("video")?.playlist_id, "other");
  assert.ok(
    f.calls
      .find((c) => c.method === "POST")
      ?.prefer.includes("resolution=ignore-duplicates"),
  );
});
test("ownership-constrained updates preserve same-playlist recreate behavior", async () => {
  const f = fixture([row("video")]);
  const desired = { ...row("video"), title: "Edited title", position: 4 };
  assert.equal(
    (await writeImportVideos(f.client, "target", [desired], [row("video")])).ok,
    true,
  );
  assert.deepEqual(f.rows.get("video"), desired);
  const patch = f.calls.find((c) => c.method === "PATCH")!;
  assert.equal(patch.url.searchParams.get("playlist_id"), "eq.target");
  assert.ok(!("playlist_id" in (patch.body as object)));
});
test("deleted and reinserted video under another owner is held without updating it", async () => {
  const f = fixture([row("video")], (rows) =>
    rows.set("video", row("video", "other")),
  );
  assert.equal(
    (
      await writeImportVideos(
        f.client,
        "target",
        [{ ...row("video"), title: "changed" }],
        [row("video")],
      )
    ).ok,
    false,
  );
  assert.deepEqual(f.rows.get("video"), row("video", "other"));
});
test("racing same-owner inserts with different metadata never report success", async () => {
  const f = fixture([], (rows) =>
    rows.set("video", { ...row("video"), position: 9 }),
  );
  assert.equal(
    (await writeImportVideos(f.client, "target", [row("video")], [])).ok,
    false,
  );
});
test("ownership checks cover more than the REST row cap and do not miss late conflicts", async () => {
  const initial = Array.from({ length: 1201 }, (_, i) =>
      row(`video${i}`, i === 1200 ? "other" : "target"),
    ),
    f = fixture(initial);
  const result = await readImportVideos(
    f.client,
    initial.map((r) => r.id),
  );
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.data.length, 1201);
    assert.equal(result.data.at(-1)?.playlist_id, "other");
  }
  assert.ok(f.calls.length > 1);
  assert.ok(
    f.calls.every((c) => Number(c.url.searchParams.get("limit")) <= 200),
  );
});
