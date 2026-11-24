"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

import { RECORDING } from "../../lib/config.ts";
import { ApiError, createGuide, type Mark } from "../../lib/guides.ts";
import { es } from "../../lib/i18n/es.ts";
import type { AlertType } from "../../lib/pure/alerts.ts";
import { markAt, whyNotSendable } from "../../lib/pure/marks.ts";
import { downloadGuide, type GuideInput, uploadVideo, VideoUploadError } from "../../lib/upload.ts";
import { useAlertLog } from "../../lib/useAlertLog.ts";
import { useCamera } from "../../lib/useCamera.ts";
import { useFrameSampler } from "../../lib/useFrameSampler.ts";
import { useLightMonitor } from "../../lib/useLightMonitor.ts";
import { useMotionMonitor } from "../../lib/useMotionMonitor.ts";
import { useRecorder } from "../../lib/useRecorder.ts";
import {
  CameraPreview,
  CoachCard,
  DebugPanel,
  RecordingBar,
  StepRail,
  WarningStack,
} from "./overlays.tsx";
import { PartsScreen, type Plan } from "./parts.tsx";
import {
  ActionButton,
  DoneScreen,
  ErrorScreen,
  IntroScreen,
  PermissionScreen,
  ReviewScreen,
  SendingScreen,
} from "./screens.tsx";

type Phase =
  | "intro"
  | "partes"
  | "permisos"
  | "listo"
  | "grabando"
  | "revision"
  | "enviando"
  | "hecho"
  | "error";
type ErrorSource = "camera" | "upload";

