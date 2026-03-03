/**
 * Tool Executor
 *
 * Executes agent tool calls against a VideoProject, returning
 * the modified project and a result message.
 */

import { v4 as uuidv4 } from "uuid";
import type { VideoProject, Track, Clip, AudioTrack, AudioClip } from "@/lib/schema/video-schema";
import { validateProject, safeParseProject } from "@/lib/schema/schema-validator";
import { reviewVideo } from "@/agent/tools/video-reviewer";
import { searchStockMedia } from "@/agent/tools/stock-media";

// ─── Types ──────────────────────────────────────────────────────────

export interface ToolExecutionResult {
  /** Updated project (null if the tool was read-only) */
  project: VideoProject | null;
  /** Result message to send back to the LLM */
  message: string;
  /** Whether the project was modified */
  modified: boolean;
}

// ─── Main Executor ──────────────────────────────────────────────────

export async function executeToolCall(
  toolName: string,
  toolInput: Record<string, unknown>,
  currentProject: VideoProject
): Promise<ToolExecutionResult> {
  switch (toolName) {
    case "update_project":
      return executeUpdateProject(toolInput, currentProject);
    case "update_metadata":
      return executeUpdateMetadata(toolInput, currentProject);
    case "add_track":
      return executeAddTrack(toolInput, currentProject);
    case "remove_track":
      return executeRemoveTrack(toolInput, currentProject);
    case "add_clip":
      return executeAddClip(toolInput, currentProject);
    case "update_clip":
      return executeUpdateClip(toolInput, currentProject);
    case "remove_clip":
      return executeRemoveClip(toolInput, currentProject);
    case "add_asset":
      return executeAddAsset(toolInput, currentProject);
    case "add_transition":
      return executeAddTransition(toolInput, currentProject);
    case "get_project_summary":
      return executeGetProjectSummary(currentProject);
    case "review_video":
      return executeReviewVideo(currentProject);
    case "search_stock_media":
      return executeSearchStockMedia(toolInput);
    case "add_audio_track":
      return executeAddAudioTrack(toolInput, currentProject);
    case "add_audio_clip":
      return executeAddAudioClip(toolInput, currentProject);
    case "render_video":
      return executeRenderVideo(toolInput, currentProject);
    case "generate_image":
      return executeGenerateImage(toolInput, currentProject);
    case "generate_voiceover":
      return executeGenerateVoiceover(toolInput, currentProject);
    case "list_skills":
      return executeListSkills(toolInput);
    case "apply_skill":
      return executeApplySkill(toolInput, currentProject);
    case "add_keyframe":
      return executeAddKeyframe(toolInput, currentProject);
    case "remove_keyframe":
      return executeRemoveKeyframe(toolInput, currentProject);
    case "generate_captions":
      return executeGenerateCaptions(toolInput, currentProject);
    default:
      return {
        project: null,
        message: `Unknown tool: ${toolName}`,
        modified: false,
      };
  }
}

// ─── update_project ─────────────────────────────────────────────────

function executeUpdateProject(
  input: Record<string, unknown>,
  currentProject: VideoProject
): ToolExecutionResult {
  const newProject = input.project as Record<string, unknown>;

  if (!newProject) {
    return {
      project: null,
      message: "Error: 'project' field is required.",
      modified: false,
    };
  }

  // Merge with preserved fields before parsing
  const rawProject = {
    ...newProject,
    version: "1.0",
    id: currentProject.id,
    createdAt: currentProject.createdAt,
    updatedAt: new Date().toISOString(),
  };

  // Parse through Zod to apply defaults (audioTracks: [], transitions: [], assets: {}, etc.)
  const parseResult = safeParseProject(rawProject);
  if (!parseResult.success) {
    const errorMessages = parseResult.error.issues
      .map((e) => `${e.path.join(".")}: ${e.message}`)
      .join("\n");
    return {
      project: null,
      message: `Validation errors in the project:\n${errorMessages}\n\nPlease fix these issues and try again.`,
      modified: false,
    };
  }

  const project = parseResult.data;

  // Run semantic validations (asset refs, timing overlaps, etc.)
  const validation = validateProject(project);
  const warnings =
    validation.warnings.length > 0
      ? `\nWarnings:\n${validation.warnings.map((w) => `- ${w.message}`).join("\n")}`
      : "";

  return {
    project,
    message: `Project updated successfully. ${project.tracks.length} tracks, ${countClips(project)} clips.${warnings}`,
    modified: true,
  };
}

