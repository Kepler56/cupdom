import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Spinner } from "@/components/atoms/Spinner";

describe("Spinner", () => {
  it("has role='status'", () => {
    render(<Spinner />);
    expect(screen.getByRole("status")).toBeInTheDocument();
  });

  it("has accessible label 'Chargement'", () => {
    render(<Spinner />);
    expect(screen.getByLabelText("Chargement")).toBeInTheDocument();
  });

  it("applies md size classes by default", () => {
    render(<Spinner />);
    expect(screen.getByRole("status")).toHaveClass("w-6", "h-6");
  });

  it("applies sm size classes", () => {
    render(<Spinner size="sm" />);
    expect(screen.getByRole("status")).toHaveClass("w-4", "h-4");
  });

  it("applies lg size classes", () => {
    render(<Spinner size="lg" />);
    expect(screen.getByRole("status")).toHaveClass("w-8", "h-8");
  });
});
