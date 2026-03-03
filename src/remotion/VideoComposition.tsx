/**
 * VideoComposition
 *
 * The main Remotion composition that interprets a VideoProject JSON schema
 * and renders all tracks, clips, transitions, and audio.
 *
 * This is the bridge between the AI-generated JSON and the visual output.
 * The Remotion Player receives this component with the schema as inputProps.
 */

"use client";

import React from "react";
import {
  AbsoluteFill,
  Sequence,
  useVideoConfig,
} from "remotion";

import type { VideoProject, Track, Clip, Asset } from "@/lib/schema/video-schema";
import { VideoElement } from "./elements/VideoElement";
import { ImageElement } from "./elements/ImageElement";
import { TextElement } from "./elements/TextElement";
import { ShapeElement } from "./elements/ShapeElement";

// ─── Props ──────────────────────────────────────────────────────────

export interface VideoCompositionProps {
  project: VideoProject;
}

// ─── Main Composition ───────────────────────────────────────────────

export const VideoComposition: React.FC<VideoCompositionProps> = ({
  project,
}) => {
  const { fps } = useVideoConfig();

  return (
    <AbsoluteFill
      style={{
        backgroundColor: project.metadata.backgroundColor,
      }}
    >
      {/* Render tracks bottom-to-top (index 0 = background) */}
      {(project.tracks ?? []).map((track) => {
        if (!track.visible) return null;
        return (
          <TrackRenderer
            key={track.id}
            track={track}
            assets={project.assets}
            fps={fps}
            trackOpacity={track.opacity}
          />
        );
      })}
    </AbsoluteFill>
  );
};

// ─── Track Renderer ─────────────────────────────────────────────────

interface TrackRendererProps {
  track: Track;
  assets: Record<string, Asset>;
  fps: number;
  trackOpacity: number;
}

const TrackRenderer: React.FC<TrackRendererProps> = ({
  track,
  assets,
  fps,
  trackOpacity,
}) => {
  return (
    <AbsoluteFill style={{ opacity: trackOpacity }}>
      {track.clips.map((clip) => {
        const startFrame = Math.round(clip.startTime * fps);
        const durationFrames = Math.round(clip.duration * fps);

        return (
          <Sequence
            key={clip.id}
            from={startFrame}
            durationInFrames={durationFrames}
            layout="none"
          >
            <ClipRenderer
              clip={clip}
              trackType={track.type}
              assets={assets}
            />
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
};

// ─── Clip Renderer ──────────────────────────────────────────────────

interface ClipRendererProps {
  clip: Clip;
  trackType: Track["type"];
  assets: Record<string, Asset>;
}

const ClipRenderer: React.FC<ClipRendererProps> = ({
  clip,
  trackType,
  assets,
}) => {
  const asset = clip.assetId ? assets[clip.assetId] : undefined;

  switch (trackType) {
    case "video": {
      if (!asset) return null;
      if (asset.type === "image") {
        return <ImageElement clip={clip} asset={asset} />;
      }
      return <VideoElement clip={clip} asset={asset} />;
    }

    case "image": {
      if (!asset) return null;
      return <ImageElement clip={clip} asset={asset} />;
    }

    case "text": {
      return <TextElement clip={clip} />;
    }

    case "shape": {
      return <ShapeElement clip={clip} />;
    }

    case "sticker": {
      // Stickers render as images for now
      if (!asset) return null;
      return <ImageElement clip={clip} asset={asset} />;
    }

    default:
      return null;
  }
};

// ─── Element index exports ──────────────────────────────────────────

export { VideoElement } from "./elements/VideoElement";
export { ImageElement } from "./elements/ImageElement";
export { TextElement } from "./elements/TextElement";
export { ShapeElement } from "./elements/ShapeElement";
