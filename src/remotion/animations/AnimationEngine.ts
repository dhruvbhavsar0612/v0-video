/**
 * Animation Engine
 *
 * Converts Animation schema objects into Remotion-compatible
 * interpolation values. Used by all visual elements.
 */

import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";

import type { Animation, EasingType, Keyframe } from "@/lib/schema/video-schema";

// ─── Easing Functions ───────────────────────────────────────────────

type EasingFn = (t: number) => number;

const EASING_FUNCTIONS: Record<EasingType, EasingFn> = {
  linear: (t) => t,
  easeIn: (t) => t * t,
  easeOut: (t) => t * (2 - t),
  easeInOut: (t) => (t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t),
  spring: (t) => t, // Spring handled separately via Remotion's spring()
};

// ─── Computed Animation Values ──────────────────────────────────────

export interface AnimationValues {
  opacity: number;
  translateX: number;
  translateY: number;
  scale: number;
  clipPath?: string;
}

const DEFAULT_VALUES: AnimationValues = {
  opacity: 1,
  translateX: 0,
  translateY: 0,
  scale: 1,
};

/**
 * Computes the combined animation values for a clip at the current frame.
 *
 * @param animations - List of animations from the clip schema
 * @param clipStartFrame - The frame where this clip starts
 * @param clipDurationFrames - Total frames this clip is visible
 */
export function useAnimationValues(
  animations: Animation[],
  clipStartFrame: number,
  clipDurationFrames: number
): AnimationValues {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Guard against potential NaN values from Remotion hooks
  const safeFrame = Number.isFinite(frame) ? frame : 0;
  const safeFps = Number.isFinite(fps) && fps > 0 ? fps : 30;

  if (animations.length === 0) {
    return DEFAULT_VALUES;
  }

  let result: AnimationValues = { ...DEFAULT_VALUES };

  for (const anim of animations) {
    const delayFrames = Math.round(anim.delay * safeFps);
    const durationFrames = Math.round(anim.duration * safeFps);

    const values = computeSingleAnimation(
      anim,
      safeFrame,
      clipStartFrame,
      clipDurationFrames,
      delayFrames,
      durationFrames,
      safeFps
    );

    // Compose animations (multiply opacity/scale, add translations)
    result = {
      opacity: result.opacity * values.opacity,
      translateX: result.translateX + values.translateX,
      translateY: result.translateY + values.translateY,
      scale: result.scale * values.scale,
    };
  }

  return result;
}

// ─── Single Animation Computation ───────────────────────────────────

function computeSingleAnimation(
  anim: Animation,
  frame: number,
  clipStartFrame: number,
  clipDurationFrames: number,
  delayFrames: number,
  durationFrames: number,
  fps: number
): AnimationValues {
  const result: AnimationValues = { ...DEFAULT_VALUES };

  switch (anim.type) {
    case "fadeIn": {
      const progress = getProgress(
        frame,
        clipStartFrame + delayFrames,
        durationFrames,
        anim.easing,
        fps
      );
      result.opacity = progress;
      break;
    }

    case "fadeOut": {
      const outStart =
        clipStartFrame + clipDurationFrames - durationFrames - delayFrames;
      const progress = getProgress(
        frame,
        outStart,
        durationFrames,
        anim.easing,
        fps
      );
      result.opacity = 1 - progress;
      break;
    }

    case "slideIn": {
      const progress = getProgress(
        frame,
        clipStartFrame + delayFrames,
        durationFrames,
        anim.easing,
        fps
      );
      const distance = 200;
      switch (anim.direction) {
        case "left":
          result.translateX = interpolate(progress, [0, 1], [-distance, 0]);
          break;
        case "right":
          result.translateX = interpolate(progress, [0, 1], [distance, 0]);
          break;
        case "up":
          result.translateY = interpolate(progress, [0, 1], [-distance, 0]);
          break;
        case "down":
        default:
          result.translateY = interpolate(progress, [0, 1], [distance, 0]);
          break;
      }
      result.opacity = progress;
      break;
    }

    case "slideOut": {
      const outStart =
        clipStartFrame + clipDurationFrames - durationFrames - delayFrames;
      const progress = getProgress(
        frame,
        outStart,
        durationFrames,
        anim.easing,
        fps
      );
      const distance = 200;
      switch (anim.direction) {
        case "left":
          result.translateX = interpolate(progress, [0, 1], [0, -distance]);
          break;
        case "right":
          result.translateX = interpolate(progress, [0, 1], [0, distance]);
          break;
        case "up":
          result.translateY = interpolate(progress, [0, 1], [0, -distance]);
          break;
        case "down":
        default:
          result.translateY = interpolate(progress, [0, 1], [0, distance]);
          break;
      }
      result.opacity = 1 - progress;
      break;
    }

    case "scaleIn": {
      const progress = getProgress(
        frame,
        clipStartFrame + delayFrames,
        durationFrames,
        anim.easing,
        fps
      );
      result.scale = interpolate(progress, [0, 1], [0, 1]);
      result.opacity = progress;
      break;
    }

    case "scaleOut": {
      const outStart =
        clipStartFrame + clipDurationFrames - durationFrames - delayFrames;
      const progress = getProgress(
        frame,
        outStart,
        durationFrames,
        anim.easing,
        fps
      );
      result.scale = interpolate(progress, [0, 1], [1, 0]);
      result.opacity = 1 - progress;
      break;
    }

    case "bounce": {
      const progress = getProgress(
        frame,
        clipStartFrame + delayFrames,
        durationFrames,
        "spring",
        fps
      );
      result.scale = interpolate(progress, [0, 1], [0.3, 1]);
      result.opacity = Math.min(progress * 2, 1);
      break;
    }

    case "typewriter": {
      // Typewriter is handled at the text element level
      // We just provide a progress value via opacity hack (0-1)
      const progress = getProgress(
        frame,
        clipStartFrame + delayFrames,
        durationFrames,
        anim.easing,
        fps
      );
      // Store progress as a special value -- the TextElement reads this
      result.opacity = progress;
      break;
    }

    case "blur": {
      // Blur is handled via filters in the element
      break;
    }

    case "none":
    default:
      break;
  }

  return result;
}

