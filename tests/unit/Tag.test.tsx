import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Tag } from "@/components/atoms/Tag";
import type { TagTone } from "@/components/atoms/Tag";

describe("Tag", () => {
  const tones: Array<{ tone: TagTone; bgClass: string; fgClass: string }> = [
    { tone: "neutral", bgClass: "bg-border", fgClass: "text-text-muted" },
    { tone: "success", bgClass: "bg-success-bg", fgClass: "text-success-fg" },
    { tone: "danger", bgClass: "bg-danger-bg", fgClass: "text-danger-fg" },
    { tone: "warning", bgClass: "bg-warning-bg", fgClass: "text-warning-fg" },
    { tone: "info", bgClass: "bg-info-bg", fgClass: "text-info-fg" },
  ];

  tones.forEach(({ tone, bgClass, fgClass }) => {
    it(`renders tone="${tone}" with correct token classes`, () => {
      render(<Tag tone={tone}>{tone}</Tag>);
      const tag = screen.getByText(tone);
      expect(tag).toHaveClass(bgClass);
      expect(tag).toHaveClass(fgClass);
    });
  });

  it("renders with default neutral tone when no tone is given", () => {
    render(<Tag>défaut</Tag>);
    const tag = screen.getByText("défaut");
    expect(tag).toHaveClass("bg-border");
    expect(tag).toHaveClass("text-text-muted");
  });

  it("renders children correctly", () => {
    render(<Tag tone="success">Actif</Tag>);
    expect(screen.getByText("Actif")).toBeInTheDocument();
  });
});
