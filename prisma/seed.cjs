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
const users = [
  ["dev-staff-1", "Toolhub Staff", "STAFF"],
  ["dev-marketing-1", "Toolhub Marketing", "MARKETING"],
  ["dev-manager-1", "Toolhub Manager", "MANAGER"],
  ["dev-admin-1", "Toolhub Admin", "ADMIN"],
];

async function main() {
  await prisma.template.upsert({
    where: { version: "TOOLHUB_SOCIAL_MASTER_V1" },
    update: { active: true },
    create: { version: "TOOLHUB_SOCIAL_MASTER_V1", name: "Toolhub Social Master V1", description: "Locked 4:5 Toolhub product advert template" },
  });
  for (const [id, name, role] of users) {
    await prisma.user.upsert({ where: { id }, update: { name, role }, create: { id, name, role, email: `${id}@toolhub.local` } });
  }
  for (const [id, displayName, assetPath] of moods) {
    const data = { id, displayName, assetPath, thumbnailPath: assetPath, active: true, defaultScale: 1, xPosition: 0, yPosition: 0 };
    await prisma.mascotMood.upsert({ where: { id }, update: data, create: data });
  }
  await prisma.product.upsert({
    where: { sku: "TEST-CIDLI20" },
    update: {},
    create: {
      sku: "TEST-CIDLI20", brand: "INGCO", productName: "20V CORDLESS DRILL KIT", category: "Cordless Tools",
      primarySpecification: "2 x 2.0Ah BATTERIES + CHARGER", secondarySpecification: "Compact, powerful drilling and screwdriving kit",
      feature01: "20V POWER", feature02: "2 BATTERIES", keyBenefit: "IDEAL FOR DIY & TRADE", currentPrice: 2499,
      websiteUrl: "https://www.toolhub.co.za", backgroundRemovalStatus: "PENDING", createdByUserId: "dev-staff-1", updatedByUserId: "dev-staff-1",
    },
  });
}

main().finally(() => prisma.$disconnect());
