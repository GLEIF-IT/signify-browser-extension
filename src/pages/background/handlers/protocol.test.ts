import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getSessionInfo: vi.fn(),
  removeSessionInfo: vi.fn(),
  getSignedHeaders: vi.fn(),
  signData: vi.fn(),
  getCredential: vi.fn(),
  createAttestationCredential: vi.fn(),
  setWebRequestedPermission: vi.fn(),
  getIssuingContext: vi.fn(),
  summarizeBatch: vi.fn(),
  issueBatch: vi.fn(),
  requestApproval: vi.fn(),
  resetTimeoutAlarm: vi.fn(),
  setBadge: vi.fn(),
}));

vi.mock("@pages/background/services/signify", () => ({
  signifyService: {
    getSessionInfo: mocks.getSessionInfo,
    removeSessionInfo: mocks.removeSessionInfo,
    getSignedHeaders: mocks.getSignedHeaders,
    signData: mocks.signData,
    getCredential: mocks.getCredential,
    createAttestationCredential: mocks.createAttestationCredential,
  },
}));
vi.mock("@pages/background/services/config", () => ({
  WEB_APP_PERMS: { SET_VENDOR_URL: "set-vendor-url" },
  configService: { setWebRequestedPermission: mocks.setWebRequestedPermission },
}));
vi.mock("@pages/background/services/issue-context", () => ({ getIssuingContext: mocks.getIssuingContext }));
vi.mock("@pages/background/services/signify-connection", () => ({ resetTimeoutAlarm: mocks.resetTimeoutAlarm }));
vi.mock("@pages/background/services/issue-confirmation", () => ({ requestApproval: mocks.requestApproval }));
vi.mock("@src/shared/browser/runtime-utils", () => ({ getExtId: () => "ext-id" }));
vi.mock("@shared/browser/action-utils", () => ({ setBadge: mocks.setBadge }));
vi.mock("@pages/background/services/credential-issuance", async () => {
  const actual = await vi.importActual<typeof import("@pages/background/services/credential-issuance")>(
    "@pages/background/services/credential-issuance"
  );
  return { ...actual, summarizeBatch: mocks.summarizeBatch, issueBatch: mocks.issueBatch };
});

import { IssuanceError } from "@pages/background/services/credential-issuance";
import { createProtocolListener } from "./protocol";

const ORIGIN = "https://app.example";
const sender = (active = true) => ({ id: "ext-id", url: `${ORIGIN}/page?x=1`, tab: { id: 3, active } });
const send = (type: string, rest: object = {}, from = sender()) =>
  createProtocolListener()({ channel: "vlei-wallet-protocol", message: { type, requestId: "r1", ...rest } }, from);

const REQUESTS = [{ schemaSaid: "SFAW", registryName: "faw-reg", attributes: { filename: "a.pdf" } }];
const ISSUED = [{ said: "ECRED1", schemaSaid: "SFAW", registryName: "faw-reg", issuer: "EAID", issuedAt: null }];
const CLIENT = { fake: "client" };

beforeEach(() => {
  Object.values(mocks).forEach((m) => m.mockReset());
  mocks.getIssuingContext.mockResolvedValue({ client: CLIENT, aidName: "signer" });
  mocks.summarizeBatch.mockResolvedValue({ issuer: { name: "signer", prefix: "EAID" }, credentials: [] });
});

describe("protocol listener", () => {
  it("ignores messages that are not protocol envelopes or come from another extension", () => {
    const listener = createProtocolListener();
    expect(listener({ type: "cs-something" }, sender())).toBeUndefined();
    expect(
      listener({ channel: "vlei-wallet-protocol", message: { type: "/signify/clear-session", requestId: "r" } }, {
        ...sender(),
        id: "other",
      })
    ).toBeUndefined();
  });

  it("answers background tabs with an error instead of staying silent", async () => {
    expect(await send("/signify/clear-session", {}, sender(false))).toEqual({
      ok: false,
      error: "Request did not come from the active tab",
    });
    expect(mocks.removeSessionInfo).not.toHaveBeenCalled();
  });

  it("answers unsupported types, including the reserved auto sign-in", async () => {
    expect(await send("/signify/authorize-auto-signin", { payload: {} })).toEqual({
      ok: false,
      error: "Unsupported message type: /signify/authorize-auto-signin",
    });
  });
});

describe("sessions", () => {
  it("get-session-info: the session, or 'Session not found'", async () => {
    mocks.getSessionInfo.mockResolvedValueOnce({ identifier: { prefix: "EAID" }, expiry: 1 }).mockResolvedValueOnce(null);
    expect(await send("/signify/get-session-info")).toEqual({ ok: true, payload: { identifier: { prefix: "EAID" }, expiry: 1 } });
    expect(mocks.getSessionInfo).toHaveBeenCalledWith({ tabId: 3, origin: ORIGIN });
    expect(await send("/signify/get-session-info")).toEqual({ ok: false, error: "Session not found" });
  });

  it("clear-session replies {}", async () => {
    expect(await send("/signify/clear-session")).toEqual({ ok: true, payload: {} });
    expect(mocks.removeSessionInfo).toHaveBeenCalledWith({ tabId: 3, origin: ORIGIN });
  });
});

