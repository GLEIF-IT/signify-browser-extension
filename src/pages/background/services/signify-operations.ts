import * as signinResource from "@pages/background/resource/signin";
import {
  Saider,
  IssueCredentialResult,
  CredentialData,
} from "signify-ts";
import { sendMessageTab } from "@src/shared/browser/tabs-utils";
import { sessionService } from "@pages/background/services/session";
import { IIdentifier, ISignin, ISessionConfig } from "@config/types";
import {
  formatAsCredentialEdgeOrRuleObject,
  getSchemaFieldOfEdge,
  parseSchemaEdgeOrRuleSection,
  setNodeValueInEdge,
  waitOperation,
} from "@src/shared/signify-utils";
import {
  getClient,
  validateClient,
  resetTimeoutAlarm,
  isConnected,
} from "./signify-connection";

const listIdentifiers = async () => {
  validateClient();
  const client = getClient();
  let aids: IIdentifier[] = [];
  let start = 0;
  let total = 0;
  do {
    const res = await client?.identifiers().list(start);
    if (res.aids?.length === 0) {
      break;
    }

    aids.push(...res.aids);
    total = res.total;
    start = aids.length;
  } while (aids.length < total);
  return aids;
};

const listCredentials = async () => {
  validateClient();
  return await getClient()?.credentials().list();
};

// credential identifier => credential.sad.d
const getCredential = async (
  credentialIdentifier: string,
  includeCESR: boolean = false
) => {
  validateClient();
  return await getClient()?.credentials().get(credentialIdentifier, includeCESR);
};

/**
 * @param tabId - tabId of the tab from where the request is being made -- required
 * @param origin - origin url from where request is being made -- required
 * @param signin - signin object containing identifier or credential -- required
 * @param config - configuration object containing sessionTime and maxReq -- required
 * @returns Promise<Request> - returns a signed headers request object
 */
const authorizeSelectedSignin = async ({
  tabId,
  signin,
  origin,
  config,
}: {
  tabId: number;
  signin: ISignin;
  origin: string;
  config: ISessionConfig;
}): Promise<any> => {
  let aidName = signin.identifier
    ? signin.identifier?.name
    : signin.credential?.issueeName;
  let credentialResp;
  if (signin.credential) {
    credentialResp = { raw: signin.credential, cesr: null };
    const cesr = await getCredential(signin.credential?.sad?.d, true);
    credentialResp.cesr = cesr;
  }

  const response = {
    credential: credentialResp,
    identifier: signin?.identifier,
  };

  if (config?.sessionOneTime) {
    const sreq = await getClient()?.createSignedRequest(aidName!, origin, {});
    let jsonHeaders: { [key: string]: string } = {};
    if (sreq?.headers) {
      for (const pair of sreq.headers.entries()) {
        jsonHeaders[pair[0]] = pair[1];
      }
    }
    response.headers = jsonHeaders;
  } else {
    const sessionInfo = await sessionService.create({
      tabId,
      origin,
      aidName: aidName!,
      signinId: signin.id,
      config,
    });
    if (sessionInfo?.expiry) {
      response.expiry = sessionInfo.expiry;
    }

    await sendMessageTab(tabId, {
      type: "tab",
      subtype: "session-info",
      data: response,
    });
  }

  resetTimeoutAlarm();
  return response;
};

/**
 * @param tabId - tabId of the tab from where the request is being made -- required
 * @param origin - origin url from where request is being made -- required
 * @returns Promise<Request> - returns a signed headers request object
 */
const getSessionInfo = async ({
  tabId,
  origin,
}: {
  tabId: number;
  origin: string;
}): Promise<any> => {
  const session = await sessionService.get({ tabId, origin });
  if (!session) {
    return null;
  }
  const signin = await signinResource.getDomainSigninById(
    origin,
    session.signinId
  );
  let credentialResp;
  if (signin?.credential) {
    credentialResp = { raw: signin.credential, cesr: null };
    const cesr = await getCredential(signin.credential?.sad?.d, true);
    credentialResp.cesr = cesr;
  }
  const resp = {
    credential: credentialResp,
    identifier: signin?.identifier,
    expiry: session.expiry,
  };
  await sendMessageTab(tabId, {
    type: "tab",
    subtype: "session-info",
    data: resp,
  });

  resetTimeoutAlarm();
  return resp;
};

/**
 * @param tabId - tabId of the tab from where the request is being made -- required
 * @param origin - origin url from where request is being made -- required
 * @returns Promise<Request> - returns null
 */
const removeSessionInfo = async ({
  tabId,
  origin,
}: {
  tabId: number;
  origin: string;
}): Promise<any> => {
  await sessionService.remove(tabId);
  await sendMessageTab(tabId, {
    type: "tab",
    subtype: "session-info",
    data: null,
  });

  resetTimeoutAlarm();
};

/**
 * @param origin - origin url from where request is being made -- required
 * @param rurl - resource url that the request is being made to -- required
 * @param method - http method of the request -- default GET
 * @param headers - headers object of the request -- default empty
 * @param signin - signin object containing identifier or credential -- required
 * @returns Promise<Request> - returns a signed headers request object
 */
