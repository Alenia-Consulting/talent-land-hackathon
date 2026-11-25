// Where to draw the points of interest of a step over its clip.
//
// The API gives each point a `box_2d`: [ymin, xmin, ymax, xmax], every value from 0 to 1000 of the
// photo's height and width. The photo is the frame of the clip at `photo_second`, so the clip is
// paused there and the points are drawn over it. Everything here works in the frame's own pixels:
// the SVG gets that frame as its viewBox and the browser scales it with the video.

import type { Step } from "../guides.ts";

export type Point = Step["points_of_interest"][number];

export type PointLayout = {
  box: { x: number; y: number; width: number; height: number };
  /** The arrow runs from `tail` (next to the label) to `tip` (touching the box). */
  arrow: { tailX: number; tailY: number; tipX: number; tipY: number };
  label: { x: number; y: number; width: number; height: number; text: string; fontSize: number };
  /** Length of one unit: 1% of the shorter side of the frame, so strokes scale with the video. */
  unit: number;
};

const ARROW_LENGTH = 11; // in units
const GAP = 1.2;
const FONT_SIZE = 3.6;
const LABEL_PADDING = 1.8;
const AVERAGE_GLYPH = 0.56; // of the font size: wide enough for Spanish capitals, narrow enough to hug the text

/** Second of the clip at which the photo was taken, which is where the points belong. */
export function pauseSecond(step: Pick<Step, "photo_second" | "start_seconds">): number {
  return Math.max(0, step.photo_second - step.start_seconds);
}

/** What the voice reads for one point: its name, then what to do. */
export function spokenPoint(point: Pick<Point, "label" | "description">): string {
  return `${point.label}. ${point.description}`;
}

const clamp = (value: number, low: number, high: number): number =>
  Math.min(high, Math.max(low, value));

export function layoutPoint(point: Point, frameWidth: number, frameHeight: number): PointLayout {
  const [ymin, xmin, ymax, xmax] = point.box_2d;
  const unit = Math.min(frameWidth, frameHeight) / 100;

  const box = {
    x: (xmin / 1000) * frameWidth,
    y: (ymin / 1000) * frameHeight,
    width: ((xmax - xmin) / 1000) * frameWidth,
    height: ((ymax - ymin) / 1000) * frameHeight,
  };

  const fontSize = FONT_SIZE * unit;
  const height = fontSize + LABEL_PADDING * 2 * unit;
  const width = point.label.length * fontSize * AVERAGE_GLYPH + LABEL_PADDING * 2 * unit;

  // The arrow comes from above and points down, as in the design. When there is no room above
  // the box for the arrow and the label, it comes from below instead.
  const centreX = box.x + box.width / 2;
  const room = ARROW_LENGTH * unit + height + GAP * unit;
  const fromAbove = box.y >= room;
  const tipY = fromAbove ? box.y - GAP * unit : box.y + box.height + GAP * unit;
  const tailY = fromAbove ? tipY - ARROW_LENGTH * unit : tipY + ARROW_LENGTH * unit;

  // The label stays inside the frame; the arrow keeps pointing at the box.
  const margin = unit;
  const labelX = clamp(centreX - width / 2, margin, Math.max(margin, frameWidth - width - margin));
  const labelY = fromAbove ? tailY - height : tailY;

  return {
    box,
    arrow: { tailX: centreX, tailY, tipX: centreX, tipY },
    label: { x: labelX, y: labelY, width, height, text: point.label, fontSize },
    unit,
  };
}

// --- What the venue does to the points in the panel -------------------------------------------

/** The API refuses a step with more points than this. */
export const MAX_POINTS = 3;
/** Smallest a box may be made: a point the visitor could still find, as a share of 1000. */
const MIN_SIDE = 40;

const clampBox = (start: number, side: number): [number, number] => {
  const begin = clamp(start, 0, 1000 - side);
  return [Math.round(begin), Math.round(begin + side)];
};

/** The same point with its box centred on (x, y), each a share of the photo from 0 to 1. */
export function movePoint(point: Point, x: number, y: number): Point {
  const [ymin, xmin, ymax, xmax] = point.box_2d;
  const [top, bottom] = clampBox(clamp(y, 0, 1) * 1000 - (ymax - ymin) / 2, ymax - ymin);
  const [left, right] = clampBox(clamp(x, 0, 1) * 1000 - (xmax - xmin) / 2, xmax - xmin);
  return { ...point, box_2d: [top, left, bottom, right] };
}

/** The same point with a bigger or smaller box around the same centre. */
export function scalePoint(point: Point, factor: number): Point {
  const [ymin, xmin, ymax, xmax] = point.box_2d;
  const height = clamp((ymax - ymin) * factor, MIN_SIDE, 1000);
  const width = clamp((xmax - xmin) * factor, MIN_SIDE, 1000);
  const [top, bottom] = clampBox((ymin + ymax) / 2 - height / 2, height);
  const [left, right] = clampBox((xmin + xmax) / 2 - width / 2, width);
  return { ...point, box_2d: [top, left, bottom, right] };
}

/**
 * Whether the API would accept these points: a name and something to read aloud on each one.
 *
 * The panel saves by itself while someone types, and a point whose name was just emptied would be
 * refused with a 422. Until it is filled in again, the points are simply not sent.
 */
export function pointsAreSendable(points: readonly Point[]): boolean {
  return (
    points.length <= MAX_POINTS &&
    points.every((point) => point.label.trim() !== "" && point.description.trim() !== "")
  );
}
