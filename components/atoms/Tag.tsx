import React from "react";
import { cn } from "@/lib/cn";

export type TagTone = "neutral" | "success" | "danger" | "warning" | "info";

interface TagProps {
  tone?: TagTone;
  children: React.ReactNode;
  className?: string;
}

const toneClasses: Record<TagTone, string> = {
  neutral: "bg-border text-text-muted",
  success: "bg-success-bg text-success-fg",
  danger: "bg-danger-bg text-danger-fg",
  warning: "bg-warning-bg text-warning-fg",
  info: "bg-info-bg text-info-fg",
};

export function Tag({ tone = "neutral", children, className = "" }: TagProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium",
        toneClasses[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
