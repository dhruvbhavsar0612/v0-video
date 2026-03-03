/**
 * Typography Skills
 *
 * Composite skills that create fully styled text clips and insert them
 * into the project. Each skill adds a new text track (or appends to an
 * existing text track) with sensible defaults that the agent can override.
 */

import { v4 as uuidv4 } from "uuid";
import { registerSkill } from "./skill-registry";
import type { Skill } from "./skill-registry";
import type { VideoProject, Clip, Track } from "@/lib/schema/video-schema";

// ─── Helper ──────────────────────────────────────────────────────────

/** Find the first text track or create one and append it. */
function ensureTextTrack(project: VideoProject, trackName: string): {
  project: VideoProject;
  trackId: string;
} {
  const existing = project.tracks.find((t) => t.type === "text");
  if (existing) {
    return { project, trackId: existing.id };
  }
  const newTrack: Track = {
    id: uuidv4(),
    type: "text",
    name: trackName,
    clips: [],
    locked: false,
    visible: true,
    opacity: 1,
  };
  return {
    project: { ...project, tracks: [...project.tracks, newTrack] },
    trackId: newTrack.id,
  };
}

/** Add a clip to a specific track by id. */
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

/** Build the clip base fields shared by all typography clips. */
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

/** lower_third: banner at the bottom 1/3 with name + title */
const lowerThirdSkill: Skill = {
  id: "lower_third",
  name: "Lower Third",
  description:
    "Adds a professional lower-third text overlay with a primary name line and a smaller subtitle line. Slides in from below.",
  category: "typography",
  parameters: [
    { name: "primaryText", type: "string", description: "Main name or headline text", required: true },
    { name: "subtitleText", type: "string", description: "Secondary subtitle text (role, title, etc.)", required: false, default: "" },
    { name: "startTime", type: "number", description: "Start time in seconds", required: false, default: 0 },
    { name: "duration", type: "number", description: "Duration in seconds", required: false, default: 4 },
    { name: "accentColor", type: "string", description: "Accent / background color (hex)", required: false, default: "#7C3AED" },
  ],
  apply(project: VideoProject, params: Record<string, unknown>): VideoProject {
    const primaryText = String(params.primaryText ?? "Name");
    const subtitleText = String(params.subtitleText ?? "");
    const startTime = Number(params.startTime ?? 0);
    const duration = Number(params.duration ?? 4);
    const accentColor = String(params.accentColor ?? "#7C3AED");

    const { project: proj, trackId } = ensureTextTrack(project, "Lower Thirds");

    const primaryClip: Clip = {
      ...baseClip({ startTime, duration }),
      position: { x: 540, y: 1650 },
      text: {
        content: primaryText,
        fontSize: 52,
        fontFamily: "Inter",
        fontWeight: "bold",
        color: "#FFFFFF",
        backgroundColor: accentColor,
        backgroundPadding: 16,
        backgroundBorderRadius: 6,
        textAlign: "left",
        lineHeight: 1.2,
        letterSpacing: 0,
        maxWidth: 900,
      },
      animations: [{ type: "slideIn", direction: "up", duration: 0.4, easing: "easeOut", delay: 0 }],
    };

    let result = addClipToTrack(proj, trackId, primaryClip);

    if (subtitleText) {
      const subtitleClip: Clip = {
        ...baseClip({ startTime, duration }),
        position: { x: 540, y: 1720 },
        text: {
          content: subtitleText,
          fontSize: 32,
          fontFamily: "Inter",
          fontWeight: "400",
          color: "#E2E8F0",
          textAlign: "left",
          lineHeight: 1.3,
          letterSpacing: 1,
          maxWidth: 900,
        },
        animations: [{ type: "slideIn", direction: "up", duration: 0.4, easing: "easeOut", delay: 0.1 }],
      };
      result = addClipToTrack(result, trackId, subtitleClip);
    }

    return result;
  },
};

/** title_card: full-screen centred title with optional subtitle */
const titleCardSkill: Skill = {
  id: "title_card",
  name: "Title Card",
  description:
    "Creates a full-screen centred title with a large headline and optional tagline. Fade in/out.",
  category: "typography",
  parameters: [
    { name: "title", type: "string", description: "Main title text", required: true },
    { name: "tagline", type: "string", description: "Optional tagline beneath title", required: false, default: "" },
    { name: "startTime", type: "number", description: "Start time in seconds", required: false, default: 0 },
    { name: "duration", type: "number", description: "Duration in seconds", required: false, default: 5 },
    { name: "titleColor", type: "string", description: "Title text color (hex)", required: false, default: "#FFFFFF" },
    { name: "taglineColor", type: "string", description: "Tagline text color (hex)", required: false, default: "#A78BFA" },
  ],
  apply(project: VideoProject, params: Record<string, unknown>): VideoProject {
    const title = String(params.title ?? "Title");
    const tagline = String(params.tagline ?? "");
    const startTime = Number(params.startTime ?? 0);
    const duration = Number(params.duration ?? 5);
    const titleColor = String(params.titleColor ?? "#FFFFFF");
    const taglineColor = String(params.taglineColor ?? "#A78BFA");

    const { project: proj, trackId } = ensureTextTrack(project, "Titles");

    const titleClip: Clip = {
      ...baseClip({ startTime, duration }),
      position: { x: 540, y: tagline ? 900 : 960 },
      text: {
        content: title,
        fontSize: 80,
        fontFamily: "Inter",
        fontWeight: "bold",
        color: titleColor,
        textAlign: "center",
        lineHeight: 1.2,
        letterSpacing: -1,
        maxWidth: 900,
      },
      animations: [
        { type: "fadeIn", duration: 0.6, easing: "easeOut", delay: 0 },
        { type: "fadeOut", duration: 0.5, easing: "easeIn", delay: 0 },
      ],
    };

    let result = addClipToTrack(proj, trackId, titleClip);

    if (tagline) {
      const taglineClip: Clip = {
        ...baseClip({ startTime, duration }),
        position: { x: 540, y: 1010 },
        text: {
          content: tagline,
          fontSize: 36,
          fontFamily: "Inter",
          fontWeight: "400",
          color: taglineColor,
          textAlign: "center",
          lineHeight: 1.4,
          letterSpacing: 2,
          maxWidth: 800,
        },
        animations: [
          { type: "fadeIn", duration: 0.6, easing: "easeOut", delay: 0.25 },
          { type: "fadeOut", duration: 0.5, easing: "easeIn", delay: 0 },
        ],
      };
      result = addClipToTrack(result, trackId, taglineClip);
    }

    return result;
  },
};

