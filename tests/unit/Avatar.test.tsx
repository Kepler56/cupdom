import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Avatar } from "@/components/atoms/Avatar";

describe("Avatar", () => {
  it("shows two-letter initials for a full name", () => {
    render(<Avatar name="Eliah Martin" />);
    expect(screen.getByText("EM")).toBeInTheDocument();
  });

  it("shows two-letter initials for a single-word name", () => {
    render(<Avatar name="Maxime" />);
    expect(screen.getByText("MA")).toBeInTheDocument();
  });

  it("renders uppercased initials", () => {
    render(<Avatar name="jean dupont" />);
    expect(screen.getByText("JD")).toBeInTheDocument();
  });

  it("uses the first and last word for multi-word names", () => {
    render(<Avatar name="Jean Paul Dupont" />);
    expect(screen.getByText("JD")).toBeInTheDocument();
  });

  it("has aria-label set to the name", () => {
    render(<Avatar name="Eliah Martin" />);
    const el = screen.getByLabelText("Eliah Martin");
    expect(el).toBeInTheDocument();
  });

  it("applies sm size classes", () => {
    render(<Avatar name="Test User" size="sm" />);
    expect(screen.getByLabelText("Test User")).toHaveClass("w-7", "h-7");
  });

  it("applies md size classes by default", () => {
    render(<Avatar name="Test User" />);
    expect(screen.getByLabelText("Test User")).toHaveClass("w-9", "h-9");
  });

  it("applies lg size classes", () => {
    render(<Avatar name="Test User" size="lg" />);
    expect(screen.getByLabelText("Test User")).toHaveClass("w-12", "h-12");
  });
});