// ─── update_metadata ────────────────────────────────────────────────

function executeUpdateMetadata(
  input: Record<string, unknown>,
  currentProject: VideoProject
): ToolExecutionResult {
  const project: VideoProject = {
    ...currentProject,
    metadata: {
      ...currentProject.metadata,
      ...Object.fromEntries(
        Object.entries(input).filter(([, v]) => v !== undefined)
      ),
    },
    updatedAt: new Date().toISOString(),
  };

  return {
    project,
    message: `Metadata updated: ${Object.keys(input).join(", ")}`,
    modified: true,
  };
}

// ─── add_track ──────────────────────────────────────────────────────

function executeAddTrack(
  input: Record<string, unknown>,
  currentProject: VideoProject
): ToolExecutionResult {
  const trackId = uuidv4();
  const newTrack: Track = {
    id: trackId,
    type: input.type as Track["type"],
    name: (input.name as string) || `Track ${currentProject.tracks.length + 1}`,
    clips: [],
    locked: false,
    visible: true,
    opacity: 1,
  };

  const tracks = [...currentProject.tracks];
  const insertIndex =
    typeof input.insertIndex === "number"
      ? Math.min(Math.max(0, input.insertIndex), tracks.length)
      : tracks.length;

  tracks.splice(insertIndex, 0, newTrack);

  const project: VideoProject = {
    ...currentProject,
    tracks,
    updatedAt: new Date().toISOString(),
  };

  return {
    project,
    message: `Track "${newTrack.name}" (${newTrack.type}) added with ID: ${trackId}`,
    modified: true,
  };
}

// ─── remove_track ───────────────────────────────────────────────────

function executeRemoveTrack(
  input: Record<string, unknown>,
  currentProject: VideoProject
): ToolExecutionResult {
  const trackId = input.trackId as string;
  const track = currentProject.tracks.find((t) => t.id === trackId);

  if (!track) {
    return {
      project: null,
      message: `Error: Track with ID "${trackId}" not found.`,
      modified: false,
    };
  }

  // Also remove transitions referencing clips from this track
  const clipIds = new Set(track.clips.map((c) => c.id));
  const project: VideoProject = {
    ...currentProject,
    tracks: currentProject.tracks.filter((t) => t.id !== trackId),
    transitions: currentProject.transitions.filter(
      (t) => !clipIds.has(t.fromClipId) && !clipIds.has(t.toClipId)
    ),
    updatedAt: new Date().toISOString(),
  };

  return {
    project,
    message: `Track "${track.name}" removed along with ${track.clips.length} clips.`,
    modified: true,
  };
}

// ─── add_clip ───────────────────────────────────────────────────────

