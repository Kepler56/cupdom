import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Input } from "@/components/atoms/Input";

describe("Input", () => {
  it("associates label with input via id", () => {
    render(<Input label="Email" />);
    const input = screen.getByLabelText("Email");
    expect(input).toBeInTheDocument();
    expect(input.tagName).toBe("INPUT");
  });

  it("two inputs with the same label get distinct ids", () => {
    render(
      <>
        <Input label="Nom" />
        <Input label="Nom" />
      </>,
    );
    const inputs = screen.getAllByLabelText("Nom");
    expect(inputs).toHaveLength(2);
    const id0 = inputs[0].getAttribute("id");
    const id1 = inputs[1].getAttribute("id");
    expect(id0).not.toBeNull();
    expect(id1).not.toBeNull();
    expect(id0).not.toBe(id1);
  });

  it("uses provided id prop over generated id", () => {
    render(<Input label="Prénom" id="custom-id" />);
    const input = screen.getByLabelText("Prénom");
    expect(input).toHaveAttribute("id", "custom-id");
  });

  it("renders without label", () => {
    render(<Input placeholder="Sans label" />);
    expect(screen.getByPlaceholderText("Sans label")).toBeInTheDocument();
  });

  it("displays error message", () => {
    render(<Input label="Champ" error="Champ requis" />);
    expect(screen.getByText("Champ requis")).toBeInTheDocument();
  });
});
