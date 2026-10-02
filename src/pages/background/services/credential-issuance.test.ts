import { describe, expect, it } from "vitest";
import type { SignifyClient } from "signify-ts";
import {
  IssuanceError,
  issueBatch,
  summarizeBatch,
  type IssueCredentialRequest,
} from "./credential-issuance";

const FAST = { maxRetries: 3, delayMs: 0 };

interface Registry {
  name: string;
  regk: string;
}

function fakeClient(
  opts: { registries?: Registry[]; aid?: object; failOnIssue?: number; knownSchemas?: string[] } = {}
) {
  const events: string[] = [];
  const registries: Registry[] = [...(opts.registries ?? [])];
  const issueArgs: any[] = [];
  const known = opts.knownSchemas ?? ["SFAW", "SDOSSIER"];
  let issueCount = 0;

  const client = {
    identifiers: () => ({
      get: async (name: string) => opts.aid ?? { name, prefix: "EAID" },
    }),
    registries: () => ({
      list: async () => registries,
      create: async ({ registryName }: { registryName: string }) => {
        events.push(`create:${registryName}`);
        registries.push({ name: registryName, regk: `E-${registryName}` });
        return { op: async () => ({ name: `regop-${registryName}`, done: false }) };
      },
    }),
    schemas: () => ({
      get: async (said: string) =>
        known.includes(said) ? { $id: said, title: `Title of ${said}` } : { title: "404 Not Found" },
    }),
    credentials: () => ({
      issue: async (_name: string, args: any) => {
        issueCount += 1;
        const n = issueCount;
        events.push(`issue-start:${n}`);
        issueArgs.push(args);
        if (opts.failOnIssue === n) throw new Error(`KERIA rejected credential ${n}`);
        await new Promise((resolve) => setTimeout(resolve, 2));
        events.push(`issue-end:${n}`);
        return {
          acdc: { ked: { d: `ECRED${n}`, a: { dt: `2026-10-01T00:00:0${n}+00:00` } } },
          op: { name: `op-${n}`, done: false },
        };
      },
    }),
    operations: () => ({ get: async (name: string) => ({ name, done: true }) }),
  } as unknown as SignifyClient;

  return { client, events, issueArgs, registries };
}

const faw = (overrides: Partial<IssueCredentialRequest> = {}): IssueCredentialRequest => ({
  schemaSaid: "SFAW",
  registryName: "faw-reg",
  attributes: { content_digest: "EDIGEST", content_type: "application/pdf", filename: "a.pdf" },
  ...overrides,
});

