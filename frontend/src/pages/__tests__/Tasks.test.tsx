import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { MemoryRouter } from "react-router-dom";
import Tasks from "../Tasks";

// Mock the api module
const mockApi = vi.fn();
vi.mock("../../api/client", () => ({
  api: (...args: unknown[]) => mockApi(...args),
}));

describe("Tasks", () => {
  beforeEach(() => {
    mockApi.mockReset();
  });

  it("shows loading state initially", () => {
    // Return a pending promise to keep loading state
    mockApi.mockReturnValue(new Promise(() => {}));

    render(
      <MemoryRouter>
        <Tasks />
      </MemoryRouter>
    );

    expect(screen.getByText("Loading...")).toBeInTheDocument();
  });

  it("shows empty state when no tasks", async () => {
    mockApi.mockResolvedValue({ items: [], pagination: { total_count: 0 } });

    render(
      <MemoryRouter>
        <Tasks />
      </MemoryRouter>
    );

    expect(
      await screen.findByText(/No open tasks/i)
    ).toBeInTheDocument();
  });

  it("renders tasks when data is available", async () => {
    mockApi.mockResolvedValue({
      items: [
        {
          id: "1",
          title: "Fix the bug",
          description: null,
          owner: "Alice",
          due_date: null,
          priority: "high",
          status: "open",
          source: "web",
          capture_id: "c1",
          approved_at: "2026-01-01T00:00:00",
        },
      ],
      pagination: { total_count: 1 },
    });

    render(
      <MemoryRouter>
        <Tasks />
      </MemoryRouter>
    );

    expect(await screen.findByText("Fix the bug")).toBeInTheDocument();
    expect(screen.getByText(/Alice/)).toBeInTheDocument();
  });
});
