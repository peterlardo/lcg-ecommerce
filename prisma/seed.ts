import { PrismaClient } from "../src/generated/prisma/client"
import bcrypt from "bcryptjs"

const prisma = new PrismaClient()

async function main() {
  const password = await bcrypt.hash("admin123", 12)

  const admin = await prisma.user.upsert({
    where: { email: "admin@lcg.cg" },
    update: {},
    create: {
      name: "Administrateur",
      email: "admin@lcg.cg",
      password,
      role: "ADMIN",
      isActive: true,
    },
  })

  console.log("Admin user created:", admin.email)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
