/**
 * Voiceover / Text-to-Speech
 *
 * Uses ElevenLabs to generate voiceover audio from text.
 * Saves the output to public/renders/ and returns a public URL.
 *
 * ElevenLabs docs: https://elevenlabs.io/docs/api-reference
 */

import path from "path";
import fs from "fs";
import { ElevenLabsClient } from "elevenlabs";

const OUTPUT_DIR = path.resolve("./public/renders");

// ─── Voice Registry ──────────────────────────────────────────────────

/**
 * Curated list of ElevenLabs voices.
 * These are pre-cloned English voices available on all plans.
 */
export const VOICES: Record<string, { id: string; description: string }> = {
  rachel: { id: "21m00Tcm4TlvDq8ikWAM", description: "Calm, conversational female (American)" },
  drew: { id: "29vD33N1CtxCmqQRPOHJ", description: "Well-rounded male (American)" },
  clyde: { id: "2EiwWnXFnvU5JabPnv8n", description: "War veteran male (American)" },
  paul: { id: "5Q0t7uMcjvnagumLfvZi", description: "Narrative, male (American)" },
  domi: { id: "AZnzlk1XvdvUeBnXmlld", description: "Strong, female (American)" },
  dave: { id: "CYw3kZ02Hs0563khs1Fj", description: "Conversational, male (British-transatlantic)" },
  fin: { id: "D38z5RcWu1voky8WS1ja", description: "Sailor, male (Irish)" },
  sarah: { id: "EXAVITQu4vr4xnSDxMaL", description: "Soft, female (American)" },
  emily: { id: "LcfcDJNUP1GQjkzn1xUU", description: "Calm, female (American)" },
  elli: { id: "MF3mGyEYCl7XYWbV9V6O", description: "Emotional, female (American)" },
  callum: { id: "N2lVS1w4EtoT3dr4eOWO", description: "Intense, male (Transatlantic)" },
  patrick: { id: "ODq5zmih8GrVes37Dizd", description: "Masculine, male (American)" },
  charlie: { id: "IKne3meq5aSn9XLyUdCD", description: "Natural conversations, male (Australian)" },
  george: { id: "JBFqnCBsd6RMkjVDRZzb", description: "Warm, male (British)" },
  ethan: { id: "g5CIjZEefAph4nQFvHAz", description: "Soft, male (American)" },
  matilda: { id: "XrExE9yKIg1WjnnlVkGX", description: "Warm, female (American)" },
  james: { id: "ZQe5CZNOzWyzPSCn5a3c", description: "Calm, male (Australian)" },
  joseph: { id: "Zlb1dXrM653N07WRdFW3", description: "Journalist, male (British)" },
  glinda: { id: "z9fAnlkpzviPz146aGWa", description: "Witch, female (American)" },
  giovanna: { id: "s3HoLyFirVnDUYvfAShE", description: "Natural, female (Brazilian Portuguese)" },
  grace: { id: "oWAxZDx7w5VEj9dCyTzz", description: "Soft, female (Southern American)" },
};

// ─── Model Registry ──────────────────────────────────────────────────

export type TTSModel =
  | "eleven_multilingual_v2"  // Best quality, all languages
  | "eleven_turbo_v2_5"       // Fast, English + multilingual
  | "eleven_turbo_v2"         // Fastest, English only
  | "eleven_flash_v2_5";      // Ultra-fast, lowest latency

// ─── Types ──────────────────────────────────────────────────────────

export interface GenerateVoiceoverOptions {
  /** The text to convert to speech */
  text: string;
  /** Voice name (from VOICES registry) or voice ID (default: rachel) */
  voice?: string;
  /** TTS model to use (default: eleven_multilingual_v2) */
  model?: TTSModel;
  /** Voice stability (0-1, higher = more consistent, default: 0.5) */
  stability?: number;
  /** Similarity boost (0-1, higher = more similar to original voice, default: 0.75) */
  similarityBoost?: number;
  /** Style exaggeration (0-1, default: 0) */
  style?: number;
}

export interface VoiceoverResult {
  /** Public URL path to the generated audio file */
  publicUrl: string;
  /** Absolute path to the audio file on disk */
  filePath: string;
  /** Voice that was used */
  voice: string;
  /** Model used */
  model: string;
  /** Estimated audio duration in seconds (based on text length) */
  estimatedDurationSeconds: number;
}

// ─── Main Function ──────────────────────────────────────────────────

/**
 * Generate voiceover audio from text using ElevenLabs.
 */
export async function generateVoiceover(
  options: GenerateVoiceoverOptions
): Promise<VoiceoverResult> {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    throw new Error("ELEVENLABS_API_KEY environment variable is not set");
  }

  // Resolve voice ID
  const voiceName = options.voice ?? "rachel";
  const voiceEntry = VOICES[voiceName.toLowerCase()];
  const voiceId = voiceEntry?.id ?? voiceName; // fall back to treating it as a raw voice ID

  const model = options.model ?? "eleven_multilingual_v2";

  const client = new ElevenLabsClient({ apiKey });

  // Generate audio stream
  const audioStream = await client.textToSpeech.convertAsStream(voiceId, {
    text: options.text,
    model_id: model,
    voice_settings: {
      stability: options.stability ?? 0.5,
      similarity_boost: options.similarityBoost ?? 0.75,
      style: options.style ?? 0,
      use_speaker_boost: true,
    },
    output_format: "mp3_44100_128",
  });

  // Ensure output directory exists
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  // Write audio to file
  const fileName = `voiceover-${Date.now()}.mp3`;
  const filePath = path.join(OUTPUT_DIR, fileName);
  const publicUrl = `/renders/${fileName}`;

  await writeStreamToFile(audioStream, filePath);

  // Estimate duration from text (rough: ~150 words/min, avg 5 chars/word)
  const wordCount = options.text.split(/\s+/).length;
  const estimatedDurationSeconds = Math.ceil((wordCount / 150) * 60);

  return {
    publicUrl,
    filePath,
    voice: voiceEntry?.description ?? voiceId,
    model,
    estimatedDurationSeconds,
  };
}

// ─── Helpers ─────────────────────────────────────────────────────────

async function writeStreamToFile(
  stream: AsyncIterable<Uint8Array>,
  filePath: string
): Promise<void> {
  const writeStream = fs.createWriteStream(filePath);

  return new Promise((resolve, reject) => {
    (async () => {
      try {
        for await (const chunk of stream) {
          if (!writeStream.write(chunk)) {
            // Back-pressure: wait for drain
            await new Promise<void>((res) => writeStream.once("drain", res));
          }
        }
        writeStream.end();
        writeStream.once("finish", resolve);
        writeStream.once("error", reject);
      } catch (err) {
        writeStream.destroy();
        reject(err);
      }
    })();
  });
}

/**
 * Get the list of available voice names.
 */
export function getAvailableVoices(): Array<{ name: string; description: string }> {
  return Object.entries(VOICES).map(([name, info]) => ({
    name,
    description: info.description,
  }));
}
