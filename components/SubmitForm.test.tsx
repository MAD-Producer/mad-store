// @vitest-environment jsdom

import { cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SubmitForm } from "./SubmitForm";

vi.mock("@/components/LicenseSelector", () => ({
  LicenseSelector: () => <input type="hidden" name="license" value="MIT" />,
}));

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("SubmitForm", () => {
  it("sends only one request while the first submission is pending", () => {
    const pendingResponse = new Promise<Response>(() => undefined);
    const fetchMock = vi.fn(() => pendingResponse);
    vi.stubGlobal("fetch", fetchMock);

    const { container } = render(
      <SubmitForm settings={{ categories: [], tags: ["工具"] }} />,
    );
    const form = container.querySelector("form");
    expect(form).not.toBeNull();

    fireEvent.submit(form!);
    fireEvent.submit(form!);

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
