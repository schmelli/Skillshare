import { readFileSync } from "node:fs";
import path from "node:path";
import { getDMMF } from "@prisma/internals";
import { describe, expect, it } from "vitest";

// DEPL-03 structural guard: every tenant-scoped model must carry a non-nullable
// tenantId/workspaceId FK from the very first migration, so a later
// multi-tenant SaaS mode never needs a backfill/schema-redesign migration.
// Introspects the real Prisma DMMF (parsed from schema.prisma) rather than
// hand-asserting against the .prisma source text, so this test tracks the
// schema even as fields are reordered/renamed.

async function loadDatamodel() {
  const schemaPath = path.join(__dirname, "..", "prisma", "schema.prisma");
  const schema = readFileSync(schemaPath, "utf8");
  const dmmf = await getDMMF({ datamodel: schema });
  return dmmf.datamodel;
}

describe("schema-tenant-scoping (DEPL-03)", () => {
  it("Workspace has a required tenantId scalar field", async () => {
    const datamodel = await loadDatamodel();
    const workspace = datamodel.models.find((m) => m.name === "Workspace");
    expect(workspace, "Workspace model must exist").toBeDefined();

    const tenantId = workspace!.fields.find((f) => f.name === "tenantId");
    expect(tenantId, "Workspace.tenantId field must exist").toBeDefined();
    expect(tenantId!.kind).toBe("scalar");
    expect(tenantId!.type).toBe("String");
    expect(tenantId!.isRequired, "Workspace.tenantId must be NOT NULL").toBe(
      true,
    );
  });

  it("Workspace has a required relation to Tenant", async () => {
    const datamodel = await loadDatamodel();
    const workspace = datamodel.models.find((m) => m.name === "Workspace");
    const tenantRelation = workspace!.fields.find((f) => f.name === "tenant");

    expect(
      tenantRelation,
      "Workspace.tenant relation field must exist",
    ).toBeDefined();
    expect(tenantRelation!.kind).toBe("object");
    expect(tenantRelation!.type).toBe("Tenant");
    expect(
      tenantRelation!.isRequired,
      "Workspace -> Tenant relation must be required (non-optional FK)",
    ).toBe(true);
  });

  it("Membership has required userId and workspaceId fields", async () => {
    const datamodel = await loadDatamodel();
    const membership = datamodel.models.find((m) => m.name === "Membership");
    expect(membership, "Membership model must exist").toBeDefined();

    const userId = membership!.fields.find((f) => f.name === "userId");
    const workspaceId = membership!.fields.find(
      (f) => f.name === "workspaceId",
    );

    expect(userId, "Membership.userId field must exist").toBeDefined();
    expect(userId!.kind).toBe("scalar");
    expect(userId!.isRequired, "Membership.userId must be NOT NULL").toBe(
      true,
    );

    expect(
      workspaceId,
      "Membership.workspaceId field must exist",
    ).toBeDefined();
    expect(workspaceId!.kind).toBe("scalar");
    expect(
      workspaceId!.isRequired,
      "Membership.workspaceId must be NOT NULL",
    ).toBe(true);
  });

  it("Membership.@@unique([userId, workspaceId]) is present (one role per user per workspace)", async () => {
    const datamodel = await loadDatamodel();
    const membership = datamodel.models.find((m) => m.name === "Membership");
    const hasCompositeUnique = membership!.uniqueFields.some(
      (fields) =>
        fields.length === 2 &&
        fields.includes("userId") &&
        fields.includes("workspaceId"),
    );
    expect(hasCompositeUnique).toBe(true);
  });

  it("Every tenant-scoped model (Workspace, Membership) carries a tenantId or workspaceId FK", async () => {
    const datamodel = await loadDatamodel();
    const tenantScopedModelNames = ["Workspace", "Membership"];

    for (const name of tenantScopedModelNames) {
      const model = datamodel.models.find((m) => m.name === name);
      expect(model, `${name} model must exist`).toBeDefined();
      const hasScopingField = model!.fields.some(
        (f) =>
          f.kind === "scalar" &&
          (f.name === "tenantId" || f.name === "workspaceId") &&
          f.isRequired,
      );
      expect(
        hasScopingField,
        `${name} must carry a required tenantId or workspaceId field`,
      ).toBe(true);
    }
  });
});
