import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { IssueSummary } from "./credential-issuance";

const { windows, removedListeners } = vi.hoisted(() => {
  const removedListeners = new Set<(windowId: number) => void>();
  return {
    removedListeners,
    windows: {
      create: vi.fn(),
      remove: vi.fn(),
      onRemoved: {
        addListener: vi.fn((listener: (windowId: number) => void) => removedListeners.add(listener)),
        removeListener: vi.fn((listener: (windowId: number) => void) => removedListeners.delete(listener)),
      },
    },
  };
});

vi.mock("webextension-polyfill", () => ({
  default: {
    windows,
    runtime: { getURL: (path: string) => `chrome-extension://ext-id/${path}` },
  },
}));

import {
  CONFIRM_TIMEOUT_MS,
  decide,
  getPendingSummary,
  requestApproval,
} from "./issue-confirmation";

const SUMMARY: IssueSummary = {
  issuer: { name: "signer", prefix: "EAID" },
  credentials: [
    { schemaSaid: "SFAW", schemaTitle: "FAW", registryName: "faw-reg", attributes: { filename: "a.pdf" } },
  ],
};

const flush = () => vi.advanceTimersByTimeAsync(0);

async function start() {
  const approval = requestApproval(SUMMARY);
  await flush();
  const url = windows.create.mock.calls.at(-1)![0].url as string;
  const id = new URL(url).searchParams.get("id")!;
  return { approval, id, url };
}

beforeEach(() => {
  vi.useFakeTimers();
  removedListeners.clear();
  windows.create.mockReset().mockResolvedValue({ id: 7 });
  windows.remove.mockReset().mockResolvedValue(undefined);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("requestApproval", () => {
  it("opens an extension popup window carrying the request id", async () => {
    const { approval, id, url } = await start();

    expect(url).toMatch(/^chrome-extension:\/\/ext-id\/src\/pages\/issue-confirm\/index\.html\?id=/);
    expect(windows.create).toHaveBeenCalledWith(expect.objectContaining({ type: "popup" }));
    expect(getPendingSummary(id)).toEqual(SUMMARY);

    decide(id, false);
    await approval;
  });

  it("resolves true on approve, closes the window and clears the request", async () => {
    const { approval, id } = await start();

    expect(decide(id, true)).toBe(true);

    await expect(approval).resolves.toBe(true);
    expect(windows.remove).toHaveBeenCalledWith(7);
    expect(getPendingSummary(id)).toBeNull();
    expect(removedListeners.size).toBe(0);
  });

  it("resolves false on deny", async () => {
    const { approval, id } = await start();
    decide(id, false);
    await expect(approval).resolves.toBe(false);
    expect(getPendingSummary(id)).toBeNull();
  });

  it("resolves false when the user closes the window", async () => {
    const { approval, id } = await start();

    for (const listener of [...removedListeners]) listener(7);

    await expect(approval).resolves.toBe(false);
    expect(getPendingSummary(id)).toBeNull();
    expect(windows.remove).not.toHaveBeenCalled(); // already gone
  });

  it("ignores another window being closed", async () => {
    const { approval, id } = await start();
    for (const listener of [...removedListeners]) listener(99);
    expect(getPendingSummary(id)).toEqual(SUMMARY);
    decide(id, false);
    await approval;
  });

  it("resolves false and closes the window after the timeout", async () => {
    const { approval, id } = await start();

    await vi.advanceTimersByTimeAsync(CONFIRM_TIMEOUT_MS);

    await expect(approval).resolves.toBe(false);
    expect(windows.remove).toHaveBeenCalledWith(7);
    expect(getPendingSummary(id)).toBeNull();
  });

  it("resolves false if the window cannot be opened", async () => {
    windows.create.mockRejectedValue(new Error("no window"));
    const approval = requestApproval(SUMMARY);
    await flush();
    await expect(approval).resolves.toBe(false);
  });
});

describe("decide / getPendingSummary", () => {
  it("returns false for an unknown id and does not affect real requests", async () => {
    const { approval, id } = await start();

    expect(decide("not-a-real-id", true)).toBe(false);
    expect(getPendingSummary("not-a-real-id")).toBeNull();
    expect(getPendingSummary(id)).toEqual(SUMMARY);

    decide(id, false);
    await approval;
  });

  it("refuses a second decision for the same request", async () => {
    const { approval, id } = await start();
    expect(decide(id, true)).toBe(true);
    expect(decide(id, false)).toBe(false);
    await expect(approval).resolves.toBe(true);
  });
});
