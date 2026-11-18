import assert from "node:assert/strict";
import test from "node:test";

import { createPodcastService } from "../lib/podcasts/service.ts";

const input = {
  title: "Episode",
  description: "Description",
  artworkVideoId: "dQw4w9WgXcQ",
  youtubeVideoId: "M7lc1UVf-VE",
  language: "ar",
  categories: [0],
};

function service(
  overrides: Partial<Parameters<typeof createPodcastService>[0]> = {},
) {
  let authorized = false;
  let updatePayload: Record<string, unknown> | undefined;
  const instance = createPodcastService({
    requireSession: async () => {
      authorized = true;
    },
    fetchVideo: async (id) => ({
      ok: true as const,
      data: { id, duration: 10, uploadedAt: 1 },
    }),
    insertPodcast: async () => ({ error: null }),
    getPublication: async () => ({
      data: { published_at: "2026-01-01T00:00:00.000Z" },
      error: null,
    }),
    deletePodcast: async () => ({ data: { id: "pod_123" }, error: null }),
    updatePodcast: async (_id, payload) => {
      updatePayload = payload;
      return { data: { id: "pod_123" }, error: null };
    },
    revalidatePublicContent: async () => ({ delivered: true }),
    now: () => "now",
    ...overrides,
  });
  return {
    instance,
    authorized: () => authorized,
    updatePayload: () => updatePayload,
  };
}

test("editing requires authorization and retains the stable podcast ID", async () => {
  const fake = service();
  const result = await fake.instance.update("pod_123", input);

  assert.equal(fake.authorized(), true);
  assert.deepEqual(result, {
    ok: true,
    data: undefined,
    refresh: { delivered: true },
  });
  assert.deepEqual(fake.updatePayload(), {
    title: "Episode",
    description: "Description",
    thumbnail_id: "dQw4w9WgXcQ",
    youtube_video_id: "M7lc1UVf-VE",
    language: "ar",
    categories: [0],
    duration: 10,
    uploaded_at: 1,
    updated_at: "now",
    published_at: "2026-01-01T00:00:00.000Z",
  });
});

test("withdrawal reports cache-refresh failure rather than claiming public removal", async () => {
  const fake = service({
    revalidatePublicContent: async () => ({
      delivered: false,
      error: "webhook unavailable",
    }),
  });
  const result = await fake.instance.withdraw("pod_123");

  assert.deepEqual(result, {
    ok: true,
    data: undefined,
    refresh: { delivered: false, error: "webhook unavailable" },
  });
});

test("anonymous write is denied before any podcast mutation", async () => {
  let called = false;
  const fake = service({
    requireSession: async () => {
      throw new Error("Unauthorized");
    },
    updatePodcast: async () => {
      called = true;
      return { data: null, error: null };
    },
  });

  await assert.rejects(() => fake.instance.withdraw("pod_123"), /Unauthorized/);
  assert.equal(called, false);
});

test("invalid update refuses its database write", async () => {
  let called = false;
  const fake = service({
    updatePodcast: async () => {
      called = true;
      return { data: null, error: null };
    },
  });
  const result = await fake.instance.update("pod_123", {
    ...input,
    categories: [],
  });

  assert.deepEqual(result, {
    ok: false,
    error: "Select at least one valid category.",
  });
  assert.equal(called, false);
});

test("saving a new podcast makes it public in one insert and refreshes discovery", async () => {
  let payload: Record<string, unknown> | undefined;
  let refreshed = 0;
  const fake = service({
    createId: () => "pod_123",
    insertPodcast: async (row) => {
      assert.equal(fake.authorized(), true);
      payload = row;
      return { error: null };
    },
    revalidatePublicContent: async () => {
      refreshed++;
      return { delivered: true };
    },
  });
  assert.deepEqual(await fake.instance.create(input), {
    ok: true,
    data: "pod_123",
    refresh: { delivered: true },
  });
  assert.equal(payload?.published_at, "now");
  assert.equal(payload?.youtube_video_id, input.youtubeVideoId);
  assert.equal(payload?.thumbnail_id, input.artworkVideoId);
  assert.equal(refreshed, 1);
});

test("a saved podcast still succeeds when public cache refresh fails", async () => {
  const fake = service({
    createId: () => "pod_123",
    revalidatePublicContent: async () => ({
      delivered: false,
      error: "offline",
    }),
  });
  assert.deepEqual(await fake.instance.create(input), {
    ok: true,
    data: "pod_123",
    refresh: { delivered: false, error: "offline" },
  });
});

test("invalid and anonymous creation never contacts YouTube or inserts a podcast", async () => {
  let contacted = false;
  const fake = service({
    fetchVideo: async () => {
      contacted = true;
      throw new Error("must not fetch");
    },
    insertPodcast: async () => {
      contacted = true;
      return { error: null };
    },
  });
  assert.equal(
    (await fake.instance.create({ ...input, categories: [] })).ok,
    false,
  );
  assert.equal(contacted, false);
  const denied = service({
    requireSession: async () => {
      throw new Error("Unauthorized");
    },
    insertPodcast: async () => {
      contacted = true;
      return { error: null };
    },
  });
  await assert.rejects(() => denied.instance.create(input), /Unauthorized/);
  assert.equal(contacted, false);
});