export default function GrabarPage() {
  const [phase, setPhase] = useState<Phase>("intro");
  const [debug, setDebug] = useState(false);
  const [resumed, setResumed] = useState(false);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [marks, setMarks] = useState<Mark[]>([]);
  const [guideId, setGuideId] = useState<string | null>(null);
  const [videoSent, setVideoSent] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<{ source: ErrorSource; message: string } | null>(null);
  const t0 = useRef(0);

  const camera = useCamera();
  const recorder = useRecorder();
  const alertLog = useAlertLog();

  // The only two dark screens of the recorder: the ones with the camera behind them.
  const cameraPhase = phase === "listo" || phase === "grabando";
  const preview = cameraPhase && camera.status === "ready";
  const sample = useFrameSampler(camera.videoRef, preview);
  const onAlert = useCallback(
    (tipo: AlertType) => (event: { type: "start" | "end"; at: number }) => {
      alertLog.record(tipo, event);
      // Android-only extra; iOS has no navigator.vibrate and nothing depends on it.
      if (event.type === "start") navigator.vibrate?.(200);
    },
    [alertLog.record],
  );
  const light = useLightMonitor(sample, onAlert("luz"));
  const motion = useMotionMonitor(sample, phase === "grabando", onAlert("movimiento"));

  useEffect(() => {
    setDebug(new URLSearchParams(window.location.search).get("debug") === "1");
  }, []);

  // permisos → listo | error, and back to permisos when the camera was released while waiting.
  useEffect(() => {
    if (phase === "permisos" && camera.status === "ready") setPhase("listo");
    if (camera.status === "error" && (phase === "permisos" || phase === "listo")) {
      setError({ source: "camera", message: es.error.camera[camera.errorKind ?? "unknown"] });
      setPhase("error");
    }
    if (phase === "listo" && camera.status === "idle") {
      setResumed(true);
      setPhase("permisos");
    }
  }, [phase, camera.status, camera.errorKind]);

  // grabando → revision when the recorder delivers the file (stop button, 120 s, or background).
  useEffect(() => {
    if (phase !== "grabando") return;
    if (recorder.failed) {
      camera.stop();
      setError({ source: "camera", message: es.error.recorderFailed });
      setPhase("error");
    } else if (recorder.result) {
      alertLog.finish(t0.current + recorder.result.durationSec * 1000);
      camera.stop();
      setPhase("revision");
    }
  }, [phase, recorder.failed, recorder.result, camera.stop, alertLog.finish]);

  const openCamera = () => {
    setResumed(false);
    setPhase("permisos");
    void camera.start();
  };

  const startRecording = () => {
    // Must stay first and synchronous: iOS only shows the motion prompt inside the tap handler.
    void motion.requestPermission();
    if (!camera.stream) return;
    t0.current = performance.now();
    alertLog.begin(t0.current, light.active ? ["luz"] : []);
    recorder.start(camera.stream, t0.current);
    setPhase("grabando");
  };

  const retry = () => {
    recorder.reset();
    alertLog.reset();
    setMarks([]);
    setGuideId(null);
    setVideoSent(false);
    openCamera();
  };

  const pending = plan ? plan.parts.slice(marks.length) : [];

  /** "Llegué a: X" — the second of the recording where this part begins. */
  const markArrival = () => {
    const part = pending[0];
    if (!part) return;
    setMarks([...marks, markAt(part, performance.now() - t0.current)]);
    navigator.vibrate?.(60);
  };

  const guide = (): GuideInput | null => {
    if (!recorder.result) return null;
    return {
      blob: recorder.result.blob,
      mimeType: recorder.result.mimeType,
      durationSec: recorder.result.durationSec,
      settings: camera.settings,
      alerts: alertLog.alerts,
      userAgent: navigator.userAgent,
    };
  };

  const send = async () => {
    // markProblem already keeps the button disabled; this is the guard, not the message.
    const input = guide();
    if (!plan || !input || markProblem) return;

    setProgress(0);
    setPhase("enviando");
    try {
      // A retry after a failed upload reuses the guide: creating it again would leave a duplicate.
      let id = guideId;
      if (!id) {
        const created = await createGuide({
          title: plan.title,
          venue_name: plan.venue,
          video_duration_seconds: input.durationSec,
          marks,
        });
        id = created.id;
        setGuideId(id);
      }
      try {
        await uploadVideo(id, input, setProgress);
        setVideoSent(true);
      } catch (cause) {
        // 503: that deployment cannot process video. The guide is saved, the video stays on the
        // device, and the done screen offers the download instead of claiming it was sent.
        if (!(cause instanceof VideoUploadError && cause.status === 503)) throw cause;
      }
      setPhase("hecho");
    } catch (cause) {
      const known = cause instanceof ApiError || (cause instanceof VideoUploadError && cause.status > 0);
      setError({ source: "upload", message: known ? cause.message : es.error.uploadFailed });
      setPhase("error");
    }
  };

  // Known before sending, so it is shown on the review screen with "Enviar" disabled instead of
  // throwing the person onto a screen titled "Algo ha fallado" for something they can redo.
  const markProblem = recorder.result
    ? recorder.result.blob.size > RECORDING.maxUploadBytes
      ? es.revision.tooBig
      : whyNotSendable(marks, recorder.result.durationSec)
    : null;

  const reviewNotice =
    recorder.result?.stopReason === "background"
      ? es.revision.interrupted
      : recorder.result?.stopReason === "limit"
        ? es.revision.limit
        : null;

  const body = {
    intro: <IntroScreen />,
    partes: (
      <PartsScreen
        onReady={(chosen) => {
          setPlan(chosen);
          setPhase("permisos");
        }}
      />
    ),
    permisos: <PermissionScreen starting={camera.status === "starting"} resumed={resumed} />,
    revision: recorder.result && (
      <ReviewScreen
        url={recorder.result.url}
        alerts={alertLog.alerts}
        notice={reviewNotice}
        problem={markProblem}
      />
    ),
    enviando: <SendingScreen progress={progress} />,
    hecho: <DoneScreen videoSent={videoSent} />,
    error: <ErrorScreen message={error?.message ?? es.error.camera.unknown} />,
  }[phase as Exclude<Phase, "listo" | "grabando">];

  const actions = {
    intro: <ActionButton onClick={() => setPhase("partes")}>{es.intro.next}</ActionButton>,
    partes: null,
    permisos: (
      <ActionButton onClick={openCamera} disabled={camera.status === "starting"}>
        {es.permisos.action}
      </ActionButton>
    ),
    listo: (
      <ActionButton tone="dark" onClick={startRecording}>
        {es.listo.start}
      </ActionButton>
    ),
    grabando: (
      <>
        {pending.length > 0 && (
          <ActionButton tone="dark" onClick={markArrival}>
            {es.marcar.action(pending[0].title)}
          </ActionButton>
        )}
        <ActionButton tone="dark" variant="danger" onClick={() => recorder.stop("user")}>
          {es.grabando.stop}
        </ActionButton>
      </>
    ),
    revision: (
      <>
        <ActionButton variant="secondary" onClick={retry}>
          {es.revision.retry}
        </ActionButton>
        <ActionButton onClick={send} disabled={markProblem !== null}>
          {es.revision.send}
        </ActionButton>
      </>
    ),
    enviando: null,
    hecho: (
      <>
        {!videoSent && (
          <ActionButton
            variant="secondary"
            onClick={() => {
              const input = guide();
              if (input) downloadGuide(input);
            }}
          >
            {es.error.download}
          </ActionButton>
        )}
        {guideId && <Link href={`/panel/guia?id=${guideId}`}>{es.hecho.review}</Link>}
        <ActionButton onClick={retry}>{es.hecho.again}</ActionButton>
      </>
    ),
    error:
      error?.source === "upload" ? (
        <>
          <ActionButton variant="secondary" onClick={() => guide() && downloadGuide(guide()!)}>
            {es.error.download}
          </ActionButton>
          <ActionButton onClick={send}>{es.error.retrySend}</ActionButton>
        </>
      ) : (
        <ActionButton onClick={retry}>{es.error.retryCamera}</ActionButton>
      ),
  }[phase];

  return (
    <section
      className={`fixed inset-0 flex flex-col ${
        cameraPhase ? "bg-tinta text-niebla" : "bg-niebla text-tinta"
      }`}
    >
      {cameraPhase ? (
        <div className="relative min-h-0 flex-1 overflow-hidden">
          <CameraPreview stream={camera.stream} videoRef={camera.videoRef} />
          {phase === "grabando" && (
            <RecordingBar remainingSec={recorder.remainingSec} maxSec={RECORDING.maxDurationSec} />
          )}
          <WarningStack active={{ luz: light.active, movimiento: motion.active }} />
          {phase === "listo" && (
            <p className="absolute inset-x-4 bottom-4 rounded-2xl bg-tinta/80 px-4 py-3 text-center text-lg">
              {es.listo.hint}
            </p>
          )}
          {phase === "grabando" && plan && (
            <>
              <CoachCard nextPart={pending[0]?.title ?? null} />
              <StepRail parts={plan.parts} done={marks.length} />
            </>
          )}
          {debug && (
            <DebugPanel
              values={{
                luminance: light.luminance,
                gyroDps: motion.gyroDps,
                frameDiff: motion.frameDiff,
                motionSource: motion.source,
                motionPermission: motion.permission,
                mimeType: recorder.result?.mimeType ?? recorder.mimeType,
                resolution: camera.settings
                  ? `${camera.settings.width}×${camera.settings.height} @ ${camera.settings.frameRate.toFixed(0)} fps`
                  : "–",
              }}
            />
          )}
        </div>
      ) : (
        body
      )}
      <footer className="flex min-h-[calc(5.5rem+env(safe-area-inset-bottom))] items-start gap-3 px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))] pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))]">
        {actions}
      </footer>
    </section>
  );
}
