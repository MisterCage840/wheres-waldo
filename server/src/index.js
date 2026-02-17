require("dotenv").config()
const express = require("express")
const path = require("path")
const cors = require("cors")
const cookieParser = require("cookie-parser")
const crypto = require("crypto")
const { PrismaClient } = require("@prisma/client")
const { PrismaPg } = require("@prisma/adapter-pg")
const { z } = require("zod")

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL })
const prisma = new PrismaClient({ adapter })
const app = express()

const PORT = process.env.PORT || 5000
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || "http://localhost:5173"
const COOKIE_SECURE = (process.env.COOKIE_SECURE || "false") === "true"

app.use(cors({ origin: CLIENT_ORIGIN, credentials: true }))
app.use(express.json())
app.use(cookieParser())
app.use(
  "/images",
  express.static(path.join(__dirname, "..", "public", "images")),
)

function getOrCreateSessionId(req, res) {
  let sid = req.cookies.sid
  if (!sid) {
    sid = crypto.randomUUID()
    res.cookie("sid", sid, {
      httpOnly: true,
      sameSite: COOKIE_SECURE ? "none" : "lax",
      secure: COOKIE_SECURE,
      maxAge: 1000 * 60 * 60 * 24 * 30,
    })
  }
  return sid
}

app.get("/health", (req, res) => res.json({ ok: true }))

app.get("/api/images", async (req, res) => {
  const images = await prisma.gameImage.findMany({
    select: { id: true, name: true, imageUrl: true },
    orderBy: { createdAt: "asc" },
  })
  res.json(images)
})

app.get("/api/images/:id", async (req, res) => {
  const image = await prisma.gameImage.findUnique({
    where: { id: req.params.id },
    select: {
      id: true,
      name: true,
      imageUrl: true,
      characters: { select: { id: true, name: true } },
    },
  })
  if (!image) return res.status(404).json({ error: "Image not found" })
  res.json(image)
})

app.post("/api/rounds/start", async (req, res) => {
  const sid = getOrCreateSessionId(req, res)

  const parsed = z.object({ imageId: z.string().min(1) }).safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: "Invalid body" })

  const { imageId } = parsed.data

  await prisma.round.updateMany({
    where: { sessionId: sid, imageId, endedAt: null },
    data: { endedAt: new Date(), durationMs: 0 },
  })

  const round = await prisma.round.create({
    data: { imageId, sessionId: sid, startedAt: new Date() },
    select: { id: true, startedAt: true },
  })

  res.json(round)
})

app.post("/api/rounds/:roundId/guess", async (req, res) => {
  const sid = getOrCreateSessionId(req, res)

  const parsed = z
    .object({
      characterName: z.string().min(1),
      box: z.object({
        xMin: z.number().min(0).max(1),
        yMin: z.number().min(0).max(1),
        xMax: z.number().min(0).max(1),
        yMax: z.number().min(0).max(1),
      }),
    })
    .safeParse(req.body)

  if (!parsed.success) return res.status(400).json({ error: "Invalid body" })

  const { characterName, box } = parsed.data

  const round = await prisma.round.findUnique({
    where: { id: req.params.roundId },
    include: {
      image: { include: { characters: true } },
      found: { include: { character: true } },
    },
  })

  if (!round) return res.status(404).json({ error: "Round not found" })
  if (round.sessionId !== sid)
    return res.status(403).json({ error: "Forbidden" })
  if (round.endedAt)
    return res.status(400).json({ error: "Round already ended" })

  const character = round.image.characters.find((c) => c.name === characterName)
  if (!character) return res.status(404).json({ error: "Character not found" })

  const alreadyFound = round.found.some((f) => f.characterId === character.id)
  if (alreadyFound) {
    return res.json({
      correct: true,
      alreadyFound: true,
      marker: { x: character.foundX, y: character.foundY },
      finished: false,
      durationMs: null,
    })
  }

  const intersects = !(
    box.xMax < character.xMin ||
    box.xMin > character.xMax ||
    box.yMax < character.yMin ||
    box.yMin > character.yMax
  )

  if (!intersects) return res.json({ correct: false })

  await prisma.foundCharacter.create({
    data: { roundId: round.id, characterId: character.id },
  })

  const foundCount = await prisma.foundCharacter.count({
    where: { roundId: round.id },
  })
  const total = round.image.characters.length

  let finished = false
  let durationMs = null

  if (foundCount === total) {
    finished = true
    const endedAt = new Date()
    durationMs = endedAt.getTime() - round.startedAt.getTime()
    await prisma.round.update({
      where: { id: round.id },
      data: { endedAt, durationMs },
    })
  }

  res.json({
    correct: true,
    marker: { x: character.foundX, y: character.foundY },
    finished,
    durationMs,
  })
})

app.get("/api/images/:id/scores", async (req, res) => {
  const scores = await prisma.highScore.findMany({
    where: { imageId: req.params.id },
    orderBy: [{ durationMs: "asc" }, { createdAt: "asc" }],
    take: 10,
    select: { id: true, name: true, durationMs: true, createdAt: true },
  })
  res.json(scores)
})

app.post("/api/rounds/:roundId/submit-score", async (req, res) => {
  const sid = getOrCreateSessionId(req, res)

  const parsed = z
    .object({ name: z.string().min(1).max(30) })
    .safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: "Invalid name" })

  const round = await prisma.round.findUnique({
    where: { id: req.params.roundId },
  })
  if (!round) return res.status(404).json({ error: "Round not found" })
  if (round.sessionId !== sid)
    return res.status(403).json({ error: "Forbidden" })
  if (!round.endedAt || round.durationMs == null)
    return res.status(400).json({ error: "Round not completed" })

  const score = await prisma.highScore.create({
    data: {
      imageId: round.imageId,
      name: parsed.data.name.trim(),
      durationMs: round.durationMs,
    },
    select: { id: true, name: true, durationMs: true },
  })

  res.json(score)
})

app.listen(PORT, () => console.log(`Server running: http://localhost:${PORT}`))
