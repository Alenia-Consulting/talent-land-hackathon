import assert from "node:assert/strict";
import { test } from "node:test";

import { buildForm, buildMetadata, type GuideInput, uploadGuide, videoFileName } from "../lib/upload.ts";

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

test("form has the video with the right extension and the metadata JSON", async () => {
  const form = buildForm(input);
  const video = form.get("video") as File;
  assert.equal(video.name, "recorrido.mp4");
  assert.equal(video.type, "video/mp4");
  assert.equal(await video.text(), "video-bytes");
  assert.equal(JSON.parse(form.get("metadata") as string).alertas[0].tipo, "luz");
  assert.equal(videoFileName("video/webm"), "recorrido.webm");
});

type FakeXhr = {
  upload: { onprogress?: (e: { lengthComputable: boolean; loaded: number; total: number }) => void };
  status: number;
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

test("upload POSTs to /guia and reports progress", async () => {
  const progress: number[] = [];
  const xhr = fakeXhr((x) => {
    x.upload.onprogress?.({ lengthComputable: true, loaded: 50, total: 200 });
    x.upload.onprogress?.({ lengthComputable: false, loaded: 0, total: 0 });
    x.status = 201;
    x.onload?.();
  });
  await uploadGuide(input, (f) => progress.push(f), () => xhr as unknown as XMLHttpRequest);
  assert.deepEqual(xhr.opened, ["POST", "/api/guia"]);
  assert.ok(xhr.sent instanceof FormData);
  assert.deepEqual(progress, [0.25]);
});

test("upload rejects on HTTP errors, network errors and timeouts", async () => {
  const run = (finish: (x: FakeXhr) => void) =>
    uploadGuide(input, () => {}, () => fakeXhr(finish) as unknown as XMLHttpRequest);
  await assert.rejects(run((x) => { x.status = 500; x.onload?.(); }), /HTTP 500/);
  await assert.rejects(run((x) => x.onerror?.()), /network/);
  await assert.rejects(run((x) => x.ontimeout?.()), /timeout/);
});
