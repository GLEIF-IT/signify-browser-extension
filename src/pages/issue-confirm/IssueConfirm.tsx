import { useEffect, useState } from "react";
import { CONFIRM_EVENTS } from "@config/event-types";
import { sendMessage } from "@src/shared/browser/runtime-utils";
import type { IssueSummary } from "@pages/background/services/credential-issuance";

const requestId = new URLSearchParams(window.location.search).get("id") ?? "";

export function IssueConfirm() {
  const [summary, setSummary] = useState<IssueSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    sendMessage<{ id: string }>({ type: CONFIRM_EVENTS.issue_get_request, data: { id: requestId } })
      .then((response) => {
        if (response?.error) setError(response.error.message ?? "request expired");
        else setSummary(response?.data?.summary ?? null);
      })
      .catch(() => setError("request expired"));
  }, []);

  const decide = async (approved: boolean) => {
    setBusy(true);
    try {
      await sendMessage<{ id: string; approved: boolean }>({
        type: CONFIRM_EVENTS.issue_decision,
        data: { id: requestId, approved },
      });
    } finally {
      window.close();
    }
  };

  if (error) {
    return (
      <main className="confirm">
        <h1>Request expired</h1>
        <p>This confirmation is no longer valid. Close this window and try again from the app.</p>
        <button onClick={() => window.close()}>Close</button>
      </main>
    );
  }
  if (!summary) return <main className="confirm"><p>Loading…</p></main>;

  const count = summary.credentials.length;
  return (
    <main className="confirm">
      <h1>Issue {count} credential{count === 1 ? "" : "s"}?</h1>
      <p className="issuer">
        A web page is asking to issue {count === 1 ? "this credential" : "these credentials"} from your
        identifier <strong>{summary.issuer.name}</strong> <code>{summary.issuer.prefix}</code>. Issued
        credentials are anchored to your key event log and cannot be silently undone.
      </p>
      {summary.credentials.map((credential, index) => (
        <section key={index} className="credential">
          <h2>
            {credential.schemaTitle} <code>{credential.schemaSaid}</code>
          </h2>
          <p>Registry: <strong>{credential.registryName}</strong></p>
          <h3>Attributes</h3>
          <pre>{JSON.stringify(credential.attributes, null, 2)}</pre>
          {credential.edges && (
            <>
              <h3>Edges</h3>
              <pre>{JSON.stringify(credential.edges, null, 2)}</pre>
            </>
          )}
        </section>
      ))}
      <div className="actions">
        <button className="deny" disabled={busy} onClick={() => decide(false)}>Deny</button>
        <button className="approve" disabled={busy} onClick={() => decide(true)}>Approve</button>
      </div>
    </main>
  );
}
