/**
 * Color Grade Skills
 *
 * 15 one-shot color grading presets. Each skill applies a set of
 * CSS filter values to every clip on every visual track in the project.
 *
 * Uses the existing `filters: Filter[]` field on Clip — no schema change needed.
 * Filters are REPLACED (not appended) so calling the same or different preset
 * twice does not stack.
 */

import { registerSkill } from "./skill-registry";
import type { Skill } from "./skill-registry";
import type { VideoProject, Filter } from "@/lib/schema/video-schema";

// ─── Helper ──────────────────────────────────────────────────────────

/** Apply a filter preset to every visual clip in the project. */
function applyFiltersToProject(
  project: VideoProject,
  filters: Filter[]
): VideoProject {
  const updatedTracks = project.tracks.map((track) => ({
    ...track,
    clips: track.clips.map((clip) => ({
      ...clip,
      filters,
    })),
  }));
  return { ...project, tracks: updatedTracks };
}

// ─── Preset Definitions ──────────────────────────────────────────────

interface ColorGradePreset {
  id: string;
  name: string;
  description: string;
  filters: Filter[];
}

const COLOR_GRADE_PRESETS: ColorGradePreset[] = [
  {
    id: "color_grade_cinematic",
    name: "Cinematic",
    description: "Subtle desaturation + slight contrast boost for a film-like look",
    filters: [
      { type: "contrast", value: 1.1 },
      { type: "saturate", value: 0.85 },
      { type: "brightness", value: 0.97 },
    ],
  },
  {
    id: "color_grade_warm",
    name: "Warm",
    description: "Warm golden tones, boosted brightness and saturation",
    filters: [
      { type: "sepia", value: 0.18 },
      { type: "saturate", value: 1.3 },
      { type: "brightness", value: 1.05 },
    ],
  },
  {
    id: "color_grade_cold",
    name: "Cold",
    description: "Cool blue tones with slightly reduced warmth",
    filters: [
      { type: "hue-rotate", value: 200 },
      { type: "saturate", value: 0.9 },
      { type: "brightness", value: 1.0 },
    ],
  },
  {
    id: "color_grade_vintage",
    name: "Vintage",
    description: "Faded film look with sepia tones and slight blur softness",
    filters: [
      { type: "sepia", value: 0.5 },
      { type: "contrast", value: 0.85 },
      { type: "brightness", value: 1.05 },
      { type: "saturate", value: 0.75 },
    ],
  },
  {
    id: "color_grade_dramatic",
    name: "Dramatic",
    description: "High contrast, deep shadows, punchy look",
    filters: [
      { type: "contrast", value: 1.4 },
      { type: "saturate", value: 1.1 },
      { type: "brightness", value: 0.92 },
    ],
  },
  {
    id: "color_grade_moody",
    name: "Moody",
    description: "Desaturated with crushed blacks for a brooding atmosphere",
    filters: [
      { type: "contrast", value: 1.25 },
      { type: "saturate", value: 0.65 },
      { type: "brightness", value: 0.88 },
    ],
  },
  {
    id: "color_grade_vibrant",
    name: "Vibrant",
    description: "Punchy saturation and brightness for social media pop",
    filters: [
      { type: "saturate", value: 1.6 },
      { type: "contrast", value: 1.05 },
      { type: "brightness", value: 1.08 },
    ],
  },
  {
    id: "color_grade_noir",
    name: "Noir",
    description: "Full black-and-white with high contrast",
    filters: [
      { type: "grayscale", value: 1 },
      { type: "contrast", value: 1.3 },
      { type: "brightness", value: 0.95 },
    ],
  },
  {
    id: "color_grade_golden_hour",
    name: "Golden Hour",
    description: "Warm amber sunset glow with lifted shadows",
    filters: [
      { type: "sepia", value: 0.25 },
      { type: "hue-rotate", value: -15 },
      { type: "saturate", value: 1.4 },
      { type: "brightness", value: 1.1 },
    ],
  },
  {
    id: "color_grade_pastel",
    name: "Pastel",
    description: "Soft, airy pastel tones with reduced contrast",
    filters: [
      { type: "contrast", value: 0.75 },
      { type: "brightness", value: 1.15 },
      { type: "saturate", value: 0.7 },
    ],
  },
  {
    id: "color_grade_neon",
    name: "Neon",
    description: "Hyper-saturated neon cyberpunk aesthetic",
    filters: [
      { type: "saturate", value: 2.2 },
      { type: "contrast", value: 1.2 },
      { type: "hue-rotate", value: 30 },
    ],
  },
  {
    id: "color_grade_sunset",
    name: "Sunset",
    description: "Orange-pink hues reminiscent of a coastal sunset",
    filters: [
      { type: "sepia", value: 0.35 },
      { type: "hue-rotate", value: -20 },
      { type: "saturate", value: 1.5 },
      { type: "brightness", value: 1.05 },
    ],
  },
  {
    id: "color_grade_cool_blue",
    name: "Cool Blue",
    description: "Crisp cool-blue corporate / tech look",
    filters: [
      { type: "hue-rotate", value: 210 },
      { type: "saturate", value: 1.2 },
      { type: "contrast", value: 1.05 },
    ],
  },
  {
    id: "color_grade_soft_glow",
    name: "Soft Glow",
    description: "Slightly overexposed with a dreamy soft feel",
    filters: [
      { type: "brightness", value: 1.18 },
      { type: "contrast", value: 0.88 },
      { type: "saturate", value: 0.9 },
    ],
  },
  {
    id: "color_grade_matte",
    name: "Matte",
    description: "Instagram matte look — lifted blacks, reduced contrast",
    filters: [
      { type: "contrast", value: 0.82 },
      { type: "brightness", value: 1.08 },
      { type: "saturate", value: 0.9 },
    ],
  },
];

// ─── Register All Color Grade Skills ────────────────────────────────

for (const preset of COLOR_GRADE_PRESETS) {
  const skill: Skill = {
    id: preset.id,
    name: preset.name,
    description: preset.description,
    category: "color-grade",
    parameters: [],
    apply(project: VideoProject): VideoProject {
      return applyFiltersToProject(project, preset.filters);
    },
  };
  registerSkill(skill);
}
