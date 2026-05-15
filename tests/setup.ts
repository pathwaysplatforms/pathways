import { vi, afterEach } from "vitest";

afterEach(() => {
  vi.clearAllMocks();
});

vi.spyOn(console, "error").mockImplementation(() => {});
