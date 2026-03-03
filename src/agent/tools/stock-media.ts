/**
 * Stock Media Search
 *
 * Searches the Pexels API for stock photos and videos.
 * Returns results formatted for the agent to use with add_asset.
 *
 * Pexels API docs: https://www.pexels.com/api/documentation/
 */

const PEXELS_BASE = "https://api.pexels.com";

interface PexelsPhoto {
  id: number;
  width: number;
  height: number;
  url: string;
  photographer: string;
  src: {
    original: string;
    large2x: string;
    large: string;
    medium: string;
    small: string;
  };
  alt: string;
}

interface PexelsVideo {
  id: number;
  width: number;
  height: number;
  url: string;
  duration: number;
  user: { name: string };
  video_files: {
    id: number;
    quality: string;
    file_type: string;
    width: number;
    height: number;
    link: string;
  }[];
}

interface PexelsPhotosResponse {
  photos: PexelsPhoto[];
  total_results: number;
  page: number;
  per_page: number;
}

interface PexelsVideosResponse {
  videos: PexelsVideo[];
  total_results: number;
  page: number;
  per_page: number;
}

export interface StockMediaResult {
  type: "image" | "video";
  url: string;
  thumbnailUrl: string;
  width: number;
  height: number;
  duration?: number;
  photographer: string;
  alt: string;
  pexelsUrl: string;
  mimeType: string;
}

/**
 * Search Pexels for stock photos.
 */
export async function searchStockPhotos(
  query: string,
  options: {
    orientation?: "landscape" | "portrait" | "square";
    perPage?: number;
  } = {}
): Promise<StockMediaResult[]> {
  const apiKey = process.env.PEXELS_API_KEY;
  if (!apiKey) {
    throw new Error("PEXELS_API_KEY environment variable is not set");
  }

  const params = new URLSearchParams({
    query,
    per_page: String(options.perPage ?? 5),
  });
  if (options.orientation) {
    params.set("orientation", options.orientation);
  }

  const response = await fetch(`${PEXELS_BASE}/v1/search?${params}`, {
    headers: { Authorization: apiKey },
  });

  if (!response.ok) {
    throw new Error(`Pexels API error: ${response.status} ${response.statusText}`);
  }

  const data = (await response.json()) as PexelsPhotosResponse;

  return data.photos.map((photo) => ({
    type: "image" as const,
    url: photo.src.large2x,
    thumbnailUrl: photo.src.medium,
    width: photo.width,
    height: photo.height,
    photographer: photo.photographer,
    alt: photo.alt || query,
    pexelsUrl: photo.url,
    mimeType: "image/jpeg",
  }));
}

/**
 * Search Pexels for stock videos.
 */
export async function searchStockVideos(
  query: string,
  options: {
    orientation?: "landscape" | "portrait" | "square";
    perPage?: number;
    minDuration?: number;
    maxDuration?: number;
  } = {}
): Promise<StockMediaResult[]> {
  const apiKey = process.env.PEXELS_API_KEY;
  if (!apiKey) {
    throw new Error("PEXELS_API_KEY environment variable is not set");
  }

  const params = new URLSearchParams({
    query,
    per_page: String(options.perPage ?? 5),
  });
  if (options.orientation) {
    params.set("orientation", options.orientation);
  }
  if (options.minDuration) {
    params.set("min_duration", String(options.minDuration));
  }
  if (options.maxDuration) {
    params.set("max_duration", String(options.maxDuration));
  }

  const response = await fetch(`${PEXELS_BASE}/videos/search?${params}`, {
    headers: { Authorization: apiKey },
  });

  if (!response.ok) {
    throw new Error(`Pexels API error: ${response.status} ${response.statusText}`);
  }

  const data = (await response.json()) as PexelsVideosResponse;

  return data.videos.map((video) => {
    // Pick the best quality MP4 file (prefer HD)
    const bestFile =
      video.video_files
        .filter((f) => f.file_type === "video/mp4")
        .sort((a, b) => b.width - a.width)[0] ?? video.video_files[0];

    return {
      type: "video" as const,
      url: bestFile?.link ?? "",
      thumbnailUrl: `https://images.pexels.com/videos/${video.id}/free-video-${video.id}.jpg?auto=compress&w=400`,
      width: video.width,
      height: video.height,
      duration: video.duration,
      photographer: video.user.name,
      alt: query,
      pexelsUrl: video.url,
      mimeType: bestFile?.file_type ?? "video/mp4",
    };
  });
}

/**
 * Combined search for both photos and videos.
 */
export async function searchStockMedia(
  query: string,
  mediaType: "photo" | "video" | "both",
  options: {
    orientation?: "landscape" | "portrait" | "square";
    perPage?: number;
    minDuration?: number;
    maxDuration?: number;
  } = {}
): Promise<StockMediaResult[]> {
  if (mediaType === "photo") {
    return searchStockPhotos(query, options);
  }
  if (mediaType === "video") {
    return searchStockVideos(query, options);
  }

  // Both — run in parallel
  const [photos, videos] = await Promise.all([
    searchStockPhotos(query, { ...options, perPage: Math.ceil((options.perPage ?? 5) / 2) }),
    searchStockVideos(query, { ...options, perPage: Math.floor((options.perPage ?? 5) / 2) }),
  ]);

  return [...photos, ...videos];
}
