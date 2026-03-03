/**
 * Remotion Root
 *
 * Entry point for Remotion. Registers compositions that can be
 * rendered both in the Player (preview) and server-side (export).
 */

import React from "react";
import { Composition } from "remotion";

import { VideoComposition, type VideoCompositionProps } from "./VideoComposition";
import { createDemoProject } from "@/lib/schema/schema-defaults";

export const RemotionRoot: React.FC = () => {
  const demoProject = createDemoProject();

  return (
    <>
      {/* Main composition -- driven by VideoProject JSON */}
      <Composition
        id="VideoProject"
        component={VideoComposition as unknown as React.FC<Record<string, unknown>>}
        durationInFrames={Math.ceil(
          demoProject.metadata.duration * demoProject.metadata.fps
        )}
        fps={demoProject.metadata.fps}
        width={demoProject.metadata.resolution.width}
        height={demoProject.metadata.resolution.height}
        defaultProps={{
          project: demoProject,
        }}
      />
    </>
  );
};
