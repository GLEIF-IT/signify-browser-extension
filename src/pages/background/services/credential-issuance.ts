import { Saider, type CredentialData, type SignifyClient } from "signify-ts";
import { waitOperation } from "@src/shared/signify-utils";

export interface IssueCredentialRequest {
  schemaSaid: string;
  registryName: string;
  attributes: Record<string, unknown>;
  edges?: Record<string, unknown>;
  rules?: Record<string, unknown>;
}

export interface IssuedCredential {
  said: string;
  schemaSaid: string;
  registryName: string;
  issuer: string;
  issuedAt: string | null;
}

export interface IssueSummary {
  issuer: { name: string; prefix: string };
  credentials: {
    schemaSaid: string;
    schemaTitle: string;
    registryName: string;
    attributes: Record<string, unknown>;
    edges?: Record<string, unknown>;
  }[];
}

export interface IssueOptions {
  /** Operation polling retries per operation (default 60). */
  maxRetries?: number;
  /** Delay between polls in ms (default 1000). */
  delayMs?: number;
}

/** Thrown by issueBatch/summarizeBatch; `issued` lists credentials already anchored before the failure. */
export class IssuanceError extends Error {
  readonly issued: IssuedCredential[];
  constructor(message: string, issued: IssuedCredential[] = []) {
    super(message);
    this.name = "IssuanceError";
    this.issued = issued;
  }
}

const DEFAULT_MAX_RETRIES = 60;
const DEFAULT_DELAY_MS = 1000;

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const hasEntries = (value: unknown): value is Record<string, unknown> =>
  isPlainObject(value) && Object.keys(value).length > 0;

const messageOf = (error: unknown): string => (error instanceof Error ? error.message : String(error));

function validateRequests(requests: IssueCredentialRequest[]): void {
  if (!Array.isArray(requests) || requests.length === 0) {
    throw new Error("Provide at least one credential to issue");
  }
  requests.forEach((request, index) => {
    const where = `credentials[${index}]`;
    if (!request || typeof request.schemaSaid !== "string" || request.schemaSaid === "") {
      throw new Error(`${where}.schemaSaid is required`);
    }
    if (typeof request.registryName !== "string" || request.registryName === "") {
      throw new Error(`${where}.registryName is required`);
    }
    if (!isPlainObject(request.attributes)) {
      throw new Error(`${where}.attributes must be an object`);
    }
    if ("d" in request.attributes || "i" in request.attributes) {
      throw new Error(`${where}.attributes must not contain "d" or "i" (the SAID is computed; issuee-bearing credentials are not supported)`);
    }
    if (request.edges !== undefined && !isPlainObject(request.edges)) {
      throw new Error(`${where}.edges must be an object`);
    }
    if (request.rules !== undefined && !isPlainObject(request.rules)) {
      throw new Error(`${where}.rules must be an object`);
    }
  });
}

const isGroupAid = (aid: any): boolean =>
  aid?.hasOwnProperty("group") && typeof aid.group === "object" && aid.group !== null;

async function loadIssuer(client: SignifyClient, aidName: string) {
  const aid = await client.identifiers().get(aidName);
  if (isGroupAid(aid)) {
    throw new Error(`Credential issuance by multisig identifier ${aidName} is not supported yet!`);
  }
  return aid;
}

async function requireSchema(client: SignifyClient, schemaSaid: string) {
  let schema: any;
  try {
    schema = await client.schemas().get(schemaSaid);
  } catch {
    schema = null;
  }
  if (!schema || schema.title === "404 Not Found") {
    throw new Error(`Schema ${schemaSaid} not found — it must be resolved by KERIA first`);
  }
  return schema;
}

async function ensureRegistry(
  client: SignifyClient,
  aidName: string,
  registryName: string,
  options: IssueOptions
) {
  const find = async () => {
    const registries: any[] = (await client.registries().list(aidName)) ?? [];
    return registries.find((registry) => registry.name === registryName);
  };

  const existing = await find();
  if (existing) return existing;

  const created = await client.registries().create({ name: aidName, registryName, noBackers: true });
  const op = await created.op();
  const done = await waitOperation(client, op, options.maxRetries ?? DEFAULT_MAX_RETRIES, options.delayMs ?? DEFAULT_DELAY_MS);
  if ((done as any).error) {
    throw new Error(`Creating registry ${registryName} failed: ${(done as any).error.message ?? "unknown error"}`);
  }

  const registry = await find();
  if (!registry) throw new Error(`Registry ${registryName} was not found after it was created`);
  return registry;
}

/**
 * Issues each credential under `aidName`, strictly sequentially (each issuance anchors an interaction
 * event at sn+1 of the AID's KEL, so concurrent issuances would collide). Stops at the first failure and
 * throws an IssuanceError carrying the credentials already anchored.
 */
export async function issueBatch(
  client: SignifyClient,
  aidName: string,
  requests: IssueCredentialRequest[],
  options: IssueOptions = {}
): Promise<IssuedCredential[]> {
  const issued: IssuedCredential[] = [];
  try {
    validateRequests(requests);
    const aid = await loadIssuer(client, aidName);

    for (const request of requests) {
      const registry = await ensureRegistry(client, aidName, request.registryName, options);
      await requireSchema(client, request.schemaSaid);

      const args: CredentialData = {
        i: aid.prefix,
        ri: registry.regk,
        s: request.schemaSaid,
        a: request.attributes as CredentialData["a"],
        e: hasEntries(request.edges) ? Saider.saidify({ d: "", ...request.edges })[1] : undefined,
        r: hasEntries(request.rules) ? Saider.saidify({ d: "", ...request.rules })[1] : undefined,
      };

      const result = await client.credentials().issue(aidName, args);
      const done = await waitOperation(
        client,
        result.op,
        options.maxRetries ?? DEFAULT_MAX_RETRIES,
        options.delayMs ?? DEFAULT_DELAY_MS
      );
      if ((done as any).error) {
        throw new Error((done as any).error.message ?? `Issuing ${request.schemaSaid} failed`);
      }

      const sad: any = result.acdc.ked; // signify-ts 0.3.0-rc1 Serder exposes .ked (not .sad)
      issued.push({
        said: sad.d,
        schemaSaid: request.schemaSaid,
        registryName: request.registryName,
        issuer: aid.prefix,
        issuedAt: sad.a?.dt ?? null,
      });
    }
  } catch (error) {
    throw new IssuanceError(messageOf(error), issued);
  }
  return issued;
}

/** Validates a batch and describes it for the confirmation window. Creates and issues nothing. */
export async function summarizeBatch(
  client: SignifyClient,
  aidName: string,
  requests: IssueCredentialRequest[]
): Promise<IssueSummary> {
  try {
    validateRequests(requests);
    const aid = await loadIssuer(client, aidName);

    const credentials: IssueSummary["credentials"] = [];
    for (const request of requests) {
      const schema = await requireSchema(client, request.schemaSaid);
      credentials.push({
        schemaSaid: request.schemaSaid,
        schemaTitle: schema.title ?? request.schemaSaid,
        registryName: request.registryName,
        attributes: request.attributes,
        edges: hasEntries(request.edges) ? request.edges : undefined,
      });
    }
    return { issuer: { name: aidName, prefix: aid.prefix }, credentials };
  } catch (error) {
    throw new IssuanceError(messageOf(error), []);
  }
}