function executeAddClip(
  input: Record<string, unknown>,
  currentProject: VideoProject
): ToolExecutionResult {
  const trackId = input.trackId as string;
  const clipData = input.clip as Record<string, unknown>;

  const trackIndex = currentProject.tracks.findIndex((t) => t.id === trackId);
  if (trackIndex === -1) {
    return {
      project: null,
      message: `Error: Track with ID "${trackId}" not found.`,
      modified: false,
    };
  }

  const track = currentProject.tracks[trackIndex];

  // ── Validate required fields based on track type ──────────────
  if (track.type === "text" && !clipData.text) {
    return {
      project: null,
      message: `Error: Clips on a "text" track must include a "text" field with at least { content, fontSize, fontFamily, fontWeight, color, textAlign, lineHeight }.`,
      modified: false,
    };
  }
  if (track.type === "shape" && !clipData.shape) {
    return {
      project: null,
      message: `Error: Clips on a "shape" track must include a "shape" field with at least { shapeType, width, height, fill }.`,
      modified: false,
    };
  }
  if ((track.type === "video" || track.type === "image" || track.type === "sticker") && !clipData.assetId) {
    return {
      project: null,
      message: `Error: Clips on a "${track.type}" track must include an "assetId" referencing a registered asset. Use add_asset first.`,
      modified: false,
    };
  }
  // Validate that assetId actually exists in the project
  if (clipData.assetId) {
    const assetId = clipData.assetId as string;
    if (!currentProject.assets[assetId]) {
      return {
        project: null,
        message: `Error: Asset with ID "${assetId}" not found in project assets. Use add_asset first to register the asset, then reference its returned ID.`,
        modified: false,
      };
    }
  }

  const clipId = uuidv4();
  const newClip = {
    id: clipId,
    startTime: (clipData.startTime as number) ?? 0,
    duration: (clipData.duration as number) ?? 5,
    opacity: (clipData.opacity as number) ?? 1,
    rotation: (clipData.rotation as number) ?? 0,
    volume: (clipData.volume as number) ?? 1,
    muted: (clipData.muted as boolean) ?? false,
    resizeMode: (clipData.resizeMode as Clip["resizeMode"]) ?? "cover",
    animations: (clipData.animations as Clip["animations"]) ?? [],
    filters: (clipData.filters as Clip["filters"]) ?? [],
  } as Clip;

  if (clipData.assetId) newClip.assetId = clipData.assetId as string;
  if (clipData.position) newClip.position = clipData.position as Clip["position"];
  if (clipData.scale) newClip.scale = clipData.scale as Clip["scale"];
  if (clipData.trim) newClip.trim = clipData.trim as Clip["trim"];
  if (clipData.text) newClip.text = clipData.text as Clip["text"];
  if (clipData.shape) newClip.shape = clipData.shape as Clip["shape"];
  if (clipData.kenBurns) newClip.kenBurns = clipData.kenBurns as Clip["kenBurns"];

  const tracks = currentProject.tracks.map((t, i) =>
    i === trackIndex ? { ...t, clips: [...t.clips, newClip] } : t
  );

  // ── Auto-extend metadata.duration if clip extends beyond it ───
  const clipEndTime = newClip.startTime + newClip.duration;
  let metadata = currentProject.metadata;
  let durationWarning = "";
  if (clipEndTime > metadata.duration) {
    metadata = { ...metadata, duration: clipEndTime };
    durationWarning = ` (metadata.duration auto-extended to ${clipEndTime}s)`;
  }

  const project: VideoProject = {
    ...currentProject,
    tracks,
    metadata,
    updatedAt: new Date().toISOString(),
  };

  return {
    project,
    message: `Clip added to track "${track.name}" with ID: ${clipId} (startTime: ${newClip.startTime}s, duration: ${newClip.duration}s)${durationWarning}`,
    modified: true,
  };
}

// ─── update_clip ────────────────────────────────────────────────────

function executeUpdateClip(
  input: Record<string, unknown>,
  currentProject: VideoProject
): ToolExecutionResult {
  const clipId = input.clipId as string;
  const updates = input.updates as Record<string, unknown>;

  // Find the clip across all tracks
  let found = false;
  let updatedClip: Clip | null = null;
  const tracks = currentProject.tracks.map((track) => ({
    ...track,
    clips: track.clips.map((clip) => {
      if (clip.id === clipId) {
        found = true;
        updatedClip = { ...clip, ...updates };
        return updatedClip;
      }
      return clip;
    }),
  }));

  if (!found || !updatedClip) {
    return {
      project: null,
      message: `Error: Clip with ID "${clipId}" not found.`,
      modified: false,
    };
  }

  // Auto-extend metadata.duration if clip now extends beyond it
  const clipEndTime = (updatedClip as Clip).startTime + (updatedClip as Clip).duration;
  let metadata = currentProject.metadata;
  let durationWarning = "";
  if (clipEndTime > metadata.duration) {
    metadata = { ...metadata, duration: clipEndTime };
    durationWarning = ` (metadata.duration auto-extended to ${clipEndTime}s)`;
  }

  const project: VideoProject = {
    ...currentProject,
    tracks,
    metadata,
    updatedAt: new Date().toISOString(),
  };

  return {
    project,
    message: `Clip "${clipId}" updated: ${Object.keys(updates).join(", ")}${durationWarning}`,
    modified: true,
  };
}

// ─── remove_clip ────────────────────────────────────────────────────

