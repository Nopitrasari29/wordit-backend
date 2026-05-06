import { prisma } from "../../src/config/database";
import { TemplateType, EducationLevel, DifficultyLevel, Role } from "@prisma/client";

export const seedGames = async () => {
  console.log("🎮 Seeding 6 Golden Templates (Safe Upsert Mode)...");

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
        cards: [
          { front: "Apple", back: "Apel" },
          { front: "Cat", back: "Kucing" },
          { front: "Dog", back: "Anjing" },
          { front: "Fish", back: "Ikan" },
          { front: "Bird", back: "Burung" }
        ]
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
        words: [
          { word: "KUCING", hint: "Hewan yang suka mengeong" },
          { word: "ANJING", hint: "Hewan peliharaan yang setia" },
          { word: "KELINCI", hint: "Hewan berbulu dengan telinga panjang" },
          { word: "KUDA", hint: "Hewan yang bisa ditunggangi" },
          { word: "GAJAH", hint: "Hewan terbesar di darat" }
        ]
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
        words: [
          { word: "ATOM", hint: "Bagian terkecil dari materi" },
          { word: "PROTON", hint: "Partikel bermuatan positif" },
          { word: "NEUTRON", hint: "Partikel tidak bermuatan" },
          { word: "ELEKTRON", hint: "Partikel bermuatan negatif" },
          { word: "NUKLEUS", hint: "Inti dari sebuah atom" }
        ]
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
        words: [
          { word: "SEGITIGA", hint: "Bangun datar dengan tiga sudut" },
          { word: "LINGKARAN", hint: "Bangun datar tanpa sudut" },
          { word: "TRAPESIUM", hint: "Bangun datar dengan sepasang sisi sejajar" },
          { word: "DIAGONAL", hint: "Garis yang menghubungkan dua sudut tidak berdampingan" },
          { word: "HIPOTENUSA", hint: "Sisi miring pada segitiga siku-siku" }
        ]
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
        questions: [
          { question: "Berapakah 2 + 3?", answer: "5", wrongAnswers: ["4", "6", "7"] },
          { question: "Berapakah 10 - 4?", answer: "6", wrongAnswers: ["5", "7", "8"] },
          { question: "Berapakah 3 x 3?", answer: "9", wrongAnswers: ["6", "8", "12"] },
          { question: "Berapakah 8 / 2?", answer: "4", wrongAnswers: ["2", "3", "6"] },
          { question: "Berapakah 5 + 7?", answer: "12", wrongAnswers: ["10", "11", "13"] }
        ]
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
        questions: [
          { question: "Apa kepanjangan AI?", answer: "Artificial Intelligence" },
          { question: "Apa kepanjangan ML?", answer: "Machine Learning" },
          { question: "Apa kepanjangan API?", answer: "Application Programming Interface" },
          { question: "Apa kepanjangan OOP?", answer: "Object Oriented Programming" },
          { question: "Apa kepanjangan SQL?", answer: "Structured Query Language" }
        ]
      }
    }
  ];

  let seededCount = 0;
  let skippedCount = 0;

  for (const game of games) {
    // ✅ SAFE UPSERT: Tidak akan menghapus game yang sudah ada!
    // Hanya update game dummy ini jika title-nya sudah ada
    await prisma.game.upsert({
      where: { shareCode: game.shareCode, },
      update: {
        // Update data game dummy jika ada perubahan
        description: game.description,
        shareCode: game.shareCode,
        gameJson: game.gameJson,
        isPublished: game.isPublished,
      },
      create: game,
    });

    const existing = await prisma.game.findUnique({ where: { shareCode: game.shareCode, } });
    if (existing) {
      console.log(`  OK [${game.templateType}]: "${game.title}" (Code: ${game.shareCode})`);
      seededCount++;
    }
  }

  // Hitung total game di DB (termasuk yang dibuat user)
  const totalGames = await prisma.game.count();
  console.log(`\n  Summary: ${seededCount} template bawaan terjaga, ${totalGames} total game di database.`);
  console.log(`  Game buatan user TIDAK dihapus!`);
};
