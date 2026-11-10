import browser from "webextension-polyfill";
import { createRoot } from "react-dom/client";
import "@fontsource/source-sans-3/latin-400.css";
import "@fontsource/source-sans-3/latin-600.css";
import "@fontsource/source-sans-3/latin-700.css";
import {
  HandlerError,
  PROTOCOL_ERRORS,
  createContentBridge,
  forwardViaRuntime,
  type AuthorizeResult,
  type RequestEnvelope,
} from "vlei-wallet-protocol/extension";
import { LocaleProvider } from "@src/_locales";
import { CS_EVENTS } from "@config/event-types";
import { getExtId, sendMessage } from "@src/shared/browser/runtime-utils";
import { TAB_STATE } from "@pages/popup/constants";
import { Dialog } from "./dialog/Dialog";
import { SessionInfo } from "./session-info/session-info";

window.polaris_tab_state = window.polaris_tab_state ?? TAB_STATE.NONE;

type AuthorizeType = "/signify/authorize" | "/signify/authorize/aid" | "/signify/authorize/credential";

/** The sign-in prompt the page is waiting for. At most one: a new one cancels the previous. */
interface PendingPrompt {
  eventType: AuthorizeType;
  schema?: string;
  sessionOneTime: boolean;
  resolve(result: AuthorizeResult): void;
  reject(error: Error): void;
}

let pendingPrompt: PendingPrompt | undefined;

// Web page ↔ extension protocol (vlei-wallet-protocol): handshake on injection and on every
// `signify-extension-client`, exactly one `/signify/reply` per request. `authorize*` prompts are answered
// here in the page (dialog); everything else goes to the background (handlers/protocol.ts).
createContentBridge({
  extensionId: getExtId(),
  forward: forwardViaRuntime((envelope) => browser.runtime.sendMessage(envelope)),
  local: {
    "/signify/authorize": promptSignin,
    "/signify/authorize/aid": promptSignin,
    "/signify/authorize/credential": promptSignin,
  },
});

function promptSignin(request: RequestEnvelope<AuthorizeType>): Promise<AuthorizeResult> {
  if (pendingPrompt) cancelPrompt(pendingPrompt);
  return new Promise<AuthorizeResult>((resolve, reject) => {
    const prompt: PendingPrompt = {
      eventType: request.type,
      schema: "schema" in request && typeof request.schema === "string" ? request.schema : undefined,
      sessionOneTime: request.payload?.session?.oneTime ?? false,
      resolve,
      reject,
    };
    pendingPrompt = prompt;
    showPrompt(prompt).catch((error) => settlePrompt(prompt, () => reject(error)));
  });
}

/** Runs `outcome` once, only if `prompt` is still the pending one. */
function settlePrompt(prompt: PendingPrompt, outcome: () => void) {
  if (pendingPrompt !== prompt) return;
  pendingPrompt = undefined;
  outcome();
}

function cancelPrompt(prompt: PendingPrompt) {
  settlePrompt(prompt, () => prompt.reject(new HandlerError(PROTOCOL_ERRORS.cancelled)));
  resetTabState();
}

async function showPrompt(prompt: PendingPrompt) {
  await sendMessage({ type: CS_EVENTS.action_icon_set_tab });
  const respVendorData = await sendMessage({ type: CS_EVENTS.vendor_info_get_vendor_data });
  const { data } = await sendMessage({ type: CS_EVENTS.authentication_check_agent_connection });
  const tabSigninResp = await sendMessage({ type: CS_EVENTS.fetch_resource_tab_signin });
  if (pendingPrompt !== prompt) return; // replaced or cancelled meanwhile

  insertDialog({
    isConnected: data?.isConnected,
    tabUrl: data?.tabUrl ?? window.location.href,
    signins: getFilteredSignins(tabSigninResp?.data?.signins, prompt.eventType, prompt.schema),
    eventType: prompt.eventType,
    autoSigninObj: tabSigninResp?.data?.autoSigninObj,
    vendorData: respVendorData?.data?.vendorData,
    prompt,
  });
}

