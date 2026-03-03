/**
 * Video Project JSON Schema
 *
 * This is the core data model for the entire application.
 * The AI agent generates and manipulates instances of VideoProject.
 * The Remotion Player interprets this schema to render video previews.
 *
 * Design principles:
 * - Flat and predictable structure for LLM reliability
 * - All time values in seconds (not frames) for human/AI readability
 * - Assets separated into a registry to avoid duplication
 * - Tracks are layered bottom-to-top (index 0 = background)
 */

import { z } from "zod";

// ─── Enums & Constants ───────────────────────────────────────────────

export const ASPECT_RATIOS = ["9:16", "16:9", "1:1", "4:5"] as const;
export const FPS_OPTIONS = [24, 30, 60] as const;

export const ANIMATION_TYPES = [
  "fadeIn",
  "fadeOut",
  "slideIn",
  "slideOut",
  "scaleIn",
  "scaleOut",
  "bounce",
  "typewriter",
  "blur",
  "none",
] as const;

export const ANIMATION_DIRECTIONS = ["left", "right", "up", "down"] as const;

export const EASING_TYPES = [
  "linear",
  "easeIn",
  "easeOut",
  "easeInOut",
  "spring",
] as const;

export const TRANSITION_TYPES = [
  "fade",
  "dissolve",
  "wipe",
  "slide",
  "zoom",
  "glitch",
  "none",
] as const;

export const TRACK_TYPES = [
  "video",
  "image",
  "text",
  "shape",
  "sticker",
] as const;

export const ASSET_TYPES = ["video", "image", "audio", "generated"] as const;

export const ASSET_SOURCES = [
  "upload",
  "stock",
  "ai-generated",
  "url",
] as const;

export const FONT_WEIGHTS = [
  "normal",
  "bold",
  "100",
  "200",
  "300",
  "400",
  "500",
  "600",
  "700",
  "800",
  "900",
] as const;

export const TEXT_ALIGNMENTS = ["left", "center", "right"] as const;

export const RESIZE_MODES = [
  "cover",
  "contain",
  "stretch",
  "none",
] as const;

// ─── Sub-schemas ─────────────────────────────────────────────────────

export const PositionSchema = z.object({
  x: z.number().describe("Horizontal position in pixels from left"),
  y: z.number().describe("Vertical position in pixels from top"),
});

export const ScaleSchema = z.object({
  x: z.number().min(0).default(1).describe("Horizontal scale factor"),
  y: z.number().min(0).default(1).describe("Vertical scale factor"),
});

export const DimensionsSchema = z.object({
  width: z.number().positive(),
  height: z.number().positive(),
});

