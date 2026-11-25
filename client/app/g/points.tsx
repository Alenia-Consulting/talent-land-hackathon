"use client";

// The places worth finding in a step, drawn over the clip while it is paused on the photo and
// listed below it with a voice.
//
// The overlay is an SVG whose viewBox is the video's own frame, with the same fit as the video
// (`meet`), so a point lands on the table it names whatever the size of the screen. It is
// decoration for the eyes: the list underneath says the same in words, for screen readers and
// for the voice.

import { useState } from "react";

import { es } from "../../lib/i18n/es.ts";
import { layoutPoint, spokenPoint, type Point } from "../../lib/pure/points.ts";
import type { useSpeech } from "../../lib/useSpeech.ts";
import { WaveIcon } from "../icons.tsx";
import { Button, Card } from "../ui.tsx";

const t = es.publica.player;

// Light enough to read over a dark corner, with a dark edge for a bright one; the same pair for
// everything, so the eye learns it once.
const MINT = "#c4f2d6";
const INK = "#0f3d33";

export function PointsOverlay({
  points,
  width,
  height,
}: {
  points: Point[];
  width: number;
  height: number;
}) {
  return (
    <svg
      aria-hidden="true"
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="xMidYMid meet"
      className="pointer-events-none absolute inset-0 h-full w-full"
    >
      {points.map((point, i) => {
        const { box, arrow, label, unit } = layoutPoint(point, width, height);
        const head = 2.2 * unit;
        const direction = arrow.tipY > arrow.tailY ? 1 : -1;
        const shaft = `M${arrow.tailX} ${arrow.tailY} L${arrow.tipX} ${arrow.tipY - direction * head}`;
        const tip =
          `M${arrow.tipX - head} ${arrow.tipY - direction * head * 1.4} ` +
          `L${arrow.tipX} ${arrow.tipY} L${arrow.tipX + head} ${arrow.tipY - direction * head * 1.4}`;
        return (
          <g key={`${i}-${point.label}`} fill="none" strokeLinecap="round" strokeLinejoin="round">
            {/* The dark edge goes underneath, wider, so the mint line reads on any background. */}
            {[
              { color: INK, extra: 0.9 * unit },
              { color: MINT, extra: 0 },
            ].map(({ color, extra }) => (
              <g key={color} stroke={color} strokeWidth={0.55 * unit + extra}>
                <rect x={box.x} y={box.y} width={box.width} height={box.height} rx={1.2 * unit} />
                <path d={shaft} />
                <path d={tip} />
              </g>
            ))}
            <rect
              x={label.x}
              y={label.y}
              width={label.width}
              height={label.height}
              rx={label.height / 2}
              fill={MINT}
              stroke={INK}
              strokeWidth={0.3 * unit}
            />
            <text
              x={label.x + label.width / 2}
              y={label.y + label.height / 2}
              textAnchor="middle"
              dominantBaseline="central"
              fontSize={label.fontSize}
              fontWeight={700}
              fill={INK}
              stroke="none"
              style={{ fontFamily: "inherit" }}
            >
              {label.text}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

/** The same points in words, each with a button to hear it. It speaks only when pressed. */
export function PointsList({
  points,
  speech,
}: {
  points: Point[];
  speech: ReturnType<typeof useSpeech>;
}) {
  // Which point the voice is on, so only its button turns into "Parar".
  const [reading, setReading] = useState<number | null>(null);

  return (
    <Card className="mt-5">
      <h2 className="text-xl font-extrabold">{t.pointsTitle}</h2>
      <ul className="mt-3 grid gap-4">
        {points.map((point, i) => {
          const active = speech.speaking && reading === i;
          return (
            <li key={`${i}-${point.label}`}>
              <p className="text-xl font-bold">{point.label}</p>
              <p className="mt-1 text-lg">{point.description}</p>
              {speech.supported && (
                <Button
                  variant="secondary"
                  className="mt-3"
                  icon={<WaveIcon size={22} />}
                  onClick={() => {
                    if (active) {
                      speech.stop();
                      return;
                    }
                    setReading(i);
                    speech.speak(spokenPoint(point));
                  }}
                >
                  {active ? t.stopPoint : t.readPoint(point.label)}
                </Button>
              )}
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