/** kinetic_title: word-by-word animated title using kineticTypography */
const kineticTitleSkill: Skill = {
  id: "kinetic_title",
  name: "Kinetic Title",
  description:
    "Creates a kinetic typography title where each word animates in with staggered timing. Great for hook text and attention-grabbing headlines.",
  category: "typography",
  parameters: [
    { name: "text", type: "string", description: "Title text (will be animated word by word)", required: true },
    { name: "style", type: "string", description: "Animation style: fade | slideUp | bounce | scale | wave", required: false, default: "slideUp" },
    { name: "startTime", type: "number", description: "Start time in seconds", required: false, default: 0 },
    { name: "duration", type: "number", description: "Duration in seconds", required: false, default: 4 },
    { name: "fontSize", type: "number", description: "Font size in pixels", required: false, default: 72 },
    { name: "color", type: "string", description: "Text color (hex)", required: false, default: "#FFFFFF" },
    { name: "staggerMs", type: "number", description: "Stagger delay between words in ms", required: false, default: 100 },
  ],
  apply(project: VideoProject, params: Record<string, unknown>): VideoProject {
    const text = String(params.text ?? "Your Title Here");
    const style = String(params.style ?? "slideUp") as "fade" | "slideUp" | "bounce" | "scale" | "wave";
    const startTime = Number(params.startTime ?? 0);
    const duration = Number(params.duration ?? 4);
    const fontSize = Number(params.fontSize ?? 72);
    const color = String(params.color ?? "#FFFFFF");
    const staggerMs = Number(params.staggerMs ?? 100);

    const { project: proj, trackId } = ensureTextTrack(project, "Kinetic Titles");

    const clip: Clip = {
      ...baseClip({ startTime, duration }),
      position: { x: 540, y: 960 },
      text: {
        content: text,
        fontSize,
        fontFamily: "Inter",
        fontWeight: "bold",
        color,
        textAlign: "center",
        lineHeight: 1.3,
        letterSpacing: 0,
        maxWidth: 900,
        kineticTypography: {
          mode: "word",
          style,
          staggerMs,
        },
      },
    };

    return addClipToTrack(proj, trackId, clip);
  },
};

/** quote_card: centred quote with attribution */
const quoteCardSkill: Skill = {
  id: "quote_card",
  name: "Quote Card",
  description:
    "Adds a styled quote block with quote text and optional author attribution. Scales in with a spring animation.",
  category: "typography",
  parameters: [
    { name: "quote", type: "string", description: "The quote text", required: true },
    { name: "author", type: "string", description: "Author attribution (optional)", required: false, default: "" },
    { name: "startTime", type: "number", description: "Start time in seconds", required: false, default: 0 },
    { name: "duration", type: "number", description: "Duration in seconds", required: false, default: 5 },
    { name: "quoteColor", type: "string", description: "Quote text color (hex)", required: false, default: "#FFFFFF" },
    { name: "accentColor", type: "string", description: "Accent / author color (hex)", required: false, default: "#A78BFA" },
  ],
  apply(project: VideoProject, params: Record<string, unknown>): VideoProject {
    const quote = String(params.quote ?? "");
    const author = String(params.author ?? "");
    const startTime = Number(params.startTime ?? 0);
    const duration = Number(params.duration ?? 5);
    const quoteColor = String(params.quoteColor ?? "#FFFFFF");
    const accentColor = String(params.accentColor ?? "#A78BFA");

    const { project: proj, trackId } = ensureTextTrack(project, "Quotes");

    const quoteClip: Clip = {
      ...baseClip({ startTime, duration }),
      position: { x: 540, y: author ? 900 : 960 },
      text: {
        content: `"${quote}"`,
        fontSize: 52,
        fontFamily: "Inter",
        fontWeight: "600",
        color: quoteColor,
        textAlign: "center",
        lineHeight: 1.5,
        letterSpacing: 0,
        maxWidth: 880,
      },
      animations: [{ type: "scaleIn", duration: 0.5, easing: "spring", delay: 0 }],
    };

    let result = addClipToTrack(proj, trackId, quoteClip);

    if (author) {
      const authorClip: Clip = {
        ...baseClip({ startTime, duration }),
        position: { x: 540, y: 1050 },
        text: {
          content: `— ${author}`,
          fontSize: 32,
          fontFamily: "Inter",
          fontWeight: "400",
          color: accentColor,
          textAlign: "center",
          lineHeight: 1.3,
          letterSpacing: 1,
          maxWidth: 700,
        },
        animations: [{ type: "fadeIn", duration: 0.5, easing: "easeOut", delay: 0.3 }],
      };
      result = addClipToTrack(result, trackId, authorClip);
    }

    return result;
  },
};

// ─── Register All ────────────────────────────────────────────────────

registerSkill(lowerThirdSkill);
registerSkill(titleCardSkill);
registerSkill(kineticTitleSkill);
registerSkill(quoteCardSkill);
