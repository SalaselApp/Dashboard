"use client";

import { useId } from "react";

import {
  Categories,
  Classes,
  ContentTypes,
  LANGUAGES,
  PresentationStyles,
  type Language,
} from "@/types";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import {
  categoryLabel,
  classLabel,
  contentTypeLabel,
  presentationStyleLabel,
} from "@/lib/i18n/labels";

const CATEGORY_OPTIONS = Object.values(Categories).filter(
  (v): v is Categories => typeof v === "number",
);
const CLASS_OPTIONS = Object.values(Classes).filter(
  (v): v is Classes => typeof v === "number",
);
const CONTENT_TYPE_OPTIONS = Object.values(ContentTypes).filter(
  (v): v is ContentTypes => typeof v === "number",
);
const PRESENTATION_STYLE_OPTIONS = Object.values(PresentationStyles).filter(
  (v): v is PresentationStyles => typeof v === "number",
);

/**
 * Editor-provided manual fields shared by the add and edit playlist
 * screens. `name` and `thumbnailId` are managed by the parent (they sit
 * alongside the thumbnail picker), so this component only owns the
 * remaining metadata fields.
 */
export interface ManualFieldsState {
  description: string;
  participants: string; // comma-separated in the UI, split on submit
  language: Language;
  type: ContentTypes;
  style: PresentationStyles;
  categories: Set<Categories>;
  classes: Set<Classes>;
}

export function emptyManualFields(): ManualFieldsState {
  return {
    description: "",
    participants: "",
    language: "ar",
    type: ContentTypes.Educational,
    style: PresentationStyles.Narration,
    categories: new Set(),
    classes: new Set(),
  };
}

export function inputClasses(): string {
  return "rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-primary focus:ring-1 focus:ring-primary dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100";
}

export function labelClasses(): string {
  return "text-sm font-medium text-gray-700 dark:text-slate-300";
}

function RequiredMark() {
  return (
    <span className="text-red-500" aria-hidden="true">
      {" "}
      *
    </span>
  );
}

function toggleSetValue<T>(set: Set<T>, value: T): Set<T> {
  const next = new Set(set);
  if (next.has(value)) {
    next.delete(value);
  } else {
    next.add(value);
  }
  return next;
}

type EditableContentMetadata = Omit<ManualFieldsState, "type" | "style"> & {
  type: ContentTypes | null;
  style: PresentationStyles | null;
};

interface MetadataFieldsProps<T extends EditableContentMetadata> {
  value: T;
  onChange: (next: T) => void;
  dict: Dictionary;
}

/** Curator-written details; the same controls serve playlists and podcasts. */
export function ContentDetailsFields<T extends EditableContentMetadata>({
  value,
  onChange,
  dict,
}: MetadataFieldsProps<T>) {
  const id = useId();
  const t = dict.playlist;
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <label htmlFor={`${id}-description`} className={labelClasses()}>
          {t.description}
        </label>
        <textarea
          id={`${id}-description`}
          value={value.description}
          onChange={(event) =>
            onChange({ ...value, description: event.target.value })
          }
          rows={3}
          className={inputClasses()}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor={`${id}-participants`} className={labelClasses()}>
          {t.participants}
        </label>
        <input
          id={`${id}-participants`}
          type="text"
          value={value.participants}
          onChange={(event) =>
            onChange({ ...value, participants: event.target.value })
          }
          className={inputClasses()}
        />
      </div>
    </div>
  );
}

/** Exact shared enum identities and options, with no podcast-specific taxonomy. */
export function ContentClassificationFields<T extends EditableContentMetadata>({
  value,
  onChange,
  dict,
}: MetadataFieldsProps<T>) {
  const id = useId();
  const t = dict.playlist;
  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <label htmlFor={`${id}-language`} className={labelClasses()}>
            {t.language}
            <RequiredMark />
          </label>
          <select
            id={`${id}-language`}
            value={value.language}
            onChange={(event) =>
              onChange({ ...value, language: event.target.value as Language })
            }
            className={inputClasses()}
          >
            {LANGUAGES.map((language) => (
              <option key={language} value={language}>
                {language}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor={`${id}-type`} className={labelClasses()}>
            {t.contentType}
            <RequiredMark />
          </label>
          <select
            id={`${id}-type`}
            value={value.type ?? ""}
            onChange={(event) =>
              onChange({
                ...value,
                type: Number(event.target.value) as ContentTypes,
              })
            }
            className={inputClasses()}
          >
            <option value="" disabled>
              {t.unclassified}
            </option>
            {CONTENT_TYPE_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {contentTypeLabel(dict, option)}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor={`${id}-style`} className={labelClasses()}>
            {t.presentationStyle}
            <RequiredMark />
          </label>
          <select
            id={`${id}-style`}
            value={value.style ?? ""}
            onChange={(event) =>
              onChange({
                ...value,
                style: Number(event.target.value) as PresentationStyles,
              })
            }
            className={inputClasses()}
          >
            <option value="" disabled>
              {t.unclassified}
            </option>
            {PRESENTATION_STYLE_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {presentationStyleLabel(dict, option)}
              </option>
            ))}
          </select>
        </div>
      </div>
      <fieldset className="flex flex-col gap-1.5">
        <legend className={labelClasses()}>
          {t.categories}
          <RequiredMark />
        </legend>
        <div className="flex flex-wrap gap-3">
          {CATEGORY_OPTIONS.map((option) => (
            <label
              key={option}
              className="flex min-h-11 cursor-pointer items-center gap-1.5 text-sm text-gray-700 dark:text-slate-300"
            >
              <input
                type="checkbox"
                checked={value.categories.has(option)}
                onChange={() =>
                  onChange({
                    ...value,
                    categories: toggleSetValue(value.categories, option),
                  })
                }
                className="accent-primary"
              />
              {categoryLabel(dict, option)}
            </label>
          ))}
        </div>
      </fieldset>
      <fieldset className="flex flex-col gap-1.5">
        <legend className={labelClasses()}>{t.classes}</legend>
        <div className="flex flex-wrap gap-3">
          {CLASS_OPTIONS.map((option) => (
            <label
              key={option}
              className="flex min-h-11 cursor-pointer items-center gap-1.5 text-sm text-gray-700 dark:text-slate-300"
            >
              <input
                type="checkbox"
                checked={value.classes.has(option)}
                onChange={() =>
                  onChange({
                    ...value,
                    classes: toggleSetValue(value.classes, option),
                  })
                }
                className="accent-primary"
              />
              {classLabel(dict, option)}
            </label>
          ))}
        </div>
      </fieldset>
    </div>
  );
}

export function PlaylistFields(props: MetadataFieldsProps<ManualFieldsState>) {
  return (
    <div className="flex flex-col gap-4">
      <ContentDetailsFields {...props} />
      <ContentClassificationFields {...props} />
    </div>
  );
}
