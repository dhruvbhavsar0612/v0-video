/**
 * Auto-Captions Tool
 *
 * Transcribes audio using ElevenLabs Scribe (scribe_v1) with word-level
 * timestamps, then groups words into caption segments and creates a text
 * track with timed subtitle clips.
 *
 * ElevenLabs Scribe docs:
 *   https://elevenlabs.io/docs/api-reference/speech-to-text
 */

import path from "path";
import fs from "fs";
import { v4 as uuidv4 } from "uuid";
import { ElevenLabsClient } from "elevenlabs";

import type { VideoProject, Clip, Track } from "@/lib/schema/video-schema";

// ─── Types ──────────────────────────────────────────────────────────

export type CaptionStyle = "default" | "bold" | "minimal" | "kinetic";

export interface GenerateCaptionsOptions {
  /** ID of the audio asset in project.assets to transcribe */
  audioAssetId: string;
  /** Visual style for the caption clips */
  style?: CaptionStyle;
  /** Maximum words per caption segment (default: 6) */
  maxWordsPerCaption?: number;
  /** Vertical position of captions in pixels (default: 1700) */
  position?: { x?: number; y?: number };
}

export interface GenerateCaptionsResult {
  /** Updated project with caption clips added */
  project: VideoProject;
  /** Number of caption segments created */
  segmentCount: number;
  /** Total transcript text */
  transcript: string;
  /** ID of the text track that was created/used */
  trackId: string;
}

// ─── Caption Style Presets ──────────────────────────────────────────

interface CaptionTextStyle {
  fontSize: number;
  fontWeight: "normal" | "bold" | "100" | "200" | "300" | "400" | "500" | "600" | "700" | "800" | "900";
  color: string;
  backgroundColor?: string;
  backgroundPadding?: number;
  backgroundBorderRadius?: number;
  textAlign: "left" | "center" | "right";
  lineHeight: number;
  letterSpacing: number;
  maxWidth: number;
  textShadow?: string;
  stroke?: { color: string; width: number };
  kineticTypography?: {
    mode: "word" | "char" | "line";
    style: "fade" | "slideUp" | "bounce" | "scale" | "wave";
    staggerMs: number;
  };
}

const CAPTION_STYLES: Record<CaptionStyle, CaptionTextStyle> = {
  default: {
    fontSize: 42,
    fontWeight: "bold",
    color: "#FFFFFF",
    backgroundColor: "rgba(0,0,0,0.75)",
    backgroundPadding: 12,
    backgroundBorderRadius: 6,
    textAlign: "center",
    lineHeight: 1.3,
    letterSpacing: 0,
    maxWidth: 900,
  },
  bold: {
    fontSize: 46,
    fontWeight: "bold",
    color: "#FFFFFF",
    backgroundColor: "#7C3AED",
    backgroundPadding: 14,
    backgroundBorderRadius: 8,
    textAlign: "center",
    lineHeight: 1.3,
    letterSpacing: 0,
    maxWidth: 880,
    stroke: { color: "#000000", width: 2 },
  },
  minimal: {
    fontSize: 40,
    fontWeight: "600",
    color: "#FFFFFF",
    textAlign: "center",
    lineHeight: 1.3,
    letterSpacing: 0.5,
    maxWidth: 900,
    textShadow: "0 2px 8px rgba(0,0,0,0.9)",
  },
  kinetic: {
    fontSize: 44,
    fontWeight: "bold",
    color: "#FFFFFF",
    textAlign: "center",
    lineHeight: 1.3,
    letterSpacing: 0,
    maxWidth: 900,
    textShadow: "0 2px 12px rgba(0,0,0,0.8)",
    kineticTypography: {
      mode: "word",
      style: "fade",
      staggerMs: 60,
    },
  },
};

// ─── Main Function ──────────────────────────────────────────────────

