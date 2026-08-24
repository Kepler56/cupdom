import React, { useId } from "react";
import { cn } from "@/lib/cn";

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export function Input({ label, error, className = "", id, ...props }: InputProps) {
  const generatedId = useId();
  const inputId = id ?? (label ? generatedId : undefined);

  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label
          htmlFor={inputId}
          className="text-xs font-medium text-text-muted"
        >
          {label}
        </label>
      )}
      <input
        id={inputId}
        className={cn(
          "w-full rounded-input border bg-surface px-3 py-2.5 text-base text-text sm:py-2 sm:text-sm",
          "placeholder:text-text-faint",
          "focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-0 focus:border-primary",
          "disabled:opacity-40 disabled:cursor-not-allowed",
          error ? "border-danger-fg" : "border-border-strong",
          className,
        )}
        {...props}
      />
      {error && (
        <p className="text-xs text-danger-fg">{error}</p>
      )}
    </div>
  );
}
