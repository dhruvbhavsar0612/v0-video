/**
 * AI Image Generator
 *
 * Uses Fal.ai to generate images from text prompts.
 * Supports multiple models with different speed/quality tradeoffs.
 *
 * Fal.ai docs: https://fal.ai/models
 */

import { fal } from "@fal-ai/client";

// ─── Model Registry ──────────────────────────────────────────────────

export type ImageModel = "flux-schnell" | "flux-dev" | "flux-pro" | "stable-diffusion-xl";

const MODEL_ENDPOINTS: Record<ImageModel, string> = {
  "flux-schnell": "fal-ai/flux/schnell",   // Fast, good quality
  "flux-dev": "fal-ai/flux/dev",           // High quality, slower
  "flux-pro": "fal-ai/flux-pro",           // Best quality, slower
  "stable-diffusion-xl": "fal-ai/stable-diffusion-xl",
};

// ─── Types ──────────────────────────────────────────────────────────

export interface GenerateImageOptions {
  /** Text prompt describing the desired image */
  prompt: string;
  /** Negative prompt — things to avoid */
  negativePrompt?: string;
  /** Model to use (default: flux-schnell for speed) */
  model?: ImageModel;
  /** Image dimensions */
  width?: number;
  height?: number;
  /** Number of inference steps (higher = better quality, slower) */
  numInferenceSteps?: number;
  /** Guidance scale for prompt adherence */
  guidanceScale?: number;
  /** Number of images to generate (1-4) */
  numImages?: number;
}

export interface GeneratedImage {
  /** Direct URL to the generated image */
  url: string;
  /** Image width in pixels */
  width: number;
  /** Image height in pixels */
  height: number;
  /** Content type */
  contentType: string;
}

export interface GenerateImageResult {
  images: GeneratedImage[];
  /** Model used for generation */
  model: string;
  /** Time taken in milliseconds */
  durationMs: number;
  /** The seed used (for reproducibility) */
  seed?: number;
}

// ─── Fal.ai Response Types ───────────────────────────────────────────

interface FalImage {
  url: string;
  width: number;
  height: number;
  content_type: string;
}

interface FalResult {
  images?: FalImage[];
  image?: FalImage;
  seed?: number;
}

// ─── Main Function ──────────────────────────────────────────────────

/**
 * Generate images using Fal.ai.
 */
export async function generateImage(
  options: GenerateImageOptions
): Promise<GenerateImageResult> {
  const apiKey = process.env.FAL_KEY;
  if (!apiKey) {
    throw new Error("FAL_KEY environment variable is not set");
  }

  fal.config({ credentials: apiKey });

  const model = options.model ?? "flux-schnell";
  const endpoint = MODEL_ENDPOINTS[model];
  const startTime = Date.now();

  // Build input based on model capabilities
  const input: Record<string, unknown> = {
    prompt: options.prompt,
    image_size: buildImageSize(options.width, options.height),
    num_inference_steps: options.numInferenceSteps ?? (model === "flux-schnell" ? 4 : 28),
    num_images: options.numImages ?? 1,
    enable_safety_checker: false,
  };

  if (options.negativePrompt) {
    input.negative_prompt = options.negativePrompt;
  }
  if (options.guidanceScale !== undefined) {
    input.guidance_scale = options.guidanceScale;
  }

  const result = await fal.subscribe(endpoint, { input }) as { data: FalResult };

  const falResult = result.data;
  const rawImages = falResult.images ?? (falResult.image ? [falResult.image] : []);

  if (rawImages.length === 0) {
    throw new Error("Fal.ai returned no images");
  }

  return {
    images: rawImages.map((img) => ({
      url: img.url,
      width: img.width,
      height: img.height,
      contentType: img.content_type || "image/jpeg",
    })),
    model,
    durationMs: Date.now() - startTime,
    seed: falResult.seed,
  };
}

// ─── Helpers ─────────────────────────────────────────────────────────

type FalImageSize =
  | "square_hd"
  | "square"
  | "portrait_4_3"
  | "portrait_16_9"
  | "landscape_4_3"
  | "landscape_16_9"
  | { width: number; height: number };

function buildImageSize(
  width?: number,
  height?: number
): FalImageSize {
  if (width && height) {
    return { width, height };
  }
  if (width === height) return "square_hd";
  if (!width && !height) return "portrait_16_9"; // good default for 9:16 videos
  if (width && height) return { width, height };
  return "square_hd";
}
