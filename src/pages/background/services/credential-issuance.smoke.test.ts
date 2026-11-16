import { describe, expect, it } from "vitest";
import { Diger, MtrDex, SignifyClient, Tier, ready } from "signify-ts";
import { waitOperation } from "@src/shared/signify-utils";
import { issueBatch } from "./credential-issuance";

// Real-agent check, skipped unless AAV_SMOKE_PASSCODE is set (the extension agent's passcode).
//   AAV_SMOKE_PASSCODE='<passcode>' npx vitest run src/pages/background/services/credential-issuance.smoke.test.ts
// Optional: AAV_SMOKE_AGENT_URL (default http://localhost:3901), AAV_SMOKE_SCHEMA_HOST (default
// http://vlei-server:7723 -- the Docker-network name KERIA itself uses to fetch schemas).
const PASSCODE = process.env.AAV_SMOKE_PASSCODE;
const AGENT_URL = process.env.AAV_SMOKE_AGENT_URL ?? "http://localhost:3901";
const SCHEMA_HOST = process.env.AAV_SMOKE_SCHEMA_HOST ?? "http://vlei-server:7723";

const FAW_SCHEMA = "EEOikJx0pQxDsXmqiUo-N8apjtJGFY3Kafegxfy4wZ_Q";
const DOSSIER_SCHEMA = "EEeTwn7-DU7rXa1zp17Sw5af0fbM9cbewqb2-XeDVbnj";
const ECR_SCHEMA = "EEy9PkikFcANV1l7EHukCeXqrzT1hNZjGlUk7wuMO5jw";
const SIGNER_ROLE = "AAV Report Signer";

const digestOf = (text: string) =>
  new Diger({ code: MtrDex.Blake3_256 }, new TextEncoder().encode(text)).qb64;

describe.skipIf(!PASSCODE)("credential issuance against a real KERIA", () => {
  it(
    "issues FAWs in faw-reg, then a Dossier in dossier-reg with an I2I edge to the signer's ECR",
    async () => {
      await ready();
      const client = new SignifyClient(AGENT_URL, PASSCODE!, Tier.low);
      await client.connect();

      // Make sure this agent knows the schemas (the extension itself never resolves them).
      for (const [alias, said] of [["faw", FAW_SCHEMA], ["dossier", DOSSIER_SCHEMA]] as const) {
        const op = await client.oobis().resolve(`${SCHEMA_HOST}/oobi/${said}`, alias);
        await waitOperation(client, op, 60, 500);
        expect((await client.schemas().get(said)).$id).toBe(said);
      }

      // The signer's identifier is the ECR's issuee (that's what makes the Dossier edge I2I-valid).
      const ecrs = await client.credentials().list({ filter: { "-s": ECR_SCHEMA }, limit: 50 });
      const signerEcr = ecrs.find((c: any) => c.sad.a.engagementContextRole === SIGNER_ROLE);
      expect(signerEcr, `this agent must hold an ECR with the role ${SIGNER_ROLE}`).toBeDefined();
      const ecr = signerEcr.sad;
      const identifiers = await client.identifiers().list();
      const signer = identifiers.aids.find((aid: any) => aid.prefix === ecr.a.i);
      expect(signer, "an identifier of this agent must be the ECR's issuee").toBeDefined();

      const faws = await issueBatch(
        client,
        signer.name,
        ["a.pdf", "b.pdf"].map((filename) => ({
          schemaSaid: FAW_SCHEMA,
          registryName: "faw-reg",
          attributes: {
            content_digest: digestOf(`smoke ${filename} ${Date.now()}`),
            content_type: "application/pdf",
            filename,
          },
        }))
      );
      expect(faws).toHaveLength(2);

      const [dossier] = await issueBatch(client, signer.name, [
        {
          schemaSaid: DOSSIER_SCHEMA,
          registryName: "dossier-reg",
          attributes: {
            governance: "AAV-v1",
            metadata: {
              assembler: { name: ecr.a.personLegalName },
              submitter: { ecr: digestOf("smoke ecr stand-in"), schema: ECR_SCHEMA },
            },
          },
          edges: {
            signerAuthority: { n: ecr.d, s: ECR_SCHEMA, o: "I2I" },
            report0: { n: faws[0].said, s: FAW_SCHEMA },
            report1: { n: faws[1].said, s: FAW_SCHEMA },
          },
        },
      ]);

      expect(dossier.issuer).toBe(signer.prefix);
      const cesr = await client.credentials().get(dossier.said, true);
      expect(String(cesr)).toContain(DOSSIER_SCHEMA);
    },
    600_000
  );
});