export const ColorSchema = z
  .string()
  .regex(/^#([0-9a-fA-F]{3,8})$|^rgba?\(|^hsla?\(/)
  .describe("CSS color value (#hex, rgb(), rgba(), hsl())");

// ─── Animation Schema ────────────────────────────────────────────────

export const AnimationSchema = z.object({
  type: z.enum(ANIMATION_TYPES).describe("Animation type"),
  direction: z
    .enum(ANIMATION_DIRECTIONS)
    .optional()
    .describe("Direction for slide animations"),
  duration: z
    .number()
    .positive()
    .max(10)
    .describe("Animation duration in seconds"),
  easing: z.enum(EASING_TYPES).default("easeInOut").describe("Easing function"),
  delay: z
    .number()
    .min(0)
    .default(0)
    .describe("Delay before animation starts in seconds"),
});

// ─── Keyframe Schema ─────────────────────────────────────────────────

export const KeyframeSchema = z.object({
  time: z
    .number()
    .min(0)
    .max(1)
    .describe("Relative time within clip (0=start, 1=end)"),
  opacity: z
    .number()
    .min(0)
    .max(1)
    .optional()
    .describe("Absolute opacity at this keyframe (0=transparent, 1=opaque)"),
  x: z
    .number()
    .optional()
    .describe("Absolute X position in pixels at this keyframe"),
  y: z
    .number()
    .optional()
    .describe("Absolute Y position in pixels at this keyframe"),
  scaleX: z
    .number()
    .min(0)
    .optional()
    .describe("Horizontal scale factor at this keyframe"),
  scaleY: z
    .number()
    .min(0)
    .optional()
    .describe("Vertical scale factor at this keyframe"),
  rotation: z
    .number()
    .optional()
    .describe("Rotation in degrees at this keyframe"),
  easing: z
    .enum(EASING_TYPES)
    .default("easeInOut")
    .describe("Easing function to interpolate TO this keyframe from the previous one"),
});

// ─── Filter Schema ───────────────────────────────────────────────────

export const FilterSchema = z.object({
  type: z
    .enum([
      "brightness",
      "contrast",
      "saturate",
      "grayscale",
      "sepia",
      "blur",
      "hue-rotate",
      "opacity",
    ])
    .describe("CSS filter type"),
  value: z.number().describe("Filter value (interpretation depends on type)"),
});

// ─── Text Properties Schema ─────────────────────────────────────────

export const TextPropertiesSchema = z.object({
  content: z.string().describe("Text content to display"),
  fontSize: z.number().positive().default(48).describe("Font size in pixels"),
  fontFamily: z.string().default("Inter").describe("Font family name"),
  fontWeight: z.enum(FONT_WEIGHTS).default("bold").describe("Font weight"),
  color: ColorSchema.default("#FFFFFF").describe("Text color"),
  backgroundColor: ColorSchema.optional().describe("Text background color"),
  backgroundPadding: z
    .number()
    .min(0)
    .optional()
    .describe("Padding around text background in pixels"),
  backgroundBorderRadius: z
    .number()
    .min(0)
    .optional()
    .describe("Border radius for text background"),
  textAlign: z.enum(TEXT_ALIGNMENTS).default("center").describe("Text alignment"),
  lineHeight: z.number().positive().default(1.4).describe("Line height multiplier"),
  letterSpacing: z.number().default(0).describe("Letter spacing in pixels"),
  textShadow: z.string().optional().describe("CSS text-shadow value"),
  stroke: z
    .object({
      color: ColorSchema,
      width: z.number().positive(),
    })
    .optional()
    .describe("Text stroke/outline"),
  maxWidth: z
    .number()
    .positive()
    .optional()
    .describe("Maximum width for text wrapping in pixels"),
  kineticTypography: z
    .object({
      mode: z
        .enum(["word", "char", "line"])
        .default("word")
        .describe("Token unit: word, char (per character), or line"),
      style: z
        .enum(["fade", "slideUp", "bounce", "scale", "wave"])
        .default("fade")
        .describe("Animation style applied to each token"),
      staggerMs: z
        .number()
        .min(0)
        .default(80)
        .describe("Delay in milliseconds between consecutive token animations"),
    })
    .optional()
    .describe(
      "Kinetic typography: animates each word/char/line individually with staggered timing"
    ),
});

// ─── Shape Properties Schema ────────────────────────────────────────

export const ShapePropertiesSchema = z.object({
  shapeType: z
    .enum(["rectangle", "circle", "rounded-rect", "line"])
    .describe("Shape type"),
  fill: ColorSchema.optional().describe("Fill color"),
  stroke: ColorSchema.optional().describe("Stroke color"),
  strokeWidth: z.number().min(0).default(0).describe("Stroke width in pixels"),
  borderRadius: z.number().min(0).default(0).describe("Border radius in pixels"),
  width: z.number().positive().describe("Shape width in pixels"),
  height: z.number().positive().describe("Shape height in pixels"),
});

// ─── Ken Burns Effect ────────────────────────────────────────────────

export const KenBurnsSchema = z.object({
  enabled: z.boolean().default(false),
  startScale: z.number().positive().default(1),
  endScale: z.number().positive().default(1.2),
  startPosition: PositionSchema.default({ x: 0, y: 0 }),
  endPosition: PositionSchema.default({ x: 0, y: 0 }),
});

// ─── Clip Schema ─────────────────────────────────────────────────────

export const ClipSchema = z.object({
  id: z.string().describe("Unique clip identifier"),
  assetId: z
    .string()
    .optional()
    .describe("Reference to asset in the assets registry"),

  // Timeline placement
  startTime: z
    .number()
    .min(0)
    .describe("When this clip starts on the timeline (seconds)"),
  duration: z
    .number()
    .positive()
    .describe("How long this clip is displayed (seconds)"),

  // Source media trimming
  trim: z
    .object({
      start: z.number().min(0).describe("Trim start point in source media (seconds)"),
      end: z.number().positive().describe("Trim end point in source media (seconds)"),
    })
    .optional()
    .describe("Trim the source media to a specific range"),

  // Transform
  position: PositionSchema.optional().describe("Position on canvas"),
  scale: ScaleSchema.optional().describe("Scale factor"),
  rotation: z.number().default(0).describe("Rotation in degrees"),
  opacity: z
    .number()
    .min(0)
    .max(1)
    .default(1)
    .describe("Opacity (0 = transparent, 1 = opaque)"),

  // Resize
  resizeMode: z
    .enum(RESIZE_MODES)
    .default("cover")
    .describe("How to resize media to fit"),

  // Animations
  animations: z
    .array(AnimationSchema)
    .default([])
    .describe("List of animations applied to this clip"),

  // Text-specific properties
  text: TextPropertiesSchema.optional().describe("Text properties (for text clips)"),

  // Shape-specific properties
  shape: ShapePropertiesSchema.optional().describe(
    "Shape properties (for shape clips)"
  ),

  // Ken Burns (for images)
  kenBurns: KenBurnsSchema.optional().describe(
    "Ken Burns pan/zoom effect (for images)"
  ),

  // Filters
  filters: z
    .array(FilterSchema)
    .default([])
    .describe("Visual filters applied to this clip"),

  // Keyframe animation
  keyframes: z
    .array(KeyframeSchema)
    .default([])
    .describe(
      "Timeline keyframes for smooth per-property animation within a clip (opacity, position, scale, rotation)"
    ),

  // Audio
  volume: z
    .number()
    .min(0)
    .max(2)
    .default(1)
    .describe("Volume level (0 = muted, 1 = normal, 2 = 2x)"),
  muted: z.boolean().default(false).describe("Whether audio is muted"),
});

// ─── Track Schema ────────────────────────────────────────────────────

export const TrackSchema = z.object({
  id: z.string().describe("Unique track identifier"),
  type: z.enum(TRACK_TYPES).describe("Type of content on this track"),
  name: z.string().optional().describe("Human-readable track name"),
  clips: z.array(ClipSchema).describe("Clips on this track, ordered by startTime"),
  locked: z.boolean().default(false).describe("Whether this track is locked for editing"),
  visible: z.boolean().default(true).describe("Whether this track is visible"),
  opacity: z
    .number()
    .min(0)
    .max(1)
    .default(1)
    .describe("Track-level opacity"),
});

// ─── Audio Track Schema ─────────────────────────────────────────────

export const AudioClipSchema = z.object({
  id: z.string().describe("Unique audio clip identifier"),
  assetId: z.string().describe("Reference to audio asset in the registry"),
  startTime: z
    .number()
    .min(0)
    .describe("When this audio clip starts on the timeline (seconds)"),
  duration: z.number().positive().describe("Duration of the audio clip (seconds)"),
  trim: z
    .object({
      start: z.number().min(0),
      end: z.number().positive(),
    })
    .optional()
    .describe("Trim the source audio"),
  volume: z.number().min(0).max(2).default(1).describe("Volume level"),
  fadeIn: z
    .number()
    .min(0)
    .default(0)
    .describe("Fade in duration in seconds"),
  fadeOut: z
    .number()
    .min(0)
    .default(0)
    .describe("Fade out duration in seconds"),
});

export const AudioTrackSchema = z.object({
  id: z.string().describe("Unique audio track identifier"),
  name: z.string().optional().describe("Human-readable track name"),
  clips: z.array(AudioClipSchema).describe("Audio clips on this track"),
  volume: z.number().min(0).max(2).default(1).describe("Track-level volume"),
  muted: z.boolean().default(false).describe("Whether this track is muted"),
});

// ─── Transition Schema ──────────────────────────────────────────────

export const TransitionSchema = z.object({
  id: z.string().describe("Unique transition identifier"),
  type: z.enum(TRANSITION_TYPES).describe("Transition effect type"),
  duration: z
    .number()
    .positive()
    .max(5)
    .describe("Transition duration in seconds"),
  fromClipId: z.string().describe("ID of the clip transitioning from"),
  toClipId: z.string().describe("ID of the clip transitioning to"),
});

// ─── Asset Schema ────────────────────────────────────────────────────

export const AssetSchema = z.object({
  id: z.string().describe("Unique asset identifier"),
  type: z.enum(ASSET_TYPES).describe("Type of asset"),
  source: z.enum(ASSET_SOURCES).describe("How this asset was obtained"),
  url: z.string().url().describe("URL to the asset file"),
  filename: z.string().optional().describe("Original filename"),
  mimeType: z.string().optional().describe("MIME type of the asset"),
  metadata: z
    .object({
      originalQuery: z
        .string()
        .optional()
        .describe("Search query or prompt that produced this asset"),
      provider: z
        .string()
        .optional()
        .describe("Provider name (pexels, dall-e, elevenlabs, etc.)"),
      duration: z
        .number()
        .optional()
        .describe("Duration in seconds (for video/audio)"),
      dimensions: DimensionsSchema.optional().describe(
        "Width x height (for video/image)"
      ),
      fileSize: z.number().optional().describe("File size in bytes"),
    })
    .optional()
    .describe("Additional metadata about the asset"),
});

// ─── Project Metadata Schema ────────────────────────────────────────

export const ProjectMetadataSchema = z.object({
  title: z.string().min(1).describe("Project title"),
  description: z.string().default("").describe("Project description"),
  aspectRatio: z
    .enum(ASPECT_RATIOS)
    .default("9:16")
    .describe("Video aspect ratio"),
  fps: z.union([z.literal(24), z.literal(30), z.literal(60)]).default(30).describe("Frames per second"),
  resolution: DimensionsSchema.default({ width: 1080, height: 1920 }).describe(
    "Video resolution in pixels"
  ),
  duration: z
    .number()
    .positive()
    .describe("Total video duration in seconds"),
  backgroundColor: ColorSchema.default("#000000").describe(
    "Background color of the canvas"
  ),
});

// ─── Video Project Schema (Root) ────────────────────────────────────

export const VideoProjectSchema = z.object({
  version: z.literal("1.0").default("1.0").describe("Schema version"),
  id: z.string().describe("Unique project identifier"),
  metadata: ProjectMetadataSchema.describe("Project-level metadata"),
  tracks: z
    .array(TrackSchema)
    .describe("Visual tracks, layered bottom-to-top"),
  audioTracks: z
    .array(AudioTrackSchema)
    .default([])
    .describe("Audio tracks (music, narration, SFX)"),
  transitions: z
    .array(TransitionSchema)
    .default([])
    .describe("Transitions between clips"),
  assets: z
    .record(z.string(), AssetSchema)
    .default({})
    .describe("Asset registry - maps asset IDs to asset data"),
  createdAt: z.string().datetime().describe("ISO 8601 creation timestamp"),
  updatedAt: z.string().datetime().describe("ISO 8601 last update timestamp"),
});

// ─── Inferred TypeScript Types ──────────────────────────────────────

export type Position = z.infer<typeof PositionSchema>;
export type Scale = z.infer<typeof ScaleSchema>;
export type Dimensions = z.infer<typeof DimensionsSchema>;
export type Animation = z.infer<typeof AnimationSchema>;
export type Filter = z.infer<typeof FilterSchema>;
export type TextProperties = z.infer<typeof TextPropertiesSchema>;
export type ShapeProperties = z.infer<typeof ShapePropertiesSchema>;
export type KenBurns = z.infer<typeof KenBurnsSchema>;
export type Keyframe = z.infer<typeof KeyframeSchema>;
export type Clip = z.infer<typeof ClipSchema>;
export type Track = z.infer<typeof TrackSchema>;
export type AudioClip = z.infer<typeof AudioClipSchema>;
export type AudioTrack = z.infer<typeof AudioTrackSchema>;
export type Transition = z.infer<typeof TransitionSchema>;
export type Asset = z.infer<typeof AssetSchema>;
export type ProjectMetadata = z.infer<typeof ProjectMetadataSchema>;
export type VideoProject = z.infer<typeof VideoProjectSchema>;
export type AspectRatio = (typeof ASPECT_RATIOS)[number];
export type TrackType = (typeof TRACK_TYPES)[number];
export type AssetType = (typeof ASSET_TYPES)[number];
export type AssetSource = (typeof ASSET_SOURCES)[number];
export type AnimationType = (typeof ANIMATION_TYPES)[number];
export type TransitionType = (typeof TRANSITION_TYPES)[number];
export type EasingType = (typeof EASING_TYPES)[number];
export type ResizeMode = (typeof RESIZE_MODES)[number];