export async function generateCaptions(
  project: VideoProject,
  options: GenerateCaptionsOptions
): Promise<GenerateCaptionsResult> {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    throw new Error("ELEVENLABS_API_KEY environment variable is not set");
  }

  // Validate the audio asset exists
  const asset = project.assets[options.audioAssetId];
  if (!asset) {
    throw new Error(
      `Audio asset "${options.audioAssetId}" not found in project. ` +
      `Available assets: ${Object.keys(project.assets).join(", ") || "none"}`
    );
  }
  if (asset.type !== "audio") {
    throw new Error(
      `Asset "${options.audioAssetId}" is type "${asset.type}", expected "audio"`
    );
  }

  // Fetch the audio file as a ReadStream or Blob for ElevenLabs
  const audioFile = await fetchAudioAsStreamOrBlob(asset.url);

  // Transcribe with ElevenLabs Scribe
  const client = new ElevenLabsClient({ apiKey });

  const response = await client.speechToText.convert({
    file: audioFile,
    model_id: "scribe_v1",
    timestamps_granularity: "word",
  });

  // response.words: Array<{ text, start, end, type }>
  // type is "word" | "punctuation" | "spacing"
  const words = (response.words ?? []).filter(
    (w: { type: string }) => w.type === "word"
  ) as Array<{ text: string; start: number; end: number; type: string }>;

  const transcript = words.map((w) => w.text).join(" ");

  if (words.length === 0) {
    throw new Error("No words detected in audio. The audio may be silent or unsupported.");
  }

  // Group words into caption segments
  const maxWords = options.maxWordsPerCaption ?? 6;
  const segments = groupWordsIntoSegments(words, maxWords);

  // Determine position
  const captionX = options.position?.x ?? 540;
  const captionY = options.position?.y ?? 1700;

  // Find or create a caption text track
  let updatedProject = { ...project };
  let captionTrackId: string;

  const existingCaptionTrack = updatedProject.tracks.find(
    (t) => t.type === "text" && (t.name === "Captions" || t.name === "Auto-Captions")
  );

  if (existingCaptionTrack) {
    captionTrackId = existingCaptionTrack.id;
  } else {
    const newTrack: Track = {
      id: uuidv4(),
      type: "text",
      name: "Captions",
      clips: [],
      locked: false,
      visible: true,
      opacity: 1,
    };
    updatedProject = {
      ...updatedProject,
      tracks: [...updatedProject.tracks, newTrack],
    };
    captionTrackId = newTrack.id;
  }

  // Build caption clips
  const style = options.style ?? "default";
  const textStyle = CAPTION_STYLES[style];

  const captionClips: Clip[] = segments.map((seg) => ({
    id: uuidv4(),
    startTime: seg.start,
    duration: Math.max(seg.end - seg.start, 0.1),
    position: { x: captionX, y: captionY },
    text: {
      content: seg.text,
      fontSize: textStyle.fontSize,
      fontWeight: textStyle.fontWeight,
      fontFamily: "Inter",
      color: textStyle.color,
      backgroundColor: textStyle.backgroundColor,
      backgroundPadding: textStyle.backgroundPadding,
      backgroundBorderRadius: textStyle.backgroundBorderRadius,
      textAlign: textStyle.textAlign,
      lineHeight: textStyle.lineHeight,
      letterSpacing: textStyle.letterSpacing,
      maxWidth: textStyle.maxWidth,
      textShadow: textStyle.textShadow,
      stroke: textStyle.stroke,
      kineticTypography: textStyle.kineticTypography,
    },
    opacity: 1,
    rotation: 0,
    volume: 1,
    muted: false,
    resizeMode: "cover" as const,
    animations: [],
    filters: [],
    keyframes: [],
  }));

  // Add clips to the caption track
  updatedProject = {
    ...updatedProject,
    tracks: updatedProject.tracks.map((t) =>
      t.id === captionTrackId
        ? { ...t, clips: [...t.clips, ...captionClips] }
        : t
    ),
  };

  return {
    project: updatedProject,
    segmentCount: segments.length,
    transcript,
    trackId: captionTrackId,
  };
}

// ─── Helpers ─────────────────────────────────────────────────────────

interface WordTiming {
  text: string;
  start: number;
  end: number;
  type: string;
}

interface CaptionSegment {
  text: string;
  start: number;
  end: number;
}

function groupWordsIntoSegments(
  words: WordTiming[],
  maxWords: number
): CaptionSegment[] {
  const segments: CaptionSegment[] = [];
  let i = 0;

  while (i < words.length) {
    const chunk = words.slice(i, i + maxWords);
    segments.push({
      text: chunk.map((w) => w.text).join(" "),
      start: chunk[0].start,
      end: chunk[chunk.length - 1].end,
    });
    i += maxWords;
  }

  return segments;
}

/**
 * Fetch an audio file from a URL or local path and return it as a fs.ReadStream or Blob.
 * ElevenLabs accepts fs.ReadStream for local files and Blob for remote.
 */
async function fetchAudioAsStreamOrBlob(url: string): Promise<fs.ReadStream | Blob> {
  if (url.startsWith("http://") || url.startsWith("https://")) {
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`Failed to fetch audio from ${url}: ${res.status} ${res.statusText}`);
    }
    const arrayBuffer = await res.arrayBuffer();
    return new Blob([arrayBuffer]);
  }

  // Local path — resolve relative to project root's /public dir
  const localPath = url.startsWith("/")
    ? path.resolve("./public" + url)
    : path.resolve("./public/" + url);

  if (!fs.existsSync(localPath)) {
    throw new Error(`Audio file not found at ${localPath}`);
  }

  return fs.createReadStream(localPath);
}
