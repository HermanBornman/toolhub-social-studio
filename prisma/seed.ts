import { PrismaClient } from "@prisma/client";
import { MASCOT_MOODS } from "../lib/moods";

const prisma = new PrismaClient();

async function main() {
  await prisma.template.upsert({
    where: { version: "TOOLHUB_SOCIAL_MASTER_V1" },
    update: { active: true },
    create: {
      version: "TOOLHUB_SOCIAL_MASTER_V1",
      name: "Toolhub Social Master V1",
      description: "Locked 4:5 Toolhub product advert template",
    },
  });

  for (const mood of MASCOT_MOODS) {
    await prisma.mascotMood.upsert({
      where: { id: mood.id },
      update: mood,
      create: mood,
    });
  }
}

main()
  .finally(async () => prisma.$disconnect());