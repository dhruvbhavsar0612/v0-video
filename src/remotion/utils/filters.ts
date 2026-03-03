/**
 * Filter Utilities
 *
 * Converts Filter schema objects into CSS filter strings.
 */

import type { Filter } from "@/lib/schema/video-schema";

/**
 * Builds a CSS filter string from an array of Filter objects.
 *
 * @example
 * buildFilterString([
 *   { type: "brightness", value: 1.2 },
 *   { type: "blur", value: 2 },
 * ])
 * // Returns: "brightness(1.2) blur(2px)"
 */
export function buildFilterString(filters: Filter[]): string {
  if (!filters || filters.length === 0) return "";

  return filters
    .map((filter) => {
      switch (filter.type) {
        case "brightness":
          return `brightness(${filter.value})`;
        case "contrast":
          return `contrast(${filter.value})`;
        case "saturate":
          return `saturate(${filter.value})`;
        case "grayscale":
          return `grayscale(${filter.value})`;
        case "sepia":
          return `sepia(${filter.value})`;
        case "blur":
          return `blur(${filter.value}px)`;
        case "hue-rotate":
          return `hue-rotate(${filter.value}deg)`;
        case "opacity":
          return `opacity(${filter.value})`;
        default:
          return "";
      }
    })
    .filter(Boolean)
    .join(" ");
}
