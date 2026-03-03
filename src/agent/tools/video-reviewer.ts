/**
 * Video Reviewer
 *
 * Uses Google Gemini to analyze a VideoProject and provide feedback.
 *
 * Two review modes:
 * 1. Schema-based review (fast) — analyzes the JSON structure
 * 2. Visual review (thorough) — renders frames and sends images to Gemini
 *
 * Visual review requires @remotion/renderer and is loaded dynamically
 * to avoid bundling Node-only deps in client code.
 */

import fs from "fs";
import { GoogleGenAI } from "@google/genai";
import type { VideoProject } from "@/lib/schema/video-schema";

// ─── Scene Description Builder ──────────────────────────────────────

function buildSceneDescription(project: VideoProject): string {
  const { metadata } = project;
  const tracks = project.tracks ?? [];
  const audioTracks = project.audioTracks ?? [];
  const transitions = project.transitions ?? [];
  const assets = project.assets ?? {};

  const lines: string[] = [];

  // Project overview
  lines.push("## Video Project Overview");
  lines.push(`- Title: ${metadata.title}`);
  lines.push(`- Description: ${metadata.description || "(none)"}`);
  lines.push(`- Aspect Ratio: ${metadata.aspectRatio}`);
  lines.push(`- Resolution: ${metadata.resolution.width}x${metadata.resolution.height}`);
  lines.push(`- Duration: ${metadata.duration}s`);
  lines.push(`- FPS: ${metadata.fps}`);
  lines.push(`- Background Color: ${metadata.backgroundColor}`);
  lines.push("");

  // Tracks and clips
  lines.push("## Tracks & Clips");
  if (tracks.length === 0) {
    lines.push("(No tracks — the video is empty)");
  }

  for (const track of tracks) {
    lines.push(`### Track: "${track.name || track.id}" (type: ${track.type}, visible: ${track.visible})`);

    if (track.clips.length === 0) {
      lines.push("  - (No clips on this track)");
    }

    for (const clip of track.clips) {
      lines.push(`  - Clip: "${clip.id}" (track type: ${track.type})`);
      lines.push(`    Time: ${clip.startTime}s → ${(clip.startTime + clip.duration).toFixed(1)}s (${clip.duration}s)`);

      if (track.type === "text" && clip.text) {
        lines.push(`    Text: "${clip.text.content}"`);
        lines.push(`    Font: ${clip.text.fontFamily || "default"}, size: ${clip.text.fontSize || "default"}`);
        if (clip.text.color) lines.push(`    Color: ${clip.text.color}`);
      } else if ((track.type === "video" || track.type === "image") && clip.assetId) {
        const asset = assets[clip.assetId];
        lines.push(`    Source: ${asset?.url || "(no source)"}`);
      } else if (track.type === "shape" && clip.shape) {
        lines.push(`    Shape: ${clip.shape.shapeType}`);
        if (clip.shape.fill) lines.push(`    Fill: ${clip.shape.fill}`);
        lines.push(`    Size: ${clip.shape.width}x${clip.shape.height}`);
      }

      // Position
      if (clip.position) {
        lines.push(`    Position: (${clip.position.x}, ${clip.position.y})`);
      }

      // Scale
      if (clip.scale) {
        lines.push(`    Scale: (${clip.scale.x}, ${clip.scale.y})`);
      }

      // Animations
      if (clip.animations && clip.animations.length > 0) {
        const animDescs = clip.animations.map(
          (a) => `${a.type}${a.direction ? `-${a.direction}` : ""} (${a.duration}s, ${a.easing})`
        );
        lines.push(`    Animations: ${animDescs.join(", ")}`);
      }
    }
    lines.push("");
  }

  // Audio tracks
  if (audioTracks && audioTracks.length > 0) {
    lines.push("## Audio Tracks");
    for (const at of audioTracks) {
      lines.push(`- Audio Track: "${at.name || at.id}" (volume: ${at.volume})`);
      if (at.clips) {
        for (const ac of at.clips) {
          const audioAsset = assets[ac.assetId];
          lines.push(`  - Clip: "${ac.id}" (${ac.startTime}s → ${(ac.startTime + ac.duration).toFixed(1)}s)`);
          if (audioAsset) lines.push(`    Source: ${audioAsset.url}`);
          lines.push(`    Volume: ${ac.volume}, fadeIn: ${ac.fadeIn}s, fadeOut: ${ac.fadeOut}s`);
        }
      }
    }
    lines.push("");
  }

  // Transitions
  if (transitions && transitions.length > 0) {
    lines.push("## Transitions");
    for (const t of transitions) {
      lines.push(`- ${t.type} (${t.duration}s) between clips ${t.fromClipId} → ${t.toClipId}`);
    }
    lines.push("");
  }

  // Assets
  const assetValues = Object.values(assets);
  if (assetValues.length > 0) {
    lines.push("## Assets");
    for (const a of assetValues) {
      lines.push(`- ${a.type}: "${a.filename || a.id}" (${a.url || "(no URL)"})`);
    }
  }

  return lines.join("\n");
}

// ─── Review Prompts ─────────────────────────────────────────────────

