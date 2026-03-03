/**
 * Agent Tool Definitions
 *
 * Defines the tools (functions) that the AI agent can call
 * to manipulate the VideoProject JSON. These are passed to
 * Claude's tool_use API.
 *
 * Design principles:
 * - Tools operate on the complete VideoProject, returning a modified copy
 * - Each tool does one thing well (single responsibility)
 * - Tools validate their inputs with Zod before applying changes
 * - The `update_project` tool is the most powerful — it replaces the entire project
 *   (useful for the agent to make sweeping changes from a plan)
 */

import type { Tool } from "@anthropic-ai/sdk/resources/messages";

// ─── Source Metadata ────────────────────────────────────────────────

/** Built-in tool names for quick identification when merging with MCP tools */
export const BUILTIN_TOOL_NAMES = new Set([
  "update_project",
  "update_metadata",
  "add_track",
  "remove_track",
  "add_clip",
  "update_clip",
  "remove_clip",
  "add_asset",
  "add_transition",
  "get_project_summary",
  "review_video",
  "search_stock_media",
  "add_audio_track",
  "add_audio_clip",
  "render_video",
  "generate_image",
  "generate_voiceover",
  "list_skills",
  "apply_skill",
  "add_keyframe",
  "remove_keyframe",
  "generate_captions",
]);

/**
 * Check if a tool name is a built-in tool.
 */
export function isBuiltinTool(name: string): boolean {
  return BUILTIN_TOOL_NAMES.has(name);
}

// ─── Tool Definitions for Anthropic API ─────────────────────────────

