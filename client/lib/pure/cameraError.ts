export type CameraErrorKind =
  | "insecure"
  | "unsupported"
  | "denied"
  | "busy"
  | "notfound"
  | "unknown";

/** Maps a getUserMedia failure (DOMException name) to a kind the UI has a message for. */
export function classifyCameraError(error: unknown): CameraErrorKind {
  const name = typeof error === "object" && error !== null ? (error as { name?: string }).name : undefined;
  switch (name) {
    case "NotAllowedError":
    case "PermissionDeniedError":
    case "SecurityError":
      return "denied";
    case "NotReadableError":
    case "TrackStartError":
    case "AbortError":
      return "busy";
    case "NotFoundError":
    case "DevicesNotFoundError":
    case "OverconstrainedError":
      return "notfound";
    default:
      return "unknown";
  }
}
