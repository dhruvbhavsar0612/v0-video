/**
 * Schema-to-Props Utilities
 *
 * Converts schema values to CSS/Remotion-compatible values.
 */

import type { ResizeMode } from "@/lib/schema/video-schema";

/**
 * Maps our schema's resizeMode to CSS object-fit values.
 * "stretch" in our schema maps to "fill" in CSS.
 */
export function resizeModeToCss(
  mode: ResizeMode
): React.CSSProperties["objectFit"] | undefined {
  switch (mode) {
    case "cover":
      return "cover";
    case "contain":
      return "contain";
    case "stretch":
      return "fill";
    case "none":
      return undefined;
    default:
      return "cover";
  }
}