describe("issueBatch", () => {
  it("issues in the registry found by name, not just the first one", async () => {
    const { client, issueArgs } = fakeClient({
      registries: [
        { name: "other", regk: "EOTHER" },
        { name: "faw-reg", regk: "EFAWREG" },
      ],
    });

    const issued = await issueBatch(client, "signer", [faw()], FAST);

    expect(issueArgs[0]).toMatchObject({ i: "EAID", ri: "EFAWREG", s: "SFAW" });
    expect(issueArgs[0].a).toEqual(faw().attributes);
    expect(issued).toEqual([
      {
        said: "ECRED1",
        schemaSaid: "SFAW",
        registryName: "faw-reg",
        issuer: "EAID",
        issuedAt: "2026-10-01T00:00:01+00:00",
      },
    ]);
  });

  it("creates the named registry (no backers) when the AID doesn't have it", async () => {
    const { client, events, issueArgs } = fakeClient({ registries: [{ name: "other", regk: "EOTHER" }] });

    await issueBatch(client, "signer", [faw({ registryName: "dossier-reg", schemaSaid: "SDOSSIER" })], FAST);

    expect(events[0]).toBe("create:dossier-reg");
    expect(issueArgs[0].ri).toBe("E-dossier-reg");
  });

  it("issues strictly one at a time, in request order", async () => {
    const { client, events } = fakeClient({ registries: [{ name: "faw-reg", regk: "EFAWREG" }] });

    const issued = await issueBatch(client, "signer", [faw(), faw(), faw()], FAST);

    expect(events).toEqual([
      "issue-start:1", "issue-end:1", "issue-start:2", "issue-end:2", "issue-start:3", "issue-end:3",
    ]);
    expect(issued.map((c) => c.said)).toEqual(["ECRED1", "ECRED2", "ECRED3"]);
  });

  it("saidifies edges and rules, and omits them when absent or empty", async () => {
    const { client, issueArgs } = fakeClient({ registries: [{ name: "dossier-reg", regk: "EDOSS" }] });
    const edges = {
      signerAuthority: { n: "EOOR", s: "SOOR", o: "I2I" },
      report: { n: "EFAW1", s: "SFAW" },
    };

    await issueBatch(
      client,
      "signer",
      [
        faw({ schemaSaid: "SDOSSIER", registryName: "dossier-reg", edges, rules: { usageDisclaimer: { l: "x" } } }),
        faw({ schemaSaid: "SDOSSIER", registryName: "dossier-reg", edges: {}, rules: {} }),
        faw({ schemaSaid: "SDOSSIER", registryName: "dossier-reg" }),
      ],
      FAST
    );

    expect(Object.keys(issueArgs[0].e)[0]).toBe("d");
    expect(issueArgs[0].e.d).toMatch(/^E[A-Za-z0-9_-]{43}$/);
    expect(issueArgs[0].e.signerAuthority).toEqual(edges.signerAuthority);
    expect(issueArgs[0].e.report).toEqual(edges.report);
    expect(issueArgs[0].r.d).toMatch(/^E[A-Za-z0-9_-]{43}$/);
    expect(issueArgs[1].e).toBeUndefined();
    expect(issueArgs[1].r).toBeUndefined();
    expect(issueArgs[2].e).toBeUndefined();
  });

  it("fails with a clear message when KERIA doesn't know the schema", async () => {
    const { client, issueArgs } = fakeClient({ registries: [{ name: "faw-reg", regk: "EFAWREG" }] });

    const error = await issueBatch(client, "signer", [faw({ schemaSaid: "SUNKNOWN" })], FAST).catch((e) => e);

    expect(error).toBeInstanceOf(IssuanceError);
    expect(error.message).toContain("must be resolved by KERIA first");
    expect(error.issued).toEqual([]);
    expect(issueArgs).toHaveLength(0);
  });

  it("stops at the first failure and reports what was already issued", async () => {
    const { client, issueArgs } = fakeClient({
      registries: [{ name: "faw-reg", regk: "EFAWREG" }],
      failOnIssue: 2,
    });

    const error = await issueBatch(client, "signer", [faw(), faw(), faw()], FAST).catch((e) => e);

    expect(error).toBeInstanceOf(IssuanceError);
    expect(error.message).toBe("KERIA rejected credential 2");
    expect(error.issued.map((c: { said: string }) => c.said)).toEqual(["ECRED1"]);
    expect(issueArgs).toHaveLength(2); // the third was never attempted
  });

  it("rejects group (multisig) identifiers", async () => {
    const { client } = fakeClient({ aid: { name: "signer", prefix: "EGRP", group: { mhab: {} } } });
    const error = await issueBatch(client, "signer", [faw()], FAST).catch((e) => e);
    expect(error).toBeInstanceOf(IssuanceError);
    expect(error.message).toContain("multisig");
  });

  it.each([
    ["an empty batch", [], "at least one credential"],
    ["a missing registryName", [faw({ registryName: "" })], "registryName"],
    ["a missing schemaSaid", [faw({ schemaSaid: "" })], "schemaSaid"],
    ["attributes carrying an issuee", [faw({ attributes: { i: "EOTHER" } })], "must not contain"],
    ["attributes carrying a SAID", [faw({ attributes: { d: "EX" } })], "must not contain"],
    ["non-object attributes", [faw({ attributes: [] as unknown as Record<string, unknown> })], "attributes"],
  ])("rejects %s before issuing anything", async (_label, requests, expected) => {
    const { client, issueArgs } = fakeClient({ registries: [{ name: "faw-reg", regk: "EFAWREG" }] });
    const error = await issueBatch(client, "signer", requests as IssueCredentialRequest[], FAST).catch((e) => e);
    expect(error).toBeInstanceOf(IssuanceError);
    expect(error.message).toContain(expected);
    expect(error.issued).toEqual([]);
    expect(issueArgs).toHaveLength(0);
  });
});

describe("summarizeBatch", () => {
  it("describes the batch for the confirmation window without issuing anything", async () => {
    const { client, issueArgs, events } = fakeClient();
    const edges = { signerAuthority: { n: "EOOR", s: "SOOR", o: "I2I" } };

    const summary = await summarizeBatch(client, "signer", [
      faw({ schemaSaid: "SDOSSIER", registryName: "dossier-reg", edges }),
    ]);

    expect(summary).toEqual({
      issuer: { name: "signer", prefix: "EAID" },
      credentials: [
        {
          schemaSaid: "SDOSSIER",
          schemaTitle: "Title of SDOSSIER",
          registryName: "dossier-reg",
          attributes: faw().attributes,
          edges,
        },
      ],
    });
    expect(issueArgs).toHaveLength(0);
    expect(events).toEqual([]); // no registry created while merely summarizing
  });

  it("fails before any prompt when a schema is unknown", async () => {
    const { client } = fakeClient();
    const error = await summarizeBatch(client, "signer", [faw({ schemaSaid: "SUNKNOWN" })]).catch((e) => e);
    expect(error).toBeInstanceOf(IssuanceError);
    expect(error.message).toContain("must be resolved by KERIA first");
  });
});
