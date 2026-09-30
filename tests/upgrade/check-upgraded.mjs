// Checks a database that the upgrade's database step (scripts/system/upgrade-db.sh) has been through, for
// test-upgrade-db.sh: every migration in prisma/migrations is recorded as applied, once, and with --with-data, what
// pre-migrations-data.sql put in before the upgrade is all still there.
import { readdirSync } from "node:fs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const problems = [];

const migrations = readdirSync("prisma/migrations", { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort();
const rows = await prisma.$queryRaw`SELECT migration_name, finished_at, rolled_back_at FROM _prisma_migrations`;
const applied = rows
  .filter((row) => row.finished_at !== null && row.rolled_back_at === null)
  .map((row) => row.migration_name)
  .sort();
if (applied.join() !== migrations.join()) {
  problems.push(`applied migrations are [${applied}], expected [${migrations}]`);
}
if (rows.length !== applied.length) problems.push(`${rows.length - applied.length} migration(s) failed or rolled back`);

if (process.argv.includes("--with-data")) {
  const session = await prisma.session.findUnique({
    where: { id: "0b8e1c5a-6d2f-4f3a-9c41-1a2b3c4d5e04" },
    include: { laps: { orderBy: { lapNumber: "asc" } }, penalties: true, driver: true, car: true, location: true },
  });
  if (!session) {
    problems.push("the session is gone");
  } else {
    const laps = session.laps.map((lap) => lap.lapTime).join();
    if (laps !== "1400,1600") problems.push(`the session's laps are [${laps}], expected [1400,1600]`);
    if (session.penalties.length !== 1) problems.push(`the session has ${session.penalties.length} penalties`);
    if (session.notes !== "Windy") problems.push(`the session's notes are ${JSON.stringify(session.notes)}`);
    if (session.driver.name !== "Upgrade Driver" || session.car.name !== "Upgrade Car") {
      problems.push("the session's driver or car changed");
    }
    if (session.car.defaultCarNumber !== 3) problems.push("the car lost its IR car number");
    if (session.location.name !== "Upgrade Track") problems.push("the session's location changed");
  }
  const settings = await prisma.motionSettings.findMany();
  if (settings.length !== 1 || settings[0].framesToSkip !== 30) problems.push("the motion settings changed");
}

await prisma.$disconnect();
if (problems.length > 0) {
  console.error(`   FAILED: ${problems.join("; ")}`);
  process.exit(1);
}
console.log(
  `   ok: ${applied.length} migrations recorded${process.argv.includes("--with-data") ? ", data intact" : ""}`,
);
