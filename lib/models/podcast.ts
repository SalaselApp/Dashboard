import type {
  Categories,
  Classes,
  ContentTypes,
  PresentationStyles,
  Language,
} from "@/types";

/** Raw `podcasts` row as stored in shared Supabase. */
export interface PodcastRow {
  id: string;
  title: string;
  description: string;
  thumbnail_id: string;
  youtube_video_id: string;
  language: string;
  categories: number[];
  participants?: string[] | null;
  type?: number | null;
  style?: number | null;
  classes?: number[] | null;
  duration: number;
  uploaded_at: number;
  published_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Podcast {
  id: string;
  title: string;
  description: string;
  thumbnailId: string;
  youtubeVideoId: string;
  language: Language;
  categories: Categories[];
  participants: string[];
  type: ContentTypes | null;
  style: PresentationStyles | null;
  classes: Classes[];
  duration: number;
  uploadedAt: number;
  publishedAt: string | null;
}

export function rowToPodcast(row: PodcastRow): Podcast {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    thumbnailId: row.thumbnail_id,
    youtubeVideoId: row.youtube_video_id,
    language: row.language as Language,
    categories: row.categories as Categories[],
    participants: row.participants ?? [],
    type: row.type == null ? null : (row.type as ContentTypes),
    style: row.style == null ? null : (row.style as PresentationStyles),
    classes: (row.classes ?? []) as Classes[],
    duration: row.duration,
    uploadedAt: row.uploaded_at,
    publishedAt: row.published_at,
  };
}
