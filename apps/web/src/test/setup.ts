import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";

afterEach(() => {
  cleanup();
  sessionStorage.clear();
  window.history.replaceState({}, "", "/");
  vi.useRealTimers();
});

// jsdom lacks these browser APIs used by the UI.
if (!window.scrollTo) window.scrollTo = () => undefined;
window.scrollTo = (() => undefined) as typeof window.scrollTo;
if (!URL.createObjectURL) URL.createObjectURL = () => "blob:certichain-test";
if (!URL.revokeObjectURL) URL.revokeObjectURL = () => undefined;
