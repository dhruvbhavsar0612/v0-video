/**
 * TextElement
 *
 * Renders a text clip with animations (including typewriter effect),
 * kinetic typography, keyframe animation, styling, and optional background.
 */

"use client";

import React from "react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";

import type { Clip } from "@/lib/schema/video-schema";
import {
  useAnimationValues,
  getTypewriterProgress,
  computeKeyframeValues,
} from "../animations/AnimationEngine";
import { buildFilterString } from "../utils/filters";

interface TextElementProps {
  clip: Clip;
}

// ─── Kinetic token style helper ────────────────────────────────────────

interface TokenStyle {
  opacity: number;
  transform: string;
}

function computeTokenStyle(
  style: "fade" | "slideUp" | "bounce" | "scale" | "wave",
  frame: number,
  tokenStartFrame: number,
  fps: number
): TokenStyle {
  const tokenAnimFrames = Math.round(0.4 * fps); // each token animates over 0.4 s
  const rawProgress = (frame - tokenStartFrame) / Math.max(tokenAnimFrames, 1);
  const progress = Math.min(Math.max(rawProgress, 0), 1);

  // Simple easeOut for most styles
  const eased = progress * (2 - progress);

  switch (style) {
    case "fade":
      return { opacity: eased, transform: "none" };

    case "slideUp": {
      const translateY = interpolate(eased, [0, 1], [24, 0], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      });
      return { opacity: eased, transform: `translateY(${translateY}px)` };
    }

    case "bounce": {
      const springVal = spring({
        frame: Math.round(progress * 14),
        fps,
        config: { damping: 8, stiffness: 220, mass: 0.8 },
      });
      const scale = interpolate(springVal, [0, 1], [0.2, 1]);
      const opacity = Math.min(progress * 3, 1);
      return { opacity, transform: `scale(${scale})` };
    }

    case "scale":
      return { opacity: eased, transform: `scale(${eased})` };

    case "wave": {
      // Tokens ripple up then settle
      const wavePeak = Math.sin(Math.PI * eased);
      const translateY = interpolate(wavePeak, [0, 1], [0, -14], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      });
      return { opacity: eased, transform: `translateY(${translateY}px)` };
    }

    default:
      return { opacity: 1, transform: "none" };
  }
}

// ─── Component ─────────────────────────────────────────────────────────

