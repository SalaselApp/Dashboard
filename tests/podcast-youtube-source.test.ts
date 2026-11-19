import assert from "node:assert/strict";
import test from "node:test";
import { fetchPodcastVideo } from "../lib/youtube/podcast-source.ts";

const id = "zsZ6eqtoKxc";
const unavailable = async () => ({ ok: false as const, error: "Video not found or could not be parsed." });
const embed = (source = id) => ({ type: "video", provider_name: "YouTube", title: "هندسة الحياة الطيبة", html: `<iframe src="https://www.youtube.com/embed/${source}?feature=oembed"></iframe>` });

test("valid podcast import falls back to identity-verified first-party metadata when Innertube has no ID", async () => {
  const result = await fetchPodcastVideo(id, unavailable, async (input, init) => {
    const url = new URL(String(input));
    assert.equal(url.origin + url.pathname, "https://www.youtube.com/oembed");
    assert.equal(url.searchParams.get("url"), `https://www.youtube.com/watch?v=${id}`);
    assert.equal(init?.cache, "no-store");
    assert.equal(init?.redirect, "error");
    assert.ok(init?.signal);
    return Response.json(embed());
  });
  assert.deepEqual(result, { ok: true, data: { id, title: "هندسة الحياة الطيبة", duration: 0, uploadedAt: 0 } });
});

test("successful primary metadata keeps the original duration and release date without fallback", async () => {
  const expected = { ok: true as const, data: { id, title: "Source title", duration: 1800, uploadedAt: 123456 } };
  assert.deepEqual(await fetchPodcastVideo(id, async () => expected, async () => { throw new Error("Fallback must not run"); }), expected);
});

test("fallback refuses unavailable videos, malformed data, wrong provider and mismatched or foreign embed identity", async () => {
  const values = [
    new Response("Unavailable", { status: 404 }),
    new Response("not JSON"),
    Response.json({ ...embed(), title: "" }),
    Response.json({ ...embed(), provider_name: "Other" }),
    Response.json(embed("8PrucOug7v8")),
    Response.json({ ...embed(), html: `<iframe src="https://evil.test/embed/${id}"></iframe>` }),
    Response.json({ ...embed(), html: `<iframe src="http://www.youtube.com/embed/${id}"></iframe>` }),
  ];
  for (const response of values) assert.equal((await fetchPodcastVideo(id, unavailable, async () => response)).ok, false);
});

test("bad input cannot trigger network requests; failed fallback remains a source failure", async () => {
  const fail = async () => { throw new Error("Network unavailable"); };
  assert.equal((await fetchPodcastVideo("../not-a-video", fail, fail)).ok, false);
  assert.equal((await fetchPodcastVideo(id, unavailable, fail)).ok, false);
});
