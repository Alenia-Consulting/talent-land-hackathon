import assert from "node:assert/strict";
import { test } from "node:test";

import {
  buildMetadata,
  buildVideoForm,
  type GuideInput,
  uploadVideo,
  VideoUploadError,
  videoFileName,
} from "../lib/upload.ts";

const input: GuideInput = {
  blob: new Blob(["video-bytes"], { type: "video/mp4" }),
  mimeType: "video/mp4;codecs=avc1",
  durationSec: 61.4,
  settings: { width: 1280, height: 720, frameRate: 29.97 },
  alerts: [{ tipo: "luz", inicio_seg: 3, fin_seg: 8 }],
  userAgent: "TestAgent/1.0",
};

test("metadata carries duration, real resolution and fps, mimeType, agent and alerts", () => {
  assert.deepEqual(buildMetadata(input), {
    duracion_seg: 61.4,
    resolucion: { ancho: 1280, alto: 720 },
    fps: 30,
    mime_type: "video/mp4;codecs=avc1",
    user_agent: "TestAgent/1.0",
    alertas: [{ tipo: "luz", inicio_seg: 3, fin_seg: 8 }],
  });
  assert.equal(buildMetadata({ ...input, settings: null }).resolucion.ancho, 0);
});

test("form carries only the video, with the right extension", async () => {
  const form = buildVideoForm(input);
  const video = form.get("video") as File;
  assert.equal(video.name, "recorrido.mp4");
  assert.equal(video.type, "video/mp4");
  assert.equal(await video.text(), "video-bytes");
  assert.equal(form.get("metadata"), null);
  assert.equal(videoFileName("video/webm"), "recorrido.webm");
});

type FakeXhr = {
  upload: { onprogress?: (e: { lengthComputable: boolean; loaded: number; total: number }) => void };
  status: number;
  responseText: string;
  sent?: unknown;
  opened?: [string, string];
  onload?: () => void;
  onerror?: () => void;
  ontimeout?: () => void;
  open(method: string, url: string): void;
  send(body: unknown): void;
};

function fakeXhr(finish: (xhr: FakeXhr) => void): FakeXhr {
  const xhr: FakeXhr = {
    upload: {},
    status: 0,
    responseText: "",
    open(method, url) {
      this.opened = [method, url];
    },
    send(body) {
      this.sent = body;
      queueMicrotask(() => finish(this));
    },
  };
  return xhr;
}

test("upload POSTs the video to the guide and reports progress", async () => {
  const progress: number[] = [];
  const xhr = fakeXhr((x) => {
    x.upload.onprogress?.({ lengthComputable: true, loaded: 50, total: 200 });
    x.upload.onprogress?.({ lengthComputable: false, loaded: 0, total: 0 });
    x.status = 200;
    x.onload?.();
  });
  await uploadVideo("guide-1", input, (f) => progress.push(f), () => xhr as unknown as XMLHttpRequest);
  assert.deepEqual(xhr.opened, ["POST", "/api/guides/guide-1/video"]);
  assert.ok(xhr.sent instanceof FormData);
  assert.deepEqual(progress, [0.25]);
});

const failWith = (finish: (x: FakeXhr) => void) =>
  uploadVideo("g", input, () => {}, () => fakeXhr(finish) as unknown as XMLHttpRequest);

test("503 from the API keeps its status and message, so the caller can tell it is not a failure", async () => {
  const error = await failWith((x) => {
    x.status = 503;
    x.responseText = JSON.stringify({ detail: "el procesado de vídeo todavía no está disponible" });
    x.onload?.();
  }).catch((e: unknown) => e);
  assert.ok(error instanceof VideoUploadError);
  assert.equal(error.status, 503);
  assert.match(error.message, /procesado/);
});

test("a non-JSON error body falls back to the status", async () => {
  await assert.rejects(failWith((x) => { x.status = 413; x.responseText = "<html>"; x.onload?.(); }), /HTTP 413/);
});

test("network errors and timeouts have status 0", async () => {
  for (const [event, message] of [["onerror", /network/], ["ontimeout", /timeout/]] as const) {
    const error = await failWith((x) => x[event]?.()).catch((e: unknown) => e);
    assert.ok(error instanceof VideoUploadError);
    assert.equal(error.status, 0);
    assert.match(error.message, message);
  }
});
