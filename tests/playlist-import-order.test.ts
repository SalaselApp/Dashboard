import assert from "node:assert/strict";
import test from "node:test";

import {
  buildPlaylistVideoRows,
  findVideoPlaylistConflicts,
  hasVideoOrderChanged,
  isCurrentFetch,
  isUsableUploadedAt,
  mergeVideoDetails,
  preserveCurrentVideoDetails,
  sortVideosOldestFirst,
} from "../lib/youtube/order.ts";
import { videoDetailFromInfo } from "../lib/youtube/detail.ts";

type TestVideo = {
  id: string;
  title: string;
  duration: number;
  uploadedAt: number;
};

function video(id: string, uploadedAt: number): TestVideo {
  return { id, title: id, duration: 60, uploadedAt };
}

test("new import order is oldest first, stable for equal dates, with missing dates last", () => {
  const source = [
    video("newest", 300),
    video("equal-a", 100),
    video("missing-a", 0),
    video("equal-b", 100),
    video("oldest", 50),
    video("missing-b", 0),
  ];

  assert.deepEqual(
    sortVideosOldestFirst(source).map((item) => item.id),
    ["oldest", "equal-a", "equal-b", "newest", "missing-a", "missing-b"],
  );
  assert.deepEqual(
    source.map((item) => item.id),
    ["newest", "equal-a", "missing-a", "equal-b", "oldest", "missing-b"],
  );
});

test("video detail fetch mapping keeps unavailable dates distinguishable and preserves manual order", () => {
  const datedDetail = videoDetailFromInfo({
    basic_info: { duration: 80 },
    primary_info: { published: { text: "Jan 1, 2020" } },
  });
  const unavailableDetail = videoDetailFromInfo({
    basic_info: { duration: 80 },
    primary_info: { published: { text: null } },
  });
  assert.ok(datedDetail.uploadedAt > 0);
  assert.equal(unavailableDetail.uploadedAt, 0);

  const source = [video("first", 0), video("second", 0)];
  const enriched = mergeVideoDetails(source, [
    { id: "first", ...datedDetail },
    { id: "second", ...unavailableDetail },
  ]);
  assert.deepEqual(
    enriched.map((item) => item.uploadedAt),
    [datedDetail.uploadedAt, 0],
  );

  const manuallyOrdered = [enriched[1], enriched[0]];
  assert.equal(hasVideoOrderChanged(source, manuallyOrdered), true);
  assert.deepEqual(
    mergeVideoDetails(manuallyOrdered, [
      { id: "first", ...datedDetail },
      { id: "second", ...unavailableDetail },
    ]).map((item) => item.id),
    ["second", "first"],
  );

  const staleReorder = [video("second", 0), video("first", 0)];
  const reconciled = preserveCurrentVideoDetails(staleReorder, enriched);
  assert.deepEqual(
    reconciled.map((item) => item.id),
    ["second", "first"],
  );
  assert.equal(reconciled[1].uploadedAt, datedDetail.uploadedAt);
});

test("invalid upload dates sort stably with unavailable dates and are not displayable", () => {
  const source = [
    video("infinity", Infinity),
    video("valid", 100),
    video("negative", -1),
    video("nan", Number.NaN),
  ];

  assert.deepEqual(
    sortVideosOldestFirst(source).map((item) => item.id),
    ["valid", "infinity", "negative", "nan"],
  );
  assert.equal(isUsableUploadedAt(Infinity), false);
  assert.equal(isUsableUploadedAt(Number.NaN), false);
  assert.equal(isUsableUploadedAt(-1), false);
  assert.equal(isUsableUploadedAt(100), true);
  assert.equal(isCurrentFetch(3, 3), true);
  assert.equal(isCurrentFetch(2, 3), false);
});

test("overlap preflight identifies only videos owned by another playlist", () => {
  assert.deepEqual(
    findVideoPlaylistConflicts(
      ["same-playlist", "other-playlist", "new-video"],
      [
        { id: "same-playlist", playlist_id: "target" },
        { id: "other-playlist", playlist_id: "existing" },
      ],
      "target",
    ),
    ["other-playlist"],
  );
});

test("save payload preserves the final chosen sequence instead of sorting it", () => {
  const rows = buildPlaylistVideoRows("PL1234567890", [
    video("second", 200),
    video("first", 100),
  ]);

  assert.deepEqual(
    rows.map((row) => ({ id: row.id, position: row.position })),
    [
      { id: "second", position: 0 },
      { id: "first", position: 1 },
    ],
  );
});
