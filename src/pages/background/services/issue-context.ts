import { sessionService } from "@pages/background/services/session";
import { getClient, isConnected, validateClient } from "./signify-connection";

/** The connected client and the AID name of this tab's authorized session (same checks as signData). */
export const getIssuingContext = async ({ origin, tabId }: { origin: string; tabId: number }) => {
  const connected = await isConnected();
  if (!connected) {
    validateClient();
  }

  const session = await sessionService.get({ tabId, origin });
  if (!session) {
    throw new Error("Session not found");
  }
  await sessionService.incrementRequestCount(tabId);

  const client = getClient();
  if (!client) {
    throw new Error("Not connected to KERIA");
  }
  return { client, aidName: session.aidName as string };
};