function executeRemoveClip(
  input: Record<string, unknown>,
  currentProject: VideoProject
): ToolExecutionResult {
  const clipId = input.clipId as string;

  let found = false;
  const tracks = currentProject.tracks.map((track) => {
    const clipIndex = track.clips.findIndex((c) => c.id === clipId);
    if (clipIndex !== -1) {
      found = true;
      return {
        ...track,
        clips: track.clips.filter((c) => c.id !== clipId),
      };
    }
    return track;
  });

  if (!found) {
    return {
      project: null,
      message: `Error: Clip with ID "${clipId}" not found.`,
      modified: false,
    };
  }

  const project: VideoProject = {
    ...currentProject,
    tracks,
    transitions: currentProject.transitions.filter(
      (t) => t.fromClipId !== clipId && t.toClipId !== clipId
    ),
    updatedAt: new Date().toISOString(),
  };

  return {
    project,
    message: `Clip "${clipId}" removed.`,
    modified: true,
  };
}

// ─── add_asset ──────────────────────────────────────────────────────

function executeAddAsset(
  input: Record<string, unknown>,
  currentProject: VideoProject
): ToolExecutionResult {
  const assetData = input.asset as Record<string, unknown>;
  const assetId = uuidv4();

  const newAsset: Record<string, unknown> = {
    id: assetId,
    type: assetData.type,
    source: assetData.source,
    url: assetData.url,
  };
  if (assetData.filename) newAsset.filename = assetData.filename;
  if (assetData.mimeType) newAsset.mimeType = assetData.mimeType;
  if (assetData.metadata) newAsset.metadata = assetData.metadata;

  const project: VideoProject = {
    ...currentProject,
    assets: {
      ...currentProject.assets,
      [assetId]: newAsset as VideoProject["assets"][string],
    },
    updatedAt: new Date().toISOString(),
  };

  return {
    project,
    message: `Asset registered with ID: ${assetId} (${assetData.type}, ${assetData.source})`,
    modified: true,
  };
}

// ─── add_transition ─────────────────────────────────────────────────

function executeAddTransition(
  input: Record<string, unknown>,
  currentProject: VideoProject
): ToolExecutionResult {
  const transitionId = uuidv4();

  const project: VideoProject = {
    ...currentProject,
    transitions: [
      ...currentProject.transitions,
      {
        id: transitionId,
        type: input.type as "fade" | "dissolve" | "wipe" | "slide" | "zoom" | "glitch" | "none",
        duration: (input.duration as number) ?? 0.5,
        fromClipId: input.fromClipId as string,
        toClipId: input.toClipId as string,
      },
    ],
    updatedAt: new Date().toISOString(),
  };

  return {
    project,
    message: `Transition (${input.type}) added between clips with ID: ${transitionId}`,
    modified: true,
  };
}

// ─── get_project_summary ────────────────────────────────────────────

function executeGetProjectSummary(
  currentProject: VideoProject
): ToolExecutionResult {
  const totalClips = countClips(currentProject);
  const tracks = currentProject.tracks ?? [];
  const audioTracks = currentProject.audioTracks ?? [];
  const assets = currentProject.assets ?? {};
  const transitions = currentProject.transitions ?? [];

  const trackSummaries = tracks.map((track) => {
    const clipDetails = track.clips
      .map((clip) => {
        let desc = `[${clip.id.slice(0, 8)}] ${clip.startTime}s-${clip.startTime + clip.duration}s`;
        if (clip.text) desc += ` text: "${clip.text.content.slice(0, 30)}"`;
        if (clip.shape) desc += ` shape: ${clip.shape.shapeType} (${clip.shape.fill || "no fill"})`;
        if (clip.assetId) desc += ` asset: ${clip.assetId.slice(0, 8)}`;
        if (clip.animations && clip.animations.length > 0)
          desc += ` animations: ${clip.animations.map((a) => a.type).join(",")}`;
        return desc;
      })
      .join("\n    ");

    return `  Track "${track.name || track.id}" (${track.type}, id: ${track.id.slice(0, 8)}...)\n    ${clipDetails || "(empty)"}`;
  });

  const audioSummaries = audioTracks.map((track) => {
    const clips = track.clips
      .map(
        (c) =>
          `[${c.id.slice(0, 8)}] ${c.startTime}s-${c.startTime + c.duration}s asset:${c.assetId.slice(0, 8)}`
      )
      .join("\n    ");
    return `  Audio "${track.name || track.id}" (id: ${track.id.slice(0, 8)}...)\n    ${clips || "(empty)"}`;
  });

  const assetCount = Object.keys(assets).length;
  const transitionCount = transitions.length;

  const summary = `Project: "${currentProject.metadata.title}"
Aspect: ${currentProject.metadata.aspectRatio} (${currentProject.metadata.resolution.width}x${currentProject.metadata.resolution.height})
Duration: ${currentProject.metadata.duration}s | FPS: ${currentProject.metadata.fps} | BG: ${currentProject.metadata.backgroundColor}
Tracks (${tracks.length}):
${trackSummaries.join("\n")}
Audio Tracks (${audioTracks.length}):
${audioSummaries.join("\n") || "  (none)"}
Assets: ${assetCount} | Transitions: ${transitionCount} | Total clips: ${totalClips}`;

  return {
    project: null,
    message: summary,
    modified: false,
  };
}

