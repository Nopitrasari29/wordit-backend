import { prisma } from "../../src/config/database";
import { TemplateType, EducationLevel, DifficultyLevel, Role } from "@prisma/client"; // ✅ Tambahkan Role di sini

export const seedGames = async () => {
  console.log("🌱 Seeding 6 Golden Templates...");

  // ✅ Gunakan Role.TEACHER dari @prisma/client (Ini memperbaiki Error 1)
  const teacher = await prisma.user.findFirst({
    where: { role: Role.TEACHER } 
  });

  if (!teacher) {
    throw new Error("❌ Error: Belum ada user dengan role TEACHER di database!");
  }

  const teacherId = teacher.id;

  const games =[
    {
      title: "Hafalan Kosakata Inggris",
      description: "Belajar kosakata dasar sehari-hari",
      templateType: TemplateType.FLASHCARD,
      educationLevel: EducationLevel.SD,
      difficulty: DifficultyLevel.EASY,
      creatorId: teacherId,
      gameJson: { cards: [{ front: "Apple", back: "Apel" }] }
    },
    {
      title: "Tebak Nama Hewan",
      description: "Tebak huruf dari nama-nama hewan",
      templateType: TemplateType.HANGMAN,
      educationLevel: EducationLevel.SD,
      difficulty: DifficultyLevel.MEDIUM,
      creatorId: teacherId,
      gameJson: { words: ["KUCING", "KELINCI"] }
    },
    {
      title: "Cari Kata Sains",
      description: "Cari kata tersembunyi di dalam grid",
      templateType: TemplateType.WORD_SEARCH,
      educationLevel: EducationLevel.SMP_SMA,
      difficulty: DifficultyLevel.MEDIUM,
      creatorId: teacherId,
      gameJson: { words:["ATOM", "GAYA"] }
    },
    {
      title: "Susun Huruf Teknis",
      description: "Susun anagram dari istilah IT",
      templateType: TemplateType.ANAGRAM,
      educationLevel: EducationLevel.UNIVERSITY,
      difficulty: DifficultyLevel.HARD,
      creatorId: teacherId,
      gameJson: { words: ["PRISMA", "DOCKER"] }
    },
    {
      title: "Petualangan Matematika",
      description: "Jawab soal matematika di labirin",
      templateType: TemplateType.MAZE_CHASE,
      educationLevel: EducationLevel.SD,
      difficulty: DifficultyLevel.MEDIUM,
      creatorId: teacherId,
      gameJson: { questions: [{ q: "1+1?", a: "2" }] }
    },
    {
      title: "Random Review Materi",
      description: "Putar roda untuk memilih topik diskusi",
      templateType: TemplateType.SPIN_THE_WHEEL,
      educationLevel: EducationLevel.UNIVERSITY,
      difficulty: DifficultyLevel.HARD,
      creatorId: teacherId,
      gameJson: { items: ["Diskusi 1", "Diskusi 2"] }
    }
  ];

  // ✅ Ini memperbaiki Error 2: Kita bersihkan tabel game lama dulu, lalu buat baru (tanpa upsert)
  await prisma.game.deleteMany({});

  for (const game of games) {
    const created = await prisma.game.create({
      data: {
        ...game,
        thumbnailUrl: "default.jpg",
        isPublished: true,
      }
    });
    console.log(`  ✅[${created.educationLevel}] ${created.templateType}: ${created.title}`);
  }
};