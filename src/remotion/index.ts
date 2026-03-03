/**
 * Remotion Entry Point
 *
 * This file is the entry point for Remotion bundler.
 * It registers all compositions for both preview and SSR rendering.
 */

import { registerRoot } from "remotion";
import { RemotionRoot } from "./Root";

registerRoot(RemotionRoot);
