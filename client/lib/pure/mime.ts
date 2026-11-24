// Preferred recording formats, best first. Safari records MP4 (H.264); Chrome Android falls to WebM.
export const MIME_CANDIDATES = [
  "video/mp4;codecs=avc1",
  "video/mp4",
  "video/webm;codecs=vp9",
  "video/webm",
] as const;

/** First candidate the browser supports, or null so MediaRecorder picks its own default. */
export function pickMimeType(isSupported: (mimeType: string) => boolean): string | null {
  return MIME_CANDIDATES.find((candidate) => isSupported(candidate)) ?? null;
}

export function fileExtension(mimeType: string): "mp4" | "webm" {
  return mimeType.toLowerCase().startsWith("video/mp4") ? "mp4" : "webm";
}

/** Container type without the codecs parameter, suitable for a Blob. */
export function baseMimeType(mimeType: string): string {
  return mimeType.split(";")[0]!.trim();
}