const getSignedHeaders = async ({
  origin,
  rurl,
  method = "GET",
  headers = new Headers({}),
  tabId,
}: {
  origin: string;
  rurl: string;
  method?: string;
  headers?: Headers;
  tabId: number;
}): Promise<any> => {
  // in case the client is not connected, try to connect
  const connected = await isConnected();
  // connected is false, it means the client session timed out or disconnected by user
  if (!connected) {
    validateClient();
  }

  const session = await sessionService.get({ tabId, origin });
  await sessionService.incrementRequestCount(tabId);
  if (!session) {
    throw new Error("Session not found");
  }
  const sreq = await getClient()?.createSignedRequest(session.aidName, rurl, {
    method,
    headers,
  });
  resetTimeoutAlarm();
  console.log("sreq", sreq);
  let jsonHeaders: { [key: string]: string } = {};
  if (sreq?.headers) {
    for (const pair of sreq.headers.entries()) {
      jsonHeaders[pair[0]] = pair[1];
    }
  }

  return {
    headers: jsonHeaders,
  };
};

/**
 * Create a data attestation credential, it is an untargeted ACDC credential i.e. there is no issuee.
 *
 * @param origin - origin url from where request is being made -- required
 * @param credData - credential data object containing the credential attributes -- required
 * @param schemaSaid - SAID of the schema -- required
 * @param signin - signin object containing identifier or credential -- required
 * @returns Promise<Request> - returns a signed headers request object
 */
const createAttestationCredential = async ({
  origin,
  credData,
  schemaSaid,
  tabId,
}: {
  origin: string;
  credData: any;
  schemaSaid: string;
  tabId: number;
}): Promise<any> => {
  // in case the client is not connected, try to connect
  const connected = await isConnected();
  // connected is false, it means the client session timed out or disconnected by user
  if (!connected) {
    validateClient();
  }

  const session = await sessionService.get({ tabId, origin });
  let { aid, registry, rules, edge } = await getCreateCredentialPrerequisites(
    session?.aidName!,
    schemaSaid
  );
  if (isGroupAid(aid) === true) {
    throw new Error(
      `Attestation credential issuance by multisig identifier ${session.aidName} is not supported yet!`
    );
  }

  let credArgs: CredentialData = {
    i: aid.prefix,
    ri: registry.regk,
    s: schemaSaid,
    a: credData,
    r: rules
      ? Object.keys(rules).length > 0
        ? Saider.saidify({ d: "", ...rules })[1]
        : undefined
      : undefined,
    e: edge
      ? Object.keys(edge).length > 0
        ? Saider.saidify({ d: "", ...edge })[1]
        : undefined
      : undefined,
  };
  console.log("create credential args: ", credArgs);
  let credResult = await createCredential(session.aidName, credArgs);
  const client = getClient();
  if (credResult && client) {
    await waitOperation(client, credResult.op);
  }

  return credResult;
};

const getCreateCredentialPrerequisites = async (
  aidName: string,
  schemaSaid: string
): Promise<{
  aid: any | undefined;
  schema: any;
  registry: any;
  rules: any;
  edge: any;
}> => {
  const client = getClient();
  const aid = await client?.identifiers().get(aidName);

  let registries = await client?.registries().list(aidName);
  if (registries == undefined || registries.length === 0) {
    throw new Error(`No credential registries found for the AID ${aidName}`);
  }

  let schema = await client?.schemas().get(schemaSaid);
  if (!schema || schema?.title == "404 Not Found") {
    throw new Error(`Schema not found!`);
  }

  const edgeObject = parseSchemaEdgeOrRuleSection(schema.properties?.e);
  let edge = formatAsCredentialEdgeOrRuleObject(edgeObject);
  let edgeSchema = getSchemaFieldOfEdge(edge);
  if (edge && edgeSchema) {
    let filter = { "-s": edgeSchema, "-a-i": aid?.prefix };
    let creds = await client
      ?.credentials()
      .list({ filter: filter, limit: 50 });
    if (creds && creds?.length > 0) {
      edge = setNodeValueInEdge(edge, creds[0]?.sad.d);
    }
  }

  let parsedRules = parseSchemaEdgeOrRuleSection(schema.properties?.r);
  let rules = formatAsCredentialEdgeOrRuleObject(parsedRules);

  return { aid, schema, registry: registries[0], rules, edge };
};

const createAID = async (name: string) => {
  validateClient();
  let res = await getClient()?.identifiers().create(name);
  return await res?.op();
};

const createCredential = async (
  name: string,
  args: CredentialData
): Promise<IssueCredentialResult | undefined> => {
  const result = await getClient()?.credentials().issue(name, args);
  return result;
};

const isGroupAid = (aid: any): boolean => {
  return (
    aid.hasOwnProperty("group") &&
    typeof aid.group === "object" &&
    aid.group !== null
  );
};

export const signifyOperationsService = {
  listIdentifiers,
  listCredentials,
  getCredential,
  createAID,
  getSignedHeaders,
  authorizeSelectedSignin,
  getSessionInfo,
  removeSessionInfo,
  createAttestationCredential,
};
