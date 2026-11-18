"use client";

import Image from "next/image";
import { useState } from "react";
import { DragDropProvider } from "@dnd-kit/react";
import { move } from "@dnd-kit/helpers";
import { useSortable } from "@dnd-kit/react/sortable";

import type { FetchedVideo } from "@/lib/youtube/fetch";
import { isUsableUploadedAt } from "@/lib/youtube/order";
import type { Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import { interpolate } from "@/lib/i18n/interpolate";
import {
  videoThumbnailUrl,
  fallbackThumbnailUrl,
} from "@/lib/youtube/thumbnail";

export interface EditableVideo extends FetchedVideo {
  included: boolean;
}

export interface VideoListEditorProps {
  videos: EditableVideo[];
  onChange: (videos: EditableVideo[]) => void;
  locale: Locale;
  dict: Dictionary;
}

function formatDate(unixSeconds: number, locale: Locale): string {
  if (!isUsableUploadedAt(unixSeconds)) return "";
  const date = new Date(unixSeconds * 1000);
  return date.toLocaleDateString(locale, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function formatDuration(seconds: number): string {
  if (!seconds || seconds <= 0) return "--:--";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  const mm = h > 0 ? String(m).padStart(2, "0") : String(m);
  const ss = String(s).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

/**
 * Per-video row: drag handle, thumbnail, editable title, duration, and
 * an include/exclude checkbox controlling whether the video is saved
 * with the playlist. Order (drag position) is tracked purely as the
 * array order of the `videos` prop — the caller is responsible for
 * persisting it (e.g. via `reorderVideos`) once a playlist exists.
 */
// How many videos to show before the user expands the full list. Long
// playlists (60+ episodes) otherwise push the save button far off-screen.
const INITIAL_VIDEO_COUNT = 10;

export function VideoListEditor({
  videos,
  onChange,
  locale,
  dict,
}: VideoListEditorProps) {
  const t = dict.videos;
  const [expanded, setExpanded] = useState(false);
  const includedCount = videos.filter((v) => v.included).length;

  function updateVideo(id: string, patch: Partial<EditableVideo>) {
    onChange(videos.map((v) => (v.id === id ? { ...v, ...patch } : v)));
  }

  const isCollapsible = videos.length > INITIAL_VIDEO_COUNT;
  const visibleVideos =
    isCollapsible && !expanded ? videos.slice(0, INITIAL_VIDEO_COUNT) : videos;
  const hiddenCount = videos.length - visibleVideos.length;

  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-surface-light shadow-sm dark:border-slate-700 dark:bg-surface-dark">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-gray-200 bg-gray-50 px-6 py-4 dark:border-slate-700 dark:bg-slate-800/50">
        <div>
          <h2 className="text-base font-semibold text-gray-900 dark:text-slate-100">
            {t.heading}
          </h2>
          <p className="mt-1 max-w-2xl text-xs text-gray-500 dark:text-slate-400">
            {t.importOrderHelper}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <span className="text-sm font-medium text-gray-500 dark:text-slate-400">
            {interpolate(t.countIncluded, {
              included: includedCount,
              total: videos.length,
            })}
          </span>
          {videos.length > 1 && (
            <button
              type="button"
              onClick={() => onChange([...videos].reverse())}
              className="flex min-h-11 items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium text-primary transition-colors hover:bg-gray-100 dark:hover:bg-slate-800"
            >
              <span className="material-icons-round text-base">swap_vert</span>
              {t.reverse}
            </button>
          )}
        </div>
      </div>

      <DragDropProvider
        onDragEnd={(event) => {
          if (event.canceled) return;
          onChange(move(videos, event));
        }}
      >
        <div className="divide-y divide-gray-200 dark:divide-slate-700">
          {visibleVideos.map((video, index) => (
            <VideoRow
              key={video.id}
              video={video}
              index={index}
              onMove={(offset) => {
                const next = [...videos];
                [next[index], next[index + offset]] = [
                  next[index + offset],
                  next[index],
                ];
                onChange(next);
              }}
              canMoveUp={index > 0}
              canMoveDown={index < videos.length - 1}
              onChange={(patch) => updateVideo(video.id, patch)}
              locale={locale}
              dict={dict}
            />
          ))}
        </div>
      </DragDropProvider>

      {isCollapsible && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="flex w-full items-center justify-center gap-1.5 border-t border-gray-200 bg-gray-50 px-6 py-3 text-sm font-medium text-primary transition-colors hover:bg-gray-100 dark:border-slate-700 dark:bg-slate-800/50 dark:hover:bg-slate-800"
        >
          <span className="material-icons-round text-base">
            {expanded ? "expand_less" : "expand_more"}
          </span>
          {expanded
            ? t.showFewer
            : interpolate(t.loadAll, { count: hiddenCount })}
        </button>
      )}
    </div>
  );
}

function VideoRow({
  video,
  index,
  onChange,
  onMove,
  canMoveUp,
  canMoveDown,
  locale,
  dict,
}: {
  video: EditableVideo;
  index: number;
  onChange: (patch: Partial<EditableVideo>) => void;
  onMove: (offset: -1 | 1) => void;
  canMoveUp: boolean;
  canMoveDown: boolean;
  locale: Locale;
  dict: Dictionary;
}) {
  const [imageUrl, setImageUrl] = useState(videoThumbnailUrl(video.id));
  const { ref, handleRef, isDragging } = useSortable({ id: video.id, index });

  return (
    <div
      ref={ref}
      data-video-id={video.id}
      className={`flex flex-wrap items-center gap-x-4 gap-y-2 p-4 transition-colors sm:px-6 ${
        video.included ? "" : "opacity-50"
      } ${isDragging ? "opacity-40" : ""}`}
    >
      <button
        ref={handleRef}
        type="button"
        aria-label={interpolate(dict.videos.dragToReorder, {
          title: video.title,
        })}
        className="inline-flex min-h-11 min-w-11 cursor-grab touch-none items-center justify-center text-gray-400 hover:text-gray-600 active:cursor-grabbing dark:text-slate-500 dark:hover:text-slate-300"
      >
        <span className="material-icons-round text-lg">drag_indicator</span>
      </button>

      <div className="flex shrink-0 flex-col">
        <button
          type="button"
          disabled={!canMoveUp}
          onClick={() => onMove(-1)}
          aria-label={interpolate(dict.videos.moveUp, { title: video.title })}
          className="inline-flex min-h-11 min-w-11 items-center justify-center rounded text-gray-600 hover:text-primary focus-visible:outline-2 focus-visible:outline-primary disabled:opacity-40 dark:text-slate-300"
        >
          <span aria-hidden="true" className="material-icons-round">
            arrow_upward
          </span>
        </button>
        <button
          type="button"
          disabled={!canMoveDown}
          onClick={() => onMove(1)}
          aria-label={interpolate(dict.videos.moveDown, { title: video.title })}
          className="inline-flex min-h-11 min-w-11 items-center justify-center rounded text-gray-600 hover:text-primary focus-visible:outline-2 focus-visible:outline-primary disabled:opacity-40 dark:text-slate-300"
        >
          <span aria-hidden="true" className="material-icons-round">
            arrow_downward
          </span>
        </button>
      </div>
      <span className="w-6 text-end text-sm font-medium tabular-nums text-gray-400 dark:text-slate-500">
        {index + 1}
      </span>

      <input
        type="checkbox"
        checked={video.included}
        onChange={(e) => onChange({ included: e.target.checked })}
        aria-label={interpolate(dict.videos.include, { title: video.title })}
        className="accent-primary"
      />

      <div className="relative aspect-video w-24 shrink-0 overflow-hidden rounded-md bg-gray-200 shadow-sm sm:w-28 dark:bg-slate-700">
        <Image
          alt={video.title}
          src={imageUrl}
          fill
          sizes="112px"
          className="object-cover"
          onError={() => setImageUrl(fallbackThumbnailUrl(video.id))}
        />
      </div>

      <input
        type="text"
        aria-label={interpolate(dict.videos.titleForVideo, { id: video.id })}
        value={video.title}
        onChange={(e) => onChange({ title: e.target.value })}
        disabled={!video.included}
        className="min-w-0 flex-1 basis-48 rounded-md border border-transparent bg-transparent px-2 py-1 text-sm text-gray-900 outline-none hover:border-gray-300 focus:border-primary focus:ring-1 focus:ring-primary disabled:cursor-not-allowed dark:text-slate-100 dark:hover:border-slate-600"
      />

      <div className="flex min-w-24 shrink-0 flex-col items-start gap-1 text-sm text-gray-500 dark:text-slate-400">
        <span>{formatDuration(video.duration)}</span>
        {isUsableUploadedAt(video.uploadedAt) ? (
          <time dateTime={new Date(video.uploadedAt * 1000).toISOString()}>
            {formatDate(video.uploadedAt, locale)}
          </time>
        ) : (
          <span className="inline-flex items-center gap-1 text-amber-700 dark:text-amber-300">
            <span className="material-icons-round text-sm" aria-hidden="true">
              event_busy
            </span>
            <span>{dict.videos.dateUnavailable}</span>
          </span>
        )}
      </div>
    </div>
  );
}
