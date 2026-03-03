/**
 * S3 Asset Storage
 *
 * Handles uploading, downloading, and managing assets in S3.
 * Provides presigned URLs for direct browser uploads.
 */

import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

// ─── S3 Client ──────────────────────────────────────────────────────

const s3Client = new S3Client({
  region: process.env.AWS_REGION ?? "us-east-1",
  credentials: process.env.AWS_ACCESS_KEY_ID
    ? {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY ?? "",
      }
    : undefined,
  ...(process.env.S3_ENDPOINT
    ? {
        endpoint: process.env.S3_ENDPOINT,
        forcePathStyle: true, // Required for MinIO/LocalStack
      }
    : {}),
});

const BUCKET_NAME = process.env.S3_BUCKET_NAME ?? "reelforge-assets";

// ─── Key Generation ─────────────────────────────────────────────────

/**
 * Generates a structured S3 key for an asset.
 */
export function generateAssetKey(
  projectId: string,
  assetId: string,
  filename: string
): string {
  const ext = filename.split(".").pop() ?? "";
  return `projects/${projectId}/assets/${assetId}${ext ? `.${ext}` : ""}`;
}

/**
 * Generates a key for rendered video output.
 */
export function generateRenderOutputKey(
  projectId: string,
  renderId: string
): string {
  return `projects/${projectId}/renders/${renderId}.mp4`;
}

// ─── Upload ─────────────────────────────────────────────────────────

/**
 * Uploads a file buffer to S3.
 */
export async function uploadAsset(
  key: string,
  body: Buffer | Uint8Array | ReadableStream,
  contentType: string
): Promise<string> {
  await s3Client.send(
    new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
      Body: body,
      ContentType: contentType,
    })
  );

  return getAssetUrl(key);
}

/**
 * Gets a presigned URL for direct browser upload.
 */
export async function getUploadPresignedUrl(
  key: string,
  contentType: string,
  expiresIn: number = 3600
): Promise<string> {
  const command = new PutObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
    ContentType: contentType,
  });

  return getSignedUrl(s3Client, command, { expiresIn });
}

// ─── Download ───────────────────────────────────────────────────────

/**
 * Gets a presigned URL for downloading an asset.
 */
export async function getDownloadPresignedUrl(
  key: string,
  expiresIn: number = 3600
): Promise<string> {
  const command = new GetObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
  });

  return getSignedUrl(s3Client, command, { expiresIn });
}

/**
 * Gets the public URL for an asset.
 * Uses a custom CDN URL if configured, otherwise constructs S3 URL.
 */
export function getAssetUrl(key: string): string {
  if (process.env.CDN_URL) {
    return `${process.env.CDN_URL}/${key}`;
  }

  if (process.env.S3_ENDPOINT) {
    return `${process.env.S3_ENDPOINT}/${BUCKET_NAME}/${key}`;
  }

  return `https://${BUCKET_NAME}.s3.${process.env.AWS_REGION ?? "us-east-1"}.amazonaws.com/${key}`;
}

// ─── Delete ─────────────────────────────────────────────────────────

/**
 * Deletes an asset from S3.
 */
export async function deleteAsset(key: string): Promise<void> {
  await s3Client.send(
    new DeleteObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
    })
  );
}

// ─── Metadata ───────────────────────────────────────────────────────

/**
 * Checks if an asset exists in S3 and returns its metadata.
 */
export async function getAssetMetadata(
  key: string
): Promise<{ contentType?: string; contentLength?: number } | null> {
  try {
    const response = await s3Client.send(
      new HeadObjectCommand({
        Bucket: BUCKET_NAME,
        Key: key,
      })
    );

    return {
      contentType: response.ContentType,
      contentLength: response.ContentLength,
    };
  } catch {
    return null;
  }
}

// ─── Export client for advanced usage ────────────────────────────────

export { s3Client, BUCKET_NAME };
