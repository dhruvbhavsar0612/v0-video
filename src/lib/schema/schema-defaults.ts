/**
 * Schema Defaults & Templates
 *
 * Pre-built templates for common video formats.
 * The AI agent can use these as starting points.
 */

import { v4 as uuidv4 } from "uuid";

import type { VideoProject, ProjectMetadata, AspectRatio, Animation, AnimationType, EasingType, TextProperties } from "./video-schema";

// ─── Resolution Presets ─────────────────────────────────────────────

export const RESOLUTION_PRESETS: Record<
  AspectRatio,
  { width: number; height: number }
> = {
  "9:16": { width: 1080, height: 1920 }, // Instagram Reels, TikTok, YouTube Shorts
  "16:9": { width: 1920, height: 1080 }, // YouTube, standard video
  "1:1": { width: 1080, height: 1080 }, // Instagram Posts
  "4:5": { width: 1080, height: 1350 }, // Instagram Feed
};

// ─── Default Metadata ───────────────────────────────────────────────

export function createDefaultMetadata(
  overrides?: Partial<ProjectMetadata>
): ProjectMetadata {
  const aspectRatio = overrides?.aspectRatio ?? "9:16";
  const resolution =
    overrides?.resolution ?? RESOLUTION_PRESETS[aspectRatio];

  return {
    title: overrides?.title ?? "Untitled Project",
    description: overrides?.description ?? "",
    aspectRatio,
    fps: overrides?.fps ?? 30,
    resolution,
    duration: overrides?.duration ?? 30,
    backgroundColor: overrides?.backgroundColor ?? "#000000",
  };
}

// ─── Create Empty Project ───────────────────────────────────────────

export function createEmptyProject(
  overrides?: { metadata?: Partial<ProjectMetadata>; id?: string }
): VideoProject {
  const now = new Date().toISOString();
  return {
    version: "1.0",
    id: overrides?.id ?? uuidv4(),
    metadata: createDefaultMetadata(overrides?.metadata),
    tracks: [],
    audioTracks: [],
    transitions: [],
    assets: {},
    createdAt: now,
    updatedAt: now,
  };
}

// ─── Instagram Reels Template ───────────────────────────────────────

export function createInstagramReelsTemplate(
  title: string = "My Reel"
): VideoProject {
  const projectId = uuidv4();
  const now = new Date().toISOString();

  return {
    version: "1.0",
    id: projectId,
    metadata: {
      title,
      description: "",
      aspectRatio: "9:16",
      fps: 30,
      resolution: { width: 1080, height: 1920 },
      duration: 30,
      backgroundColor: "#000000",
    },
    tracks: [
      {
        id: uuidv4(),
        type: "video",
        name: "Background",
        clips: [],
        locked: false,
        visible: true,
        opacity: 1,
      },
      {
        id: uuidv4(),
        type: "text",
        name: "Text Overlays",
        clips: [],
        locked: false,
        visible: true,
        opacity: 1,
      },
    ],
    audioTracks: [
      {
        id: uuidv4(),
        name: "Music",
        clips: [],
        volume: 0.7,
        muted: false,
      },
      {
        id: uuidv4(),
        name: "Narration",
        clips: [],
        volume: 1,
        muted: false,
      },
    ],
    transitions: [],
    assets: {},
    createdAt: now,
    updatedAt: now,
  };
}

// ─── Demo Project (for testing the preview) ─────────────────────────

