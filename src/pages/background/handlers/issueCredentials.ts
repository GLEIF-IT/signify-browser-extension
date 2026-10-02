import { IHandler } from "@config/types";
import { getDomainFromUrl } from "@shared/utils";
import {
  issueBatch,
  summarizeBatch,
  type IssueCredentialRequest,
} from "@pages/background/services/credential-issuance";
import { decide, getPendingSummary, requestApproval } from "@pages/background/services/issue-confirmation";
import { getIssuingContext } from "@pages/background/services/issue-context";
import { resetTimeoutAlarm } from "@pages/background/services/signify-connection";

interface IIssueCredentialsData {
  credentials?: IssueCredentialRequest[];
}

interface IIssueRequestData {
  id?: string;
}

interface IIssueDecisionData {
  id?: string;
  approved?: unknown;
}

/** Content-script message: validate, ask the user in an extension window, then issue the batch. */
export async function handleIssueCredentials({
  sendResponse,
  url,
  tabId,
  data,
}: IHandler<IIssueCredentialsData>) {
  if (!data?.credentials) {
    sendResponse({ error: { code: 400, message: "missing credentials", issued: [] } });
    return;
  }

  try {
    const { client, aidName } = await getIssuingContext({ origin: getDomainFromUrl(url!), tabId: tabId! });

    const summary = await summarizeBatch(client, aidName, data.credentials);
    const approved = await requestApproval(summary);
    if (!approved) {
      sendResponse({ error: { code: 403, message: "User rejected", issued: [] } });
      return;
    }

    const credentials = await issueBatch(client, aidName, data.credentials);
    resetTimeoutAlarm();
    sendResponse({ data: { credentials } });
  } catch (error: any) {
    sendResponse({
      error: { code: 503, message: error?.message, issued: error?.issued ?? [] },
    });
  }
}

/** Confirmation-page message: the summary to display for a pending request. */
export function handleGetIssueRequest({ sendResponse, data }: IHandler<IIssueRequestData>) {
  const summary = data?.id ? getPendingSummary(data.id) : null;
  if (!summary) {
    sendResponse({ error: { code: 404, message: "request expired" } });
    return;
  }
  sendResponse({ data: { summary } });
}

/** Confirmation-page message: Approve (approved === true) or anything else as Deny. */
export function handleIssueDecision({ sendResponse, data }: IHandler<IIssueDecisionData>) {
  const known = !!data?.id && decide(data.id, data.approved === true);
  sendResponse(known ? { data: { ok: true } } : { error: { code: 404, message: "request expired" } });
}
