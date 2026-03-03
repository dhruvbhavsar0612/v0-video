/**
 * Background Skills
 *
 * Skills that add decorative background elements (shapes, gradients)
 * using the existing shape track system.
 */

import { v4 as uuidv4 } from "uuid";
import { registerSkill } from "./skill-registry";
import type { Skill } from "./skill-registry";
import type { VideoProject, Clip, Track } from "@/lib/schema/video-schema";

// ─── Helper ──────────────────────────────────────────────────────────

function ensureShapeTrack(project: VideoProject, trackName: string): {
  project: VideoProject;
  trackId: string;
} {
  // Prefer an existing shape track that isn't locked
  const existing = project.tracks.find((t) => t.type === "shape" && !t.locked);
  if (existing) {
    return { project, trackId: existing.id };
  }
  const newTrack: Track = {
    id: uuidv4(),
    type: "shape",
    name: trackName,
    clips: [],
    locked: false,
    visible: true,
    opacity: 1,
  };
  // Shape tracks go at the bottom (index 0)
  return {
    project: { ...project, tracks: [newTrack, ...project.tracks] },
    trackId: newTrack.id,
  };
}

function addClipToTrack(
  project: VideoProject,
  trackId: string,
  clip: Clip
): VideoProject {
  return {
    ...project,
    tracks: project.tracks.map((t) =>
      t.id === trackId ? { ...t, clips: [...t.clips, clip] } : t
    ),
  };
}

function baseClip(overrides: {
  startTime: number;
  duration: number;
  opacity?: number;
}): Pick<Clip, "id" | "startTime" | "duration" | "opacity" | "rotation" | "volume" | "muted" | "resizeMode" | "animations" | "filters" | "keyframes"> {
  return {
    id: uuidv4(),
    startTime: overrides.startTime,
    duration: overrides.duration,
    opacity: overrides.opacity ?? 1,
    rotation: 0,
    volume: 1,
    muted: false,
    resizeMode: "cover",
    animations: [],
    filters: [],
    keyframes: [],
  };
}

// ─── Skills ──────────────────────────────────────────────────────────

/**
 * gradient_background: two overlapping semi-transparent blurred circles
 * that together simulate a gradient mesh background.
 */
const gradientBackgroundSkill: Skill = {
  id: "gradient_background",
  name: "Gradient Background",
  description:
    "Adds two large overlapping blurred circles to create a soft gradient mesh background. Works great behind text or as a scene background.",
  category: "background",
  parameters: [
    { name: "color1", type: "string", description: "First gradient blob color (hex)", required: false, default: "#7C3AED" },
    { name: "color2", type: "string", description: "Second gradient blob color (hex)", required: false, default: "#2563EB" },
    { name: "startTime", type: "number", description: "Start time in seconds", required: false, default: 0 },
    { name: "duration", type: "number", description: "Duration in seconds", required: false, default: 10 },
    { name: "bgColor", type: "string", description: "Base background rectangle color (hex)", required: false, default: "#0F0F1A" },
  ],
  apply(project: VideoProject, params: Record<string, unknown>): VideoProject {
    const color1 = String(params.color1 ?? "#7C3AED");
    const color2 = String(params.color2 ?? "#2563EB");
    const startTime = Number(params.startTime ?? 0);
    const duration = Number(params.duration ?? 10);
    const bgColor = String(params.bgColor ?? "#0F0F1A");

    const { project: proj, trackId } = ensureShapeTrack(project, "Backgrounds");

    // Base background rectangle
    const bgRect: Clip = {
      ...baseClip({ startTime, duration }),
      shape: {
        shapeType: "rectangle",
        fill: bgColor,
        width: 1080,
        height: 1920,
        strokeWidth: 0,
        borderRadius: 0,
      },
    };

    // Blob 1 — top-left
    const blob1: Clip = {
      ...baseClip({ startTime, duration, opacity: 0.55 }),
      position: { x: 300, y: 500 },
      shape: {
        shapeType: "circle",
        fill: color1,
        width: 800,
        height: 800,
        strokeWidth: 0,
        borderRadius: 0,
      },
      filters: [{ type: "blur", value: 120 }],
    };

    // Blob 2 — bottom-right
    const blob2: Clip = {
      ...baseClip({ startTime, duration, opacity: 0.5 }),
      position: { x: 780, y: 1500 },
      shape: {
        shapeType: "circle",
        fill: color2,
        width: 700,
        height: 700,
        strokeWidth: 0,
        borderRadius: 0,
      },
      filters: [{ type: "blur", value: 100 }],
    };

    let result = addClipToTrack(proj, trackId, bgRect);
    result = addClipToTrack(result, trackId, blob1);
    result = addClipToTrack(result, trackId, blob2);
    return result;
  },
};