export function createDemoProject(): VideoProject {
  const projectId = uuidv4();
  const now = new Date().toISOString();
  const textClip1Id = uuidv4();
  const textClip2Id = uuidv4();
  const textClip3Id = uuidv4();
  const bgClip1Id = uuidv4();
  const bgClip2Id = uuidv4();
  const bgClip3Id = uuidv4();

  return {
    version: "1.0",
    id: projectId,
    metadata: {
      title: "Demo Reel",
      description: "A demo project showing the capabilities of the editor",
      aspectRatio: "9:16",
      fps: 30,
      resolution: { width: 1080, height: 1920 },
      duration: 15,
      backgroundColor: "#1a1a2e",
    },
    tracks: [
      {
        id: uuidv4(),
        type: "shape",
        name: "Backgrounds",
        clips: [
          {
            id: bgClip1Id,
            startTime: 0,
            duration: 5,
            shape: {
              shapeType: "rectangle",
              fill: "#1a1a2e",
              width: 1080,
              height: 1920,
              strokeWidth: 0,
              borderRadius: 0,
            },
            opacity: 1,
            rotation: 0,
            volume: 1,
            muted: false,
            resizeMode: "cover",
            animations: [],
            filters: [],
            keyframes: [],
          },
          {
            id: bgClip2Id,
            startTime: 5,
            duration: 5,
            shape: {
              shapeType: "rectangle",
              fill: "#16213e",
              width: 1080,
              height: 1920,
              strokeWidth: 0,
              borderRadius: 0,
            },
            opacity: 1,
            rotation: 0,
            volume: 1,
            muted: false,
            resizeMode: "cover",
            animations: [],
            filters: [],
            keyframes: [],
          },
          {
            id: bgClip3Id,
            startTime: 10,
            duration: 5,
            shape: {
              shapeType: "rectangle",
              fill: "#0f3460",
              width: 1080,
              height: 1920,
              strokeWidth: 0,
              borderRadius: 0,
            },
            opacity: 1,
            rotation: 0,
            volume: 1,
            muted: false,
            resizeMode: "cover",
            animations: [],
            filters: [],
            keyframes: [],
          },
        ],
        locked: false,
        visible: true,
        opacity: 1,
      },
      {
        id: uuidv4(),
        type: "text",
        name: "Text Overlays",
        clips: [
          {
            id: textClip1Id,
            startTime: 0,
            duration: 5,
            position: { x: 540, y: 800 },
            text: {
              content: "AI Video Editor",
              fontSize: 72,
              fontFamily: "Inter",
              fontWeight: "bold",
              color: "#FFFFFF",
              textAlign: "center",
              lineHeight: 1.4,
              letterSpacing: 0,
              maxWidth: 900,
            },
            animations: [
              {
                type: "fadeIn",
                duration: 0.8,
                easing: "easeOut",
                delay: 0,
              },
            ],
            opacity: 1,
            rotation: 0,
            volume: 1,
            muted: false,
            resizeMode: "cover",
            filters: [],
            keyframes: [],
          },
          {
            id: textClip2Id,
            startTime: 5,
            duration: 5,
            position: { x: 540, y: 800 },
            text: {
              content: "Powered by AI",
              fontSize: 56,
              fontFamily: "Inter",
              fontWeight: "600",
              color: "#e94560",
              textAlign: "center",
              lineHeight: 1.4,
              letterSpacing: 2,
              maxWidth: 900,
            },
            animations: [
              {
                type: "slideIn",
                direction: "up",
                duration: 0.6,
                easing: "spring",
                delay: 0,
              },
            ],
            opacity: 1,
            rotation: 0,
            volume: 1,
            muted: false,
            resizeMode: "cover",
            filters: [],
            keyframes: [],
          },
          {
            id: textClip3Id,
            startTime: 10,
            duration: 5,
            position: { x: 540, y: 800 },
            text: {
              content: "Create Amazing\nContent",
              fontSize: 64,
              fontFamily: "Inter",
              fontWeight: "bold",
              color: "#FFFFFF",
              backgroundColor: "rgba(233, 69, 96, 0.8)",
              backgroundPadding: 20,
              backgroundBorderRadius: 12,
              textAlign: "center",
              lineHeight: 1.4,
              letterSpacing: 0,
              maxWidth: 900,
            },
            animations: [
              {
                type: "scaleIn",
                duration: 0.5,
                easing: "spring",
                delay: 0,
              },
            ],
            opacity: 1,
            rotation: 0,
            volume: 1,
            muted: false,
            resizeMode: "cover",
            filters: [],
            keyframes: [],
          },
        ],
        locked: false,
        visible: true,
        opacity: 1,
      },
    ],
    audioTracks: [],
    transitions: [
      {
        id: uuidv4(),
        type: "fade",
        duration: 0.5,
        fromClipId: bgClip1Id,
        toClipId: bgClip2Id,
      },
      {
        id: uuidv4(),
        type: "slide",
        duration: 0.5,
        fromClipId: bgClip2Id,
        toClipId: bgClip3Id,
      },
    ],
    assets: {},
    createdAt: now,
    updatedAt: now,
  };
}

// ─── Aspect Ratio Helpers ───────────────────────────────────────────

export function getResolutionForAspectRatio(
  aspectRatio: AspectRatio
): { width: number; height: number } {
  return RESOLUTION_PRESETS[aspectRatio];
}

export function calculateDurationInFrames(
  durationSeconds: number,
  fps: number
): number {
  return Math.ceil(durationSeconds * fps);
}

export function calculateSecondsFromFrames(
  frames: number,
  fps: number
): number {
  return frames / fps;
}

// ─── Template Registry ──────────────────────────────────────────────

export interface TemplateInfo {
  id: string;
  name: string;
  description: string;
  category: "social" | "business" | "education" | "entertainment" | "marketing";
  aspectRatio: AspectRatio;
  duration: number;
  create: (title?: string) => VideoProject;
}

// Helper to create a standard clip base (reduces boilerplate)
function clipBase(overrides: {
  id?: string;
  startTime: number;
  duration: number;
  opacity?: number;
}): {
  id: string;
  startTime: number;
  duration: number;
  opacity: number;
  rotation: number;
  volume: number;
  muted: boolean;
  resizeMode: "cover";
  animations: [];
  filters: [];
  keyframes: [];
} {
  return {
    id: overrides.id ?? uuidv4(),
    startTime: overrides.startTime,
    duration: overrides.duration,
    opacity: overrides.opacity ?? 1,
    rotation: 0,
    volume: 1,
    muted: false,
    resizeMode: "cover" as const,
    animations: [] as [],
    filters: [] as [],
    keyframes: [] as [],
  };
}

