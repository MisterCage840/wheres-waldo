/*
  Warnings:

  - A unique constraint covering the columns `[name]` on the table `GameImage` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "GameImage_name_key" ON "GameImage"("name");
