import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getIssuingContext: vi.fn(),
  summarizeBatch: vi.fn(),
  issueBatch: vi.fn(),
  requestApproval: vi.fn(),
  getPendingSummary: vi.fn(),
  decide: vi.fn(),
  resetTimeoutAlarm: vi.fn(),
}));

vi.mock("@pages/background/services/issue-context", () => ({ getIssuingContext: mocks.getIssuingContext }));
vi.mock("@pages/background/services/signify-connection", () => ({ resetTimeoutAlarm: mocks.resetTimeoutAlarm }));
vi.mock("@pages/background/services/issue-confirmation", () => ({
  requestApproval: mocks.requestApproval,
  getPendingSummary: mocks.getPendingSummary,
  decide: mocks.decide,
}));
vi.mock("@pages/background/services/credential-issuance", async () => {
  const actual = await vi.importActual<typeof import("@pages/background/services/credential-issuance")>(
    "@pages/background/services/credential-issuance"
  );
  return { ...actual, summarizeBatch: mocks.summarizeBatch, issueBatch: mocks.issueBatch };
});

import { IssuanceError } from "@pages/background/services/credential-issuance";
import { handleGetIssueRequest, handleIssueCredentials, handleIssueDecision } from "./issueCredentials";

const REQUESTS = [{ schemaSaid: "SFAW", registryName: "faw-reg", attributes: { filename: "a.pdf" } }];
const CLIENT = { fake: "client" };
const call = async (data: unknown) => {
  const sendResponse = vi.fn();
  await handleIssueCredentials({ sendResponse, tabId: 3, url: "https://app.example/page", data } as any);
  return sendResponse;
};

beforeEach(() => {
  Object.values(mocks).forEach((m) => m.mockReset());
  mocks.getIssuingContext.mockResolvedValue({ client: CLIENT, aidName: "signer" });
  mocks.summarizeBatch.mockResolvedValue({ issuer: { name: "signer", prefix: "EAID" }, credentials: [] });
});

describe("handleIssueCredentials", () => {
  it("answers 400 when the payload has no credentials", async () => {
    const sendResponse = await call({});
    expect(sendResponse).toHaveBeenCalledWith({ error: { code: 400, message: "missing credentials", issued: [] } });
    expect(mocks.requestApproval).not.toHaveBeenCalled();
  });

  it("asks for confirmation using the session context, then issues and replies with the credentials", async () => {
    const issued = [{ said: "ECRED1", schemaSaid: "SFAW", registryName: "faw-reg", issuer: "EAID", issuedAt: null }];
    mocks.requestApproval.mockResolvedValue(true);
    mocks.issueBatch.mockResolvedValue(issued);

    const sendResponse = await call({ credentials: REQUESTS });

    expect(mocks.getIssuingContext).toHaveBeenCalledWith({ origin: "https://app.example", tabId: 3 });
    expect(mocks.summarizeBatch).toHaveBeenCalledWith(CLIENT, "signer", REQUESTS);
    expect(mocks.issueBatch).toHaveBeenCalledWith(CLIENT, "signer", REQUESTS);
    expect(sendResponse).toHaveBeenCalledWith({ data: { credentials: issued } });
    expect(mocks.resetTimeoutAlarm).toHaveBeenCalled();
  });

  it("replies 'User rejected' and issues nothing when the user denies", async () => {
    mocks.requestApproval.mockResolvedValue(false);

    const sendResponse = await call({ credentials: REQUESTS });

    expect(sendResponse).toHaveBeenCalledWith({ error: { code: 403, message: "User rejected", issued: [] } });
    expect(mocks.issueBatch).not.toHaveBeenCalled();
  });

  it("passes the already-issued list through on a failure", async () => {
    const issued = [{ said: "ECRED1", schemaSaid: "SFAW", registryName: "faw-reg", issuer: "EAID", issuedAt: null }];
    mocks.requestApproval.mockResolvedValue(true);
    mocks.issueBatch.mockRejectedValue(new IssuanceError("KERIA rejected credential 2", issued));

    const sendResponse = await call({ credentials: REQUESTS });

    expect(sendResponse).toHaveBeenCalledWith({
      error: { code: 503, message: "KERIA rejected credential 2", issued },
    });
  });

  it("fails before any prompt when the summary step fails (e.g. unknown schema)", async () => {
    mocks.summarizeBatch.mockRejectedValue(new IssuanceError("Schema SX not found — it must be resolved by KERIA first"));

    const sendResponse = await call({ credentials: REQUESTS });

    expect(sendResponse.mock.calls[0][0].error.message).toContain("must be resolved by KERIA first");
    expect(mocks.requestApproval).not.toHaveBeenCalled();
  });

  it("fails when there is no session", async () => {
    mocks.getIssuingContext.mockRejectedValue(new Error("Session not found"));
    const sendResponse = await call({ credentials: REQUESTS });
    expect(sendResponse).toHaveBeenCalledWith({ error: { code: 503, message: "Session not found", issued: [] } });
  });
});

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
