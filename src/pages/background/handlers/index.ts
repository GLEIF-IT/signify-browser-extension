import { IHandler } from "@src/config/types";
import { CS_EVENTS, UI_EVENTS, EXTERNAL_EVENTS, CONFIRM_EVENTS } from "@config/event-types";
import {
  handleSetActionIcon,
  handleUnsetActionIcon,
  handleSetTabActionIcon,
  handleUnsetTabActionIcon,
} from "./actionIcon";
import {
  handleCreateIdentifier,
  handleCreateSignin,
  handleDeleteSignin,
  handleFetchAutoSigninSignature,
  handleFetchCredentials,
  handleFetchIdentifiers,
  handleFetchSignins,
  handleFetchTabSignin,
  handleUpdateAutoSignin,
} from "./resource";
import { handleGetIssueRequest, handleIssueDecision } from "./issueCredentials";
import { handleGetVendorData } from "./vendorInfo";
import {
  handleBootConnectAgent,
  handleCheckAgentConnection,
  handleConnectAgent,
  handleDisconnectAgent,
  handleGeneratePasscode,
  handleGetAuthData,
  handleClearSession,
} from "./authentication";

export function initUIHandler() {
  const handler = new Map<string, (res: IHandler) => void>();
  handler.set(UI_EVENTS.action_icon_unset, handleUnsetActionIcon);

  handler.set(
    UI_EVENTS.authentication_check_agent_connection,
    handleCheckAgentConnection
  );
  handler.set(UI_EVENTS.authentication_disconnect_agent, handleDisconnectAgent);
  handler.set(UI_EVENTS.authentication_connect_agent, handleConnectAgent);
  handler.set(
    UI_EVENTS.authentication_boot_connect_agent,
    handleBootConnectAgent
  );
  handler.set(
    UI_EVENTS.authentication_generate_passcode,
    handleGeneratePasscode
  );

  handler.set(UI_EVENTS.create_resource_signin, handleCreateSignin);
  handler.set(UI_EVENTS.create_resource_identifier, handleCreateIdentifier);

  handler.set(UI_EVENTS.fetch_resource_identifiers, handleFetchIdentifiers);
  handler.set(UI_EVENTS.fetch_resource_signins, handleFetchSignins);
  handler.set(UI_EVENTS.fetch_resource_credentials, handleFetchCredentials);

  handler.set(UI_EVENTS.update_resource_auto_signin, handleUpdateAutoSignin);
  handler.set(UI_EVENTS.delete_resource_signins, handleDeleteSignin);

  return handler;
}

/** Internal content-script events (dialog, overlays). Page protocol requests go through handlers/protocol.ts. */
export function initCSHandler() {
  const handler = new Map<string, (res: IHandler) => void>();
  handler.set(CS_EVENTS.action_icon_set, handleSetActionIcon);
  handler.set(CS_EVENTS.action_icon_unset, handleUnsetActionIcon);
  handler.set(CS_EVENTS.action_icon_set_tab, handleSetTabActionIcon);
  handler.set(CS_EVENTS.action_icon_unset_tab, handleUnsetTabActionIcon);
  handler.set(
    CS_EVENTS.fetch_resource_auto_signin_signature,
    handleFetchAutoSigninSignature
  );
  handler.set(CS_EVENTS.fetch_resource_tab_signin, handleFetchTabSignin);

  handler.set(CS_EVENTS.vendor_info_get_vendor_data, handleGetVendorData);

  handler.set(
    CS_EVENTS.authentication_check_agent_connection,
    handleCheckAgentConnection
  );
  handler.set(
    CS_EVENTS.authentication_get_auth_data,
    handleGetAuthData
  );
  handler.set(
    CS_EVENTS.authentication_clear_session,
    handleClearSession
  );

  return handler;
}

export function initIssueConfirmHandler() {
  const handler = new Map<string, (res: IHandler) => void>();
  handler.set(CONFIRM_EVENTS.issue_get_request, handleGetIssueRequest);
  handler.set(CONFIRM_EVENTS.issue_decision, handleIssueDecision);
  return handler;
}

export function initExternalHandler() {
  const handler = new Map<string, (res: IHandler) => void>();
  // handler.set("action-icon", handleActionIcon);
  // handler.set("vendor-info", handleVendorInfo);

  return handler;
  // const processor = messageProcessors.get(message.type);
  // if (processor) {
  //   processor(message, sender, sendResponse);
  // }
}