// ─── Helpers ────────────────────────────────────────────────────────

function countClips(project: VideoProject): number {
  let count = 0;
  for (const track of project.tracks ?? []) {
    count += track.clips.length;
  }
  for (const audioTrack of project.audioTracks ?? []) {
    count += audioTrack.clips.length;
  }
  return count;
}

// ─── review_video ───────────────────────────────────────────────────

async function executeReviewVideo(
  currentProject: VideoProject
): Promise<ToolExecutionResult> {
  const review = await reviewVideo(currentProject);
  return {
    project: null,
    message: review,
    modified: false,
  };
}

// ─── search_stock_media ─────────────────────────────────────────────

async function executeSearchStockMedia(
  input: Record<string, unknown>
): Promise<ToolExecutionResult> {
  const query = input.query as string;
  const mediaType = (input.mediaType as "photo" | "video" | "both") ?? "both";
  const orientation = input.orientation as
    | "landscape"
    | "portrait"
    | "square"
    | undefined;
  const perPage = Math.min(Math.max((input.perPage as number) ?? 5, 1), 10);

  try {
    const results = await searchStockMedia(query, mediaType, {
      orientation,
      perPage,
    });

    if (results.length === 0) {
      return {
        project: null,
        message: `No ${mediaType} results found for "${query}". Try a different or broader search query.`,
        modified: false,
      };
    }

    const formatted = results
      .map((r, i) => {
        let line = `${i + 1}. [${r.type.toUpperCase()}] ${r.width}x${r.height}`;
        if (r.duration) line += ` (${r.duration}s)`;
        line += ` by ${r.photographer}`;
        line += `\n   URL: ${r.url}`;
        line += `\n   Alt: ${r.alt}`;
        return line;
      })
      .join("\n");

    return {
      project: null,
      message: `Found ${results.length} ${mediaType} result(s) for "${query}":\n\n${formatted}\n\nTo use a result: call add_asset with the URL, type ("image" or "video"), and source "stock". Then use the returned assetId in add_clip.`,
      modified: false,
    };
  } catch (error) {
    const msg =
      error instanceof Error ? error.message : "Unknown error occurred";
    return {
      project: null,
      message: `Error searching stock media: ${msg}`,
      modified: false,
    };
  }
}

// ─── add_audio_track ────────────────────────────────────────────────

function executeAddAudioTrack(
  input: Record<string, unknown>,
  currentProject: VideoProject
): ToolExecutionResult {
  const trackId = uuidv4();
  const newTrack: AudioTrack = {
    id: trackId,
    name: (input.name as string) || `Audio Track ${(currentProject.audioTracks ?? []).length + 1}`,
    clips: [],
    volume: (input.volume as number) ?? 1,
    muted: false,
  };

  const project: VideoProject = {
    ...currentProject,
    audioTracks: [...(currentProject.audioTracks ?? []), newTrack],
    updatedAt: new Date().toISOString(),
  };

  return {
    project,
    message: `Audio track "${newTrack.name}" added with ID: ${trackId}`,
    modified: true,
  };
}

// ─── add_audio_clip ─────────────────────────────────────────────────

