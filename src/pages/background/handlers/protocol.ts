import {
  HandlerError,
  PROTOCOL_ERRORS,
  createBackgroundRouter,
  createRuntimeListener,
  type ProtocolHandlers,
} from "vlei-wallet-protocol/extension";
import { signifyService } from "@pages/background/services/signify";
import { configService, WEB_APP_PERMS } from "@pages/background/services/config";
import { issueBatch, summarizeBatch } from "@pages/background/services/credential-issuance";
import { requestApproval } from "@pages/background/services/issue-confirmation";
import { getIssuingContext } from "@pages/background/services/issue-context";
import { resetTimeoutAlarm } from "@pages/background/services/signify-connection";
import { getExtId } from "@src/shared/browser/runtime-utils";
import { setBadge } from "@shared/browser/action-utils";

const messageOf = (error: unknown) => (error instanceof Error ? error.message : String(error));

/**
 * Background side of the page protocol (vlei-wallet-protocol). `authorize*` prompts are answered by the
 * content script (in-page dialog); `/signify/authorize-auto-signin` is reserved and not registered, so it
 * gets an "Unsupported message type" error reply.
 */
export function createProtocolHandlers(): Partial<ProtocolHandlers> {
  return {
    "/signify/get-session-info": async (_request, { tabId, origin }) => {
      const session = await signifyService.getSessionInfo({ tabId, origin });
      if (!session) throw new HandlerError(PROTOCOL_ERRORS.sessionNotFound);
      return session;
    },

    "/signify/clear-session": async (_request, { tabId, origin }) => {
      await signifyService.removeSessionInfo({ tabId, origin });
    },

    "/signify/sign-request": async ({ payload }, { tabId, origin }) => {
      if (!payload?.url) throw new HandlerError(PROTOCOL_ERRORS.missingData);
      return signifyService.getSignedHeaders({
        origin,
        tabId,
        rurl: payload.url,
        method: payload.method ?? "GET",
        headers: new Headers(payload.headers ?? {}),
      });
    },

    "/signify/sign-data": async ({ payload }, { tabId, origin }) => {
      if (!Array.isArray(payload?.items)) throw new HandlerError(PROTOCOL_ERRORS.missingData);
      return signifyService.signData({ origin, tabId, items: payload.items });
    },

    "/signify/credential/get": async ({ payload }) => {
      if (!payload?.id) throw new HandlerError(PROTOCOL_ERRORS.missingData);
      const credential = await signifyService.getCredential(payload.id, payload.includeCESR ?? false);
      return { credential: credential ?? null };
    },

    "/signify/credential/issue": async ({ payload }, { tabId, origin }) => {
      if (!payload?.credentials) throw new HandlerError(PROTOCOL_ERRORS.missingData, { issued: [] });
      try {
        const { client, aidName } = await getIssuingContext({ origin, tabId });
        const summary = await summarizeBatch(client, aidName, payload.credentials);
        if (!(await requestApproval(summary))) {
          throw new HandlerError(PROTOCOL_ERRORS.userRejected, { issued: [] });
        }
        const credentials = await issueBatch(client, aidName, payload.credentials);
        resetTimeoutAlarm();
        return { credentials };
      } catch (error: any) {
        if (error instanceof HandlerError) throw error;
        throw new HandlerError(messageOf(error), { issued: error?.issued ?? [] });
      }
    },

    "/signify/credential/create/data-attestation": async ({ payload }, { tabId, origin }) => {
      if (!payload?.schemaSaid) throw new HandlerError(PROTOCOL_ERRORS.missingData);
      return signifyService.createAttestationCredential({
        origin,
        tabId,
        credData: payload.credData,
        schemaSaid: payload.schemaSaid,
      });
    },

    "/signify/configure-vendor": async ({ payload }, { origin }) => {
      if (!payload?.url) throw new HandlerError(PROTOCOL_ERRORS.missingData);
      await configService.setWebRequestedPermission(WEB_APP_PERMS.SET_VENDOR_URL, {
        origin,
        vendorUrl: payload.url,
      });
      await setBadge(); // the user confirms the vendor change in the popup
    },
  };
}

/** `runtime.onMessage` listener for protocol envelopes; `undefined` for any other message. */
export function createProtocolListener() {
  const router = createBackgroundRouter(createProtocolHandlers(), {
    onError: (error, message) => console.warn("Protocol request failed:", message.type, messageOf(error)),
  });
  return createRuntimeListener(router, getExtId(), { requireActiveTab: true });
}
