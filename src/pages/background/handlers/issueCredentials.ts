import { IHandler } from "@config/types";
import { decide, getPendingSummary } from "@pages/background/services/issue-confirmation";

// The issuance request itself (`/signify/credential/issue`) is served by handlers/protocol.ts.
// These handlers answer the extension-owned confirmation window.

interface IIssueRequestData {
  id?: string;
}

interface IIssueDecisionData {
  id?: string;
  approved?: unknown;
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
