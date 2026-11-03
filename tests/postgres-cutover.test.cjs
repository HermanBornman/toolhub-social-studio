const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");

test("production Prisma runtime uses PostgreSQL and a direct migration URL", () => {
  const schema = fs.readFileSync("prisma/schema.prisma", "utf8");
  const lock = fs.readFileSync("prisma/migrations/migration_lock.toml", "utf8");
  assert.match(schema, /provider\s*=\s*"postgresql"/);
  assert.match(schema, /directUrl\s*=\s*env\("DIRECT_URL"\)/);
  assert.match(lock, /provider\s*=\s*"postgresql"/);
  assert.equal(fs.existsSync("prisma/migrations/202611030001_postgresql_baseline/migration.sql"), true);
  assert.equal(fs.existsSync("prisma/migrations/202611030002_lock_down_data_api/migration.sql"), true);
});

test("SQLite remains isolated to the explicit regression schema", () => {
  const schema = fs.readFileSync("prisma/sqlite/schema.prisma", "utf8");
  const lock = fs.readFileSync("prisma/sqlite/migrations/migration_lock.toml", "utf8");
  assert.match(schema, /provider\s*=\s*"sqlite"/);
  assert.match(lock, /provider\s*=\s*"sqlite"/);
  assert.equal(fs.existsSync("prisma/sqlite/migrations/20260916_phase1_sms_otp/migration.sql"), true);
});

test("test and production scripts generate the correct Prisma client", () => {
  const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));
  assert.match(pkg.scripts.test, /prisma generate --schema prisma\/sqlite\/schema\.prisma/);
  assert.match(pkg.scripts.build, /^prisma generate && next build$/);
  assert.match(pkg.scripts.dev, /^prisma generate && next dev$/);
  assert.match(pkg.scripts["db:setup"], /prisma migrate deploy/);
  assert.doesNotMatch(pkg.scripts["db:setup"], /db push/);
});
