/**
 * ImageElement
 *
 * Renders an image clip with Ken Burns effect support,
 * positioning, scaling, animations, and filters.
 */

"use client";

import React from "react";
import {
  AbsoluteFill,
  Img,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

import type { Clip, Asset } from "@/lib/schema/video-schema";
import { useAnimationValues, computeKeyframeValues } from "../animations/AnimationEngine";
import { buildFilterString } from "../utils/filters";
import { resizeModeToCss } from "../utils/schemaToProps";

interface ImageElementProps {
  clip: Clip;
  asset: Asset;
}

export const ImageElement: React.FC<ImageElementProps> = ({ clip, asset }) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();

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

  const filterString = buildFilterString(clip.filters);

  // Ken Burns effect
  let kenBurnsScale = 1;
  let kenBurnsX = 0;
  let kenBurnsY = 0;

  if (clip.kenBurns?.enabled) {
    const kb = clip.kenBurns;
    const progress = interpolate(
      frame,
      [0, clipDurationFrames],
      [0, 1],
      { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
    );

    kenBurnsScale = interpolate(
      progress,
      [0, 1],
      [kb.startScale, kb.endScale]
    );
    kenBurnsX = interpolate(
      progress,
      [0, 1],
      [kb.startPosition.x, kb.endPosition.x]
    );
    kenBurnsY = interpolate(
      progress,
      [0, 1],
      [kb.startPosition.y, kb.endPosition.y]
    );
  }

  const scaleX = (clip.scale?.x ?? 1) * (kfValues.scaleX ?? animValues.scale) * kenBurnsScale;
  const scaleY = (clip.scale?.y ?? 1) * (kfValues.scaleY ?? animValues.scale) * kenBurnsScale;
  const translateX = (kfValues.x !== undefined ? kfValues.x : animValues.translateX) + kenBurnsX;
  const translateY = (kfValues.y !== undefined ? kfValues.y : animValues.translateY) + kenBurnsY;
  const finalOpacity = clip.opacity * (kfValues.opacity ?? animValues.opacity);
  const finalRotation = kfValues.rotation ?? clip.rotation;

  return (
    <AbsoluteFill
      style={{
        opacity: finalOpacity,
        filter: filterString || undefined,
        overflow: "hidden",
      }}
    >
      <AbsoluteFill
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <Img
          src={asset.url}
          style={{
            width: clip.resizeMode === "cover" ? "100%" : undefined,
            height: clip.resizeMode === "cover" ? "100%" : undefined,
            objectFit: resizeModeToCss(clip.resizeMode),
            transform: `translate(${translateX}px, ${translateY}px) scale(${scaleX}, ${scaleY}) rotate(${finalRotation}deg)`,
          }}
        />
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