// Handle messages from background script and popup
browser.runtime.onMessage.addListener(async function (message, sender) {
  if (sender.id !== getExtId()) return;

  // The popup created a sign-in for this page: show the dialog again with the new list.
  if (message.type === "tab" && message.subtype === "reload-state" && pendingPrompt) {
    removeDialog();
    await showPrompt(pendingPrompt);
  }

  if (message.type === "tab" && message.subtype === "get-tab-state") {
    return { data: { tabState: getTabState() } };
  }

  if (message.type === "tab" && message.subtype === "set-tab-state") {
    setTabState(message.data.tabState);
  }

  if (message.type === "tab" && message.subtype === "session-info") {
    if (!message.data) {
      removeSessionInfo();
      return;
    }
    const respVendorData = await sendMessage({ type: CS_EVENTS.vendor_info_get_vendor_data });
    const { data } = await sendMessage({ type: CS_EVENTS.authentication_check_agent_connection });
    insertSessionInfo(data?.isConnected, respVendorData?.data?.vendorData, message.data);
  }
});

const DIALOG_ROOT = "__root";

function insertDialog({
  isConnected,
  tabUrl,
  signins,
  eventType,
  autoSigninObj,
  vendorData,
  prompt,
}: {
  isConnected: boolean;
  tabUrl: string;
  signins: any[];
  eventType: string;
  autoSigninObj: any;
  vendorData: any;
  prompt: PendingPrompt;
}) {
  document.getElementById(DIALOG_ROOT)?.remove();
  const container = document.createElement("div");
  container.id = DIALOG_ROOT;
  document.body.appendChild(container);

  createRoot(container).render(
    <LocaleProvider>
      <Dialog
        isConnected={isConnected}
        vendorData={vendorData}
        tabUrl={tabUrl}
        signins={signins}
        autoSigninObjExists={!!autoSigninObj}
        eventType={eventType}
        handleRemove={resetTabState}
        sessionOneTime={prompt.sessionOneTime}
        onResolve={(result) => settlePrompt(prompt, () => prompt.resolve(result))}
        onCancel={() => cancelPrompt(prompt)}
      />
    </LocaleProvider>
  );
}

function removeDialog() {
  document.getElementById(DIALOG_ROOT)?.remove();
  sendMessage({ type: CS_EVENTS.action_icon_unset_tab });
}

const SESSION_INFO = "__signify-session-info";
function removeSessionInfo() {
  document.getElementById(SESSION_INFO)?.remove();
}

function insertSessionInfo(isConnected: boolean, vendorData: any, data: any) {
  removeSessionInfo();
  const container = document.createElement("div");
  container.id = SESSION_INFO;
  document.body.appendChild(container);

  createRoot(container).render(
    <LocaleProvider>
      <SessionInfo
        isConnected={isConnected}
        vendorData={vendorData}
        data={data}
        handleRemove={removeSessionInfo}
      />
    </LocaleProvider>
  );
}

export function resetTabState() {
  removeDialog();
  setTabState(TAB_STATE.NONE);
}

// TODO: proper types for these params
function getFilteredSignins(signins: any, currentTabState: string, credentialSchema?: string) {
  const filteredSignins: any[] = [];
  if (!signins?.length) return [];

  signins.forEach((signin: any) => {
    if (
      signin.identifier &&
      (currentTabState === TAB_STATE.SELECT_IDENTIFIER ||
        currentTabState === TAB_STATE.SELECT_ID_CRED)
    ) {
      filteredSignins.push(signin);
    }
    if (
      signin.credential &&
      (currentTabState === TAB_STATE.SELECT_CREDENTIAL ||
        currentTabState === TAB_STATE.SELECT_ID_CRED)
    ) {
      // The credential's schema SAID is `sad.s` (KERIA's `schema` object carries it as `$id`).
      const schemaSaid = signin.credential.sad?.s ?? signin.credential.schema?.$id;
      if (!credentialSchema || schemaSaid === credentialSchema) {
        filteredSignins.push(signin);
      }
    }
  });
  return filteredSignins;
}

export function setTabState(state: string) {
  window.polaris_tab_state = state;
}

export function getTabState() {
  return window.polaris_tab_state;
}
