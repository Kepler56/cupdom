import React from "react";
import type { LucideProps, LucideIcon } from "lucide-react";

interface IconProps extends LucideProps {
  icon: LucideIcon;
}

export function Icon({ icon: LucideIcon, size = 16, ...props }: IconProps) {
  return <LucideIcon size={size} strokeWidth={1.5} aria-hidden="true" {...props} />;
}
