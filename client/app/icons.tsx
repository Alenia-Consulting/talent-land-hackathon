// The icon set of the design: line icons, rounded caps, drawn on a 24 grid.
//
// Inline SVG on purpose. An icon font or an icon package would be a new dependency and a second
// network request for something that is a few hundred bytes of path data.
//
// Every icon here is decorative: the design never ships a button with an icon and no text, so the
// label always carries the meaning and the icon is hidden from screen readers.

import type { ReactNode } from "react";

function Icon({ children, size = 24 }: { children: ReactNode; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className="shrink-0"
    >
      {children}
    </svg>
  );
}

export type IconProps = { size?: number };

/** Sound of the place. Never shown without the words that say what will play. */
export function VolumeIcon({ size }: IconProps) {
  return (
    <Icon size={size}>
      <path d="M11 5 6 9H3v6h3l5 4z" />
      <path d="M16 9a4 4 0 0 1 0 6" />
      <path d="M19 6a8 8 0 0 1 0 12" />
    </Icon>
  );
}

/** Reading the text out loud: a voice line, not a loudspeaker, to tell the two buttons apart. */
export function WaveIcon({ size }: IconProps) {
  return (
    <Icon size={size}>
      <path d="M2 12h3l3-7 4 14 3-9 2 2h5" />
    </Icon>
  );
}

export function VideoIcon({ size }: IconProps) {
  return (
    <Icon size={size}>
      <rect x="2" y="6" width="13" height="12" rx="3" />
      <path d="m15 11 6-3.5v9L15 13z" />
    </Icon>
  );
}

export function FlagIcon({ size }: IconProps) {
  return (
    <Icon size={size}>
      <path d="M5 21V4" />
      <path d="M5 5h10l-2 3 2 3H5" />
    </Icon>
  );
}

export function ChevronLeftIcon({ size }: IconProps) {
  return (
    <Icon size={size}>
      <path d="m15 5-7 7 7 7" />
    </Icon>
  );
}

export function ChevronRightIcon({ size }: IconProps) {
  return (
    <Icon size={size}>
      <path d="m9 5 7 7-7 7" />
    </Icon>
  );
}

export function CloseIcon({ size }: IconProps) {
  return (
    <Icon size={size}>
      <path d="M6 6 18 18M18 6 6 18" />
    </Icon>
  );
}

export function MoonIcon({ size }: IconProps) {
  return (
    <Icon size={size}>
      <path d="M20 14.5A8 8 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5" />
    </Icon>
  );
}

export function SunIcon({ size }: IconProps) {
  return (
    <Icon size={size}>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M19.1 4.9l-1.4 1.4M6.3 17.7l-1.4 1.4" />
    </Icon>
  );
}

/** Play the clip again from the start. */
export function ReplayIcon({ size }: IconProps) {
  return (
    <Icon size={size}>
      <path d="M3 12a9 9 0 1 0 2.6-6.4" />
      <path d="M3 4v5h5" />
    </Icon>
  );
}

export function PlayIcon({ size }: IconProps) {
  return (
    <Icon size={size}>
      <path d="M8 5.5v13l11-6.5z" fill="currentColor" />
    </Icon>
  );
}

export function PauseIcon({ size }: IconProps) {
  return (
    <Icon size={size}>
      <path d="M9 5v14M15 5v14" />
    </Icon>
  );
}

export function CheckIcon({ size }: IconProps) {
  return (
    <Icon size={size}>
      <path d="m4 12.5 5 5L20 6.5" />
    </Icon>
  );
}

export function AlertIcon({ size }: IconProps) {
  return (
    <Icon size={size}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v6M12 16.5v.5" />
    </Icon>
  );
}

export function HeadphonesIcon({ size }: IconProps) {
  return (
    <Icon size={size}>
      <path d="M4 15v-3a8 8 0 0 1 16 0v3" />
      <rect x="2.5" y="14" width="4.5" height="6" rx="2" />
      <rect x="17" y="14" width="4.5" height="6" rx="2" />
    </Icon>
  );
}

/** Always-on settings carry this, so "cannot be turned off" is visible and not just written. */
export function LockIcon({ size }: IconProps) {
  return (
    <Icon size={size}>
      <rect x="4" y="10" width="16" height="11" rx="3" />
      <path d="M8 10V7a4 4 0 0 1 8 0v3" />
    </Icon>
  );
}

export function QrIcon({ size }: IconProps) {
  return (
    <Icon size={size}>
      <path d="M4 9V5h4M20 9V5h-4M4 15v4h4M20 15v4h-4" />
      <rect x="9.5" y="9.5" width="5" height="5" rx="1" />
    </Icon>
  );
}

export function PrinterIcon({ size }: IconProps) {
  return (
    <Icon size={size}>
      <path d="M7 9V3h10v6" />
      <rect x="3" y="9" width="18" height="8" rx="2" />
      <path d="M7 14h10v7H7z" />
    </Icon>
  );
}

export function MessageIcon({ size }: IconProps) {
  return (
    <Icon size={size}>
      <path d="M4 5h16v11H9l-5 4z" />
    </Icon>
  );
}

export function SearchIcon({ size }: IconProps) {
  return (
    <Icon size={size}>
      <circle cx="11" cy="11" r="6.5" />
      <path d="m16 16 4 4" />
    </Icon>
  );
}

export function EyeIcon({ size }: IconProps) {
  return (
    <Icon size={size}>
      <path d="M2 12s3.8-6 10-6 10 6 10 6-3.8 6-10 6-10-6-10-6z" />
      <circle cx="12" cy="12" r="2.5" />
    </Icon>
  );
}

export function PlusIcon({ size }: IconProps) {
  return (
    <Icon size={size}>
      <path d="M12 5v14M5 12h14" />
    </Icon>
  );
}

export function PeopleIcon({ size }: IconProps) {
  return (
    <Icon size={size}>
      <circle cx="9" cy="8" r="3" />
      <path d="M3 19a6 6 0 0 1 12 0" />
      <path d="M16 6.5a3 3 0 0 1 0 5.8M17.5 19a6 6 0 0 0-1.6-4" />
    </Icon>
  );
}

/** Walking: the design asks the person to walk slowly, so the icon is a figure mid-step. */
export function WalkIcon({ size }: IconProps) {
  return (
    <Icon size={size}>
      <circle cx="13" cy="4.5" r="2" />
      <path d="M13 8.5 10 12l3 3 1 6M10 12 7 10M13 15l-3 6" />
    </Icon>
  );
}

export function DocumentIcon({ size }: IconProps) {
  return (
    <Icon size={size}>
      <rect x="5" y="3" width="14" height="18" rx="2" />
      <path d="M9 8h6M9 12h6M9 16h4" />
    </Icon>
  );
}

/** The brand symbol: an arch with a light inside, the room before the room. */
export function AntesalaMark({ size = 32 }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      aria-hidden="true"
      focusable="false"
      className="shrink-0"
    >
      <rect width="32" height="32" rx="9" fill="currentColor" />
      <path
        d="M10 24V15a6 6 0 0 1 12 0v9"
        fill="none"
        stroke="var(--color-niebla)"
        strokeWidth="2.6"
        strokeLinecap="round"
      />
      <circle cx="16" cy="19" r="2.2" fill="var(--color-ambar)" />
    </svg>
  );
}
