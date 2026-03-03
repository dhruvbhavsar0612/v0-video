/**
 * VideoPreview
 *
 * Wraps the Remotion Player component and connects it to the editor store.
 * Provides play/pause controls and timeline scrubbing.
 */

"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Player, type PlayerRef } from "@remotion/player";
import { Play, Pause, RotateCcw, Volume2, VolumeX, Download } from "lucide-react";

import { VideoComposition } from "@/remotion/VideoComposition";
import { useEditorStore } from "@/stores/editor-store";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { calculateDurationInFrames } from "@/lib/schema/schema-defaults";

export const VideoPreview: React.FC = () => {
  const playerRef = useRef<PlayerRef>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerSize, setContainerSize] = useState<{
    width: number;
    height: number;
  } | null>(null);

  const project = useEditorStore((s) => s.project);
  const playback = useEditorStore((s) => s.playback);
  const togglePlayback = useEditorStore((s) => s.togglePlayback);
  const setPlaying = useEditorStore((s) => s.setPlaying);
  const setCurrentTime = useEditorStore((s) => s.setCurrentTime);
  const toggleMute = useEditorStore((s) => s.toggleMute);

  const { fps, duration } = project.metadata;
  const durationInFrames = useMemo(
    () => calculateDurationInFrames(duration, fps),
    [duration, fps]
  );

  // Measure the available container space with ResizeObserver
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (width > 0 && height > 0) {
          setContainerSize({ width, height });
        }
      }
    });

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Calculate Player dimensions that fit within the container while
  // maintaining the composition aspect ratio (object-fit: contain)
  const playerDimensions = useMemo(() => {
    if (!containerSize) return null;

    const compWidth = project.metadata.resolution.width;
    const compHeight = project.metadata.resolution.height;
    const aspectRatio = compWidth / compHeight;

    // Subtract padding (16px on each side = 32px total)
    const availableWidth = containerSize.width - 32;
    const availableHeight = containerSize.height - 32;

    if (availableWidth <= 0 || availableHeight <= 0) return null;

    let playerWidth: number;
    let playerHeight: number;

    if (availableWidth / availableHeight > aspectRatio) {
      // Container is wider than composition — height-constrained
      playerHeight = availableHeight;
      playerWidth = playerHeight * aspectRatio;
    } else {
      // Container is taller than composition — width-constrained
      playerWidth = availableWidth;
      playerHeight = playerWidth / aspectRatio;
    }

    return {
      width: Math.floor(playerWidth),
      height: Math.floor(playerHeight),
    };
  }, [containerSize, project.metadata.resolution]);

  const handlePlayPause = useCallback(() => {
    if (!playerRef.current) return;

    if (playback.isPlaying) {
      playerRef.current.pause();
    } else {
      playerRef.current.play();
    }
    // Note: Store update happens in onPlay/onPause callbacks
  }, [playback.isPlaying]);

  const handleRestart = useCallback(() => {
    if (!playerRef.current) return;
    playerRef.current.seekTo(0);
    // Store update happens via onFrame -> setCurrentTime(0) or manual
    setCurrentTime(0);
  }, [setCurrentTime]);

  const handleSeek = useCallback(
    (value: number[]) => {
      if (!playerRef.current) return;
      const frame = value[0];
      playerRef.current.seekTo(frame);
      setCurrentTime(frame / fps);
    },
    [fps, setCurrentTime]
  );
  
  // Sync Remotion Player events to the editor store via event listeners
  useEffect(() => {
    const player = playerRef.current;
    if (!player) return;

    const onFrameUpdate = (e: { detail: { frame: number } }) => {
      setCurrentTime(e.detail.frame / fps);
    };
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    const onEnded = () => setPlaying(false);

    player.addEventListener("frameupdate", onFrameUpdate);
    player.addEventListener("play", onPlay);
    player.addEventListener("pause", onPause);
    player.addEventListener("ended", onEnded);

    return () => {
      player.removeEventListener("frameupdate", onFrameUpdate);
      player.removeEventListener("play", onPlay);
      player.removeEventListener("pause", onPause);
      player.removeEventListener("ended", onEnded);
    };
  }, [fps, setCurrentTime, setPlaying]);

  const handleDownload = useCallback(async () => {
    try {
       // Placeholder for download logic
       alert("Download feature coming soon! (Requires backend rendering)");
       
       // Example of how we might call the API:
       // const res = await fetch('/api/render', { method: 'POST', body: JSON.stringify(project) });
       // const blob = await res.blob();
       // ...
    } catch (e) {
      console.error("Download failed", e);
    }
  }, [project]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <div className="flex flex-col h-full w-full min-w-0 min-h-0 bg-background overflow-hidden">
      {/* Player Container — measured by ResizeObserver */}
      <div
        ref={containerRef}
        className="flex-1 flex items-center justify-center bg-black/90 min-h-0 min-w-0 overflow-hidden"
      >
        {playerDimensions ? (
          <Player
            ref={playerRef}
            component={VideoComposition}
            inputProps={{ project }}
            durationInFrames={Math.max(durationInFrames, 1)}
            compositionWidth={project.metadata.resolution.width}
            compositionHeight={project.metadata.resolution.height}
            fps={fps}
            acknowledgeRemotionLicense
            style={{
              width: playerDimensions.width,
              height: playerDimensions.height,
            }}
            controls={false}
            loop={false}
            autoPlay={false}
            clickToPlay={false}
          />
        ) : null}
      </div>

      {/* Controls */}
      <div className="flex-shrink-0 flex flex-col gap-2 px-4 py-3 border-t bg-background">
         {/* Timeline Slider */}
         <div className="flex items-center gap-3 w-full">
            <span className="text-xs w-10 text-right tabular-nums text-muted-foreground">
              {formatTime(playback.currentTime)}
            </span>
            <Slider
              value={[playback.currentTime * fps]}
              min={0}
              max={durationInFrames}
              step={1}
              onValueChange={handleSeek}
              className="flex-1"
            />
            <span className="text-xs w-10 tabular-nums text-muted-foreground">
              {formatTime(duration)}
            </span>
         </div>

         {/* Buttons */}
         <div className="flex items-center justify-between">
            <span className="text-[10px] text-muted-foreground">
              {project.metadata.resolution.width}x{project.metadata.resolution.height} @{fps}fps
            </span>
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="icon"
                onClick={handleRestart}
                className="h-8 w-8"
                title="Restart"
              >
                <RotateCcw className="h-4 w-4" />
              </Button>

              <Button
                variant="default"
                size="icon"
                onClick={handlePlayPause}
                className="h-10 w-10 rounded-full"
                title={playback.isPlaying ? "Pause" : "Play"}
              >
                {playback.isPlaying ? (
                  <Pause className="h-5 w-5" />
                ) : (
                  <Play className="h-5 w-5 ml-0.5" />
                )}
              </Button>

              <Button
                variant="ghost"
                size="icon"
                onClick={toggleMute}
                className="h-8 w-8"
                title={playback.isMuted ? "Unmute" : "Mute"}
              >
                {playback.isMuted ? (
                  <VolumeX className="h-4 w-4" />
                ) : (
                  <Volume2 className="h-4 w-4" />
                )}
              </Button>
            </div>
            <Button variant="outline" size="sm" className="h-7 gap-1 text-xs" onClick={handleDownload}>
              <Download className="h-3 w-3" />
              Export
            </Button>
         </div>
      </div>
    </div>
  );
};
