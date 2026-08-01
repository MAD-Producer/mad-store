// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AdminDashboard } from "./AdminDashboard";

vi.mock("@/components/LicenseSelector", () => ({
  LicenseSelector: () => <input type="hidden" name="license" value="MIT" />,
}));

afterEach(cleanup);

describe("AdminDashboard", () => {
  it("keeps submissions collapsed until the current row is edited", () => {
    const { container } = render(
      <AdminDashboard
        initialProjects={[{
          id: "project-id",
          slug: "mad-toolbox",
          name: "MAD Toolbox",
          description: "MAD Toolbox description",
          repoUrl: "https://github.com/MAD-Producer/MAD-Toolbox",
          authorUrl: "https://github.com/MAD-Producer",
          license: "MIT",
          systems: ["Windows"],
          tags: ["工具"],
          category: "制作工具",
          status: "pending",
          createdAt: "2026-07-31T00:00:00.000Z",
          updatedAt: "2026-07-31T00:00:00.000Z",
        }]}
        initialWebsites={[]}
        initialSettings={{ categories: ["制作工具"], tags: ["工具"] }}
      />,
    );

    expect(container.querySelector(".review-card")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "编辑" }));
    expect(container.querySelector(".review-card")).not.toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "收起" }));
    expect(container.querySelector(".review-card")).toBeNull();
  });
});
