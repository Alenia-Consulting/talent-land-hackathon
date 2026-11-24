// Quality-alert log, relative to the start of the recording. Times come from performance.now().

export type AlertType = "luz" | "movimiento";

export type RecordingAlert = { tipo: AlertType; inicio_seg: number; fin_seg: number };

export type AlertLogState = {
  t0: number;
  alerts: RecordingAlert[];
  /** Start time (ms) of each alert still open. */
  open: Partial<Record<AlertType, number>>;
};

const toSeconds = (ms: number, t0: number): number =>
  Math.max(0, Math.round(((ms - t0) / 1000) * 10) / 10);

/** Starts a log; `active` are alerts already showing when the recording begins (they open at 0). */
export function beginLog(t0: number, active: AlertType[]): AlertLogState {
  const open: AlertLogState["open"] = {};
  for (const tipo of active) open[tipo] = t0;
  return { t0, alerts: [], open };
}

export function applyAlertEvent(
  log: AlertLogState,
  tipo: AlertType,
  event: { type: "start" | "end"; at: number },
): AlertLogState {
  if (event.type === "start") {
    return log.open[tipo] === undefined ? { ...log, open: { ...log.open, [tipo]: event.at } } : log;
  }
  const start = log.open[tipo];
  if (start === undefined) return log;
  const { [tipo]: _closed, ...open } = log.open;
  const alert = { tipo, inicio_seg: toSeconds(start, log.t0), fin_seg: toSeconds(event.at, log.t0) };
  return { ...log, open, alerts: [...log.alerts, alert] };
}

/** Closes every open alert at `endAt` and returns the final list, ordered by start time. */
export function finishLog(log: AlertLogState, endAt: number): RecordingAlert[] {
  const closed = (Object.keys(log.open) as AlertType[]).map((tipo) => ({
    tipo,
    inicio_seg: toSeconds(log.open[tipo]!, log.t0),
    fin_seg: toSeconds(endAt, log.t0),
  }));
  return [...log.alerts, ...closed].sort((a, b) => a.inicio_seg - b.inicio_seg);
}

export function countByType(alerts: RecordingAlert[]): Record<AlertType, number> {
  return {
    luz: alerts.filter((a) => a.tipo === "luz").length,
    movimiento: alerts.filter((a) => a.tipo === "movimiento").length,
  };
}