export const TextElement: React.FC<TextElementProps> = ({ clip }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // ── All hooks must be called unconditionally before any early return ──
  const clipStartFrame = 0; // Sequence handles the offset
  const clipDurationFrames = Math.round(clip.duration * fps);

  // Typewriter detection (used in standard path)
  const hasTypewriter = (clip.animations ?? []).some((a) => a.type === "typewriter");
  const nonTypewriterAnimations = (clip.animations ?? []).filter(
    (a) => a.type !== "typewriter"
  );

  // Always call useAnimationValues — hooks must not be behind early returns
  const animValues = useAnimationValues(
    nonTypewriterAnimations,
    clipStartFrame,
    clipDurationFrames
  );

  const typewriterProgress = getTypewriterProgress(
    clip.animations ?? [],
    frame,
    clipStartFrame,
    fps
  );

  const kfValues = computeKeyframeValues(
    clip.keyframes ?? [],
    frame,
    fps,
    clipDurationFrames
  );

  // ── Early exit if no text configured ────────────────────────────
  if (!clip.text) return null;

  const filterString = buildFilterString(clip.filters);
  const text = clip.text;

  // ── Kinetic typography path ────────────────────────────────────────
  if (text.kineticTypography) {
    const kt = text.kineticTypography;
    const staggerSec = (kt.staggerMs ?? 80) / 1000;

    // Split into tokens
    let tokens: string[];
    if (kt.mode === "char") {
      tokens = text.content.split("");
    } else if (kt.mode === "line") {
      tokens = text.content.split("\n");
    } else {
      tokens = text.content.split(" ");
    }

    // Base position from keyframes or clip properties
    const posX = kfValues.x ?? clip.position?.x ?? "50%";
    const posY = kfValues.y ?? clip.position?.y ?? "50%";
    const finalOpacity = kfValues.opacity ?? clip.opacity;
    const finalScaleX = kfValues.scaleX ?? (clip.scale?.x ?? 1);
    const finalScaleY = kfValues.scaleY ?? (clip.scale?.y ?? 1);
    const finalRotation = kfValues.rotation ?? clip.rotation;

    return (
      <AbsoluteFill style={{ filter: filterString || undefined }}>
        <div
          style={{
            position: "absolute",
            left: posX,
            top: posY,
            transform: `translate(-50%, -50%) scale(${finalScaleX}, ${finalScaleY}) rotate(${finalRotation}deg)`,
            opacity: finalOpacity,
            maxWidth: text.maxWidth ?? undefined,
            textAlign: text.textAlign,
            // Allow tokens to wrap naturally
            display: "flex",
            flexWrap: "wrap",
            justifyContent: text.textAlign === "center" ? "center" : text.textAlign === "right" ? "flex-end" : "flex-start",
            gap: kt.mode === "char" ? "0px" : "0.25em",
            lineHeight: text.lineHeight,
            letterSpacing: text.letterSpacing,
          }}
        >
          {tokens.map((token, i) => {
            const tokenStartFrame = Math.round(i * staggerSec * fps);
            const tokenStyle = computeTokenStyle(kt.style, frame, tokenStartFrame, fps);

            return (
              <span
                key={i}
                style={{
                  display: "inline-block",
                  opacity: tokenStyle.opacity,
                  transform: tokenStyle.transform,
                  fontSize: text.fontSize,
                  fontFamily: text.fontFamily,
                  fontWeight: text.fontWeight,
                  color: text.color,
                  textShadow: text.textShadow ?? undefined,
                  WebkitTextStroke: text.stroke
                    ? `${text.stroke.width}px ${text.stroke.color}`
                    : undefined,
                  // Background on individual tokens if set
                  backgroundColor: text.backgroundColor ?? undefined,
                  padding: text.backgroundColor ? text.backgroundPadding ?? 0 : undefined,
                  borderRadius: text.backgroundColor
                    ? text.backgroundBorderRadius ?? 0
                    : undefined,
                }}
              >
                {token}
              </span>
            );
          })}
        </div>
      </AbsoluteFill>
    );
  }

  // ── Standard text path (existing behaviour + keyframe overrides) ──────

  // Compute displayed text (typewriter effect)
  let displayedText = text.content;
  if (hasTypewriter && typewriterProgress !== null) {
    const charCount = Math.floor(typewriterProgress * text.content.length);
    displayedText = text.content.slice(0, charCount);
  }

  // Merge keyframe overrides with animation-derived values
  const finalOpacity = kfValues.opacity ?? (clip.opacity * animValues.opacity);
  const finalX = kfValues.x !== undefined ? kfValues.x : (clip.position?.x ?? "50%");
  const finalY = kfValues.y !== undefined ? kfValues.y : (clip.position?.y ?? "50%");
  const finalScaleX =
    kfValues.scaleX !== undefined
      ? kfValues.scaleX
      : (clip.scale?.x ?? 1) * animValues.scale;
  const finalScaleY =
    kfValues.scaleY !== undefined
      ? kfValues.scaleY
      : (clip.scale?.y ?? 1) * animValues.scale;
  const finalRotation = kfValues.rotation ?? clip.rotation;

  // When keyframes define position, skip the animation translate offsets
  const translateX = kfValues.x !== undefined ? 0 : animValues.translateX;
  const translateY = kfValues.y !== undefined ? 0 : animValues.translateY;

  return (
    <AbsoluteFill
      style={{
        filter: filterString || undefined,
      }}
    >
      <div
        style={{
          position: "absolute",
          left: finalX,
          top: finalY,
          transform: `translate(-50%, -50%) translate(${translateX}px, ${translateY}px) scale(${finalScaleX}, ${finalScaleY}) rotate(${finalRotation}deg)`,
          opacity: finalOpacity,
          maxWidth: text.maxWidth ?? undefined,
          textAlign: text.textAlign,
        }}
      >
        {/* Optional background */}
        {text.backgroundColor && (
          <div
            style={{
              position: "absolute",
              inset: -(text.backgroundPadding ?? 0),
              backgroundColor: text.backgroundColor,
              borderRadius: text.backgroundBorderRadius ?? 0,
              zIndex: -1,
            }}
          />
        )}

        {/* Text content */}
        <span
          style={{
            fontSize: text.fontSize,
            fontFamily: text.fontFamily,
            fontWeight: text.fontWeight,
            color: text.color,
            lineHeight: text.lineHeight,
            letterSpacing: text.letterSpacing,
            textShadow: text.textShadow ?? undefined,
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
            WebkitTextStroke: text.stroke
              ? `${text.stroke.width}px ${text.stroke.color}`
              : undefined,
            display: "inline-block",
            padding: text.backgroundColor ? text.backgroundPadding ?? 0 : undefined,
          }}
        >
          {displayedText}
        </span>
      </div>
    </AbsoluteFill>
  );
};
