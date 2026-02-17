-- CreateTable
CREATE TABLE "GameImage" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "imageUrl" TEXT NOT NULL,
    "width" INTEGER,
    "height" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GameImage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Character" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "xMin" DOUBLE PRECISION NOT NULL,
    "yMin" DOUBLE PRECISION NOT NULL,
    "xMax" DOUBLE PRECISION NOT NULL,
    "yMax" DOUBLE PRECISION NOT NULL,
    "foundX" DOUBLE PRECISION NOT NULL,
    "foundY" DOUBLE PRECISION NOT NULL,
    "imageId" TEXT NOT NULL,

    CONSTRAINT "Character_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Round" (
    "id" TEXT NOT NULL,
    "imageId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "endedAt" TIMESTAMP(3),
    "durationMs" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Round_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FoundCharacter" (
    "id" TEXT NOT NULL,
    "roundId" TEXT NOT NULL,
    "characterId" TEXT NOT NULL,
    "foundAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FoundCharacter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HighScore" (
    "id" TEXT NOT NULL,
    "imageId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "durationMs" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HighScore_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Character_imageId_name_key" ON "Character"("imageId", "name");

-- CreateIndex
CREATE INDEX "Round_sessionId_idx" ON "Round"("sessionId");

-- CreateIndex
CREATE INDEX "Round_imageId_idx" ON "Round"("imageId");

-- CreateIndex
CREATE UNIQUE INDEX "FoundCharacter_roundId_characterId_key" ON "FoundCharacter"("roundId", "characterId");

-- CreateIndex
CREATE INDEX "HighScore_imageId_durationMs_idx" ON "HighScore"("imageId", "durationMs");

-- AddForeignKey
ALTER TABLE "Character" ADD CONSTRAINT "Character_imageId_fkey" FOREIGN KEY ("imageId") REFERENCES "GameImage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Round" ADD CONSTRAINT "Round_imageId_fkey" FOREIGN KEY ("imageId") REFERENCES "GameImage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FoundCharacter" ADD CONSTRAINT "FoundCharacter_roundId_fkey" FOREIGN KEY ("roundId") REFERENCES "Round"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FoundCharacter" ADD CONSTRAINT "FoundCharacter_characterId_fkey" FOREIGN KEY ("characterId") REFERENCES "Character"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HighScore" ADD CONSTRAINT "HighScore_imageId_fkey" FOREIGN KEY ("imageId") REFERENCES "GameImage"("id") ON DELETE CASCADE ON UPDATE CASCADE;
