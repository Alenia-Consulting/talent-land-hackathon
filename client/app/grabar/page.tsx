"use client";

// The recorder: choose the parts, then record each one as its own take, when the person is ready.
//
// This file is the camera and the screens around it. What happens to the takes (keeping them,
// sending them, repeating one) is in useTakes; the rules are in lib/pure/takes.ts.

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

import { RECORDING } from "../../lib/config.ts";
import { ApiError, readGuide } from "../../lib/guides.ts";
import { es } from "../../lib/i18n/es.ts";
import type { AlertType } from "../../lib/pure/alerts.ts";
import { canFinish, nextToRecord } from "../../lib/pure/takes.ts";
import { useAlertLog } from "../../lib/useAlertLog.ts";
import { useCamera } from "../../lib/useCamera.ts";
import { useFrameSampler } from "../../lib/useFrameSampler.ts";
import { useLightMonitor } from "../../lib/useLightMonitor.ts";
import { useMotionMonitor } from "../../lib/useMotionMonitor.ts";
import { useRecorder } from "../../lib/useRecorder.ts";
import { CameraPreview, CoachCard, DebugPanel, RecordingBar, WarningStack } from "./overlays.tsx";
import { EMPTY_PLAN, PartsScreen, type Plan, planWarning } from "./parts.tsx";
import { ActionButton, ErrorScreen, IntroScreen, PermissionScreen } from "./screens.tsx";
import { TakesScreen } from "./takes.tsx";
import { type Target, useTakes } from "./useTakes.ts";

type Phase = "intro" | "partes" | "lista" | "permisos" | "listo" | "grabando" | "error";
type ErrorSource = "camera" | "guide";

export default function GrabarPage() {
  const [phase, setPhase] = useState<Phase>("intro");
  const [debug, setDebug] = useState(false);
  const [resumed, setResumed] = useState(false);
  const [plan, setPlan] = useState<Plan | null>(null);
  // The parts screen is a form the footer button acts on, so the page holds what it is typing.
  const [draft, setDraft] = useState<Plan>(EMPTY_PLAN);
  // Set when the recorder was opened from a guide ("?guia=ID"): the takes are added to it.
  const [target, setTarget] = useState<(Target & { venue: string }) | null>(null);
  const [current, setCurrent] = useState<number | null>(null);
  const [finished, setFinished] = useState(false);
  const [error, setError] = useState<{ source: ErrorSource; message: string } | null>(null);
  const t0 = useRef(0);

  const camera = useCamera();
  const recorder = useRecorder();
  const alertLog = useAlertLog();
  const list = useTakes(target);
  const { takes } = list;

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
    const query = new URLSearchParams(window.location.search);
    setDebug(query.get("debug") === "1");
    const guia = query.get("guia");
    if (!guia) return;
    readGuide(guia)
      .then((existing) => {
        setTarget({
          id: existing.id,
          venue: existing.venue_name,
          knownRoutes: existing.routes.map((route) => route.id),
        });
        setDraft((now) => ({ ...now, venue: existing.venue_name, title: existing.title }));
      })
      .catch((cause: unknown) => {
        const message = cause instanceof ApiError ? cause.message : es.error.camera.unknown;
        setError({ source: "guide", message });
        setPhase("error");
      });
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

  // grabando → lista when the recorder delivers the file (stop button, the 45 s limit, background).
  useEffect(() => {
    if (phase !== "grabando") return;
    if (recorder.failed) {
      camera.stop();
      setError({ source: "camera", message: es.error.recorderFailed });
      setPhase("error");
    } else if (recorder.result && current !== null) {
      const { blob, mimeType, durationSec } = recorder.result;
      const alerts = alertLog.finish(t0.current + durationSec * 1000);
      list.record(current, {
        blob,
        mimeType,
        durationSec,
        settings: camera.settings,
        alerts,
        userAgent: navigator.userAgent,
      });
      camera.stop();
      recorder.reset();
      setCurrent(null);
      setPhase("lista");
    }
  }, [phase, current, recorder.failed, recorder.result, camera.stop, camera.settings, alertLog.finish]);

  const openCamera = () => {
    setResumed(false);
    setPhase("permisos");
    void camera.start();
  };

  /** Leave the previous part (that sends it) and open the camera for this one. */
  const recordPart = (index: number) => {
    list.flush(index);
    recorder.reset();
    alertLog.reset();
    setCurrent(index);
    openCamera();
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

  const repeatPart = async (index: number) => {
    if (await list.repeat(index)) recordPart(index);
  };

  const finish = () => {
    list.flush();
    setFinished(true);
  };

  const next = nextToRecord(takes);
  const part = current !== null ? takes[current]?.part.title : undefined;

  const body = {
    intro: <IntroScreen />,
    partes: <PartsScreen plan={draft} onChange={setDraft} addingTo={target?.venue} />,
    lista: (
      <TakesScreen
        venue={plan?.venue ?? ""}
        takes={takes}
        errors={list.errors}
        progress={list.progress}
        finished={finished}
        next={next}
        onRecord={recordPart}
        onRepeat={repeatPart}
        onRetry={list.retry}
        onDownload={list.download}
        onNoise={list.setNoise}
      />
    ),
    permisos: <PermissionScreen starting={camera.status === "starting"} resumed={resumed} />,
    error: <ErrorScreen message={error?.message ?? es.error.camera.unknown} />,
  }[phase as Exclude<Phase, "listo" | "grabando">];

  const actions = {
    intro: <ActionButton onClick={() => setPhase("partes")}>{es.intro.next}</ActionButton>,
    partes: (
      <ActionButton
        disabled={planWarning(draft) !== null}
        onClick={() => {
          const chosen = { ...draft, title: draft.title.trim(), venue: draft.venue.trim() };
          setPlan(chosen);
          list.begin(chosen.parts, { title: chosen.title, venue: chosen.venue });
          setPhase("lista");
        }}
      >
        {es.partes.next}
      </ActionButton>
    ),
    lista: finished ? (
      list.guideId && (
        <Link
          href={`/panel/guia?id=${list.guideId}`}
          className="flex min-h-14 flex-1 items-center justify-center rounded-[18px] bg-pino px-6 text-lg font-bold text-sobre-pino"
        >
          {es.takes.review}
        </Link>
      )
    ) : (
      <>
        <ActionButton variant="secondary" disabled={!canFinish(takes)} onClick={finish}>
          {es.takes.finish}
        </ActionButton>
        {next !== null && (
          <ActionButton onClick={() => recordPart(next)}>
            {es.takes.recordNext(takes[next].part.title)}
          </ActionButton>
        )}
      </>
    ),
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
      <ActionButton tone="dark" variant="danger" onClick={() => recorder.stop("user")}>
        {es.grabando.stop}
      </ActionButton>
    ),
    error: (
      <ActionButton
        onClick={() => {
          if (error?.source === "guide") return window.location.reload();
          setError(null);
          setPhase("lista");
        }}
      >
        {es.error.retryCamera}
      </ActionButton>
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
          {phase === "listo" && part && (
            <p className="absolute inset-x-4 bottom-4 rounded-2xl bg-tinta/80 px-4 py-3 text-center text-lg">
              {es.listo.hint(part)}
            </p>
          )}
          {phase === "grabando" && part && <CoachCard part={part} />}
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
