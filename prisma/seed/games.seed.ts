import { prisma } from "../../src/config/database";
import { TemplateType, EducationLevel, DifficultyLevel, Role } from "@prisma/client";

export const seedGames = async () => {
  console.log("🌱 Seeding 6 Golden Templates...");

  const teacher = await prisma.user.findFirst({ where: { role: Role.TEACHER } });
  if (!teacher) {
    throw new Error("❌ Error: Belum ada user dengan role TEACHER di database!");
  }

  const teacherId = teacher.id;

  const games = [
    {
      title: "Hafalan Kosakata Inggris",
      description: "Belajar kosakata dasar sehari-hari",
      templateType: TemplateType.FLASHCARD,
      educationLevel: EducationLevel.SD,
      difficulty: DifficultyLevel.EASY,
      isPublished: true,
      creatorId: teacherId,
      thumbnailUrl: "default.jpg",
      gameJson: { cards: [{ front: "Apple", back: "Apel" }] }
    },
    {
      title: "Tebak Nama Hewan",
      description: "Tebak huruf dari nama-nama hewan",
      templateType: TemplateType.HANGMAN,
      educationLevel: EducationLevel.SD,
      difficulty: DifficultyLevel.MEDIUM,
      isPublished: true,
      creatorId: teacherId,
      thumbnailUrl: "default.jpg",
      gameJson: { words: ["KUCING", "KELINCI"] }
    },
    {
      title: "Cari Kata Sains",
      description: "Cari kata tersembunyi di dalam grid",
      templateType: TemplateType.WORD_SEARCH,
      educationLevel: EducationLevel.SMP, // ✅ Sudah SMP
      difficulty: DifficultyLevel.MEDIUM,
      isPublished: true,
      creatorId: teacherId,
      thumbnailUrl: "default.jpg",
      gameJson: { words: ["ATOM", "GAYA"] }
    },
    {
      title: "Geometri SMA",
      description: "Susun rumus pythagoras",
      templateType: TemplateType.ANAGRAM,
      educationLevel: EducationLevel.SMA, // ✅ Sudah SMA
      difficulty: DifficultyLevel.HARD,
      isPublished: true,
      creatorId: teacherId,
      thumbnailUrl: "default.jpg",
      gameJson: { words: ["SEGITIGA", "PYTHAGORAS"] }
    },
    {
      title: "Petualangan Matematika",
      description: "Jawab soal matematika di labirin",
      templateType: TemplateType.MAZE_CHASE,
      educationLevel: EducationLevel.SD,
      difficulty: DifficultyLevel.MEDIUM,
      isPublished: true,
      creatorId: teacherId,
      thumbnailUrl: "default.jpg",
      gameJson: { questions: [{ q: "1+1?", a: "2" }] }
    },
    {
      title: "Random Review Materi",
      description: "Putar roda untuk memilih topik diskusi",
      templateType: TemplateType.SPIN_THE_WHEEL,
      educationLevel: EducationLevel.UNIVERSITY,
      difficulty: DifficultyLevel.HARD,
      isPublished: true,
      creatorId: teacherId,
      thumbnailUrl: "default.jpg",
      gameJson: { items: ["Diskusi 1", "Diskusi 2"] }
    }
  ];

  await prisma.game.deleteMany({});
  for (const game of games) {
    const created = await prisma.game.create({
      data: game
    });
    console.log(`  ✅ [${created.educationLevel}] ${created.templateType}: ${created.title}`);
  }
};