import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import CaptureInput from "../CaptureInput";

// Mock the api module
vi.mock("../../api/client", () => ({
  api: vi.fn(),
  apiUpload: vi.fn(),
}));

describe("CaptureInput", () => {
  const noop = () => {};

  it("renders AI mode by default", () => {
    render(<CaptureInput onCaptureCreated={noop} />);
    expect(screen.getByText("AI")).toBeInTheDocument();
    expect(screen.getByText("Manual")).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Paste text/i)).toBeInTheDocument();
  });

  it("switches to manual mode", () => {
    render(<CaptureInput onCaptureCreated={noop} />);
    fireEvent.click(screen.getByText("Manual"));
    expect(screen.getByPlaceholderText(/Brief summary/i)).toBeInTheDocument();
  });

  it("disables submit when empty", () => {
    render(<CaptureInput onCaptureCreated={noop} />);
    const button = screen.getByText("Send to Mailroom");
    expect(button).toBeDisabled();
  });

  it("enables submit when text is entered", () => {
    render(<CaptureInput onCaptureCreated={noop} />);
    const textarea = screen.getByPlaceholderText(/Paste text/i);
    fireEvent.change(textarea, { target: { value: "Some content" } });
    const button = screen.getByText("Send to Mailroom");
    expect(button).not.toBeDisabled();
  });
});
