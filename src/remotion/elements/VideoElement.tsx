/**
 * VideoElement
 *
 * Renders a video clip from the schema inside a Remotion composition.
 * Handles trimming, positioning, scaling, opacity, animations, and filters.
 */

"use client";

import React from "react";
import {
  AbsoluteFill,
  OffthreadVideo,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

import type { Clip, Asset } from "@/lib/schema/video-schema";
import { useAnimationValues, computeKeyframeValues } from "../animations/AnimationEngine";
import { buildFilterString } from "../utils/filters";
import { resizeModeToCss } from "../utils/schemaToProps";

interface VideoElementProps {
  clip: Clip;
  asset: Asset;
}

export const VideoElement: React.FC<VideoElementProps> = ({ clip, asset }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Inside a <Sequence>, useCurrentFrame() is relative (starts at 0).
  // clipStartFrame must be 0 since the Sequence already handles the offset.
  const clipStartFrame = 0;
  const clipDurationFrames = Math.round(clip.duration * fps);

  const animValues = useAnimationValues(
    clip.animations,
    clipStartFrame,
    clipDurationFrames
  );

  const kfValues = computeKeyframeValues(
    clip.keyframes ?? [],
    frame,
    fps,
    clipDurationFrames
  );

  // Calculate the video playback position (accounting for trim)
  // frame is already relative to clip start (Sequence handles offset)
  const trimStart = clip.trim?.start ?? 0;
  const videoStartFrom = Math.round(trimStart * fps);

  const filterString = buildFilterString(clip.filters);

  // Position and size
  const scaleX = (clip.scale?.x ?? 1) * (kfValues.scaleX ?? animValues.scale);
  const scaleY = (clip.scale?.y ?? 1) * (kfValues.scaleY ?? animValues.scale);
  const translateX = kfValues.x !== undefined ? kfValues.x : animValues.translateX;
  const translateY = kfValues.y !== undefined ? kfValues.y : animValues.translateY;
  const finalOpacity = clip.opacity * (kfValues.opacity ?? animValues.opacity);
  const finalRotation = kfValues.rotation ?? clip.rotation;

  return (
    <AbsoluteFill
      style={{
        opacity: finalOpacity,
        transform: `translate(${translateX}px, ${translateY}px)`,
        filter: filterString || undefined,
      }}
    >
      <AbsoluteFill
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <OffthreadVideo
          src={asset.url}
          startFrom={videoStartFrom}
          style={{
            width: clip.resizeMode === "cover" ? "100%" : undefined,
            height: clip.resizeMode === "cover" ? "100%" : undefined,
            objectFit: resizeModeToCss(clip.resizeMode),
            transform: `scale(${scaleX}, ${scaleY}) rotate(${finalRotation}deg)`,
          }}
          volume={clip.muted ? 0 : clip.volume}
        />
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