describe("signing", () => {
  it("sign-request signs for the tab's session, method defaults to GET", async () => {
    mocks.getSignedHeaders.mockResolvedValue({ headers: { "signify-resource": "EAID" } });
    expect(await send("/signify/sign-request", { payload: { url: "https://api.example/x" } })).toEqual({
      ok: true,
      payload: { headers: { "signify-resource": "EAID" } },
    });
    expect(mocks.getSignedHeaders).toHaveBeenCalledWith(
      expect.objectContaining({ origin: ORIGIN, tabId: 3, rurl: "https://api.example/x", method: "GET" })
    );
  });

  it("missing payloads are 'missing data'", async () => {
    expect(await send("/signify/sign-request")).toEqual({ ok: false, error: "missing data" });
    expect(await send("/signify/sign-data", { payload: {} })).toEqual({ ok: false, error: "missing data" });
    expect(await send("/signify/credential/get", { payload: {} })).toEqual({ ok: false, error: "missing data" });
  });

  it("errors from the services become error replies", async () => {
    mocks.signData.mockRejectedValue(new Error("Session not found"));
    expect(await send("/signify/sign-data", { payload: { items: ["a"] } })).toEqual({ ok: false, error: "Session not found" });
  });
});

describe("credentials", () => {
  it("credential/get returns the credential or null", async () => {
    mocks.getCredential.mockResolvedValueOnce("CESR").mockResolvedValueOnce(undefined);
    expect(await send("/signify/credential/get", { payload: { id: "E1", includeCESR: true } })).toEqual({
      ok: true,
      payload: { credential: "CESR" },
    });
    expect(mocks.getCredential).toHaveBeenCalledWith("E1", true);
    expect(await send("/signify/credential/get", { payload: { id: "E2" } })).toEqual({ ok: true, payload: { credential: null } });
  });

  it("issue: confirms in the extension window, issues, replies with the credentials", async () => {
    mocks.requestApproval.mockResolvedValue(true);
    mocks.issueBatch.mockResolvedValue(ISSUED);
    expect(await send("/signify/credential/issue", { payload: { credentials: REQUESTS } })).toEqual({
      ok: true,
      payload: { credentials: ISSUED },
    });
    expect(mocks.getIssuingContext).toHaveBeenCalledWith({ origin: ORIGIN, tabId: 3 });
    expect(mocks.summarizeBatch).toHaveBeenCalledWith(CLIENT, "signer", REQUESTS);
    expect(mocks.issueBatch).toHaveBeenCalledWith(CLIENT, "signer", REQUESTS);
    expect(mocks.resetTimeoutAlarm).toHaveBeenCalled();
  });

  it("issue: denial is 'User rejected' with issued []", async () => {
    mocks.requestApproval.mockResolvedValue(false);
    expect(await send("/signify/credential/issue", { payload: { credentials: REQUESTS } })).toEqual({
      ok: false,
      error: "User rejected",
      payload: { issued: [] },
    });
    expect(mocks.issueBatch).not.toHaveBeenCalled();
  });

  it("issue: a partial failure reports what was already issued", async () => {
    mocks.requestApproval.mockResolvedValue(true);
    mocks.issueBatch.mockRejectedValue(new IssuanceError("KERIA rejected credential 2", ISSUED));
    expect(await send("/signify/credential/issue", { payload: { credentials: REQUESTS } })).toEqual({
      ok: false,
      error: "KERIA rejected credential 2",
      payload: { issued: ISSUED },
    });
  });

  it("issue: fails before any prompt without a session or with an invalid batch", async () => {
    mocks.getIssuingContext.mockRejectedValueOnce(new Error("Session not found"));
    expect(await send("/signify/credential/issue", { payload: { credentials: REQUESTS } })).toEqual({
      ok: false,
      error: "Session not found",
      payload: { issued: [] },
    });
    mocks.summarizeBatch.mockRejectedValueOnce(new IssuanceError("Schema SX not found — it must be resolved by KERIA first"));
    const response: any = await send("/signify/credential/issue", { payload: { credentials: REQUESTS } });
    expect(response.error).toContain("must be resolved by KERIA first");
    expect(await send("/signify/credential/issue", { payload: {} })).toEqual({
      ok: false,
      error: "missing data",
      payload: { issued: [] },
    });
    expect(mocks.requestApproval).not.toHaveBeenCalled();
  });
});

describe("configure-vendor", () => {
  it("records the request for the user to confirm in the popup, replies {}", async () => {
    expect(await send("/signify/configure-vendor", { payload: { url: "https://vendor.example/v.json" } })).toEqual({
      ok: true,
      payload: {},
    });
    expect(mocks.setWebRequestedPermission).toHaveBeenCalledWith("set-vendor-url", {
      origin: ORIGIN,
      vendorUrl: "https://vendor.example/v.json",
    });
    expect(mocks.setBadge).toHaveBeenCalled();
  });
});