// ─── Progress Helpers ───────────────────────────────────────────────

function getProgress(
  frame: number,
  startFrame: number,
  durationFrames: number,
  easing: EasingType,
  fps: number
): number {
  // Guard against NaN inputs to prevent spring() from crashing
  if (!Number.isFinite(frame) || !Number.isFinite(fps) || !Number.isFinite(startFrame)) {
    return 0;
  }

  if (easing === "spring") {
    return spring({
      frame: frame - startFrame,
      fps: fps || 30, // Fallback for safety
      config: {
        damping: 12,
        stiffness: 150,
        mass: 1,
      },
    });
  }

  const raw = interpolate(frame, [startFrame, startFrame + durationFrames], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return EASING_FUNCTIONS[easing](raw);
}

/**
 * Check if a typewriter animation is present and return progress.
 */
export function getTypewriterProgress(
  animations: Animation[],
  frame: number,
  clipStartFrame: number,
  fps: number
): number | null {
  const typewriter = animations.find((a) => a.type === "typewriter");
  if (!typewriter) return null;

  const delayFrames = Math.round(typewriter.delay * fps);
  const durationFrames = Math.round(typewriter.duration * fps);

  return getProgress(
    frame,
    clipStartFrame + delayFrames,
    durationFrames,
    typewriter.easing,
    fps
  );
}

// ─── Keyframe Interpolation ──────────────────────────────────────────

/**
 * Per-property values derived from keyframes.
 * All values are absolute (not deltas). undefined means "no keyframe override".
 */
export interface KeyframeValues {
  opacity?: number;
  x?: number;
  y?: number;
  scaleX?: number;
  scaleY?: number;
  rotation?: number;
}

/**
 * Computes absolute property values at the current frame by interpolating
 * between the nearest keyframes. Returns {} when no keyframes are defined.
 *
 * Unlike the animation system (which computes deltas from a base state),
 * keyframe values are ABSOLUTE and override the base clip properties.
 */
export function computeKeyframeValues(
  keyframes: Keyframe[],
  frame: number,
  fps: number,
  clipDurationFrames: number
): KeyframeValues {
  if (!keyframes || keyframes.length === 0) return {};

  const safeFrame = Number.isFinite(frame) ? frame : 0;
  const safeFps = Number.isFinite(fps) && fps > 0 ? fps : 30;
  const safeDuration = clipDurationFrames > 0 ? clipDurationFrames : 1;

  // Normalised time within clip (0–1)
  const t = Math.min(Math.max(safeFrame / safeDuration, 0), 1);

  // Sort ascending by time
  const sorted = [...keyframes].sort((a, b) => a.time - b.time);

  // Find bracketing keyframes
  let before: Keyframe | undefined;
  let after: Keyframe | undefined;

  for (const kf of sorted) {
    if (kf.time <= t) before = kf;
    else if (after === undefined) after = kf;
  }

  // Edge cases: t is before all keyframes or after all keyframes
  if (!before && after) return extractKfValues(after);
  if (before && !after) return extractKfValues(before);
  if (!before || !after) return {};

  // Both sides found — interpolate
  const range = after.time - before.time;
  const localT = range > 0 ? (t - before.time) / range : 1;

  // Apply easing to local t (use the "after" keyframe's easing)
  const easing = after.easing ?? "easeInOut";
  const easedT = easing === "spring"
    ? spring({
        frame: Math.round(localT * 15), // map 0-1 to 0-15 frames for spring
        fps: safeFps,
        config: { damping: 12, stiffness: 150, mass: 1 },
      })
    : EASING_FUNCTIONS[easing](localT);

  const result: KeyframeValues = {};

  if (before.opacity !== undefined || after.opacity !== undefined) {
    result.opacity = lerp(before.opacity ?? 1, after.opacity ?? 1, easedT);
  }
  if (before.x !== undefined || after.x !== undefined) {
    result.x = lerp(before.x ?? 0, after.x ?? 0, easedT);
  }
  if (before.y !== undefined || after.y !== undefined) {
    result.y = lerp(before.y ?? 0, after.y ?? 0, easedT);
  }
  if (before.scaleX !== undefined || after.scaleX !== undefined) {
    result.scaleX = lerp(before.scaleX ?? 1, after.scaleX ?? 1, easedT);
  }
  if (before.scaleY !== undefined || after.scaleY !== undefined) {
    result.scaleY = lerp(before.scaleY ?? 1, after.scaleY ?? 1, easedT);
  }
  if (before.rotation !== undefined || after.rotation !== undefined) {
    result.rotation = lerp(before.rotation ?? 0, after.rotation ?? 0, easedT);
  }

  return result;
}

function extractKfValues(kf: Keyframe): KeyframeValues {
  const v: KeyframeValues = {};
  if (kf.opacity !== undefined) v.opacity = kf.opacity;
  if (kf.x !== undefined) v.x = kf.x;
  if (kf.y !== undefined) v.y = kf.y;
  if (kf.scaleX !== undefined) v.scaleX = kf.scaleX;
  if (kf.scaleY !== undefined) v.scaleY = kf.scaleY;
  if (kf.rotation !== undefined) v.rotation = kf.rotation;
  return v;
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}