function bgShape(
  startTime: number,
  duration: number,
  fill: string,
  w = 1080,
  h = 1920
) {
  return {
    ...clipBase({ startTime, duration }),
    shape: {
      shapeType: "rectangle" as const,
      fill,
      width: w,
      height: h,
      strokeWidth: 0,
      borderRadius: 0,
    },
    animations: [] as [],
  };
}

function textClip(
  startTime: number,
  duration: number,
  content: string,
  opts: {
    x?: number;
    y?: number;
    fontSize?: number;
    fontFamily?: string;
    fontWeight?: TextProperties["fontWeight"];
    color?: string;
    bg?: string;
    bgPadding?: number;
    bgRadius?: number;
    textAlign?: "left" | "center" | "right";
    maxWidth?: number;
    letterSpacing?: number;
    animation?: {
      type: AnimationType;
      duration?: number;
      easing?: EasingType;
      delay?: number;
      direction?: Animation["direction"];
    };
  } = {}
) {
  return {
    ...clipBase({ startTime, duration }),
    position: { x: opts.x ?? 540, y: opts.y ?? 960 },
    text: {
      content,
      fontSize: opts.fontSize ?? 48,
      fontFamily: opts.fontFamily ?? "Inter",
      fontWeight: opts.fontWeight ?? "bold",
      color: opts.color ?? "#FFFFFF",
      backgroundColor: opts.bg,
      backgroundPadding: opts.bgPadding,
      backgroundBorderRadius: opts.bgRadius,
      textAlign: opts.textAlign ?? "center",
      lineHeight: 1.4,
      letterSpacing: opts.letterSpacing ?? 0,
      maxWidth: opts.maxWidth ?? 900,
    },
    animations: (opts.animation
      ? [
          {
            type: opts.animation.type,
            duration: opts.animation.duration ?? 0.6,
            easing: (opts.animation.easing ?? "easeOut") as EasingType,
            delay: opts.animation.delay ?? 0,
            ...(opts.animation.direction
              ? { direction: opts.animation.direction }
              : {}),
          } satisfies Animation,
        ]
      : []) as Animation[],
  };
}

