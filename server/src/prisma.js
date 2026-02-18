require("dotenv").config()
const { PrismaClient } = require("@prisma/client")
const { PrismaPgAdapter } = require("@prisma/adapter-pg")
const { Pool } = require("pg")

const pool = new Pool({
  connectionString: process.env.DATABASE_URL, // pooled is fine for runtime
})

const adapter = new PrismaPgAdapter(pool)

const prisma = new PrismaClient({ adapter })

module.exports = { prisma, pool }
