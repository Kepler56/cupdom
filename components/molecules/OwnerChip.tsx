interface OwnerChipProps {
  name: string;
  color: string;
}

/** A coloured dot + the owner's display name. Used in colleague/Tous views to show ownership. */
export function OwnerChip({ name, color }: OwnerChipProps) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-text-body">
      <span
        className="h-2 w-2 shrink-0 rounded-full"
        style={{ backgroundColor: color }}
        aria-hidden
      />
      {name}
    </span>
  );
}