/**
 * scene_intro: a dark overlay bar that wipes to reveal a scene title.
 * Creates a rectangle + text overlay pair for a cinematic scene intro.
 */
const sceneIntroSkill: Skill = {
  id: "scene_intro",
  name: "Scene Intro",
  description:
    "Adds a cinematic scene intro: a dark horizontal bar slides in with a scene title. Great for chapter headings or location titles.",
  category: "background",
  parameters: [
    { name: "sceneTitle", type: "string", description: "Scene title text", required: true },
    { name: "startTime", type: "number", description: "Start time in seconds", required: false, default: 0 },
    { name: "duration", type: "number", description: "Duration in seconds", required: false, default: 3 },
    { name: "barColor", type: "string", description: "Background bar color (hex or rgba)", required: false, default: "rgba(0,0,0,0.8)" },
    { name: "textColor", type: "string", description: "Title text color (hex)", required: false, default: "#FFFFFF" },
  ],
  apply(project: VideoProject, params: Record<string, unknown>): VideoProject {
    const sceneTitle = String(params.sceneTitle ?? "Scene");
    const startTime = Number(params.startTime ?? 0);
    const duration = Number(params.duration ?? 3);
    const barColor = String(params.barColor ?? "rgba(0,0,0,0.8)");
    const textColor = String(params.textColor ?? "#FFFFFF");

    // Add dark bar on shape track
    const { project: proj1, trackId: shapeTrackId } = ensureShapeTrack(project, "Scene Intros");

    const bar: Clip = {
      ...baseClip({ startTime, duration }),
      position: { x: 540, y: 960 },
      shape: {
        shapeType: "rectangle",
        fill: barColor,
        width: 1080,
        height: 180,
        strokeWidth: 0,
        borderRadius: 0,
      },
      animations: [{ type: "slideIn", direction: "left", duration: 0.4, easing: "easeOut", delay: 0 }],
    };

    let result = addClipToTrack(proj1, shapeTrackId, bar);

    // Add text track
    const existingTextTrack = result.tracks.find((t) => t.type === "text");
    let textTrackId: string;
    if (existingTextTrack) {
      textTrackId = existingTextTrack.id;
    } else {
      const newTextTrack: Track = {
        id: uuidv4(),
        type: "text",
        name: "Scene Titles",
        clips: [],
        locked: false,
        visible: true,
        opacity: 1,
      };
      result = { ...result, tracks: [...result.tracks, newTextTrack] };
      textTrackId = newTextTrack.id;
    }

    const titleClip: Clip = {
      ...baseClip({ startTime, duration }),
      position: { x: 540, y: 960 },
      text: {
        content: sceneTitle,
        fontSize: 52,
        fontFamily: "Inter",
        fontWeight: "bold",
        color: textColor,
        textAlign: "center",
        lineHeight: 1.2,
        letterSpacing: 4,
        maxWidth: 900,
      },
      animations: [{ type: "fadeIn", duration: 0.3, easing: "easeOut", delay: 0.25 }],
    };

    return addClipToTrack(result, textTrackId, titleClip);
  },
};

// ─── Register All ────────────────────────────────────────────────────

registerSkill(gradientBackgroundSkill);
registerSkill(sceneIntroSkill);