function executeAddAudioClip(
  input: Record<string, unknown>,
  currentProject: VideoProject
): ToolExecutionResult {
  const audioTrackId = input.audioTrackId as string;
  const clipData = input.clip as Record<string, unknown>;

  const audioTracks = currentProject.audioTracks ?? [];
  const trackIndex = audioTracks.findIndex((t) => t.id === audioTrackId);
  if (trackIndex === -1) {
    return {
      project: null,
      message: `Error: Audio track with ID "${audioTrackId}" not found. Use add_audio_track first.`,
      modified: false,
    };
  }

  // Validate assetId
  const assetId = clipData.assetId as string;
  if (!assetId) {
    return {
      project: null,
      message: `Error: Audio clips must include an "assetId". Use add_asset first to register the audio file.`,
      modified: false,
    };
  }
  if (!currentProject.assets[assetId]) {
    return {
      project: null,
      message: `Error: Asset with ID "${assetId}" not found. Use add_asset first.`,
      modified: false,
    };
  }

  const clipId = uuidv4();
  const newClip: AudioClip = {
    id: clipId,
    assetId,
    startTime: (clipData.startTime as number) ?? 0,
    duration: (clipData.duration as number) ?? 5,
    trim: clipData.trim as AudioClip["trim"],
    volume: (clipData.volume as number) ?? 1,
    fadeIn: (clipData.fadeIn as number) ?? 0,
    fadeOut: (clipData.fadeOut as number) ?? 0,
  };

  const updatedTracks = audioTracks.map((t, i) =>
    i === trackIndex ? { ...t, clips: [...t.clips, newClip] } : t
  );

  // Auto-extend duration if needed
  const clipEndTime = newClip.startTime + newClip.duration;
  let metadata = currentProject.metadata;
  let durationWarning = "";
  if (clipEndTime > metadata.duration) {
    metadata = { ...metadata, duration: clipEndTime };
    durationWarning = ` (metadata.duration auto-extended to ${clipEndTime}s)`;
  }

  const project: VideoProject = {
    ...currentProject,
    audioTracks: updatedTracks,
    metadata,
    updatedAt: new Date().toISOString(),
  };

  return {
    project,
    message: `Audio clip added to track "${audioTracks[trackIndex].name}" with ID: ${clipId} (startTime: ${newClip.startTime}s, duration: ${newClip.duration}s)${durationWarning}`,
    modified: true,
  };
}

// ─── render_video ───────────────────────────────────────────────────

async function executeRenderVideo(
  input: Record<string, unknown>,
  currentProject: VideoProject
): Promise<ToolExecutionResult> {
  const quality = (input.quality as string) ?? "standard";

  // Quality presets
  const presets: Record<string, { crf: number; scale: number; concurrency: number }> = {
    draft: { crf: 30, scale: 0.5, concurrency: 2 },
    standard: { crf: 23, scale: 1, concurrency: 2 },
    high: { crf: 18, scale: 1, concurrency: 4 },
  };

  const preset = presets[quality] ?? presets.standard;

  try {
    // Dynamic import to avoid bundling Node.js-only Remotion renderer in client code
    const { renderVideo } = await import("@/agent/tools/video-renderer");

    const result = await renderVideo({
      project: currentProject,
      crf: preset.crf,
      scale: preset.scale,
      concurrency: preset.concurrency,
    });

    return {
      project: null,
      message: `Video rendered successfully!\n- File: ${result.publicUrl}\n- Quality: ${quality}\n- Render time: ${(result.durationMs / 1000).toFixed(1)}s\n\nThe video is available at ${result.publicUrl}`,
      modified: false,
    };
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    return {
      project: null,
      message: `Error rendering video: ${msg}\n\nThis could be due to missing assets, invalid clip configurations, or insufficient system resources. Check the project for issues and try again.`,
      modified: false,
    };
  }
}

// ─── generate_image ──────────────────────────────────────────────────

async function executeGenerateImage(
  input: Record<string, unknown>,
  currentProject: VideoProject
): Promise<ToolExecutionResult> {
  const prompt = input.prompt as string;
  if (!prompt?.trim()) {
    return { project: null, message: "Error: prompt is required", modified: false };
  }

  try {
    const { generateImage } = await import("@/agent/tools/image-generator");

    const result = await generateImage({
      prompt,
      negativePrompt: input.negativePrompt as string | undefined,
      model: input.model as "flux-schnell" | "flux-dev" | "flux-pro" | "stable-diffusion-xl" | undefined,
      width: input.width as number | undefined,
      height: input.height as number | undefined,
      numImages: input.numImages as number | undefined,
    });

    const imageList = result.images
      .map((img, i) => `  Image ${i + 1}: ${img.url} (${img.width}x${img.height})`)
      .join("\n");

    return {
      project: null,
      message: `Generated ${result.images.length} image(s) with ${result.model} in ${(result.durationMs / 1000).toFixed(1)}s:\n${imageList}\n\nTo use in the video, call add_asset with the URL above (type: "image", source: "ai-generated"), then add_clip to place it on a track.`,
      modified: false,
    };
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    return {
      project: null,
      message: `Error generating image: ${msg}`,
      modified: false,
    };
  }
}

