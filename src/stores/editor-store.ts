/**
 * Editor Store
 *
 * Central state for the video editor. Holds the current VideoProject
 * and provides actions to mutate it. The Remotion Player reads from
 * this store and re-renders on every change.
 */

import { create } from "zustand";
import { v4 as uuidv4 } from "uuid";

import type {
  VideoProject,
  Track,
  Clip,
  AudioTrack,
  AudioClip,
  Transition,
  Asset,
  ProjectMetadata,
} from "@/lib/schema/video-schema";
import {
  createEmptyProject,
  createInstagramReelsTemplate,
} from "@/lib/schema/schema-defaults";

// ─── Playback State ─────────────────────────────────────────────────

export interface PlaybackState {
  isPlaying: boolean;
  currentTime: number; // in seconds
  volume: number;
  isMuted: boolean;
}

// ─── Save Status ────────────────────────────────────────────────────

export type SaveStatus = "idle" | "saving" | "saved" | "error";

// ─── Store Interface ────────────────────────────────────────────────

export interface EditorStore {
  // Project data
  project: VideoProject;
  projectId: string | null;
  isDirty: boolean;
  saveStatus: SaveStatus;
  currentVersion: number | null;

  // Playback
  playback: PlaybackState;

  // Selection
  selectedClipId: string | null;
  selectedTrackId: string | null;

  // UI state
  zoomLevel: number;
  timelineScrollLeft: number;

  // ─── Project Actions ────────────────────────────────────────────
  setProject: (project: VideoProject) => void;
  loadProject: (projectId: string, project: VideoProject) => void;
  updateMetadata: (updates: Partial<ProjectMetadata>) => void;
  resetProject: (template?: "empty" | "instagram-reel") => void;
  save: () => Promise<void>;

  // ─── Track Actions ──────────────────────────────────────────────
  addTrack: (track: Omit<Track, "id">) => string;
  removeTrack: (trackId: string) => void;
  updateTrack: (trackId: string, updates: Partial<Track>) => void;

  // ─── Clip Actions ───────────────────────────────────────────────
  addClip: (trackId: string, clip: Omit<Clip, "id">) => string;
  removeClip: (trackId: string, clipId: string) => void;
  updateClip: (trackId: string, clipId: string, updates: Partial<Clip>) => void;

  // ─── Audio Track Actions ────────────────────────────────────────
  addAudioTrack: (track: Omit<AudioTrack, "id">) => string;
  removeAudioTrack: (trackId: string) => void;
  addAudioClip: (trackId: string, clip: Omit<AudioClip, "id">) => string;
  removeAudioClip: (trackId: string, clipId: string) => void;

  // ─── Transition Actions ─────────────────────────────────────────
  addTransition: (transition: Omit<Transition, "id">) => string;
  removeTransition: (transitionId: string) => void;

  // ─── Asset Actions ──────────────────────────────────────────────
  addAsset: (asset: Omit<Asset, "id">) => string;
  removeAsset: (assetId: string) => void;
  updateAsset: (assetId: string, updates: Partial<Asset>) => void;

  // ─── Playback Actions ──────────────────────────────────────────
  setPlaying: (playing: boolean) => void;
  setCurrentTime: (time: number) => void;
  togglePlayback: () => void;
  setVolume: (volume: number) => void;
  toggleMute: () => void;

  // ─── Selection Actions ──────────────────────────────────────────
  selectClip: (clipId: string | null) => void;
  selectTrack: (trackId: string | null) => void;

  // ─── Timeline Actions ──────────────────────────────────────────
  setZoomLevel: (zoom: number) => void;
  setTimelineScrollLeft: (scroll: number) => void;
}

// ─── Store Implementation ───────────────────────────────────────────

