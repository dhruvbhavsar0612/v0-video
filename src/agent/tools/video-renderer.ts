/**
 * Video Renderer
 *
 * Uses Remotion's SSR APIs (@remotion/bundler + @remotion/renderer)
 * to render videos to MP4 files and capture still frames.
 *
 * The bundle is cached so subsequent renders reuse it for speed.
 */

import path from "path";
import fs from "fs";
import { bundle } from "@remotion/bundler";
import {
  renderMedia,
  renderStill,
  selectComposition,
} from "@remotion/renderer";
import type { VideoProject } from "@/lib/schema/video-schema";

const COMPOSITION_ID = "VideoProject";
const OUTPUT_DIR = path.resolve("./public/renders");
const REMOTION_ENTRY = path.resolve("./src/remotion/index.ts");

// Cache the bundle path to avoid re-bundling for every render
let cachedBundlePath: string | null = null;

/**
 * Ensure the output directory exists.
 */
function ensureOutputDir() {
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }
}

/**
 * Get or create the Remotion bundle.
 * Bundles are expensive (~10-30s) so we cache the result.
 */
async function getBundle(): Promise<string> {
  if (cachedBundlePath && fs.existsSync(cachedBundlePath)) {
    return cachedBundlePath;
  }

  const bundlePath = await bundle({
    entryPoint: REMOTION_ENTRY,
    onProgress: (progress: number) => {
      if (Math.round(progress * 100) % 25 === 0) {
        console.log(`[Renderer] Bundling: ${Math.round(progress * 100)}%`);
      }
    },
  });

  cachedBundlePath = bundlePath;
  return bundlePath;
}

export interface RenderVideoOptions {
  /** The project to render */
  project: VideoProject;
  /** Output filename (without extension). Defaults to project ID */
  filename?: string;
  /** Video codec. Defaults to h264 */
  codec?: "h264" | "h265" | "vp8" | "vp9";
  /** CRF quality (0-51, lower = better). Defaults to 23 */
  crf?: number;
  /** Number of parallel frame renders. Defaults to 2 */
  concurrency?: number;
  /** Scale factor (0.5 = half resolution). Defaults to 1 */
  scale?: number;
  /** Progress callback */
  onProgress?: (progress: number) => void;
}

export interface RenderResult {
  /** Absolute path to the rendered file */
  outputPath: string;
  /** Relative URL path (for serving via Next.js /public) */
  publicUrl: string;
  /** Duration in seconds */
  durationMs: number;
}

/**
 * Render a VideoProject to an MP4 file.
 */
export async function renderVideo(
  options: RenderVideoOptions
): Promise<RenderResult> {
  const startTime = Date.now();
  ensureOutputDir();

  const {
    project,
    filename = project.id,
    codec = "h264",
    crf = 23,
    concurrency = 2,
    scale = 1,
    onProgress,
  } = options;

  const outputFile = `${filename}.mp4`;
  const outputPath = path.join(OUTPUT_DIR, outputFile);
  const publicUrl = `/renders/${outputFile}`;

  const bundlePath = await getBundle();

  const inputProps = { project };

  const composition = await selectComposition({
    serveUrl: bundlePath,
    id: COMPOSITION_ID,
    inputProps,
  });

  // Override composition dimensions/duration with the project's values
  const overriddenComposition = {
    ...composition,
    width: project.metadata.resolution.width,
    height: project.metadata.resolution.height,
    fps: project.metadata.fps,
    durationInFrames: Math.ceil(
      project.metadata.duration * project.metadata.fps
    ),
  };

  await renderMedia({
    composition: overriddenComposition,
    serveUrl: bundlePath,
    codec,
    outputLocation: outputPath,
    inputProps,
    crf,
    concurrency,
    scale,
    imageFormat: "jpeg",
    jpegQuality: 85,
    overwrite: true,
    logLevel: "warn",
    onProgress: ({ progress }) => {
      onProgress?.(progress);
    },
  });

  const durationMs = Date.now() - startTime;
  console.log(
    `[Renderer] Rendered ${outputFile} in ${(durationMs / 1000).toFixed(1)}s`
  );

  return { outputPath, publicUrl, durationMs };
}

export interface CaptureFrameOptions {
  /** The project to capture from */
  project: VideoProject;
  /** Frame number to capture (0-indexed). Defaults to 0 */
  frame?: number;
  /** Output filename (without extension) */
  filename?: string;
  /** Image format. Defaults to jpeg */
  imageFormat?: "png" | "jpeg" | "webp";
  /** JPEG quality (0-100). Defaults to 80 */
  jpegQuality?: number;
  /** Scale factor. Defaults to 0.5 (half resolution for speed) */
  scale?: number;
}

export interface CaptureResult {
  /** Absolute path to the captured frame */
  outputPath: string;
  /** Relative URL path */
  publicUrl: string;
  /** Frame number captured */
  frame: number;
}

/**
 * Capture a single frame from a VideoProject as an image.
 * Useful for thumbnails and visual review.
 */
export async function captureFrame(
  options: CaptureFrameOptions
): Promise<CaptureResult> {
  ensureOutputDir();

  const {
    project,
    frame = 0,
    filename = `${project.id}-frame-${frame}`,
    imageFormat = "jpeg",
    jpegQuality = 80,
    scale = 0.5,
  } = options;

  const ext = imageFormat === "jpeg" ? "jpg" : imageFormat;
  const outputFile = `${filename}.${ext}`;
  const outputPath = path.join(OUTPUT_DIR, outputFile);
  const publicUrl = `/renders/${outputFile}`;

  const bundlePath = await getBundle();

  const inputProps = { project };

  const composition = await selectComposition({
    serveUrl: bundlePath,
    id: COMPOSITION_ID,
    inputProps,
  });

  const overriddenComposition = {
    ...composition,
    width: project.metadata.resolution.width,
    height: project.metadata.resolution.height,
    fps: project.metadata.fps,
    durationInFrames: Math.ceil(
      project.metadata.duration * project.metadata.fps
    ),
  };

  await renderStill({
    composition: overriddenComposition,
    serveUrl: bundlePath,
    output: outputPath,
    frame,
    imageFormat,
    jpegQuality,
    scale,
    inputProps,
    overwrite: true,
    logLevel: "warn",
  });

  return { outputPath, publicUrl, frame };
}

/**
 * Capture multiple frames at evenly spaced intervals.
 * Useful for visual review — captures key moments of the video.
 */
export async function captureFrames(
  project: VideoProject,
  count: number = 5,
  scale: number = 0.5
): Promise<CaptureResult[]> {
  const totalFrames = Math.ceil(
    project.metadata.duration * project.metadata.fps
  );

  // Calculate evenly spaced frame numbers
  const frameNumbers: number[] = [];
  for (let i = 0; i < count; i++) {
    const frame = Math.round((i / (count - 1)) * (totalFrames - 1));
    frameNumbers.push(Math.max(0, Math.min(frame, totalFrames - 1)));
  }

  // Capture frames sequentially (each opens a browser)
  const results: CaptureResult[] = [];
  for (const frame of frameNumbers) {
    const result = await captureFrame({
      project,
      frame,
      scale,
    });
    results.push(result);
  }

  return results;
}

/**
 * Invalidate the cached bundle (call when Remotion components change).
 */
export function invalidateBundleCache() {
  cachedBundlePath = null;
}