// ─── generate_voiceover ──────────────────────────────────────────────

async function executeGenerateVoiceover(
  input: Record<string, unknown>,
  currentProject: VideoProject
): Promise<ToolExecutionResult> {
  const text = input.text as string;
  if (!text?.trim()) {
    return { project: null, message: "Error: text is required", modified: false };
  }

  try {
    const { generateVoiceover } = await import("@/agent/tools/voiceover");

    const result = await generateVoiceover({
      text,
      voice: input.voice as string | undefined,
      model: input.model as "eleven_multilingual_v2" | "eleven_turbo_v2_5" | "eleven_turbo_v2" | "eleven_flash_v2_5" | undefined,
      stability: input.stability as number | undefined,
      similarityBoost: input.similarityBoost as number | undefined,
      style: input.style as number | undefined,
    });

    return {
      project: null,
      message: `Voiceover generated successfully!\n- File: ${result.publicUrl}\n- Voice: ${result.voice}\n- Model: ${result.model}\n- Estimated duration: ~${result.estimatedDurationSeconds}s\n\nTo use in the video:\n1. Call add_asset with url="${result.publicUrl}", type="audio", source="ai-generated"\n2. Call add_audio_track if no audio track exists\n3. Call add_audio_clip with the asset ID to place the voiceover on the timeline`,
      modified: false,
    };
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    return {
      project: null,
      message: `Error generating voiceover: ${msg}`,
      modified: false,
    };
  }
}

// ─── list_skills ─────────────────────────────────────────────────────

async function executeListSkills(
  input: Record<string, unknown>
): Promise<ToolExecutionResult> {
  try {
    // Ensure skills are registered (side-effect import)
    const { listSkills } = await import("@/agent/skills/index");

    type SkillCat = "color-grade" | "typography" | "background" | "layout" | "effects";
    const category = input.category as SkillCat | undefined;
    const skills = listSkills(category);

    if (skills.length === 0) {
      return {
        project: null,
        message: `No skills found${category ? ` in category "${category}"` : ""}. Available categories: color-grade, typography, background.`,
        modified: false,
      };
    }

    const lines = skills.map((s) => {
      const paramSummary = s.parameters.length > 0
        ? s.parameters
            .map((p) => `${p.name}${p.required ? "" : "?"}`)
            .join(", ")
        : "no parameters";
      return `• ${s.id} [${s.category}] — ${s.name}: ${s.description}\n  params: ${paramSummary}`;
    });

    return {
      project: null,
      message: `Available skills (${skills.length}):\n\n${lines.join("\n\n")}`,
      modified: false,
    };
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    return { project: null, message: `Error listing skills: ${msg}`, modified: false };
  }
}

// ─── apply_skill ─────────────────────────────────────────────────────

async function executeApplySkill(
  input: Record<string, unknown>,
  currentProject: VideoProject
): Promise<ToolExecutionResult> {
  const skillId = input.skillId as string;
  if (!skillId?.trim()) {
    return { project: null, message: "Error: skillId is required", modified: false };
  }

  try {
    const { applySkill } = await import("@/agent/skills/index");

    const params = (input.params as Record<string, unknown>) ?? {};
    const updatedProject = await applySkill(skillId, currentProject, params);

    return {
      project: updatedProject,
      message: `Skill "${skillId}" applied successfully.`,
      modified: true,
    };
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    return { project: null, message: `Error applying skill "${skillId}": ${msg}`, modified: false };
  }
}

// ─── add_keyframe ─────────────────────────────────────────────────────