export const useEditorStore = create<EditorStore>((set, get) => ({
  // Initial state
  project: createInstagramReelsTemplate("Untitled Reel"),
  projectId: null,
  isDirty: false,
  saveStatus: "idle",
  currentVersion: null,

  playback: {
    isPlaying: false,
    currentTime: 0,
    volume: 1,
    isMuted: false,
  },

  selectedClipId: null,
  selectedTrackId: null,
  zoomLevel: 1,
  timelineScrollLeft: 0,

  // ─── Project Actions ──────────────────────────────────────────

  setProject: (project) =>
    set({ project, isDirty: true }),

  loadProject: (projectId, project) =>
    set({
      projectId,
      project,
      isDirty: false,
      saveStatus: "idle",
      selectedClipId: null,
      selectedTrackId: null,
      playback: {
        isPlaying: false,
        currentTime: 0,
        volume: 1,
        isMuted: false,
      },
    }),

  updateMetadata: (updates) =>
    set((state) => ({
      project: {
        ...state.project,
        metadata: { ...state.project.metadata, ...updates },
        updatedAt: new Date().toISOString(),
      },
      isDirty: true,
    })),

  resetProject: (template = "instagram-reel") => {
    const project =
      template === "instagram-reel"
        ? createInstagramReelsTemplate("Untitled Reel")
        : createEmptyProject();

    set({
      project,
      isDirty: false,
      selectedClipId: null,
      selectedTrackId: null,
      playback: {
        isPlaying: false,
        currentTime: 0,
        volume: 1,
        isMuted: false,
      },
    });
  },

  save: async () => {
    const { projectId, project } = get();
    if (!projectId) return;

    set({ saveStatus: "saving" });

    try {
      const res = await fetch(`/api/projects/${projectId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectData: project }),
      });

      if (!res.ok) {
        throw new Error(`Save failed: HTTP ${res.status}`);
      }

      set({ isDirty: false, saveStatus: "saved" });

      // Reset to idle after 2 seconds
      setTimeout(() => {
        const current = get();
        if (current.saveStatus === "saved") {
          set({ saveStatus: "idle" });
        }
      }, 2000);
    } catch (err) {
      console.error("[EditorStore] Save failed:", err);
      set({ saveStatus: "error" });
    }
  },

  // ─── Track Actions ────────────────────────────────────────────

  addTrack: (trackData) => {
    const id = uuidv4();
    set((state) => ({
      project: {
        ...state.project,
        tracks: [...state.project.tracks, { ...trackData, id }],
        updatedAt: new Date().toISOString(),
      },
      isDirty: true,
    }));
    return id;
  },

  removeTrack: (trackId) =>
    set((state) => ({
      project: {
        ...state.project,
        tracks: state.project.tracks.filter((t) => t.id !== trackId),
        updatedAt: new Date().toISOString(),
      },
      isDirty: true,
      selectedTrackId:
        state.selectedTrackId === trackId ? null : state.selectedTrackId,
    })),

  updateTrack: (trackId, updates) =>
    set((state) => ({
      project: {
        ...state.project,
        tracks: state.project.tracks.map((t) =>
          t.id === trackId ? { ...t, ...updates } : t
        ),
        updatedAt: new Date().toISOString(),
      },
      isDirty: true,
    })),

  // ─── Clip Actions ─────────────────────────────────────────────

  addClip: (trackId, clipData) => {
    const id = uuidv4();
    set((state) => ({
      project: {
        ...state.project,
        tracks: state.project.tracks.map((t) =>
          t.id === trackId
            ? { ...t, clips: [...t.clips, { ...clipData, id }] }
            : t
        ),
        updatedAt: new Date().toISOString(),
      },
      isDirty: true,
    }));
    return id;
  },

  removeClip: (trackId, clipId) =>
    set((state) => ({
      project: {
        ...state.project,
        tracks: state.project.tracks.map((t) =>
          t.id === trackId
            ? { ...t, clips: t.clips.filter((c) => c.id !== clipId) }
            : t
        ),
        // Also remove any transitions referencing this clip
        transitions: state.project.transitions.filter(
          (tr) => tr.fromClipId !== clipId && tr.toClipId !== clipId
        ),
        updatedAt: new Date().toISOString(),
      },
      isDirty: true,
      selectedClipId:
        state.selectedClipId === clipId ? null : state.selectedClipId,
    })),

  updateClip: (trackId, clipId, updates) =>
    set((state) => ({
      project: {
        ...state.project,
        tracks: state.project.tracks.map((t) =>
          t.id === trackId
            ? {
                ...t,
                clips: t.clips.map((c) =>
                  c.id === clipId ? { ...c, ...updates } : c
                ),
              }
            : t
        ),
        updatedAt: new Date().toISOString(),
      },
      isDirty: true,
    })),

  // ─── Audio Track Actions ──────────────────────────────────────

  addAudioTrack: (trackData) => {
    const id = uuidv4();
    set((state) => ({
      project: {
        ...state.project,
        audioTracks: [...state.project.audioTracks, { ...trackData, id }],
        updatedAt: new Date().toISOString(),
      },
      isDirty: true,
    }));
    return id;
  },

  removeAudioTrack: (trackId) =>
    set((state) => ({
      project: {
        ...state.project,
        audioTracks: state.project.audioTracks.filter((t) => t.id !== trackId),
        updatedAt: new Date().toISOString(),
      },
      isDirty: true,
    })),

  addAudioClip: (trackId, clipData) => {
    const id = uuidv4();
    set((state) => ({
      project: {
        ...state.project,
        audioTracks: state.project.audioTracks.map((t) =>
          t.id === trackId
            ? { ...t, clips: [...t.clips, { ...clipData, id }] }
            : t
        ),
        updatedAt: new Date().toISOString(),
      },
      isDirty: true,
    }));
    return id;
  },

  removeAudioClip: (trackId, clipId) =>
    set((state) => ({
      project: {
        ...state.project,
        audioTracks: state.project.audioTracks.map((t) =>
          t.id === trackId
            ? { ...t, clips: t.clips.filter((c) => c.id !== clipId) }
            : t
        ),
        updatedAt: new Date().toISOString(),
      },
      isDirty: true,
    })),

  // ─── Transition Actions ───────────────────────────────────────

  addTransition: (transitionData) => {
    const id = uuidv4();
    set((state) => ({
      project: {
        ...state.project,
        transitions: [...state.project.transitions, { ...transitionData, id }],
        updatedAt: new Date().toISOString(),
      },
      isDirty: true,
    }));
    return id;
  },

  removeTransition: (transitionId) =>
    set((state) => ({
      project: {
        ...state.project,
        transitions: state.project.transitions.filter(
          (t) => t.id !== transitionId
        ),
        updatedAt: new Date().toISOString(),
      },
      isDirty: true,
    })),

  // ─── Asset Actions ────────────────────────────────────────────

  addAsset: (assetData) => {
    const id = uuidv4();
    set((state) => ({
      project: {
        ...state.project,
        assets: {
          ...state.project.assets,
          [id]: { ...assetData, id },
        },
        updatedAt: new Date().toISOString(),
      },
      isDirty: true,
    }));
    return id;
  },

  removeAsset: (assetId) =>
    set((state) => {
      const newAssets = { ...state.project.assets };
      delete newAssets[assetId];
      return {
        project: {
          ...state.project,
          assets: newAssets,
          updatedAt: new Date().toISOString(),
        },
        isDirty: true,
      };
    }),

  updateAsset: (assetId, updates) =>
    set((state) => ({
      project: {
        ...state.project,
        assets: {
          ...state.project.assets,
          [assetId]: { ...state.project.assets[assetId], ...updates },
        },
        updatedAt: new Date().toISOString(),
      },
      isDirty: true,
    })),

  // ─── Playback Actions ─────────────────────────────────────────

  setPlaying: (isPlaying) =>
    set((state) => ({
      playback: { ...state.playback, isPlaying },
    })),

  setCurrentTime: (time) =>
    set((state) => ({
      playback: { ...state.playback, currentTime: time },
    })),

  togglePlayback: () =>
    set((state) => ({
      playback: { ...state.playback, isPlaying: !state.playback.isPlaying },
    })),

  setVolume: (volume) =>
    set((state) => ({
      playback: { ...state.playback, volume },
    })),

  toggleMute: () =>
    set((state) => ({
      playback: { ...state.playback, isMuted: !state.playback.isMuted },
    })),

  // ─── Selection Actions ────────────────────────────────────────

  selectClip: (clipId) => set({ selectedClipId: clipId }),
  selectTrack: (trackId) => set({ selectedTrackId: trackId }),

  // ─── Timeline Actions ─────────────────────────────────────────

  setZoomLevel: (zoomLevel) => set({ zoomLevel }),
  setTimelineScrollLeft: (timelineScrollLeft) => set({ timelineScrollLeft }),
}));
