import React from "react";
import { cn } from "@/lib/cn";

/** Stable palette derived from the first character of the name */
const PALETTE = [
  { bg: "#e0e7ff", fg: "#3730a3" }, // indigo
  { bg: "#fce7f3", fg: "#9d174d" }, // pink
  { bg: "#d1fae5", fg: "#065f46" }, // emerald
  { bg: "#fef9c3", fg: "#854d0e" }, // yellow
  { bg: "#fee2e2", fg: "#991b1b" }, // red
  { bg: "#e0f2fe", fg: "#075985" }, // sky
  { bg: "#f3e8ff", fg: "#6b21a8" }, // purple
  { bg: "#ffedd5", fg: "#9a3412" }, // orange
];

function colorFor(name: string) {
  const code = name.trim().charCodeAt(0);
  const idx = Number.isNaN(code) ? 0 : code % PALETTE.length;
  return PALETTE[idx];
}

function initials(name: string) {
  const trimmed = name.trim();
  if (!trimmed) return "?";
  const parts = trimmed.split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return parts[0].slice(0, 2).toUpperCase();
}

type AvatarSize = "sm" | "md" | "lg";

interface AvatarProps {
  name: string;
  size?: AvatarSize;
  className?: string;
}

const sizeClasses: Record<AvatarSize, string> = {
  sm: "w-7 h-7 text-xs",
  md: "w-9 h-9 text-sm",
  lg: "w-12 h-12 text-base",
};

export function Avatar({ name, size = "md", className = "" }: AvatarProps) {
  const { bg, fg } = colorFor(name);
  const abbr = initials(name);

  return (
    <span
      aria-label={name}
      className={cn(
        "inline-flex items-center justify-center rounded-full font-semibold select-none shrink-0",
        sizeClasses[size],
        className,
      )}
      style={{ backgroundColor: bg, color: fg }}
    >
      {abbr}
    </span>
  );
}
