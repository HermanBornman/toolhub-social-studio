#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const net = require("node:net");
const { Client } = require("pg");

const TABLE_ORDER = [
  "Branch",
  "User",
  "Product",
  "MascotMood",
  "Template",
  "ApplicationSetting",
  "SocialChannel",
  "PlanningRule",
  "AIUsage",
  "AuthThrottle",
  "Advertisement",
  "AdvertisementAsset",
  "SocialPost",
  "SocialPostChannel",
  "PublishingAttempt",
  "AdvertisementCaption",
  "ContentPlan",
  "ContentPlanItem",
  "PdfImport",
  "PdfImportPage",
  "AuditLog",
  "AuthSession",
];

function fail(message) {
  throw new Error(message);
}

function quoteIdentifier(value) {
  return `"${String(value).replaceAll('"', '""')}"`;
}

function isLoopback(hostname) {
  return hostname === "localhost" || hostname === "::1" || net.isIP(hostname) === 4 && hostname.startsWith("127.");
}

function activeRows(table, rows, now) {
  if (table !== "AuthSession" && table !== "AuthThrottle") return rows;
  return rows.filter((row) => new Date(row.expiresAt).getTime() > now);
}

async function main() {
  const args = new Set(process.argv.slice(2));
  if (!args.has("--apply")) fail("Refusing to write without --apply");
  const snapshotPath = process.env.MIGRATION_SNAPSHOT;
  const connectionString = process.env.MIGRATION_DATABASE_URL;
  if (!snapshotPath || !connectionString) fail("MIGRATION_SNAPSHOT and MIGRATION_DATABASE_URL are required");

  const target = new URL(connectionString);
  if (target.protocol !== "postgresql:" && target.protocol !== "postgres:") fail("PostgreSQL URL required");
  if (!isLoopback(target.hostname) && !args.has("--allow-remote")) {
    fail("Remote targets require the separate --allow-remote authorization flag");
  }

  const snapshot = JSON.parse(fs.readFileSync(snapshotPath, "utf8"));
  if (snapshot.formatVersion !== 1) fail("Unsupported snapshot format");
  if (JSON.stringify(snapshot.tableOrder) !== JSON.stringify(TABLE_ORDER)) fail("Unexpected table order");
  if (Object.keys(snapshot.tables).sort().join("\n") !== [...TABLE_ORDER].sort().join("\n")) {
    fail("Unexpected snapshot table inventory");
  }

  const now = Date.now();
  const prepared = new Map();
  for (const table of TABLE_ORDER) {
    const data = snapshot.tables[table];
    if (!Array.isArray(data.columns) || !Array.isArray(data.rows)) fail(`Invalid snapshot table ${table}`);
    prepared.set(table, {
      columns: data.columns,
      rows: activeRows(table, data.rows, now),
    });
  }

  const client = new Client({ connectionString, application_name: "toolhub_migration_import" });
  await client.connect();
  try {
    await client.query("BEGIN");
    await client.query("SET LOCAL statement_timeout = '60s'");

    for (const table of TABLE_ORDER) {
      const countResult = await client.query(`SELECT COUNT(*)::int AS count FROM "public".${quoteIdentifier(table)}`);
      if (countResult.rows[0].count !== 0) fail(`Target table is not empty: ${table}`);
    }

    for (const table of TABLE_ORDER) {
      const { columns, rows } = prepared.get(table);
      if (rows.length === 0) continue;
      const quotedColumns = columns.map(quoteIdentifier).join(", ");
      const placeholders = columns.map((_, index) => `$${index + 1}`).join(", ");
      const sql = `INSERT INTO "public".${quoteIdentifier(table)} (${quotedColumns}) VALUES (${placeholders})`;
      for (const row of rows) {
        await client.query(sql, columns.map((column) => row[column]));
      }
    }

    let totalRows = 0;
    for (const table of TABLE_ORDER) {
      const expected = prepared.get(table).rows;
      const actualResult = await client.query(`SELECT * FROM "public".${quoteIdentifier(table)}`);
      const actualIds = actualResult.rows.map((row) => row.id).sort();
      const expectedIds = expected.map((row) => row.id).sort();
      if (actualResult.rowCount !== expected.length) fail(`Count mismatch for ${table}`);
      if (JSON.stringify(actualIds) !== JSON.stringify(expectedIds)) fail(`ID mismatch for ${table}`);
      totalRows += actualResult.rowCount;
    }

    const manager = await client.query(
      `SELECT u."id", u."mobileE164", u."role", u."active", u."authProvider",
              u."authProviderUserId", b."name" AS "branchName"
         FROM "public"."User" u
         JOIN "public"."Branch" b ON b."id" = u."branchId"
        WHERE u."name" = $1 AND u."mobileE164" = $2`,
      ["Toolhub Store Manager Test", "+27794902832"],
    );
    if (manager.rowCount !== 1) fail("Production Store Manager lookup failed");
    const user = manager.rows[0];
    if (
      user.role !== "STORE_MANAGER" || user.active !== true ||
      user.authProvider !== "supabase" || !user.authProviderUserId ||
      user.branchName !== "Toolhub Polokwane Crossing"
    ) fail("Production Store Manager authorization/linkage validation failed");

    const duplicate = await client.query(
      `SELECT COUNT(*)::int AS count FROM "public"."User" WHERE "mobileE164" = $1 AND "active" = true`,
      ["+27794902832"],
    );
    if (duplicate.rows[0].count !== 1) fail("Active mobile uniqueness validation failed");

    const invalidForeignKeys = await client.query(
      `SELECT COUNT(*)::int AS count
         FROM pg_constraint c
         JOIN pg_namespace n ON n.oid = c.connamespace
        WHERE n.nspname = 'public' AND c.contype = 'f' AND NOT c.convalidated`,
    );
    if (invalidForeignKeys.rows[0].count !== 0) fail("Unvalidated foreign keys remain");

    await client.query("COMMIT");
    console.log("IMPORT_COMMITTED=YES");
    console.log(`IMPORTED_ROWS=${totalRows}`);
    console.log("ALL_COUNTS_MATCH=YES");
    console.log("ALL_ID_SETS_MATCH=YES");
    console.log("FOREIGN_KEYS_VALID=YES");
    console.log("STORE_MANAGER_AUTH_LINK_VALID=YES");
    console.log("ACTIVE_MOBILE_DUPLICATE=NO");
  } catch (error) {
    try { await client.query("ROLLBACK"); } catch {}
    throw error;
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(`MIGRATION_IMPORT_FAILED=${error.code || error.message || "UNKNOWN"}`);
  process.exitCode = 1;
});
