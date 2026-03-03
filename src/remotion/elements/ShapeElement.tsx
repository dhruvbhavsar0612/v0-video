/**
 * ShapeElement
 *
 * Renders shape clips (rectangles, circles, etc.) with
 * animations, positioning, and filters.
 */

"use client";

import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";

import type { Clip } from "@/lib/schema/video-schema";
import { useAnimationValues, computeKeyframeValues } from "../animations/AnimationEngine";
import { buildFilterString } from "../utils/filters";

interface ShapeElementProps {
  clip: Clip;
}

export const ShapeElement: React.FC<ShapeElementProps> = ({ clip }) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();

  // All hooks must be called unconditionally before any early return.
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

  if (!clip.shape) return null;

  const filterString = buildFilterString(clip.filters);
  const shape = clip.shape;

  const scaleX = (clip.scale?.x ?? 1) * (kfValues.scaleX ?? animValues.scale);
  const scaleY = (clip.scale?.y ?? 1) * (kfValues.scaleY ?? animValues.scale);
  const finalOpacity = clip.opacity * (kfValues.opacity ?? animValues.opacity);
  const finalRotation = kfValues.rotation ?? clip.rotation;

  const posX = kfValues.x !== undefined ? kfValues.x : clip.position?.x;
  const posY = kfValues.y !== undefined ? kfValues.y : clip.position?.y;
  const translateX = kfValues.x !== undefined ? 0 : animValues.translateX;
  const translateY = kfValues.y !== undefined ? 0 : animValues.translateY;

  // If no position set and shape fills canvas, use AbsoluteFill
  // Use == null to correctly handle posX/posY === 0
  const isFullCanvas =
    posX == null && posY == null && shape.width >= width && shape.height >= height;

  const shapeStyle: React.CSSProperties = {
    width: shape.width,
    height: shape.height,
    backgroundColor: shape.fill ?? "transparent",
    border: shape.stroke
      ? `${shape.strokeWidth}px solid ${shape.stroke}`
      : undefined,
    borderRadius:
      shape.shapeType === "circle"
        ? "50%"
        : shape.shapeType === "rounded-rect"
          ? shape.borderRadius
          : shape.borderRadius,
    transform: `translate(${translateX}px, ${translateY}px) scale(${scaleX}, ${scaleY}) rotate(${finalRotation}deg)`,
    opacity: finalOpacity,
    filter: filterString || undefined,
  };

  if (isFullCanvas) {
    return (
      <AbsoluteFill style={shapeStyle} />
    );
  }

  return (
    <AbsoluteFill>
      <div
        style={{
          position: "absolute",
          left: posX ?? "50%",
          top: posY ?? "50%",
          transform: `translate(-50%, -50%) ${shapeStyle.transform}`,
          width: shape.width,
          height: shape.height,
          backgroundColor: shapeStyle.backgroundColor,
          border: shapeStyle.border,
          borderRadius: shapeStyle.borderRadius,
          opacity: shapeStyle.opacity,
          filter: shapeStyle.filter,
        }}
      />
    </AbsoluteFill>
  );
};
