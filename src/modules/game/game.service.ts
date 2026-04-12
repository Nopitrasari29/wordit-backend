import { prisma } from "../../config/database"
import { Prisma } from "@prisma/client"
import type { CreateGameInput, UpdateGameInput, GameQueryInput } from "./game.schema"
import { generateShareCode } from "../../utils/share-code"

export const getGames = async (query: GameQueryInput) => {
  const page = parseInt(query.page)
  const limit = parseInt(query.limit)
  const skip = (page - 1) * limit

  const where: Prisma.GameWhereInput = {
    isPublished: true,
    ...(query.educationLevel && { educationLevel: query.educationLevel }),
    ...(query.templateType && { templateType: query.templateType as Prisma.EnumTemplateTypeFilter }),
    ...(query.search && {
      title: {
        contains: query.search,
      }
    })
  }

  const [games, total] = await Promise.all([
    prisma.game.findMany({
      where,
      select: {
        id: true,
        title: true,
        description: true,
        templateType: true,
        educationLevel: true,
        difficulty: true,
        playCount: true,
        thumbnailUrl: true,
        shareCode: true,
        createdAt: true,
        creator: {
          select: {
            id: true,
            name: true,
          }
        }
      },
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
    }),
    prisma.game.count({ where })
  ])

  return {
    games,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    }
  }
}

export const getGameById = async (gameId: string, userId?: string) => {
  const game = await prisma.game.findUnique({
    where: { id: gameId },
    include: {
      creator: {
        select: {
          id: true,
          name: true,
        }
      }
    }
  })

  if (!game) throw new Error("Game not found")

  if (!game.isPublished && game.creatorId !== userId) {
    throw new Error("Game not found")
  }

  return game
}

export const createGame = async (userId: string, data: CreateGameInput) => {
  const shareCode = generateShareCode()

  const game = await prisma.game.create({
    data: {
      title: data.title,
      description: data.description,
      templateType: data.templateType,
      educationLevel: data.educationLevel,
      difficulty: data.difficulty,
      creatorId: userId,
      shareCode,
      gameJson: data.gameJson as Prisma.InputJsonValue,
    },
    select: {
      id: true,
      title: true,
      templateType: true,
      educationLevel: true,
      difficulty: true,
      isPublished: true,
      shareCode: true,
      createdAt: true,
    }
  })

  return game
}

export const updateGame = async (
  gameId: string,
  userId: string,
  data: UpdateGameInput
) => {
  const game = await prisma.game.findUnique({
    where: { id: gameId }
  })

  if (!game) throw new Error("Game not found")
  if (game.creatorId !== userId) throw new Error("Unauthorized")

  const updateData: Prisma.GameUpdateInput = {
    ...(data.title && { title: data.title }),
    ...(data.description !== undefined && { description: data.description }),
    ...(data.difficulty && { difficulty: data.difficulty }),
    ...(data.gameJson && { gameJson: data.gameJson as Prisma.InputJsonValue }),
  }

  const updated = await prisma.game.update({
    where: { id: gameId },
    data: updateData,
    select: {
      id: true,
      title: true,
      templateType: true,
      educationLevel: true,
      difficulty: true,
      isPublished: true,
      updatedAt: true,
    }
  })

  return updated
}

export const deleteGame = async (gameId: string, userId: string) => {
  const game = await prisma.game.findUnique({
    where: { id: gameId }
  })

  if (!game) throw new Error("Game not found")
  if (game.creatorId !== userId) throw new Error("Unauthorized")

  await prisma.game.delete({ where: { id: gameId } })

  return { message: "Game deleted successfully" }
}

export const togglePublish = async (gameId: string, userId: string) => {
  const game = await prisma.game.findUnique({
    where: { id: gameId }
  })

  if (!game) throw new Error("Game not found")
  if (game.creatorId !== userId) throw new Error("Unauthorized")

  const updated = await prisma.game.update({
    where: { id: gameId },
    data: { isPublished: !game.isPublished },
    select: {
      id: true,
      title: true,
      isPublished: true,
      updatedAt: true,
    }
  })

  return updated
}

export const getMyGames = async (userId: string) => {
  const games = await prisma.game.findMany({
    where: { creatorId: userId },
    select: {
      id: true,
      title: true,
      templateType: true,
      educationLevel: true,
      difficulty: true,
      isPublished: true,
      playCount: true,
      shareCode: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" }
  })

  return games
}

export const getTemplatesByLevel = async (educationLevel: string) => {
  const templateMapping: Record<string, string[]> = {
    SD: ["FLASHCARD", "HANGMAN", "WORD_SEARCH", "MATCHING_PAIR", "QUIZ", "SHORT_ANSWER"],
    SMP_SMA: ["FLASHCARD", "HANGMAN", "WORD_SEARCH", "MATCHING_PAIR", "QUIZ", "SHORT_ANSWER"],
    UNIVERSITY: ["FLASHCARD", "WORD_SEARCH", "MATCHING_PAIR", "QUIZ", "SHORT_ANSWER"],
  }

  const templates = templateMapping[educationLevel] ?? []

  return templates.map(t => ({
    type: t,
    label: getTemplateLabel(t),
    description: getTemplateDescription(t),
  }))
}

const getTemplateLabel = (type: string): string => {
  const labels: Record<string, string> = {
    QUIZ: "Quiz",
    TRUE_OR_FALSE: "True or False",
    FLASHCARD: "Flashcard",
    MATCHING_PAIR: "Matching Pair",
    WORD_SEARCH: "Word Search",
    SHORT_ANSWER: "Short Answer",
    HANGMAN: "Hangman",
  }
  return labels[type] ?? type
}

const getTemplateDescription = (type: string): string => {
  const descriptions: Record<string, string> = {
    QUIZ: "Pilihan ganda dengan 4 opsi jawaban",
    TRUE_OR_FALSE: "Tentukan pernyataan benar atau salah",
    FLASHCARD: "Kartu hafalan bolak-balik",
    MATCHING_PAIR: "Jodohkan pasangan yang sesuai",
    WORD_SEARCH: "Temukan kata tersembunyi di grid huruf",
    SHORT_ANSWER: "Jawab pertanyaan dengan kalimat singkat",
    HANGMAN: "Tebak kata huruf per huruf",
  }
  return descriptions[type] ?? ""
}