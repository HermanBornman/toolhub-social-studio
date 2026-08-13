const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();
const moods = [
  ["happy", "Happy", "/mascots/happy.png"],
  ["excited", "Excited", "/mascots/excited.png"],
  ["wow", "WOW", "/mascots/wow.png"],
  ["wink", "Wink", "/mascots/wink.png"],
  ["thumbs_up", "Thumbs Up", "/mascots/thumbs-up.png"],
  ["smile", "Smile", "/mascots/smile.png"],
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