function projectShell(
  title: string,
  opts: {
    aspectRatio?: AspectRatio;
    duration?: number;
    bg?: string;
  } = {}
): VideoProject {
  const ar = opts.aspectRatio ?? "9:16";
  return {
    version: "1.0",
    id: uuidv4(),
    metadata: {
      title,
      description: "",
      aspectRatio: ar,
      fps: 30,
      resolution: RESOLUTION_PRESETS[ar],
      duration: opts.duration ?? 30,
      backgroundColor: opts.bg ?? "#000000",
    },
    tracks: [],
    audioTracks: [],
    transitions: [],
    assets: {},
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

// ── 1. Motivational Quote ───────────────────────────────────────────

function createMotivationalQuoteTemplate(title = "Motivational Quote"): VideoProject {
  const project = projectShell(title, { duration: 10, bg: "#0a0a1a" });
  const w = 1080, h = 1920;

  project.tracks = [
    {
      id: uuidv4(), type: "shape", name: "Backgrounds", clips: [
        bgShape(0, 10, "linear-gradient(180deg, #0a0a1a 0%, #1a1a3e 100%)", w, h),
      ], locked: false, visible: true, opacity: 1,
    },
    {
      id: uuidv4(), type: "shape", name: "Accent Bar", clips: [{
        ...clipBase({ startTime: 0.5, duration: 9 }),
        position: { x: 540, y: 700 },
        shape: { shapeType: "rounded-rect", fill: "#e94560", width: 80, height: 6, strokeWidth: 0, borderRadius: 3 },
        animations: [{ type: "scaleIn", duration: 0.5, easing: "easeOut", delay: 0 }],
      }], locked: false, visible: true, opacity: 1,
    },
    {
      id: uuidv4(), type: "text", name: "Quote", clips: [
        textClip(0.3, 9, '"The only way to\ndo great work is\nto love what you do."', {
          y: 850, fontSize: 56, color: "#FFFFFF", fontWeight: "600",
          animation: { type: "fadeIn", duration: 1, easing: "easeOut" },
        }),
        textClip(1.5, 8, "— Steve Jobs", {
          y: 1100, fontSize: 32, color: "#e94560", fontWeight: "normal",
          animation: { type: "fadeIn", duration: 0.8, delay: 0.5 },
        }),
      ], locked: false, visible: true, opacity: 1,
    },
  ];

  return project;
}

// ── 2. Product Showcase ─────────────────────────────────────────────

function createProductShowcaseTemplate(title = "Product Showcase"): VideoProject {
  const project = projectShell(title, { duration: 20, bg: "#FFFFFF" });

  project.tracks = [
    {
      id: uuidv4(), type: "shape", name: "Backgrounds", clips: [
        bgShape(0, 7, "#FFFFFF"),
        bgShape(7, 7, "#F8F9FA"),
        bgShape(14, 6, "#1a1a2e"),
      ], locked: false, visible: true, opacity: 1,
    },
    {
      id: uuidv4(), type: "image", name: "Product Images", clips: [],
      locked: false, visible: true, opacity: 1,
    },
    {
      id: uuidv4(), type: "text", name: "Headlines", clips: [
        textClip(0, 7, "Introducing\nOur New Product", {
          y: 600, fontSize: 64, color: "#1a1a2e",
          animation: { type: "slideIn", direction: "up", duration: 0.7, easing: "spring" },
        }),
        textClip(7, 7, "Key Features", {
          y: 400, fontSize: 52, color: "#333333",
          animation: { type: "fadeIn", duration: 0.6 },
        }),
        textClip(14, 6, "Get Yours Today", {
          y: 800, fontSize: 60, color: "#FFFFFF", bg: "#e94560", bgPadding: 24, bgRadius: 16,
          animation: { type: "scaleIn", duration: 0.5, easing: "spring" },
        }),
      ], locked: false, visible: true, opacity: 1,
    },
    {
      id: uuidv4(), type: "text", name: "Subtext", clips: [
        textClip(0.5, 6, "The future of [category]", {
          y: 750, fontSize: 28, color: "#888888", fontWeight: "normal",
          animation: { type: "fadeIn", duration: 0.8, delay: 0.3 },
        }),
        textClip(7.5, 6, "✓ Feature One\n✓ Feature Two\n✓ Feature Three", {
          y: 600, fontSize: 36, color: "#555555", fontWeight: "normal", textAlign: "left", x: 200,
          animation: { type: "slideIn", direction: "left", duration: 0.6 },
        }),
        textClip(14.5, 5, "Link in bio · Starting at $XX", {
          y: 1000, fontSize: 28, color: "rgba(255,255,255,0.7)", fontWeight: "normal",
          animation: { type: "fadeIn", duration: 0.5, delay: 0.3 },
        }),
      ], locked: false, visible: true, opacity: 1,
    },
  ];

  return project;
}

// ── 3. Listicle / Top 5 ─────────────────────────────────────────────

function createListicleTemplate(title = "Top 5 List"): VideoProject {
  const project = projectShell(title, { duration: 25, bg: "#0d1117" });
  const colors = ["#FF6B6B", "#4ECDC4", "#45B7D1", "#96CEB4", "#FFEAA7"];

  const bgClips = [];
  const numClips = [];
  const itemClips = [];

  for (let i = 0; i < 5; i++) {
    const start = i * 5;
    bgClips.push(bgShape(start, 5, i % 2 === 0 ? "#0d1117" : "#161b22"));
    numClips.push(textClip(start + 0.2, 4.5, `#${5 - i}`, {
      y: 600, fontSize: 120, color: colors[i], fontWeight: "900",
      animation: { type: "scaleIn", duration: 0.4, easing: "spring" },
    }));
    itemClips.push(textClip(start + 0.6, 4, `Item ${5 - i} goes here`, {
      y: 850, fontSize: 44, color: "#FFFFFF", fontWeight: "600",
      animation: { type: "slideIn", direction: "up", duration: 0.5, easing: "easeOut" },
    }));
  }

  project.tracks = [
    { id: uuidv4(), type: "shape", name: "Backgrounds", clips: bgClips, locked: false, visible: true, opacity: 1 },
    { id: uuidv4(), type: "text", name: "Numbers", clips: numClips, locked: false, visible: true, opacity: 1 },
    { id: uuidv4(), type: "text", name: "Items", clips: itemClips, locked: false, visible: true, opacity: 1 },
  ];

  return project;
}

// ── 4. Tutorial / How-To ────────────────────────────────────────────

function createTutorialTemplate(title = "How-To Tutorial"): VideoProject {
  const project = projectShell(title, { duration: 30, bg: "#1E1E2E" });

  project.tracks = [
    {
      id: uuidv4(), type: "shape", name: "Backgrounds", clips: [
        bgShape(0, 5, "#1E1E2E"),
        bgShape(5, 8, "#2D2D44"),
        bgShape(13, 8, "#1E1E2E"),
        bgShape(21, 9, "#2D2D44"),
      ], locked: false, visible: true, opacity: 1,
    },
    {
      id: uuidv4(), type: "shape", name: "Step Badges", clips: [
        { ...clipBase({ startTime: 5.2, duration: 7.5 }), position: { x: 540, y: 400 }, shape: { shapeType: "circle", fill: "#7C3AED", width: 100, height: 100, strokeWidth: 0, borderRadius: 0 }, animations: [{ type: "scaleIn", duration: 0.4, easing: "spring", delay: 0 }] },
        { ...clipBase({ startTime: 13.2, duration: 7.5 }), position: { x: 540, y: 400 }, shape: { shapeType: "circle", fill: "#2563EB", width: 100, height: 100, strokeWidth: 0, borderRadius: 0 }, animations: [{ type: "scaleIn", duration: 0.4, easing: "spring", delay: 0 }] },
        { ...clipBase({ startTime: 21.2, duration: 8.5 }), position: { x: 540, y: 400 }, shape: { shapeType: "circle", fill: "#059669", width: 100, height: 100, strokeWidth: 0, borderRadius: 0 }, animations: [{ type: "scaleIn", duration: 0.4, easing: "spring", delay: 0 }] },
      ], locked: false, visible: true, opacity: 1,
    },
    {
      id: uuidv4(), type: "text", name: "Content", clips: [
        textClip(0, 5, "How To\n[Topic]", { y: 800, fontSize: 64, animation: { type: "fadeIn", duration: 0.8 } }),
        textClip(0.5, 4, "Quick & Easy Guide", { y: 1050, fontSize: 28, color: "#A78BFA", fontWeight: "normal", animation: { type: "fadeIn", duration: 0.6, delay: 0.3 } }),
        // Step numbers (inside circles)
        textClip(5.3, 7.4, "1", { y: 400, fontSize: 48, color: "#FFFFFF", animation: { type: "fadeIn", duration: 0.3 } }),
        textClip(13.3, 7.4, "2", { y: 400, fontSize: 48, color: "#FFFFFF", animation: { type: "fadeIn", duration: 0.3 } }),
        textClip(21.3, 8.4, "3", { y: 400, fontSize: 48, color: "#FFFFFF", animation: { type: "fadeIn", duration: 0.3 } }),
        // Step descriptions
        textClip(5.5, 7, "Step 1 Title", { y: 600, fontSize: 48, animation: { type: "slideIn", direction: "up", duration: 0.5 } }),
        textClip(6, 6.5, "Describe what to do\nin this step", { y: 780, fontSize: 32, color: "#D1D5DB", fontWeight: "normal", animation: { type: "fadeIn", duration: 0.6, delay: 0.3 } }),
        textClip(13.5, 7, "Step 2 Title", { y: 600, fontSize: 48, animation: { type: "slideIn", direction: "up", duration: 0.5 } }),
        textClip(14, 6.5, "Describe what to do\nin this step", { y: 780, fontSize: 32, color: "#D1D5DB", fontWeight: "normal", animation: { type: "fadeIn", duration: 0.6, delay: 0.3 } }),
        textClip(21.5, 8, "Step 3 Title", { y: 600, fontSize: 48, animation: { type: "slideIn", direction: "up", duration: 0.5 } }),
        textClip(22, 7.5, "Describe what to do\nin this step", { y: 780, fontSize: 32, color: "#D1D5DB", fontWeight: "normal", animation: { type: "fadeIn", duration: 0.6, delay: 0.3 } }),
      ], locked: false, visible: true, opacity: 1,
    },
  ];

  return project;
}

// ── 5. Before / After ───────────────────────────────────────────────

function createBeforeAfterTemplate(title = "Before & After"): VideoProject {
  const project = projectShell(title, { duration: 15, bg: "#111111" });

  project.tracks = [
    {
      id: uuidv4(), type: "shape", name: "Backgrounds", clips: [
        bgShape(0, 7, "#1a1a1a"),
        bgShape(7, 1, "#FFFFFF"),
        bgShape(8, 7, "#111111"),
      ], locked: false, visible: true, opacity: 1,
    },
    {
      id: uuidv4(), type: "image", name: "Before/After Images", clips: [],
      locked: false, visible: true, opacity: 1,
    },
    {
      id: uuidv4(), type: "text", name: "Labels", clips: [
        textClip(0.3, 6.5, "BEFORE", { y: 350, fontSize: 40, color: "#FF4444", letterSpacing: 8, animation: { type: "fadeIn", duration: 0.5 } }),
        textClip(8.3, 6.5, "AFTER", { y: 350, fontSize: 40, color: "#44FF88", letterSpacing: 8, animation: { type: "fadeIn", duration: 0.5 } }),
        textClip(7, 1, "✨", { y: 960, fontSize: 100, animation: { type: "scaleIn", duration: 0.3, easing: "spring" } }),
      ], locked: false, visible: true, opacity: 1,
    },
  ];

  return project;
}

// ── 6. Announcement / Launch ────────────────────────────────────────

function createAnnouncementTemplate(title = "Big Announcement"): VideoProject {
  const project = projectShell(title, { duration: 12, bg: "#0a0a0a" });

  project.tracks = [
    {
      id: uuidv4(), type: "shape", name: "Backgrounds", clips: [
        bgShape(0, 4, "#0a0a0a"),
        bgShape(4, 4, "#1a0a2e"),
        bgShape(8, 4, "#0a0a0a"),
      ], locked: false, visible: true, opacity: 1,
    },
    {
      id: uuidv4(), type: "shape", name: "Accent Elements", clips: [
        { ...clipBase({ startTime: 0, duration: 12, opacity: 0.3 }), position: { x: 540, y: 960 }, shape: { shapeType: "circle", fill: "#7C3AED", width: 600, height: 600, strokeWidth: 0, borderRadius: 0 }, animations: [] as [] },
      ], locked: false, visible: true, opacity: 1,
    },
    {
      id: uuidv4(), type: "text", name: "Content", clips: [
        textClip(0, 4, "SOMETHING\nBIG IS\nCOMING", { y: 800, fontSize: 72, letterSpacing: 4, animation: { type: "fadeIn", duration: 1.2 } }),
        textClip(4, 4, "[Your\nAnnouncement\nHere]", { y: 800, fontSize: 64, color: "#DDD4FF", bg: "rgba(124,58,237,0.3)", bgPadding: 30, bgRadius: 20, animation: { type: "scaleIn", duration: 0.5, easing: "spring" } }),
        textClip(8.5, 3, "Coming [Date]", { y: 750, fontSize: 40, color: "#A78BFA", fontWeight: "normal", animation: { type: "fadeIn", duration: 0.6 } }),
        textClip(9, 2.5, "Follow for updates", { y: 900, fontSize: 28, color: "rgba(255,255,255,0.6)", fontWeight: "normal", animation: { type: "slideIn", direction: "up", duration: 0.5, delay: 0.3 } }),
      ], locked: false, visible: true, opacity: 1,
    },
  ];

  return project;
}

// ── 7. Text Story / Thread ──────────────────────────────────────────

function createTextStoryTemplate(title = "Text Story"): VideoProject {
  const project = projectShell(title, { duration: 20, bg: "#0f172a" });
  const scenes = [
    { text: "Did you know?", color: "#38BDF8", y: 900 },
    { text: "Here's the thing...", color: "#FFFFFF", y: 900 },
    { text: "[Main point\ngoes here]", color: "#F472B6", y: 850 },
    { text: "Follow for more", color: "#A78BFA", y: 900 },
  ];

  const bgClips = [];
  const txtClips = [];

  for (let i = 0; i < scenes.length; i++) {
    const start = i * 5;
    bgClips.push(bgShape(start, 5, i % 2 === 0 ? "#0f172a" : "#1e293b"));
    txtClips.push(textClip(start + 0.3, 4.5, scenes[i].text, {
      y: scenes[i].y, fontSize: 56, color: scenes[i].color, fontWeight: "700",
      animation: { type: "typewriter", duration: 1.5 },
    }));
  }

  project.tracks = [
    { id: uuidv4(), type: "shape", name: "Backgrounds", clips: bgClips, locked: false, visible: true, opacity: 1 },
    { id: uuidv4(), type: "text", name: "Story Text", clips: txtClips, locked: false, visible: true, opacity: 1 },
  ];

  return project;
}

// ── 8. Comparison / VS ──────────────────────────────────────────────

function createComparisonTemplate(title = "A vs B"): VideoProject {
  const project = projectShell(title, { duration: 15, bg: "#111111" });

  project.tracks = [
    {
      id: uuidv4(), type: "shape", name: "Backgrounds", clips: [
        bgShape(0, 5, "#111111"),
        bgShape(5, 5, "#0a192f"),
        bgShape(10, 5, "#111111"),
      ], locked: false, visible: true, opacity: 1,
    },
    {
      id: uuidv4(), type: "shape", name: "Divider", clips: [
        { ...clipBase({ startTime: 5, duration: 5 }), position: { x: 540, y: 960 }, shape: { shapeType: "rectangle", fill: "#FFD700", width: 4, height: 1920, strokeWidth: 0, borderRadius: 0 }, animations: [{ type: "slideIn", direction: "down", duration: 0.4, easing: "easeOut", delay: 0 }] },
      ], locked: false, visible: true, opacity: 1,
    },
    {
      id: uuidv4(), type: "text", name: "Labels", clips: [
        textClip(0, 5, "Which is better?", { y: 800, fontSize: 56, animation: { type: "fadeIn", duration: 0.8 } }),
        textClip(5.3, 4.5, "Option A", { x: 270, y: 500, fontSize: 44, color: "#FF6B6B", animation: { type: "slideIn", direction: "left", duration: 0.5 } }),
        textClip(5.3, 4.5, "Option B", { x: 810, y: 500, fontSize: 44, color: "#4ECDC4", animation: { type: "slideIn", direction: "right", duration: 0.5 } }),
        textClip(10.5, 4, "The Winner Is...", { y: 700, fontSize: 52, animation: { type: "scaleIn", duration: 0.5, easing: "spring" } }),
        textClip(11.5, 3, "[Option X]", { y: 900, fontSize: 72, color: "#FFD700", fontWeight: "900", animation: { type: "scaleIn", duration: 0.4, easing: "spring", delay: 0.5 } }),
      ], locked: false, visible: true, opacity: 1,
    },
  ];

  return project;
}

// ── 9. YouTube Landscape ────────────────────────────────────────────

function createYouTubeLandscapeTemplate(title = "YouTube Video"): VideoProject {
  const project = projectShell(title, { aspectRatio: "16:9", duration: 30, bg: "#0f0f0f" });
  const w = 1920, h = 1080;

  project.tracks = [
    {
      id: uuidv4(), type: "shape", name: "Backgrounds", clips: [
        bgShape(0, 10, "#0f0f0f", w, h),
        bgShape(10, 15, "#1a1a2e", w, h),
        bgShape(25, 5, "#0f0f0f", w, h),
      ], locked: false, visible: true, opacity: 1,
    },
    {
      id: uuidv4(), type: "video", name: "Main Video", clips: [],
      locked: false, visible: true, opacity: 1,
    },
    {
      id: uuidv4(), type: "text", name: "Lower Thirds", clips: [
        textClip(2, 5, "[Channel Name]", {
          x: 200, y: 950, fontSize: 32, color: "#FFFFFF", textAlign: "left",
          bg: "rgba(0,0,0,0.7)", bgPadding: 16, bgRadius: 8,
          animation: { type: "slideIn", direction: "left", duration: 0.4 },
        }),
        textClip(25, 5, "Like & Subscribe!", {
          x: 960, y: 540, fontSize: 56, color: "#FF0000",
          animation: { type: "scaleIn", duration: 0.5, easing: "spring" },
        }),
      ], locked: false, visible: true, opacity: 1,
    },
  ];

  project.audioTracks = [
    { id: uuidv4(), name: "Background Music", clips: [], volume: 0.3, muted: false },
    { id: uuidv4(), name: "Voiceover", clips: [], volume: 1, muted: false },
  ];

  return project;
}

// ── 10. Square Instagram Post ───────────────────────────────────────

function createSquarePostTemplate(title = "Instagram Post"): VideoProject {
  const project = projectShell(title, { aspectRatio: "1:1", duration: 10, bg: "#FFF5F5" });
  const w = 1080, h = 1080;

  project.tracks = [
    {
      id: uuidv4(), type: "shape", name: "Background", clips: [
        bgShape(0, 10, "#FFF5F5", w, h),
        { ...clipBase({ startTime: 0, duration: 10, opacity: 0.1 }), shape: { shapeType: "circle", fill: "#FF6B6B", width: 800, height: 800, strokeWidth: 0, borderRadius: 0 }, position: { x: 900, y: 200 }, animations: [] as [] },
      ], locked: false, visible: true, opacity: 1,
    },
    {
      id: uuidv4(), type: "text", name: "Content", clips: [
        textClip(0.3, 9, "[Your message\ngoes here]", {
          y: 450, fontSize: 52, color: "#2D3748", fontWeight: "700",
          animation: { type: "fadeIn", duration: 0.8 },
        }),
        textClip(1, 8.5, "@yourhandle", {
          y: 700, fontSize: 24, color: "#A0AEC0", fontWeight: "normal",
          animation: { type: "fadeIn", duration: 0.5, delay: 0.3 },
        }),
      ], locked: false, visible: true, opacity: 1,
    },
  ];

  return project;
}

// ── 11. Countdown / Coming Soon ─────────────────────────────────────

function createCountdownTemplate(title = "Countdown"): VideoProject {
  const project = projectShell(title, { duration: 15, bg: "#000000" });

  const countClips = [];
  for (let i = 5; i >= 1; i--) {
    const start = (5 - i) * 2;
    countClips.push(textClip(start, 2, String(i), {
      y: 900, fontSize: 200, color: "#FFFFFF", fontWeight: "900",
      animation: { type: "scaleIn", duration: 0.3, easing: "spring" },
    }));
  }

  project.tracks = [
    {
      id: uuidv4(), type: "shape", name: "Backgrounds", clips: [
        bgShape(0, 10, "#000000"),
        bgShape(10, 5, "#e94560"),
      ], locked: false, visible: true, opacity: 1,
    },
    {
      id: uuidv4(), type: "text", name: "Countdown Numbers", clips: countClips,
      locked: false, visible: true, opacity: 1,
    },
    {
      id: uuidv4(), type: "text", name: "Reveal", clips: [
        textClip(10.5, 4, "🎉 IT'S HERE! 🎉", {
          y: 800, fontSize: 56,
          animation: { type: "scaleIn", duration: 0.5, easing: "spring" },
        }),
        textClip(11.5, 3, "[Your reveal text]", {
          y: 1050, fontSize: 36, color: "rgba(255,255,255,0.8)", fontWeight: "normal",
          animation: { type: "fadeIn", duration: 0.6, delay: 0.3 },
        }),
      ], locked: false, visible: true, opacity: 1,
    },
  ];

  return project;
}

// ── 12. Testimonial / Review ────────────────────────────────────────

function createTestimonialTemplate(title = "Testimonial"): VideoProject {
  const project = projectShell(title, { duration: 12, bg: "#F7FAFC" });

  project.tracks = [
    {
      id: uuidv4(), type: "shape", name: "Background", clips: [
        bgShape(0, 12, "#F7FAFC"),
        { ...clipBase({ startTime: 0, duration: 12 }), position: { x: 540, y: 960 }, shape: { shapeType: "rounded-rect", fill: "#FFFFFF", width: 900, height: 600, strokeWidth: 2, stroke: "#E2E8F0", borderRadius: 24 }, animations: [{ type: "scaleIn", duration: 0.5, easing: "easeOut", delay: 0 }] },
      ], locked: false, visible: true, opacity: 1,
    },
    {
      id: uuidv4(), type: "text", name: "Quote Content", clips: [
        textClip(0.5, 11, "⭐⭐⭐⭐⭐", { y: 730, fontSize: 36, color: "#F6AD55", animation: { type: "fadeIn", duration: 0.5 } }),
        textClip(1, 10.5, '"This changed my life!\nAbsolutely incredible\nproduct."', {
          y: 920, fontSize: 38, color: "#2D3748", fontWeight: "600",
          animation: { type: "fadeIn", duration: 0.8, delay: 0.3 },
        }),
        textClip(2, 9.5, "— Happy Customer", {
          y: 1120, fontSize: 24, color: "#718096", fontWeight: "normal",
          animation: { type: "fadeIn", duration: 0.5, delay: 0.5 },
        }),
      ], locked: false, visible: true, opacity: 1,
    },
  ];

  return project;
}

// ── Template Registry ───────────────────────────────────────────────

export const TEMPLATES: TemplateInfo[] = [
  {
    id: "instagram-reels",
    name: "Instagram Reels",
    description: "Basic vertical video template with text overlays and audio tracks",
    category: "social",
    aspectRatio: "9:16",
    duration: 30,
    create: createInstagramReelsTemplate,
  },
  {
    id: "motivational-quote",
    name: "Motivational Quote",
    description: "Elegant quote display with accent bar and author attribution",
    category: "social",
    aspectRatio: "9:16",
    duration: 10,
    create: createMotivationalQuoteTemplate,
  },
  {
    id: "product-showcase",
    name: "Product Showcase",
    description: "Three-scene product reveal with features list and CTA",
    category: "marketing",
    aspectRatio: "9:16",
    duration: 20,
    create: createProductShowcaseTemplate,
  },
  {
    id: "listicle",
    name: "Top 5 List",
    description: "Countdown listicle with numbered items and bold typography",
    category: "entertainment",
    aspectRatio: "9:16",
    duration: 25,
    create: createListicleTemplate,
  },
  {
    id: "tutorial",
    name: "How-To Tutorial",
    description: "Step-by-step tutorial with numbered badges and descriptions",
    category: "education",
    aspectRatio: "9:16",
    duration: 30,
    create: createTutorialTemplate,
  },
  {
    id: "before-after",
    name: "Before & After",
    description: "Split comparison with dramatic reveal transition",
    category: "marketing",
    aspectRatio: "9:16",
    duration: 15,
    create: createBeforeAfterTemplate,
  },
  {
    id: "announcement",
    name: "Big Announcement",
    description: "Teaser-reveal-CTA structure for launches and announcements",
    category: "marketing",
    aspectRatio: "9:16",
    duration: 12,
    create: createAnnouncementTemplate,
  },
  {
    id: "text-story",
    name: "Text Story",
    description: "Typewriter-animated text story with scene transitions",
    category: "social",
    aspectRatio: "9:16",
    duration: 20,
    create: createTextStoryTemplate,
  },
  {
    id: "comparison",
    name: "A vs B Comparison",
    description: "Side-by-side comparison with split screen and winner reveal",
    category: "entertainment",
    aspectRatio: "9:16",
    duration: 15,
    create: createComparisonTemplate,
  },
  {
    id: "youtube-landscape",
    name: "YouTube Video",
    description: "16:9 landscape template with lower thirds and audio tracks",
    category: "social",
    aspectRatio: "16:9",
    duration: 30,
    create: createYouTubeLandscapeTemplate,
  },
  {
    id: "square-post",
    name: "Instagram Post",
    description: "1:1 square format for Instagram feed posts",
    category: "social",
    aspectRatio: "1:1",
    duration: 10,
    create: createSquarePostTemplate,
  },
  {
    id: "countdown",
    name: "Countdown Reveal",
    description: "5-4-3-2-1 countdown with dramatic reveal",
    category: "entertainment",
    aspectRatio: "9:16",
    duration: 15,
    create: createCountdownTemplate,
  },
  {
    id: "testimonial",
    name: "Testimonial / Review",
    description: "Customer review card with star rating and quote",
    category: "business",
    aspectRatio: "9:16",
    duration: 12,
    create: createTestimonialTemplate,
  },
];

/**
 * Get a template by ID. Returns undefined if not found.
 */
export function getTemplateById(id: string): TemplateInfo | undefined {
  return TEMPLATES.find((t) => t.id === id);
}

/**
 * Get templates filtered by category.
 */
export function getTemplatesByCategory(category: TemplateInfo["category"]): TemplateInfo[] {
  return TEMPLATES.filter((t) => t.category === category);
}
