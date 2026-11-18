import assert from "node:assert/strict";
import test from "node:test";
import { collectPlaylistItems } from "../lib/youtube/continuation.ts";

test("playlist item collection follows every continuation and removes duplicate IDs", async () => {
  const page3 = {
    items: [{ id: "third" }, { id: "duplicate" }],
    has_continuation: false,
    async getContinuation() {
      throw new Error("not called");
    },
  };
  const page2 = {
    items: [{ id: "second" }, { id: "duplicate" }],
    has_continuation: true,
    async getContinuation() {
      return page3;
    },
  };
  const page1 = {
    items: [{ id: "first" }, { id: "duplicate" }],
    has_continuation: true,
    async getContinuation() {
      return page2;
    },
  };

  const result = await collectPlaylistItems(page1, (item) => item.id);

  assert.deepEqual(result, {
    ok: true,
    data: [
      { id: "first" },
      { id: "duplicate" },
      { id: "second" },
      { id: "third" },
    ],
  });
});

test("playlist item collection holds on continuation failure instead of returning a partial snapshot", async () => {
  const result = await collectPlaylistItems(
    {
      items: [{ id: "first" }],
      has_continuation: true,
      async getContinuation() {
        throw new Error("continuation unavailable");
      },
    },
    (item) => item.id,
  );

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.match(result.error, /complete playlist/i);
    assert.match(result.error, /continuation unavailable/);
  }
});

test("complete enumeration refuses unidentifiable entries and continuation loops", async () => {
  const incomplete = await collectPlaylistItems(
    {
      items: [{ id: "normal" }, {}],
      has_continuation: false,
      getContinuation: async () => {
        throw new Error("unused");
      },
    },
    (item) => item.id,
  );
  assert.equal(incomplete.ok, false);
  const loop = {
    items: [{ id: "normal" }],
    has_continuation: true,
    getContinuation: async () => loop,
  };
  assert.equal((await collectPlaylistItems(loop, (item) => item.id)).ok, false);
});

test("playlist listing includes Shorts and Reel source identities for explicit review", async () => {
  const { parseListingItem } = await import("../lib/youtube/listing.ts");
  const { YTNodes } = await import("youtubei.js");
  const reel = Object.assign(Object.create(YTNodes.ReelItem.prototype), {
    id: "aaaaaaaaaa0",
    title: { text: "Short episode" },
  });
  const short = Object.assign(
    Object.create(YTNodes.ShortsLockupView.prototype),
    {
      on_tap_endpoint: { payload: { videoId: "aaaaaaaaaa1" } },
      overlay_metadata: { primary_text: { text: "Another episode" } },
    },
  );
  assert.deepEqual(parseListingItem(reel), {
    id: "aaaaaaaaaa0",
    title: "Short episode",
    duration: 0,
  });
  assert.deepEqual(parseListingItem(short), {
    id: "aaaaaaaaaa1",
    title: "Another episode",
    duration: 0,
  });
});
