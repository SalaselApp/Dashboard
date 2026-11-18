import assert from "node:assert/strict";
import test from "node:test";

import { validatePodcastInput } from "../lib/podcasts/validation.ts";

test("accepts an independent YouTube podcast and preserves shared category identities", () => {
  const result = validatePodcastInput({
    title: "  Episode title  ",
    description: "  Episode description  ",
    artworkVideoId: "dQw4w9WgXcQ",
    youtubeVideoId: "M7lc1UVf-VE",
    language: "ar",
    categories: [0, 2],
  });

  assert.deepEqual(result, {
    valid: true,
    data: {
      title: "Episode title",
      description: "Episode description",
      artworkVideoId: "dQw4w9WgXcQ",
      youtubeVideoId: "M7lc1UVf-VE",
      language: "ar",
      categories: [0, 2],
    },
  });
});

test("accepts raw IDs and supported canonical YouTube URL forms", () => {
  for (const youtubeVideoId of [
    "M7lc1UVf-VE",
    "https://www.youtube.com/watch?v=M7lc1UVf-VE",
    "https://youtube.com/watch?v=M7lc1UVf-VE&feature=share",
    "https://m.youtube.com/watch?v=M7lc1UVf-VE",
    "https://youtu.be/M7lc1UVf-VE?t=30",
  ]) {
    const result = validatePodcastInput({
      title: "Episode title",
      description: "Description",
      artworkVideoId: "dQw4w9WgXcQ",
      youtubeVideoId,
      language: "ar",
      categories: [0],
    });
    assert.equal(result.valid, true);
  }
});

test("rejects lookalike, credentialed, query-embedded, and non-HTTPS YouTube URLs", () => {
  for (const youtubeVideoId of [
    "https://evil.example/watch?v=M7lc1UVf-VE",
    "https://evil.example/?next=https://youtu.be/M7lc1UVf-VE",
    "https://youtube.com.evil.example/watch?v=M7lc1UVf-VE",
    "https://youtube.com@evil.example/watch?v=M7lc1UVf-VE",
    "http://www.youtube.com/watch?v=M7lc1UVf-VE",
    "ftp://youtu.be/M7lc1UVf-VE",
    "https://www.youtube.com/watch?v=M7lc1UVf-VE.evil",
  ]) {
    const result = validatePodcastInput({
      title: "Episode title",
      description: "Description",
      artworkVideoId: "dQw4w9WgXcQ",
      youtubeVideoId,
      language: "ar",
      categories: [0],
    });
    assert.deepEqual(result, {
      valid: false,
      error: "Enter a valid YouTube video URL or ID.",
    });
  }
});

test("rejects a podcast without a supported YouTube source or category", () => {
  assert.deepEqual(
    validatePodcastInput({
      title: "Episode title",
      description: "Description",
      artworkVideoId: "not-a-video-id",
      youtubeVideoId: "https://example.com/media.mp3",
      language: "ar",
      categories: [],
    }),
    { valid: false, error: "Enter a valid YouTube video URL or ID." },
  );
});

test("optional artwork defaults to the normalized source video", () => {
  for (const artworkVideoId of [undefined, "", "   "]) {
    const result = validatePodcastInput({
      title: "Episode",
      description: "Description",
      youtubeVideoId: "https://youtu.be/M7lc1UVf-VE",
      artworkVideoId,
      language: "ar",
      categories: [0],
    });
    assert.equal(result.valid, true);
    if (result.valid) assert.equal(result.data.artworkVideoId, "M7lc1UVf-VE");
  }
});

test("nonempty invalid optional artwork is rejected instead of silently replaced", () => {
  const result = validatePodcastInput({
    title: "Episode",
    description: "Description",
    youtubeVideoId: "M7lc1UVf-VE",
    artworkVideoId: "https://evil.example/image.png",
    language: "ar",
    categories: [0],
  });
  assert.deepEqual(result, {
    valid: false,
    error: "Enter a valid YouTube artwork video URL or ID.",
  });
});

const curatedInput = {
  title: "Episode",
  description: "Our own summary",
  youtubeVideoId: "M7lc1UVf-VE",
  language: "ar",
  categories: [0],
  participants: ["  Host  ", "Guest"],
  type: 1,
  style: 2,
  classes: [0, 3],
};

test("retains curator participants and the exact playlist taxonomy identities", () => {
  const result = validatePodcastInput(curatedInput);
  assert.equal(result.valid, true);
  if (!result.valid) return;
  assert.deepEqual(result.data.participants, ["Host", "Guest"]);
  assert.equal(result.data.type, 1);
  assert.equal(result.data.style, 2);
  assert.deepEqual(result.data.classes, [0, 3]);
});

test("editor-written description can be empty or omitted just like a playlist", () => {
  for (const description of ["", "   ", undefined]) {
    const result = validatePodcastInput({ ...curatedInput, description });
    assert.equal(result.valid, true);
    if (result.valid) assert.equal(result.data.description, "");
  }
});

test("rejects unsupported classifications and malformed participant data", () => {
  for (const change of [
    { type: 3 },
    { type: "1" },
    { style: 4 },
    { classes: [99] },
    { classes: "kids" },
    { participants: "Guest" },
    { participants: [123] },
  ]) {
    assert.equal(
      validatePodcastInput({ ...curatedInput, ...change }).valid,
      false,
      JSON.stringify(change),
    );
  }
});
