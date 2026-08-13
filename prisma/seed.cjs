const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();
const moods = [
  ["happy", "Happy", "/mascots/happy.svg"],
  ["excited", "Excited", "/mascots/excited.svg"],
  ["wow", "WOW", "/mascots/wow.svg"],
  ["wink", "Wink", "/mascots/wink.svg"],
  ["thumbs_up", "Thumbs Up", "/mascots/thumbs-up.svg"],
  ["smile", "Smile", "/mascots/smile.svg"],
];

async function main() {
  await prisma.template.upsert({
    where: { version: "TOOLHUB_SOCIAL_MASTER_V1" },
    update: { active: true },
    create: { version: "TOOLHUB_SOCIAL_MASTER_V1", name: "Toolhub Social Master V1", description: "Locked 4:5 Toolhub product advert template" },
  });
  for (const [id, displayName, assetPath] of moods) {
    const data = { id, displayName, assetPath, thumbnailPath: assetPath, active: true, defaultScale: 1, xPosition: 0, yPosition: 0 };
    await prisma.mascotMood.upsert({ where: { id }, update: data, create: data });
  }
}

main().finally(() => prisma.$disconnect());