function executeAddKeyframe(
  input: Record<string, unknown>,
  currentProject: VideoProject
): ToolExecutionResult {
  const clipId = input.clipId as string;
  const kfInput = input.keyframe as Record<string, unknown>;

  if (!clipId) {
    return { project: null, message: "Error: clipId is required", modified: false };
  }
  if (!kfInput || typeof kfInput.time !== "number") {
    return { project: null, message: "Error: keyframe.time (number 0–1) is required", modified: false };
  }

  // Find the clip across all tracks
  let found = false;
  const updatedTracks = currentProject.tracks.map((track) => ({
    ...track,
    clips: track.clips.map((clip) => {
      if (clip.id !== clipId) return clip;
      found = true;

      const newKf = {
        time: kfInput.time as number,
        ...(kfInput.opacity !== undefined && { opacity: kfInput.opacity as number }),
        ...(kfInput.x !== undefined && { x: kfInput.x as number }),
        ...(kfInput.y !== undefined && { y: kfInput.y as number }),
        ...(kfInput.scaleX !== undefined && { scaleX: kfInput.scaleX as number }),
        ...(kfInput.scaleY !== undefined && { scaleY: kfInput.scaleY as number }),
        ...(kfInput.rotation !== undefined && { rotation: kfInput.rotation as number }),
        easing: ((kfInput.easing as string) ?? "easeInOut") as "linear" | "easeIn" | "easeOut" | "easeInOut" | "spring",
      };

      // Replace existing keyframe at same time, or add new
      const existingKfs = clip.keyframes ?? [];
      const withoutSameTime = existingKfs.filter((k) => k.time !== newKf.time);

      return { ...clip, keyframes: [...withoutSameTime, newKf] };
    }),
  }));

  if (!found) {
    return {
      project: null,
      message: `Clip "${clipId}" not found. Check get_project_summary for valid clip IDs.`,
      modified: false,
    };
  }

  return {
    project: { ...currentProject, tracks: updatedTracks },
    message: `Keyframe at time=${kfInput.time} added/updated on clip "${clipId}".`,
    modified: true,
  };
}

// ─── remove_keyframe ──────────────────────────────────────────────────

function executeRemoveKeyframe(
  input: Record<string, unknown>,
  currentProject: VideoProject
): ToolExecutionResult {
  const clipId = input.clipId as string;
  const time = input.time as number;

  if (!clipId) {
    return { project: null, message: "Error: clipId is required", modified: false };
  }
  if (typeof time !== "number") {
    return { project: null, message: "Error: time (number 0–1) is required", modified: false };
  }

  let found = false;
  let removed = false;

  const updatedTracks = currentProject.tracks.map((track) => ({
    ...track,
    clips: track.clips.map((clip) => {
      if (clip.id !== clipId) return clip;
      found = true;
      const before = (clip.keyframes ?? []).length;
      const filtered = (clip.keyframes ?? []).filter((k) => k.time !== time);
      removed = filtered.length < before;
      return { ...clip, keyframes: filtered };
    }),
  }));

  if (!found) {
    return { project: null, message: `Clip "${clipId}" not found.`, modified: false };
  }
  if (!removed) {
    return { project: null, message: `No keyframe found at time=${time} on clip "${clipId}".`, modified: false };
  }

  return {
    project: { ...currentProject, tracks: updatedTracks },
    message: `Keyframe at time=${time} removed from clip "${clipId}".`,
    modified: true,
  };
}

// ─── generate_captions ────────────────────────────────────────────────

async function executeGenerateCaptions(
  input: Record<string, unknown>,
  currentProject: VideoProject
): Promise<ToolExecutionResult> {
  const audioAssetId = input.audioAssetId as string;
  if (!audioAssetId?.trim()) {
    return { project: null, message: "Error: audioAssetId is required", modified: false };
  }

  try {
    const { generateCaptions } = await import("@/agent/tools/captions");

    const posInput = input.position as { x?: number; y?: number } | undefined;

    const result = await generateCaptions(currentProject, {
      audioAssetId,
      style: input.style as "default" | "bold" | "minimal" | "kinetic" | undefined,
      maxWordsPerCaption: input.maxWordsPerCaption as number | undefined,
      position: posInput,
    });

    return {
      project: result.project,
      message: `Captions generated successfully!\n- ${result.segmentCount} caption segments created\n- Track ID: ${result.trackId}\n- Full transcript:\n\n"${result.transcript}"`,
      modified: true,
    };
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    return {
      project: null,
      message: `Error generating captions: ${msg}`,
      modified: false,
    };
  }
}
