import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Button } from "@/components/atoms/Button";

describe("Button", () => {
  it("renders with default primary variant", () => {
    render(<Button>Enregistrer</Button>);
    const btn = screen.getByRole("button", { name: /enregistrer/i });
    expect(btn).toBeInTheDocument();
    expect(btn).toHaveClass("bg-primary");
    expect(btn).toHaveClass("text-primary-contrast");
  });

  it("renders secondary variant", () => {
    render(<Button variant="secondary">Annuler</Button>);
    const btn = screen.getByRole("button", { name: /annuler/i });
    expect(btn).toHaveClass("bg-surface");
    expect(btn).toHaveClass("border-border-strong");
  });

  it("renders danger-outline variant", () => {
    render(<Button variant="danger-outline">Supprimer</Button>);
    const btn = screen.getByRole("button", { name: /supprimer/i });
    expect(btn).toHaveClass("text-danger-fg");
    expect(btn).toHaveClass("border-danger-fg");
  });

  it("renders sm size", () => {
    render(<Button size="sm">Petit</Button>);
    const btn = screen.getByRole("button", { name: /petit/i });
    expect(btn).toHaveClass("px-3");
    expect(btn).toHaveClass("py-1.5");
  });

  it("renders md size", () => {
    render(<Button size="md">Moyen</Button>);
    const btn = screen.getByRole("button", { name: /moyen/i });
    expect(btn).toHaveClass("px-4");
    expect(btn).toHaveClass("py-2");
  });

  it("is disabled when disabled prop is set", () => {
    render(<Button disabled>Désactivé</Button>);
    const btn = screen.getByRole("button", { name: /désactivé/i });
    expect(btn).toBeDisabled();
    expect(btn).toHaveClass("opacity-40");
    expect(btn).toHaveClass("cursor-not-allowed");
  });

  it("is not disabled by default", () => {
    render(<Button>Actif</Button>);
    expect(screen.getByRole("button")).not.toBeDisabled();
  });
});
