import { prisma } from "../../src/config/database";
import { TemplateType, EducationLevel, DifficultyLevel, Role } from "@prisma/client";

export const seedGames = async () => {
  console.log("🌱 Seeding 6 Golden Templates (Standardized Mode)...");

  const teacher = await prisma.user.findFirst({ where: { role: Role.TEACHER } });
  if (!teacher) {
    throw new Error("❌ Error: Belum ada user dengan role TEACHER! Jalankan seedUsers dulu.");
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
      shareCode: "JOINSD",
      gameJson: { 
        cards: [{ front: "Apple", back: "Apel" }] 
      }
    },
    {
      title: "Tebak Nama Hewan",
      description: "Tebak huruf dari nama-nama hewan",
      templateType: TemplateType.HANGMAN,
      educationLevel: EducationLevel.SD,
      difficulty: DifficultyLevel.MEDIUM,
      isPublished: true,
      creatorId: teacherId,
      shareCode: "ANIMAL",
      gameJson: { 
        words: [{ word: "KUCING", hint: "Hewan yang suka mengeong" }] 
      }
    },
    {
      title: "Cari Kata Sains",
      description: "Cari kata tersembunyi di dalam grid",
      templateType: TemplateType.WORD_SEARCH,
      educationLevel: EducationLevel.SMP,
      difficulty: DifficultyLevel.MEDIUM,
      isPublished: true,
      creatorId: teacherId,
      shareCode: "SAINS1",
      gameJson: { 
        words: [{ word: "ATOM", hint: "Bagian terkecil dari materi" }] 
      }
    },
    {
      title: "Geometri SMA",
      description: "Susun kata terkait geometri",
      templateType: TemplateType.ANAGRAM,
      educationLevel: EducationLevel.SMA,
      difficulty: DifficultyLevel.HARD,
      isPublished: true,
      creatorId: teacherId,
      shareCode: "SMA123",
      gameJson: { 
        words: [{ word: "SEGITIGA", hint: "Bangun datar dengan tiga sudut" }] 
      }
    },
    {
      title: "Petualangan Matematika",
      description: "Jawab soal matematika di labirin",
      templateType: TemplateType.MAZE_CHASE,
      educationLevel: EducationLevel.SD,
      difficulty: DifficultyLevel.MEDIUM,
      isPublished: true,
      creatorId: teacherId,
      shareCode: "MAZE01",
      gameJson: { 
        questions: [{ question: "Berapakah 1+1?", answer: "2" }] 
      }
    },
    {
      title: "Random Review Materi",
      description: "Putar roda untuk memilih topik diskusi",
      templateType: TemplateType.SPIN_THE_WHEEL,
      educationLevel: EducationLevel.UNIVERSITY,
      difficulty: DifficultyLevel.HARD,
      isPublished: true,
      creatorId: teacherId,
      shareCode: "UNIVIT",
      gameJson: { 
        questions: [{ question: "Apa kepanjangan AI?", answer: "Artificial Intelligence" }] 
      }
    }
  ];

  await prisma.game.deleteMany({});
  for (const game of games) {
    const created = await prisma.game.create({
      data: game
    });
    console.log(`  ✅ [${created.educationLevel}] ${created.templateType}: ${created.title} (Code: ${created.shareCode})`);
  }
};