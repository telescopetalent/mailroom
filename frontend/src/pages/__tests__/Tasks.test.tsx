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
    mockApi.mockReturnValue(new Promise(() => {}));

    render(
      <MemoryRouter>
        <Tasks />
      </MemoryRouter>
    );

    expect(screen.getByText("Loading...")).toBeInTheDocument();
  });

  it("shows empty state when no tasks", async () => {
    // Both /tasks and /workflows return empty
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

  it("renders standalone tasks when data is available", async () => {
    mockApi.mockImplementation((url: string) => {
      if (url.includes("/workflows")) {
        return Promise.resolve({ items: [], pagination: { total_count: 0 } });
      }
      return Promise.resolve({
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
            workflow_id: null,
            workflow_name: null,
            workflow_order: null,
            approved_at: "2026-01-01T00:00:00",
          },
        ],
        pagination: { total_count: 1 },
      });
    });

    render(
      <MemoryRouter>
        <Tasks />
      </MemoryRouter>
    );

    expect(await screen.findByText("Fix the bug")).toBeInTheDocument();
    expect(screen.getByText(/Alice/)).toBeInTheDocument();
  });

  it("renders workflows with steps", async () => {
    mockApi.mockImplementation((url: string) => {
      if (url.includes("/workflows")) {
        return Promise.resolve({
          items: [
            {
              id: "wf1",
              name: "Weekly Meal Plan",
              description: "Plan meals for the week",
              status: "open",
              capture_id: "c1",
              tasks: [
                { id: "t1", title: "Pick recipes", description: null, owner: "Tommy", status: "open", priority: "none", workflow_order: 0 },
                { id: "t2", title: "Make grocery list", description: null, owner: null, status: "open", priority: "none", workflow_order: 1 },
              ],
              approved_at: "2026-01-01T00:00:00",
              created_at: "2026-01-01T00:00:00",
            },
          ],
          pagination: { total_count: 1 },
        });
      }
      return Promise.resolve({ items: [], pagination: { total_count: 0 } });
    });

    render(
      <MemoryRouter>
        <Tasks />
      </MemoryRouter>
    );

    expect(await screen.findByText("Weekly Meal Plan")).toBeInTheDocument();
    expect(screen.getByText("Pick recipes")).toBeInTheDocument();
    expect(screen.getByText("Make grocery list")).toBeInTheDocument();
    expect(screen.getByText(/0\/2/)).toBeInTheDocument();
  });
});
