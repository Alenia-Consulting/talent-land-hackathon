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

export function buildForm(input: GuideInput): FormData {
  const form = new FormData();
  form.append("video", new Blob([input.blob], { type: baseMimeType(input.mimeType) }), videoFileName(input.mimeType));
  form.append("metadata", JSON.stringify(buildMetadata(input)));
  return form;
}

/** POST {apiUrl}/guia as multipart/form-data; XMLHttpRequest is used for upload progress. */
export function uploadGuide(
  input: GuideInput,
  onProgress: (fraction: number) => void,
  createXhr: () => XMLHttpRequest = () => new XMLHttpRequest(),
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = createXhr();
    xhr.open("POST", `${apiUrl()}/guia`);
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(event.loaded / event.total);
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else reject(new Error(`HTTP ${xhr.status}`));
    };
    xhr.onerror = () => reject(new Error("network"));
    xhr.ontimeout = () => reject(new Error("timeout"));
    xhr.send(buildForm(input));
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

/** Fallback when the upload fails: save the video and its metadata JSON on the device. */
export function downloadGuide(input: GuideInput): void {
  saveBlob(input.blob, videoFileName(input.mimeType));
  const json = new Blob([JSON.stringify(buildMetadata(input), null, 2)], { type: "application/json" });
  saveBlob(json, "recorrido.json");
}