export const agentTools: Tool[] = [
  // ─── Project-Level Tools ──────────────────────────────────────────
  {
    name: "update_project",
    description: `Replace the entire VideoProject JSON. Use this when making large changes, creating a new video from scratch, or applying multiple edits at once. The input must be a complete, valid VideoProject object.

IMPORTANT: When using this tool, you must provide the COMPLETE project JSON — not a partial update. This includes version, id, metadata, tracks, audioTracks, transitions, assets, createdAt, and updatedAt fields.`,
    input_schema: {
      type: "object" as const,
      properties: {
        project: {
          type: "object",
          description:
            "The complete VideoProject JSON object. Must conform to the VideoProject schema.",
        },
      },
      required: ["project"],
    },
  },

  {
    name: "update_metadata",
    description: `Update project metadata fields like title, description, aspectRatio, fps, resolution, duration, or backgroundColor. Only include the fields you want to change.`,
    input_schema: {
      type: "object" as const,
      properties: {
        title: { type: "string", description: "Project title" },
        description: { type: "string", description: "Project description" },
        aspectRatio: {
          type: "string",
          enum: ["9:16", "16:9", "1:1", "4:5"],
          description: "Video aspect ratio",
        },
        fps: {
          type: "number",
          enum: [24, 30, 60],
          description: "Frames per second",
        },
        resolution: {
          type: "object",
          properties: {
            width: { type: "number" },
            height: { type: "number" },
          },
          description: "Video resolution in pixels",
        },
        duration: {
          type: "number",
          description: "Total video duration in seconds",
        },
        backgroundColor: {
          type: "string",
          description: "Background color (CSS color value)",
        },
      },
      required: [],
    },
  },

  // ─── Track Tools ──────────────────────────────────────────────────
  {
    name: "add_track",
    description: `Add a new visual track to the project. Tracks are layered bottom-to-top (index 0 = background). Types: video, image, text, shape, sticker.`,
    input_schema: {
      type: "object" as const,
      properties: {
        type: {
          type: "string",
          enum: ["video", "image", "text", "shape", "sticker"],
          description: "Type of content on this track",
        },
        name: {
          type: "string",
          description: "Human-readable track name",
        },
        insertIndex: {
          type: "number",
          description:
            "Position to insert the track (0 = bottom). If omitted, adds to top.",
        },
      },
      required: ["type", "name"],
    },
  },

  {
    name: "remove_track",
    description: `Remove a track and all its clips from the project.`,
    input_schema: {
      type: "object" as const,
      properties: {
        trackId: {
          type: "string",
          description: "The ID of the track to remove",
        },
      },
      required: ["trackId"],
    },
  },

  // ─── Clip Tools ───────────────────────────────────────────────────
  {
    name: "add_clip",
    description: `Add a clip to a track. The clip type should match the track type.

For TEXT clips, include the 'text' property with content, fontSize, fontFamily, fontWeight, color, textAlign, etc.
For SHAPE clips, include the 'shape' property with shapeType, fill, width, height, etc.
For VIDEO/IMAGE clips, include 'assetId' referencing an asset in the registry.

Always include startTime and duration. Optionally include position, animations, filters, opacity, rotation.`,
    input_schema: {
      type: "object" as const,
      properties: {
        trackId: {
          type: "string",
          description: "The ID of the track to add the clip to",
        },
        clip: {
          type: "object",
          description:
            "The clip object (without 'id' — it will be auto-generated). Must include startTime and duration.",
          properties: {
            assetId: {
              type: "string",
              description: "Reference to asset in the assets registry",
            },
            startTime: {
              type: "number",
              description: "When this clip starts on the timeline (seconds)",
            },
            duration: {
              type: "number",
              description: "How long this clip is displayed (seconds)",
            },
            position: {
              type: "object",
              properties: {
                x: { type: "number" },
                y: { type: "number" },
              },
              description: "Position on canvas in pixels",
            },
            opacity: {
              type: "number",
              description: "Opacity (0 = transparent, 1 = opaque)",
            },
            rotation: {
              type: "number",
              description: "Rotation in degrees",
            },
            resizeMode: {
              type: "string",
              enum: ["cover", "contain", "stretch", "none"],
            },
            animations: {
              type: "array",
              description: "List of animations",
              items: {
                type: "object",
                properties: {
                  type: {
                    type: "string",
                    enum: [
                      "fadeIn",
                      "fadeOut",
                      "slideIn",
                      "slideOut",
                      "scaleIn",
                      "scaleOut",
                      "bounce",
                      "typewriter",
                      "blur",
                      "none",
                    ],
                  },
                  direction: {
                    type: "string",
                    enum: ["left", "right", "up", "down"],
                  },
                  duration: { type: "number" },
                  easing: {
                    type: "string",
                    enum: [
                      "linear",
                      "easeIn",
                      "easeOut",
                      "easeInOut",
                      "spring",
                    ],
                  },
                  delay: { type: "number" },
                },
              },
            },
            text: {
              type: "object",
              description: "Text properties (for text clips)",
              properties: {
                content: { type: "string" },
                fontSize: { type: "number" },
                fontFamily: { type: "string" },
                fontWeight: {
                  type: "string",
                  enum: [
                    "normal",
                    "bold",
                    "100",
                    "200",
                    "300",
                    "400",
                    "500",
                    "600",
                    "700",
                    "800",
                    "900",
                  ],
                },
                color: { type: "string" },
                backgroundColor: { type: "string" },
                backgroundPadding: { type: "number" },
                backgroundBorderRadius: { type: "number" },
                textAlign: {
                  type: "string",
                  enum: ["left", "center", "right"],
                },
                lineHeight: { type: "number" },
                letterSpacing: { type: "number" },
                textShadow: { type: "string" },
                maxWidth: { type: "number" },
              },
            },
            shape: {
              type: "object",
              description: "Shape properties (for shape clips)",
              properties: {
                shapeType: {
                  type: "string",
                  enum: ["rectangle", "circle", "rounded-rect", "line"],
                },
                fill: { type: "string" },
                stroke: { type: "string" },
                strokeWidth: { type: "number" },
                borderRadius: { type: "number" },
                width: { type: "number" },
                height: { type: "number" },
              },
            },
            filters: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  type: {
                    type: "string",
                    enum: [
                      "brightness",
                      "contrast",
                      "saturate",
                      "grayscale",
                      "sepia",
                      "blur",
                      "hue-rotate",
                      "opacity",
                    ],
                  },
                  value: { type: "number" },
                },
              },
            },
            kenBurns: {
              type: "object",
              description: "Ken Burns effect (for images)",
              properties: {
                enabled: { type: "boolean" },
                startScale: { type: "number" },
                endScale: { type: "number" },
                startPosition: {
                  type: "object",
                  properties: { x: { type: "number" }, y: { type: "number" } },
                },
                endPosition: {
                  type: "object",
                  properties: { x: { type: "number" }, y: { type: "number" } },
                },
              },
            },
            volume: { type: "number" },
            muted: { type: "boolean" },
          },
        },
      },
      required: ["trackId", "clip"],
    },
  },

  {
    name: "update_clip",
    description: `Update properties of an existing clip. You can change any clip property: position, text content, animations, filters, opacity, timing, etc. Only include the fields you want to change.`,
    input_schema: {
      type: "object" as const,
      properties: {
        clipId: {
          type: "string",
          description: "The ID of the clip to update",
        },
        updates: {
          type: "object",
          description:
            "Partial clip object with only the fields to update. Supports all clip properties.",
        },
      },
      required: ["clipId", "updates"],
    },
  },

  {
    name: "remove_clip",
    description: `Remove a clip from its track. Also removes any transitions referencing this clip.`,
    input_schema: {
      type: "object" as const,
      properties: {
        clipId: {
          type: "string",
          description: "The ID of the clip to remove",
        },
      },
      required: ["clipId"],
    },
  },

  // ─── Asset Tools ──────────────────────────────────────────────────
  {
    name: "add_asset",
    description: `Register an asset (video, image, audio) in the project's asset registry. Assets are referenced by clips via assetId. Use this before adding clips that reference media files.`,
    input_schema: {
      type: "object" as const,
      properties: {
        asset: {
          type: "object",
          description:
            "Asset object (without 'id' — it will be auto-generated)",
          properties: {
            type: {
              type: "string",
              enum: ["video", "image", "audio", "generated"],
            },
            source: {
              type: "string",
              enum: ["upload", "stock", "ai-generated", "url"],
            },
            url: { type: "string", description: "URL to the asset file" },
            filename: { type: "string", description: "Original filename" },
            mimeType: { type: "string", description: "MIME type" },
            metadata: {
              type: "object",
              properties: {
                originalQuery: { type: "string" },
                provider: { type: "string" },
                duration: { type: "number" },
                dimensions: {
                  type: "object",
                  properties: {
                    width: { type: "number" },
                    height: { type: "number" },
                  },
                },
                fileSize: { type: "number" },
              },
            },
          },
        },
      },
      required: ["asset"],
    },
  },

  // ─── Transition Tools ─────────────────────────────────────────────
  {
    name: "add_transition",
    description: `Add a transition effect between two clips. Types: fade, dissolve, wipe, slide, zoom, glitch.`,
    input_schema: {
      type: "object" as const,
      properties: {
        type: {
          type: "string",
          enum: ["fade", "dissolve", "wipe", "slide", "zoom", "glitch"],
          description: "Transition effect type",
        },
        duration: {
          type: "number",
          description: "Transition duration in seconds (max 5)",
        },
        fromClipId: {
          type: "string",
          description: "ID of the clip transitioning from",
        },
        toClipId: {
          type: "string",
          description: "ID of the clip transitioning to",
        },
      },
      required: ["type", "duration", "fromClipId", "toClipId"],
    },
  },

  // ─── Query Tools ──────────────────────────────────────────────────
  {
    name: "get_project_summary",
    description: `Get a structured summary of the current project state — tracks, clips, assets, duration, etc. Use this to understand the current state before making changes.`,
    input_schema: {
      type: "object" as const,
      properties: {},
      required: [],
    },
  },

  // ─── Review Tools ─────────────────────────────────────────────────
  {
    name: "review_video",
    description: `Review the current video project and provide detailed feedback on pacing, visual design, content effectiveness, animations, and technical issues. Uses an external AI reviewer (Gemini) to analyze the project schema and suggest improvements. Call this when the user asks for feedback or a review of their video.`,
    input_schema: {
      type: "object" as const,
      properties: {},
      required: [],
    },
  },

  // ─── Stock Media Tools ────────────────────────────────────────────
  {
    name: "search_stock_media",
    description: `Search for free stock photos and videos from Pexels. Returns a list of results with URLs, dimensions, and metadata. Use the results to register assets (via add_asset) and then add clips referencing those assets.

WORKFLOW: search_stock_media → pick best result → add_asset (with the URL) → add_clip (with the returned assetId)

Tips:
- Use specific, descriptive queries (e.g. "sunset over ocean waves" not just "sunset")
- For vertical/short-form video, use orientation "portrait"
- For background footage, search for "video" mediaType`,
    input_schema: {
      type: "object" as const,
      properties: {
        query: {
          type: "string",
          description: "Search query describing the desired media",
        },
        mediaType: {
          type: "string",
          enum: ["photo", "video", "both"],
          description: "Type of media to search for",
        },
        orientation: {
          type: "string",
          enum: ["landscape", "portrait", "square"],
          description:
            "Filter by orientation. Use 'portrait' for 9:16 vertical videos, 'landscape' for 16:9",
        },
        perPage: {
          type: "number",
          description: "Number of results to return (1-10, default 5)",
        },
      },
      required: ["query", "mediaType"],
    },
  },

  // ─── Audio Track Tools ────────────────────────────────────────────
  {
    name: "add_audio_track",
    description: `Add a new audio track to the project. Audio tracks hold audio clips (background music, sound effects, voiceovers). Multiple audio tracks can play simultaneously.`,
    input_schema: {
      type: "object" as const,
      properties: {
        name: {
          type: "string",
          description:
            "Human-readable track name (e.g. 'Background Music', 'Sound Effects', 'Voiceover')",
        },
        volume: {
          type: "number",
          description: "Track volume (0-1, default 1)",
        },
      },
      required: ["name"],
    },
  },

  {
    name: "add_audio_clip",
    description: `Add an audio clip to an audio track. The clip must reference a registered audio asset via assetId. Use add_asset first to register the audio file, then use the returned assetId here.`,
    input_schema: {
      type: "object" as const,
      properties: {
        audioTrackId: {
          type: "string",
          description: "The ID of the audio track to add the clip to",
        },
        clip: {
          type: "object",
          description: "Audio clip data",
          properties: {
            assetId: {
              type: "string",
              description: "Reference to an audio asset in the asset registry",
            },
            startTime: {
              type: "number",
              description: "When this clip starts on the timeline (seconds)",
            },
            duration: {
              type: "number",
              description: "How long this clip plays (seconds)",
            },
            trim: {
              type: "object",
              properties: {
                start: { type: "number" },
                end: { type: "number" },
              },
              description: "Trim the audio source (start/end in seconds)",
            },
            volume: {
              type: "number",
              description: "Clip volume multiplier (0-1, default 1)",
            },
            fadeIn: {
              type: "number",
              description: "Fade in duration in seconds",
            },
            fadeOut: {
              type: "number",
              description: "Fade out duration in seconds",
            },
          },
          required: ["assetId", "startTime", "duration"],
        },
      },
      required: ["audioTrackId", "clip"],
    },
  },

  // ─── Render Tools ─────────────────────────────────────────────────
  {
    name: "render_video",
    description: `Render the current video project to an MP4 file. This creates a real video file that can be downloaded or used for visual review. The rendering process takes 10-60 seconds depending on video length and complexity.

Use this when:
- The user wants to export/download the video
- You want to visually review the video after making changes
- The user asks to "render", "export", or "generate" the video`,
    input_schema: {
      type: "object" as const,
      properties: {
        quality: {
          type: "string",
          enum: ["draft", "standard", "high"],
          description:
            "Render quality preset. 'draft' = fast/low quality, 'standard' = balanced, 'high' = slow/best quality. Default: standard",
        },
      },
      required: [],
    },
  },

  // ─── AI Generation Tools ──────────────────────────────────────────
  {
    name: "generate_image",
    description: `Generate an AI image using Fal.ai (FLUX models). The generated image URL is returned so you can immediately add it as an asset with add_asset.

Use this when:
- The user wants custom AI-generated imagery instead of stock photos
- You need a very specific visual that doesn't exist in stock libraries
- Creating backgrounds, textures, or stylized illustrations

Workflow: generate_image → use the returned url in add_asset → add_clip to a track`,
    input_schema: {
      type: "object" as const,
      properties: {
        prompt: {
          type: "string",
          description:
            "Detailed text description of the image to generate. Be specific about style, lighting, composition, colors",
        },
        negativePrompt: {
          type: "string",
          description:
            "Things to avoid in the image (e.g. 'blurry, low quality, watermark, text')",
        },
        model: {
          type: "string",
          enum: ["flux-schnell", "flux-dev", "flux-pro", "stable-diffusion-xl"],
          description:
            "Model to use. 'flux-schnell' = fastest (4 steps), 'flux-dev' = balanced, 'flux-pro' = highest quality. Default: flux-schnell",
        },
        width: {
          type: "number",
          description:
            "Image width in pixels. For 9:16 vertical video: 1080. For 16:9: 1920. Default: auto-selected based on aspect ratio",
        },
        height: {
          type: "number",
          description:
            "Image height in pixels. For 9:16 vertical video: 1920. For 16:9: 1080. Default: auto-selected",
        },
        numImages: {
          type: "number",
          description: "Number of images to generate (1-4). Default: 1",
        },
      },
      required: ["prompt"],
    },
  },

  {
    name: "generate_voiceover",
    description: `Generate a voiceover audio file from text using ElevenLabs TTS. The generated MP3 is saved and a public URL is returned so you can add it as an audio asset.

Use this when:
- The user wants narration or voiceover for their video
- Creating explainer videos, tutorials, or stories with spoken text
- Adding a professional voice to the video content

Workflow: generate_voiceover → use the returned url in add_asset (type: audio) → add_audio_clip

Available voices: rachel (default, calm female), george (warm British male), charlie (Australian male), sarah (soft female), drew (American male), matilda (warm female), and many more.`,
    input_schema: {
      type: "object" as const,
      properties: {
        text: {
          type: "string",
          description: "The text to convert to speech. Can include natural pauses with commas and periods.",
        },
        voice: {
          type: "string",
          description:
            "Voice name or ID. Options: rachel (default), george, charlie, sarah, drew, matilda, emily, elli, james, joseph, clyde, domi, dave, fin, paul, callum, ethan, patrick, glinda, grace. Default: rachel",
        },
        model: {
          type: "string",
          enum: [
            "eleven_multilingual_v2",
            "eleven_turbo_v2_5",
            "eleven_turbo_v2",
            "eleven_flash_v2_5",
          ],
          description:
            "TTS model. 'eleven_multilingual_v2' = best quality (default), 'eleven_turbo_v2_5' = fast + multilingual, 'eleven_turbo_v2' = fast English only, 'eleven_flash_v2_5' = ultra-fast",
        },
        stability: {
          type: "number",
          description: "Voice stability (0-1). Higher = more consistent but less expressive. Default: 0.5",
        },
        similarityBoost: {
          type: "number",
          description: "Similarity to original voice (0-1). Default: 0.75",
        },
      },
      required: ["text"],
    },
  },

  // ─── Skills Tools ──────────────────────────────────────────────────

  {
    name: "list_skills",
    description: `List all available agent skills, optionally filtered by category.

Skills are higher-order composites that perform common editing tasks in 1-2 calls instead of 5-10. Examples: apply a cinematic color grade, add a lower-third, create a kinetic title, add a gradient background.

Categories: color-grade, typography, background, layout, effects`,
    input_schema: {
      type: "object" as const,
      properties: {
        category: {
          type: "string",
          enum: ["color-grade", "typography", "background", "layout", "effects"],
          description: "Filter by category (optional). Omit to list all skills.",
        },
      },
      required: [],
    },
  },

  {
    name: "apply_skill",
    description: `Apply a registered skill to the current project. Skills are parameterized macros that perform complex, multi-step edits in a single call.

Call list_skills first to discover available skills and their required parameters.

Example workflow:
1. list_skills(category: "color-grade") to see color presets
2. apply_skill(skillId: "color_grade_cinematic") to apply the cinematic look
3. list_skills(category: "typography") to see text skills
4. apply_skill(skillId: "lower_third", params: { primaryText: "John Doe", subtitleText: "CEO" })`,
    input_schema: {
      type: "object" as const,
      properties: {
        skillId: {
          type: "string",
          description: "The skill ID to apply (from list_skills)",
        },
        params: {
          type: "object",
          description: "Parameters for the skill (see list_skills for required/optional params per skill). Pass as a JSON object.",
          additionalProperties: true,
        },
      },
      required: ["skillId"],
    },
  },

  // ─── Keyframe Tools ────────────────────────────────────────────────

  {
    name: "add_keyframe",
    description: `Add or update a keyframe on a specific clip. Keyframes define absolute property values at a point in time (0=clip start, 1=clip end), enabling smooth property animations.

Keyframe values OVERRIDE base clip properties. Multiple keyframes are interpolated automatically.

Use cases:
- Fade a clip's opacity from 0 → 1 → 0 over its duration
- Pan a text element from left to right
- Scale an element up mid-clip for emphasis
- Rotate a shape continuously

Note: The agent uses keyframes for D1 (Keyframe Animation) — no editor UI is exposed.`,
    input_schema: {
      type: "object" as const,
      properties: {
        clipId: {
          type: "string",
          description: "ID of the clip to add the keyframe to",
        },
        keyframe: {
          type: "object",
          description: "Keyframe definition",
          properties: {
            time: {
              type: "number",
              description: "Normalized time within clip: 0 = start, 1 = end",
            },
            opacity: { type: "number", description: "Absolute opacity (0–1)" },
            x: { type: "number", description: "Absolute X position in pixels" },
            y: { type: "number", description: "Absolute Y position in pixels" },
            scaleX: { type: "number", description: "Horizontal scale factor" },
            scaleY: { type: "number", description: "Vertical scale factor" },
            rotation: { type: "number", description: "Rotation in degrees" },
            easing: {
              type: "string",
              enum: ["linear", "easeIn", "easeOut", "easeInOut", "spring"],
              description: "Easing function for interpolation to this keyframe",
            },
          },
          required: ["time"],
        },
      },
      required: ["clipId", "keyframe"],
    },
  },

  {
    name: "remove_keyframe",
    description: `Remove a keyframe from a clip at a specific time value.

Provide the exact normalized time (0–1) of the keyframe to remove. Use get_project_summary to inspect current keyframes on a clip.`,
    input_schema: {
      type: "object" as const,
      properties: {
        clipId: {
          type: "string",
          description: "ID of the clip to remove the keyframe from",
        },
        time: {
          type: "number",
          description: "Normalized time (0–1) of the keyframe to remove",
        },
      },
      required: ["clipId", "time"],
    },
  },

  // ─── Captions Tool ─────────────────────────────────────────────────

  {
    name: "generate_captions",
    description: `Auto-generate captions for a video by transcribing an audio asset with ElevenLabs Scribe (word-level timestamps). Creates a timed text track with subtitle clips.

Requires an audio asset (e.g. voiceover or soundtrack) already in project.assets. Use add_asset first if the audio is not yet in the project.

Caption styles:
- "default": white text, semi-transparent black background (most readable)
- "bold": white text on purple accent background with stroke
- "minimal": white text with shadow only (clean, no background)
- "kinetic": word-by-word fade animation (dynamic, engaging)

Workflow: add_asset (audio) → generate_captions(audioAssetId)`,
    input_schema: {
      type: "object" as const,
      properties: {
        audioAssetId: {
          type: "string",
          description: "ID of the audio asset in project.assets to transcribe",
        },
        style: {
          type: "string",
          enum: ["default", "bold", "minimal", "kinetic"],
          description: "Visual style for the captions. Default: 'default'",
        },
        maxWordsPerCaption: {
          type: "number",
          description: "Maximum number of words per caption segment. Default: 6",
        },
        position: {
          type: "object",
          description: "Override caption position (default: center-bottom at y=1700)",
          properties: {
            x: { type: "number", description: "Horizontal center position in pixels (default: 540)" },
            y: { type: "number", description: "Vertical position in pixels (default: 1700)" },
          },
        },
      },
      required: ["audioAssetId"],
    },
  },
];
