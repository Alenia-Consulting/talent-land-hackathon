import { apiUrl } from "./config.ts";
import type { RecordingAlert } from "./pure/alerts.ts";
import { baseMimeType, fileExtension } from "./pure/mime.ts";

export type GuideMetadata = {
  duracion_seg: number;
  resolucion: { ancho: number; alto: number };
  fps: number;
  mime_type: string;
  user_agent: string;
  alertas: RecordingAlert[];
};

export type GuideInput = {
  blob: Blob;
  mimeType: string;
  durationSec: number;
  settings: { width: number; height: number; frameRate: number } | null;
  alerts: RecordingAlert[];
  userAgent: string;
};

export function buildMetadata(input: GuideInput): GuideMetadata {
  return {
    duracion_seg: input.durationSec,
    resolucion: { ancho: input.settings?.width ?? 0, alto: input.settings?.height ?? 0 },
    fps: Math.round((input.settings?.frameRate ?? 0) * 10) / 10,
    mime_type: input.mimeType,
    user_agent: input.userAgent,
    alertas: input.alerts,
  };
}

export function videoFileName(mimeType: string): string {
  return `recorrido.${fileExtension(mimeType)}`;
}

/** The API reads a single `video` field; everything else about the route travels in POST /guides. */
export function buildVideoForm(input: GuideInput): FormData {
  const form = new FormData();
  form.append("video", new Blob([input.blob], { type: baseMimeType(input.mimeType) }), videoFileName(input.mimeType));
  return form;
}

/** The API refused the recording. `status` is 0 when the request never arrived. */
export class VideoUploadError extends Error {
  // Declared, not a constructor parameter property: Node's type stripping rejects those.
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "VideoUploadError";
    this.status = status;
  }
}

/** FastAPI answers `{"detail": "..."}` for business rules; anything else falls back to the status. */
function readDetail(status: number, responseText: string): string {
  try {
    const detail = (JSON.parse(responseText) as { detail?: unknown }).detail;
    if (typeof detail === "string") return detail;
  } catch {
    // Not JSON (a proxy error page): use the status.
  }
  return `HTTP ${status}`;
}

/**
 * POST {apiUrl}/guides/{guideId}/video as multipart/form-data; XMLHttpRequest gives upload progress.
 *
 * The API answers 503 while the face blurring in api/media/pipeline.py does not exist: a recording
 * with recognisable faces must never reach storage. The caller treats that as "guide saved, video
 * still on the device", not as a failure.
 */
export function uploadVideo(
  guideId: string,
  input: GuideInput,
  onProgress: (fraction: number) => void,
  createXhr: () => XMLHttpRequest = () => new XMLHttpRequest(),
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = createXhr();
    xhr.open("POST", `${apiUrl()}/guides/${guideId}/video`);
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(event.loaded / event.total);
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else reject(new VideoUploadError(xhr.status, readDetail(xhr.status, xhr.responseText)));
    };
    xhr.onerror = () => reject(new VideoUploadError(0, "network"));
    xhr.ontimeout = () => reject(new VideoUploadError(0, "timeout"));
    xhr.send(buildVideoForm(input));
  });
}

function saveBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/** Fallback while the video cannot be sent: save it and its recording data on the device. */
export function downloadGuide(input: GuideInput): void {
  saveBlob(input.blob, videoFileName(input.mimeType));
  const json = new Blob([JSON.stringify(buildMetadata(input), null, 2)], { type: "application/json" });
  saveBlob(json, "recorrido.json");
}
