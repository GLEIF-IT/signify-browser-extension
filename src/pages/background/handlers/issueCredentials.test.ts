import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getPendingSummary: vi.fn(),
  decide: vi.fn(),
}));

vi.mock("@pages/background/services/issue-confirmation", () => ({
  getPendingSummary: mocks.getPendingSummary,
  decide: mocks.decide,
}));

import { handleGetIssueRequest, handleIssueDecision } from "./issueCredentials";

// The issuance request itself is tested in protocol.test.ts.

beforeEach(() => Object.values(mocks).forEach((m) => m.mockReset()));

describe("confirmation-page handlers", () => {
  it("returns the pending summary for a known id", () => {
    mocks.getPendingSummary.mockReturnValue({ issuer: { name: "s", prefix: "E" }, credentials: [] });
    const sendResponse = vi.fn();
    handleGetIssueRequest({ sendResponse, data: { id: "abc" } } as any);
    expect(sendResponse).toHaveBeenCalledWith({ data: { summary: { issuer: { name: "s", prefix: "E" }, credentials: [] } } });
  });

  it("says 'request expired' for an unknown id", () => {
    mocks.getPendingSummary.mockReturnValue(null);
    const sendResponse = vi.fn();
    handleGetIssueRequest({ sendResponse, data: { id: "nope" } } as any);
    expect(sendResponse).toHaveBeenCalledWith({ error: { code: 404, message: "request expired" } });
  });

  it("forwards the decision, and reports an unknown id as expired", () => {
    mocks.decide.mockReturnValueOnce(true).mockReturnValueOnce(false);
    const ok = vi.fn();
    const expired = vi.fn();

    handleIssueDecision({ sendResponse: ok, data: { id: "abc", approved: true } } as any);
    handleIssueDecision({ sendResponse: expired, data: { id: "gone", approved: true } } as any);

    expect(mocks.decide).toHaveBeenNthCalledWith(1, "abc", true);
    expect(ok).toHaveBeenCalledWith({ data: { ok: true } });
    expect(expired).toHaveBeenCalledWith({ error: { code: 404, message: "request expired" } });
  });

  it("treats anything but approved === true as a denial", () => {
    mocks.decide.mockReturnValue(true);
    handleIssueDecision({ sendResponse: vi.fn(), data: { id: "abc", approved: "yes" } } as any);
    expect(mocks.decide).toHaveBeenCalledWith("abc", false);
  });
});
