/**
 * Schema Validator
 *
 * Provides validation utilities for VideoProject schemas.
 * Used by both the AI agent (to validate generated schemas)
 * and the frontend (to validate before rendering).
 */

import { ZodError } from "zod";

import {
  VideoProjectSchema,
  ClipSchema,
  TrackSchema,
  AssetSchema,
  TransitionSchema,
  type VideoProject,
  type Clip,
  type Track,
} from "./video-schema";

// ─── Validation Result Type ─────────────────────────────────────────

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

export interface ValidationError {
  path: string;
  message: string;
  code: string;
}

export interface ValidationWarning {
  path: string;
  message: string;
  code: string;
}

// ─── Core Validation ────────────────────────────────────────────────

/**
 * Validates a VideoProject against the Zod schema and runs
 * additional semantic checks (e.g., asset references, timing overlaps).
 */
export function validateProject(data: unknown): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];

  // Step 1: Zod schema validation
  const zodResult = VideoProjectSchema.safeParse(data);
  if (!zodResult.success) {
    for (const issue of zodResult.error.issues) {
      errors.push({
        path: issue.path.join("."),
        message: issue.message,
        code: "SCHEMA_VALIDATION",
      });
    }
    return { valid: false, errors, warnings };
  }

  const project = zodResult.data;

  // Step 2: Semantic validations
  validateAssetReferences(project, errors);
  validateTransitionReferences(project, errors);
  validateClipTimings(project, errors, warnings);
  validateDurationConsistency(project, warnings);

  return { valid: errors.length === 0, errors, warnings };
}

/**
 * Parses and validates a VideoProject, returning the typed result or throwing.
 */
export function parseProject(data: unknown): VideoProject {
  return VideoProjectSchema.parse(data);
}

/**
 * Safely parses a VideoProject, returning null on failure.
 */
export function safeParseProject(
  data: unknown
): { success: true; data: VideoProject } | { success: false; error: ZodError } {
  return VideoProjectSchema.safeParse(data);
}

/**
 * Validates a single clip against the Clip schema.
 */
export function validateClip(data: unknown) {
  return ClipSchema.safeParse(data);
}

/**
 * Validates a single track against the Track schema.
 */
export function validateTrack(data: unknown) {
  return TrackSchema.safeParse(data);
}

/**
 * Validates a single asset against the Asset schema.
 */
export function validateAsset(data: unknown) {
  return AssetSchema.safeParse(data);
}

/**
 * Validates a single transition against the Transition schema.
 */
export function validateTransition(data: unknown) {
  return TransitionSchema.safeParse(data);
}

// ─── Semantic Validations ───────────────────────────────────────────

/**
 * Ensures all assetId references in clips point to existing assets.
 */
function validateAssetReferences(
  project: VideoProject,
  errors: ValidationError[]
): void {
  const assetIds = new Set(Object.keys(project.assets));

  for (const track of project.tracks) {
    for (const clip of track.clips) {
      if (clip.assetId && !assetIds.has(clip.assetId)) {
        errors.push({
          path: `tracks[${track.id}].clips[${clip.id}].assetId`,
          message: `Asset "${clip.assetId}" not found in assets registry`,
          code: "MISSING_ASSET_REFERENCE",
        });
      }
    }
  }

  for (const audioTrack of project.audioTracks) {
    for (const clip of audioTrack.clips) {
      if (!assetIds.has(clip.assetId)) {
        errors.push({
          path: `audioTracks[${audioTrack.id}].clips[${clip.id}].assetId`,
          message: `Audio asset "${clip.assetId}" not found in assets registry`,
          code: "MISSING_ASSET_REFERENCE",
        });
      }
    }
  }
}

/**
 * Ensures all transition clip references point to existing clips.
 */