test("failed creation does not claim success or refresh public data", async () => {
  let refreshed = false;
  const fake = service({
    insertPodcast: async () => ({ error: { message: "duplicate source" } }),
    revalidatePublicContent: async () => {
      refreshed = true;
      return { delivered: true };
    },
  });
  assert.deepEqual(await fake.instance.create(input), {
    ok: false,
    error: "Failed to create podcast: duplicate source",
  });
  assert.equal(refreshed, false);
});

test("save makes an older unpublished episode available without a second publish action", async () => {
  const fake = service({
    getPublication: async () => ({ data: { published_at: null }, error: null }),
  });
  assert.equal((await fake.instance.update("pod_123", input)).ok, true);
  assert.equal(fake.updatePayload()?.published_at, "now");
});

test("editing preserves the original publication time", async () => {
  const fake = service();
  await fake.instance.update("pod_123", input);
  assert.equal(fake.updatePayload()?.published_at, "2026-01-01T00:00:00.000Z");
});

test("missing or unreadable publication state prevents an update", async () => {
  let changed = false;
  const missing = service({
    getPublication: async () => ({ data: null, error: null }),
    updatePodcast: async () => {
      changed = true;
      return { data: null, error: null };
    },
  });
  assert.deepEqual(await missing.instance.update("pod_123", input), {
    ok: false,
    error: "Podcast was not found.",
  });
  const failed = service({
    getPublication: async () => ({
      data: null,
      error: { message: "unavailable" },
    }),
    updatePodcast: async () => {
      changed = true;
      return { data: null, error: null };
    },
  });
  assert.equal((await failed.instance.update("pod_123", input)).ok, false);
  assert.equal(changed, false);
});

test("deleting removes only the requested episode and refreshes discovery", async () => {
  let removed = "";
  const fake = service({
    deletePodcast: async (id) => {
      assert.equal(fake.authorized(), true);
      removed = id;
      return { data: { id }, error: null };
    },
  });
  assert.deepEqual(await fake.instance.remove("pod_123"), {
    ok: true,
    data: undefined,
    refresh: { delivered: true },
  });
  assert.equal(removed, "pod_123");
});

test("invalid or anonymous deletion cannot change podcast data", async () => {
  let removed = false;
  const fake = service({
    deletePodcast: async () => {
      removed = true;
      return { data: null, error: null };
    },
  });
  assert.equal((await fake.instance.remove("not-a-podcast")).ok, false);
  const denied = service({
    requireSession: async () => {
      throw new Error("Unauthorized");
    },
    deletePodcast: async () => {
      removed = true;
      return { data: null, error: null };
    },
  });
  await assert.rejects(() => denied.instance.remove("pod_123"), /Unauthorized/);
  assert.equal(removed, false);
});

test("deletion failures and missing records are reported without refreshing", async () => {
  let refreshed = false;
  const options = {
    revalidatePublicContent: async () => {
      refreshed = true;
      return { delivered: true };
    },
  };
  const failed = service({
    ...options,
    deletePodcast: async () => ({
      data: null,
      error: { message: "unavailable" },
    }),
  });
  assert.deepEqual(await failed.instance.remove("pod_123"), {
    ok: false,
    error: "Failed to delete podcast: unavailable",
  });
  const missing = service({
    ...options,
    deletePodcast: async () => ({ data: null, error: null }),
  });
  assert.deepEqual(await missing.instance.remove("pod_123"), {
    ok: false,
    error: "Podcast was not found.",
  });
  assert.equal(refreshed, false);
});

test("management accepts existing canonical podcast IDs with underscores", async () => {
  const fake = service();
  assert.equal((await fake.instance.update("pod_ui_review_1", input)).ok, true);
  assert.equal((await fake.instance.remove("pod_ui_review_1")).ok, true);
});

test("creation persists all curator metadata rather than a YouTube description", async () => {
  let payload: Record<string, unknown> | undefined;
  const fake = service({
    createId: () => "pod_curated",
    fetchVideo: async (id) => ({
      ok: true,
      data: {
        id,
        duration: 10,
        uploadedAt: 1,
        description: "YouTube promotional description",
      },
    }),
    insertPodcast: async (row) => {
      payload = row;
      return { error: null };
    },
  });
  const curated = {
    ...input,
    description: "Curator-written summary",
    participants: ["Host", "Guest"],
    type: 2,
    style: 1,
    classes: [1, 3],
  };
  assert.equal((await fake.instance.create(curated)).ok, true);
  assert.equal(payload?.description, curated.description);
  assert.deepEqual(payload?.participants, curated.participants);
  assert.equal(payload?.type, 2);
  assert.equal(payload?.style, 1);
  assert.deepEqual(payload?.classes, [1, 3]);
});

test("editing round-trips participants, audience and classifications without changing publication identity", async () => {
  const fake = service();
  const result = await fake.instance.update("pod_123", {
    ...input,
    description: "",
    participants: ["New guest"],
    type: 1,
    style: 3,
    classes: [2],
  });
  assert.equal(result.ok, true);
  assert.deepEqual(fake.updatePayload()?.participants, ["New guest"]);
  assert.equal(fake.updatePayload()?.description, "");
  assert.equal(fake.updatePayload()?.type, 1);
  assert.equal(fake.updatePayload()?.style, 3);
  assert.deepEqual(fake.updatePayload()?.classes, [2]);
  assert.equal(fake.updatePayload()?.published_at, "2026-01-01T00:00:00.000Z");
});