const SCHEMA_REVIEW_PROMPT = `You are a professional video editor and content strategist reviewing a short-form video project.

You will receive a structured description of a video project (tracks, clips, text elements, animations, timing, etc.) represented as a schema. Your job is to review it as if you were watching the final rendered video.

Provide a thorough but concise review covering:

1. **Pacing & Timing**: Is the duration appropriate? Are clips too long/short? Is there good rhythm?
2. **Visual Design**: Color choices, layout, text readability, use of space
3. **Content Effectiveness**: Does the content convey its message? Is the text clear and impactful?
4. **Animations & Transitions**: Are they appropriate? Too many or too few?
5. **Technical Issues**: Missing assets, overlapping elements, empty tracks, timing gaps
6. **Suggestions**: 3-5 specific, actionable improvements the creator should make

Be direct and specific. Reference actual clip names, timing values, and track names.
Format your response in markdown.`;

const VISUAL_REVIEW_PROMPT = `You are a professional video editor reviewing a short-form video (Reel/TikTok/YouTube Short).

You are looking at rendered frames captured from the video at evenly spaced intervals. You also have the project schema for technical reference.

Analyze the actual visual output and provide a thorough review covering:

1. **Visual Quality**: How do the frames look? Are colors good? Is text readable? Are images/shapes visible?
2. **Layout & Composition**: Is content well-positioned? Any clipping or overflow issues? Good use of screen space?
3. **Pacing & Flow**: Based on the frame sequence, does the video seem to flow well? Are there empty/blank frames?
4. **Content Impact**: Will this video capture attention? Is the message clear from the visuals alone?
5. **Technical Problems**: Any completely blank frames, rendering artifacts, invisible elements, or obvious bugs?
6. **Specific Improvements**: 3-5 concrete, actionable suggestions with references to specific frames

IMPORTANT: If you see blank/empty frames or frames that are just a solid color with no visible content, flag this prominently as a critical rendering issue.

Be direct and specific. Format your response in markdown.`;

// ─── Main Review Function ───────────────────────────────────────────

/**
 * Review a video project. Attempts visual review first (with rendered frames),
 * falls back to schema-based review if rendering fails.
 */
export async function reviewVideo(
  project: VideoProject
): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return "Error: GEMINI_API_KEY is not configured. Please add it to your .env file to enable video review.";
  }

  // Try visual review first
  try {
    const visualReview = await visualReviewVideo(project, apiKey);
    return visualReview;
  } catch (err) {
    console.log("[Reviewer] Visual review failed, falling back to schema review:", err);
  }

  // Fallback to schema-based review
  return schemaReviewVideo(project, apiKey);
}

/**
 * Schema-based review (fast, no rendering needed).
 */
async function schemaReviewVideo(
  project: VideoProject,
  apiKey: string
): Promise<string> {
  const sceneDescription = buildSceneDescription(project);

  try {
    const ai = new GoogleGenAI({ apiKey });

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [
        {
          role: "user",
          parts: [
            {
              text: `${SCHEMA_REVIEW_PROMPT}\n\n---\n\n${sceneDescription}`,
            },
          ],
        },
      ],
    });

    const text = response.text;
    if (!text) {
      return "Error: Gemini returned an empty response. The video project may be too simple to review.";
    }

    return `[Schema-based review — no rendered frames]\n\n${text}`;
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : "Unknown error";
    return `Error reviewing video: ${errorMessage}`;
  }
}

/**
 * Visual review — captures rendered frames and sends them to Gemini.
 */
async function visualReviewVideo(
  project: VideoProject,
  apiKey: string
): Promise<string> {
  // Dynamically import the renderer (Node.js only)
  const { captureFrames } = await import("@/agent/tools/video-renderer");

  // Capture 5 evenly-spaced frames at 50% resolution for speed
  const frames = await captureFrames(project, 5, 0.5);

  // Read frame files as base64
  const frameParts: Array<{ inlineData: { mimeType: string; data: string } } | { text: string }> = [];

  const sceneDescription = buildSceneDescription(project);
  frameParts.push({
    text: `${VISUAL_REVIEW_PROMPT}\n\n## Project Schema Reference\n\n${sceneDescription}\n\n## Rendered Frames\n\nBelow are ${frames.length} frames captured at evenly spaced intervals throughout the video:`,
  });

  for (let i = 0; i < frames.length; i++) {
    const frame = frames[i];
    const imageData = fs.readFileSync(frame.outputPath);
    const base64 = imageData.toString("base64");

    frameParts.push({
      text: `\n### Frame ${i + 1} (frame #${frame.frame}):`,
    });
    frameParts.push({
      inlineData: {
        mimeType: "image/jpeg",
        data: base64,
      },
    });
  }

  const ai = new GoogleGenAI({ apiKey });

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: [
      {
        role: "user",
        parts: frameParts,
      },
    ],
  });

  const text = response.text;
  if (!text) {
    throw new Error("Gemini returned an empty response for visual review");
  }

  return `[Visual review — analyzed ${frames.length} rendered frames]\n\n${text}`;
}