function validateTransitionReferences(
  project: VideoProject,
  errors: ValidationError[]
): void {
  const clipIds = new Set<string>();
  for (const track of project.tracks) {
    for (const clip of track.clips) {
      clipIds.add(clip.id);
    }
  }

  for (const transition of project.transitions) {
    if (!clipIds.has(transition.fromClipId)) {
      errors.push({
        path: `transitions[${transition.id}].fromClipId`,
        message: `Clip "${transition.fromClipId}" not found`,
        code: "MISSING_CLIP_REFERENCE",
      });
    }
    if (!clipIds.has(transition.toClipId)) {
      errors.push({
        path: `transitions[${transition.id}].toClipId`,
        message: `Clip "${transition.toClipId}" not found`,
        code: "MISSING_CLIP_REFERENCE",
      });
    }
  }
}

/**
 * Checks for overlapping clips on the same track and clips
 * that extend beyond the project duration.
 */
function validateClipTimings(
  project: VideoProject,
  errors: ValidationError[],
  warnings: ValidationWarning[]
): void {
  for (const track of project.tracks) {
    const sortedClips = [...track.clips].sort(
      (a, b) => a.startTime - b.startTime
    );

    for (let i = 0; i < sortedClips.length; i++) {
      const clip = sortedClips[i];
      const clipEnd = clip.startTime + clip.duration;

      // Check if clip extends beyond project duration
      if (clipEnd > project.metadata.duration + 0.1) {
        warnings.push({
          path: `tracks[${track.id}].clips[${clip.id}]`,
          message: `Clip ends at ${clipEnd}s but project duration is ${project.metadata.duration}s`,
          code: "CLIP_EXCEEDS_DURATION",
        });
      }

      // Check for overlap with next clip on same track
      if (i < sortedClips.length - 1) {
        const nextClip = sortedClips[i + 1];
        if (clipEnd > nextClip.startTime + 0.01) {
          warnings.push({
            path: `tracks[${track.id}].clips[${clip.id}]`,
            message: `Clip overlaps with clip "${nextClip.id}" (ends at ${clipEnd}s, next starts at ${nextClip.startTime}s)`,
            code: "CLIP_OVERLAP",
          });
        }
      }
    }
  }
}

/**
 * Warns if the metadata.duration doesn't match the actual content.
 */
function validateDurationConsistency(
  project: VideoProject,
  warnings: ValidationWarning[]
): void {
  let maxEndTime = 0;

  for (const track of project.tracks) {
    for (const clip of track.clips) {
      const clipEnd = clip.startTime + clip.duration;
      if (clipEnd > maxEndTime) {
        maxEndTime = clipEnd;
      }
    }
  }

  for (const audioTrack of project.audioTracks) {
    for (const clip of audioTrack.clips) {
      const clipEnd = clip.startTime + clip.duration;
      if (clipEnd > maxEndTime) {
        maxEndTime = clipEnd;
      }
    }
  }

  if (maxEndTime > 0 && Math.abs(maxEndTime - project.metadata.duration) > 1) {
    warnings.push({
      path: "metadata.duration",
      message: `Declared duration (${project.metadata.duration}s) differs from actual content end (${maxEndTime}s)`,
      code: "DURATION_MISMATCH",
    });
  }
}

// ─── Utility: Collect All Clip IDs ──────────────────────────────────

export function getAllClipIds(project: VideoProject): string[] {
  const ids: string[] = [];
  for (const track of project.tracks) {
    for (const clip of track.clips) {
      ids.push(clip.id);
    }
  }
  return ids;
}

/**
 * Find a clip by ID across all tracks.
 */
export function findClipById(
  project: VideoProject,
  clipId: string
): { track: Track; clip: Clip; trackIndex: number; clipIndex: number } | null {
  for (let ti = 0; ti < project.tracks.length; ti++) {
    const track = project.tracks[ti];
    for (let ci = 0; ci < track.clips.length; ci++) {
      if (track.clips[ci].id === clipId) {
        return { track, clip: track.clips[ci], trackIndex: ti, clipIndex: ci };
      }
    }
  }
  return null;
}
