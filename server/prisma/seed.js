require("dotenv").config()
const { prisma } = require("../src/prisma")

async function main() {
  const scenes = [
    {
      name: "Classic Scene",
      imageUrl: "/images/waldo.jpg",
      width: 2048,
      height: 1373,
      characters: [
        {
          name: "Waldo",
          xMin: 0.8447,
          yMin: 0.7793,
          xMax: 0.9058,
          yMax: 0.9177,
          foundX: 0.8789,
          foundY: 0.8521,
        },
        {
          name: "Horse Rider",
          xMin: 0.6787,
          yMin: 0.4916,
          xMax: 0.7813,
          yMax: 0.6118,
          foundX: 0.7324,
          foundY: 0.5535,
        },
        {
          name: "Sailboat",
          xMin: 0.7129,
          yMin: 0.1529,
          xMax: 0.8154,
          yMax: 0.3532,
          foundX: 0.7617,
          foundY: 0.2622,
        },
      ],
    },
    {
      name: "The Unfriendly Giants",
      imageUrl: "/images/giants.jpg",
      width: 2048,
      height: 1373,
      characters: [
        {
          name: "Waldo",
          xMin: 0.781,
          yMin: 0.628,
          xMax: 0.842,
          yMax: 0.758,
          foundX: 0.812,
          foundY: 0.695,
        },
        {
          name: "Wizard",
          xMin: 0.607,
          yMin: 0.422,
          xMax: 0.67,
          yMax: 0.547,
          foundX: 0.638,
          foundY: 0.485,
        },
        {
          name: "Chessboard",
          xMin: 0.312,
          yMin: 0.735,
          xMax: 0.45,
          yMax: 0.885,
          foundX: 0.381,
          foundY: 0.81,
        },
      ],
    },
    {
      name: "Ski Mountain Scene",
      imageUrl: "/images/ski.jpg",
      width: 2048,
      height: 1373,
      characters: [
        {
          name: "Waldo",
          xMin: 0.842,
          yMin: 0.694,
          xMax: 0.902,
          yMax: 0.82,
          foundX: 0.873,
          foundY: 0.755,
        },
        {
          name: "Snowball Fight",
          xMin: 0.267,
          yMin: 0.411,
          xMax: 0.365,
          yMax: 0.55,
          foundX: 0.316,
          foundY: 0.478,
        },
        {
          name: "Chairlift",
          xMin: 0.682,
          yMin: 0.103,
          xMax: 0.789,
          yMax: 0.245,
          foundX: 0.734,
          foundY: 0.17,
        },
      ],
    },
  ]

  for (const scene of scenes) {
    const existing = await prisma.gameImage.findFirst({
      where: { name: scene.name },
    })

    const image = existing
      ? await prisma.gameImage.update({
          where: { id: existing.id },
          data: {
            imageUrl: scene.imageUrl,
            width: scene.width,
            height: scene.height,
          },
        })
      : await prisma.gameImage.create({
          data: {
            name: scene.name,
            imageUrl: scene.imageUrl,
            width: scene.width,
            height: scene.height,
          },
        })

    for (const character of scene.characters) {
      await prisma.character.upsert({
        where: { imageId_name: { imageId: image.id, name: character.name } },
        update: {
          xMin: character.xMin,
          yMin: character.yMin,
          xMax: character.xMax,
          yMax: character.yMax,
          foundX: character.foundX,
          foundY: character.foundY,
        },
        create: { ...character, imageId: image.id },
      })
    }
  }

  console.log("Seed OK. scenes:", scenes.length)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => prisma.$disconnect())
