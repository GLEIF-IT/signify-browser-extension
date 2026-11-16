import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { Diger, MtrDex, SignifyClient, Tier, ready } from "signify-ts";
import { issueBatch } from "./credential-issuance";

// One-off capture of real vLEI chain fixtures for aav-signer's tests. Skipped unless the signer
// passcode and the output directory are set. The signer (holds an ECR with the role AAV Report Signer;
// issues the FAWs and the Dossier) and the submitter (holds an ECR with the role AAV Report Submitter)
// normally live in different agents, so two passcodes are used:
//   AAV_SMOKE_PASSCODE='<signer agent passcode>' \
//   AAV_SUBMITTER_PASSCODE='<submitter agent passcode>' \
//   AAV_CAPTURE_DIR=/home/aidar/Desktop/git/gleif/gleif-aav/aav-signer/tests/fixtures/chain \
//   npx vitest run src/pages/background/services/aav-fixture-capture.smoke.test.ts
// AAV_SUBMITTER_PASSCODE may be omitted when one agent holds both credentials. Optional:
// AAV_SMOKE_AGENT_URL / AAV_SUBMITTER_AGENT_URL (both default to http://localhost:3901),
// AAV_CAPTURE_SIGNER_ECR_SAID / AAV_CAPTURE_SUBMITTER_ECR_SAID to pick specific credentials.
// The signer's agent needs the FAW/Dossier schemas; both ECRs must carry the same LEI.
const PASSCODE = process.env.AAV_SMOKE_PASSCODE;
const SUBMITTER_PASSCODE = process.env.AAV_SUBMITTER_PASSCODE ?? PASSCODE;
const OUT_DIR = process.env.AAV_CAPTURE_DIR;
const AGENT_URL = process.env.AAV_SMOKE_AGENT_URL ?? "http://localhost:3901";
const SUBMITTER_AGENT_URL = process.env.AAV_SUBMITTER_AGENT_URL ?? AGENT_URL;

const FAW_SCHEMA = "EEOikJx0pQxDsXmqiUo-N8apjtJGFY3Kafegxfy4wZ_Q";
const DOSSIER_SCHEMA = "EEeTwn7-DU7rXa1zp17Sw5af0fbM9cbewqb2-XeDVbnj";
const ECR_SCHEMA = "EEy9PkikFcANV1l7EHukCeXqrzT1hNZjGlUk7wuMO5jw";
const QVI_SCHEMA = "EBfdlu8R27Fbx-ehrqwImnK-8Cm79sqbAQ4MmvEAYqao";
const SIGNER_ROLE = "AAV Report Signer";
const SUBMITTER_ROLE = "AAV Report Submitter";

const FILES = [
  { filename: "report.pdf", content_type: "application/pdf", content: "AAV fixture report one" },
  { filename: "annex.txt", content_type: "text/plain", content: "AAV fixture annex two" },
];

const digestOf = (text: string) =>
  new Diger({ code: MtrDex.Blake3_256 }, new TextEncoder().encode(text)).qb64;

async function ecrWithRole(client: SignifyClient, role: string, saidOverride?: string) {
  const list = await client.credentials().list({ filter: { "-s": ECR_SCHEMA }, limit: 50 });
  const found = list.find(
    (c: any) => c.sad.a.engagementContextRole === role && (!saidOverride || c.sad.d === saidOverride)
  );
  expect(found, `this agent must hold an ECR with the role ${role}`).toBeDefined();
  return found.sad;
}

async function rootOf(client: SignifyClient, said: string): Promise<string> {
  const credential = await client.credentials().get(said);
  const sad = credential.sad;
  if (sad.s === QVI_SCHEMA) return sad.i; // issued by the root (GLEIF)
  const edges = sad.e ?? {};
  const next = edges.auth ?? edges.le ?? edges.qvi;
  if (!next) throw new Error(`cannot walk the chain past ${said}: edges ${JSON.stringify(edges)}`);
  return rootOf(client, next.n);
}

describe.skipIf(!PASSCODE || !OUT_DIR)("capture aav-signer chain fixtures", () => {
  it(
    "exports the signer ECR, the submitter ECR and a Dossier with FAWs, plus a manifest",
    async () => {
      await ready();
      const client = new SignifyClient(AGENT_URL, PASSCODE!, Tier.low);
      await client.connect();
      // The submitter's agent: only used to find and export its ECR (the Dossier merely names it).
      const submitterClient = new SignifyClient(SUBMITTER_AGENT_URL, SUBMITTER_PASSCODE!, Tier.low);
      await submitterClient.connect();

      const signerEcr = await ecrWithRole(client, SIGNER_ROLE, process.env.AAV_CAPTURE_SIGNER_ECR_SAID);
      const submitterEcr = await ecrWithRole(
        submitterClient, SUBMITTER_ROLE, process.env.AAV_CAPTURE_SUBMITTER_ECR_SAID
      );
      expect(submitterEcr.a.LEI, "both ECRs must carry the same LEI").toBe(signerEcr.a.LEI);

      const identifiers = await client.identifiers().list();
      const signer = identifiers.aids.find((aid: any) => aid.prefix === signerEcr.a.i);
      expect(signer, "an identifier of this agent must be the signer ECR's issuee").toBeDefined();

      const faws = await issueBatch(
        client,
        signer.name,
        FILES.map((file) => ({
          schemaSaid: FAW_SCHEMA,
          registryName: "faw-reg",
          attributes: {
            content_digest: digestOf(file.content),
            content_type: file.content_type,
            filename: file.filename,
          },
        }))
      );
      const [dossier] = await issueBatch(client, signer.name, [
        {
          schemaSaid: DOSSIER_SCHEMA,
          registryName: "dossier-reg",
          attributes: {
            governance: "AAV-v1",
            metadata: {
              assembler: { name: signerEcr.a.personLegalName },
              submitter: { ecr: submitterEcr.d, schema: ECR_SCHEMA },
            },
          },
          edges: {
            signerAuthority: { n: signerEcr.d, s: ECR_SCHEMA, o: "I2I" },
            report0: { n: faws[0].said, s: FAW_SCHEMA },
            report1: { n: faws[1].said, s: FAW_SCHEMA },
          },
        },
      ]);

      const cesr = async (from: SignifyClient, said: string) =>
        String(await from.credentials().get(said, true));
      mkdirSync(OUT_DIR!, { recursive: true });
      writeFileSync(join(OUT_DIR!, "signer_ecr.cesr"), await cesr(client, signerEcr.d));
      writeFileSync(join(OUT_DIR!, "submitter_ecr.cesr"), await cesr(submitterClient, submitterEcr.d));
      writeFileSync(join(OUT_DIR!, "dossier.cesr"), await cesr(client, dossier.said));
      writeFileSync(
        join(OUT_DIR!, "manifest.json"),
        JSON.stringify(
          {
            le_lei: signerEcr.a.LEI,
            signer_aid: signerEcr.a.i,
            submitter_aid: submitterEcr.a.i,
            submitter_ecr_said: submitterEcr.d,
            signer_ecr_said: signerEcr.d,
            dossier_said: dossier.said,
            root_aid: await rootOf(client, signerEcr.d),
            files: FILES.map((file) => ({ ...file, digest: digestOf(file.content) })),
          },
          null,
          2
        )
      );
    },
    600_000
  );
});
