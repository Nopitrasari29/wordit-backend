import { prisma } from "../../src/config/database"

export const seedGames = async (creatorIds: string[]) => {
  console.log("🌱 Seeding games...")

  // creatorIds[0] = Bu Sari (SD), creatorIds[1] = Pak Budi (University)
  const sariId = creatorIds[0]!
  const budiId = creatorIds[1]!

  const games = [
    // ── SD GAMES ──────────────────────────────────────────
    {
      title: "Kenalan dengan Hewan",
      description: "Belajar nama-nama hewan dalam bahasa Indonesia dan Inggris",
      templateType: "MATCHING_PAIR" as const,
      educationLevel: "SD" as const,
      difficulty: "EASY" as const,
      isPublished: true,
      creatorId: sariId,
      gameJson: {
        pairs: [
          { left: "Kucing", right: "Cat" },
          { left: "Anjing", right: "Dog" },
          { left: "Kelinci", right: "Rabbit" },
          { left: "Ikan", right: "Fish" },
          { left: "Burung", right: "Bird" },
        ],
        timeLimit: 60,
      }
    },
    {
      title: "Matematika Dasar",
      description: "Latihan penjumlahan dan pengurangan untuk kelas 1-3",
      templateType: "QUIZ" as const,
      educationLevel: "SD" as const,
      difficulty: "EASY" as const,
      isPublished: true,
      creatorId: sariId,
      gameJson: {
        questions: [
          {
            question: "Berapa hasil dari 5 + 3?",
            options: [
              { text: "7", isCorrect: false },
              { text: "8", isCorrect: true },
              { text: "9", isCorrect: false },
              { text: "6", isCorrect: false },
            ],
            timeLimit: 15,
            points: 100,
          },
          {
            question: "Berapa hasil dari 10 - 4?",
            options: [
              { text: "5", isCorrect: false },
              { text: "7", isCorrect: false },
              { text: "6", isCorrect: true },
              { text: "8", isCorrect: false },
            ],
            timeLimit: 15,
            points: 100,
          },
          {
            question: "Berapa hasil dari 3 × 4?",
            options: [
              { text: "10", isCorrect: false },
              { text: "11", isCorrect: false },
              { text: "13", isCorrect: false },
              { text: "12", isCorrect: true },
            ],
            timeLimit: 20,
            points: 100,
          },
        ]
      }
    },
    {
      title: "Kosakata Bahasa Inggris",
      description: "Hafal kosakata bahasa Inggris sehari-hari dengan flashcard",
      templateType: "FLASHCARD" as const,
      educationLevel: "SD" as const,
      difficulty: "EASY" as const,
      isPublished: true,
      creatorId: sariId,
      gameJson: {
        cards: [
          { front: "Apple", back: "Apel 🍎" },
          { front: "Book", back: "Buku 📚" },
          { front: "Chair", back: "Kursi 🪑" },
          { front: "Door", back: "Pintu 🚪" },
          { front: "Egg", back: "Telur 🥚" },
        ]
      }
    },
    // ── SMP/SMA GAMES ─────────────────────────────────────
    {
      title: "Tata Bahasa Indonesia",
      description: "Uji pemahaman tata bahasa Indonesia tingkat SMP",
      templateType: "QUIZ" as const,
      educationLevel: "SMP_SMA" as const,
      difficulty: "MEDIUM" as const,
      isPublished: true,
      creatorId: sariId,
      gameJson: {
        questions: [
          {
            question: "Manakah kalimat yang menggunakan kata baku yang benar?",
            options: [
              { text: "Dia pergi kesekolah", isCorrect: false },
              { text: "Dia pergi ke sekolah", isCorrect: true },
              { text: "Dia pergi Ke Sekolah", isCorrect: false },
              { text: "dia pergi ke sekolah", isCorrect: false },
            ],
            timeLimit: 30,
            points: 100,
          },
          {
            question: "Apa imbuhan yang tepat untuk kata 'tulis' agar bermakna 'hasil tulisan'?",
            options: [
              { text: "menulis", isCorrect: false },
              { text: "tulisan", isCorrect: true },
              { text: "tertulis", isCorrect: false },
              { text: "penulisan", isCorrect: false },
            ],
            timeLimit: 30,
            points: 100,
          },
        ]
      }
    },
    {
      title: "Tebak Nama Ibukota",
      description: "Tebak nama ibukota negara-negara di dunia",
      templateType: "HANGMAN" as const,
      educationLevel: "SMP_SMA" as const,
      difficulty: "MEDIUM" as const,
      isPublished: true,
      creatorId: sariId,
      gameJson: {
        words: [
          { word: "JAKARTA", hint: "Ibukota Indonesia" },
          { word: "TOKYO", hint: "Ibukota Jepang" },
          { word: "PARIS", hint: "Ibukota Prancis" },
          { word: "LONDON", hint: "Ibukota Inggris" },
          { word: "BERLIN", hint: "Ibukota Jerman" },
        ],
        maxWrongGuesses: 6,
      }
    },
    {
      title: "Cari Kata Sains",
      description: "Temukan kata-kata yang berhubungan dengan sains",
      templateType: "WORD_SEARCH" as const,
      educationLevel: "SMP_SMA" as const,
      difficulty: "MEDIUM" as const,
      isPublished: true,
      creatorId: sariId,
      gameJson: {
        words: ["ATOM", "ENERGI", "GAYA", "MASSA", "CAHAYA", "KIMIA"],
        gridSize: 10,
        timeLimit: 120,
      }
    },
    // ── UNIVERSITY GAMES ──────────────────────────────────
    {
      title: "Jaringan Komputer Dasar",
      description: "Quiz materi jaringan komputer untuk mahasiswa TI",
      templateType: "QUIZ" as const,
      educationLevel: "UNIVERSITY" as const,
      difficulty: "HARD" as const,
      isPublished: true,
      creatorId: budiId,
      gameJson: {
        questions: [
          {
            question: "Protokol manakah yang beroperasi pada Layer 4 (Transport) model OSI?",
            options: [
              { text: "HTTP", isCorrect: false },
              { text: "IP", isCorrect: false },
              { text: "TCP", isCorrect: true },
              { text: "Ethernet", isCorrect: false },
            ],
            timeLimit: 30,
            points: 100,
          },
          {
            question: "Berapa jumlah bit dalam sebuah alamat IPv4?",
            options: [
              { text: "16 bit", isCorrect: false },
              { text: "32 bit", isCorrect: true },
              { text: "64 bit", isCorrect: false },
              { text: "128 bit", isCorrect: false },
            ],
            timeLimit: 20,
            points: 100,
          },
          {
            question: "Apa fungsi dari protokol DNS?",
            options: [
              { text: "Mengenkripsi data", isCorrect: false },
              { text: "Mengirim email", isCorrect: false },
              { text: "Menerjemahkan domain ke IP address", isCorrect: true },
              { text: "Mengatur routing", isCorrect: false },
            ],
            timeLimit: 30,
            points: 100,
          },
        ]
      }
    },
    {
      title: "Algoritma & Struktur Data",
      description: "Uji pemahaman konsep algoritma dan struktur data",
      templateType: "MATCHING_PAIR" as const,
      educationLevel: "UNIVERSITY" as const,
      difficulty: "HARD" as const,
      isPublished: true,
      creatorId: budiId,
      gameJson: {
        pairs: [
          { left: "O(1)", right: "Constant Time" },
          { left: "O(n)", right: "Linear Time" },
          { left: "O(log n)", right: "Logarithmic Time" },
          { left: "O(n²)", right: "Quadratic Time" },
          { left: "Stack", right: "LIFO Structure" },
        ],
        timeLimit: 60,
      }
    },
    {
      title: "Analisis Sistem Informasi",
      description: "Jawab pertanyaan essay tentang konsep sistem informasi",
      templateType: "SHORT_ANSWER" as const,
      educationLevel: "UNIVERSITY" as const,
      difficulty: "HARD" as const,
      isPublished: true,
      creatorId: budiId,
      gameJson: {
        questions: [
          {
            question: "Jelaskan perbedaan antara Data, Informasi, dan Pengetahuan dalam konteks Sistem Informasi!",
            idealAnswer: "Data adalah fakta mentah belum diolah. Informasi adalah data yang sudah diolah dan bermakna. Pengetahuan adalah informasi yang sudah dipahami dan dapat digunakan untuk pengambilan keputusan.",
            points: 100,
            timeLimit: 120,
          },
          {
            question: "Apa yang dimaksud dengan Normalisasi Database? Jelaskan bentuk normal 1NF, 2NF, dan 3NF!",
            idealAnswer: "Normalisasi adalah proses mengorganisasi database untuk mengurangi redundansi. 1NF: setiap kolom atomic. 2NF: tidak ada partial dependency. 3NF: tidak ada transitive dependency.",
            points: 100,
            timeLimit: 180,
          },
        ]
      }
    },
  ]

  for (const game of games) {
    const created = await prisma.game.create({ data: game })
    console.log(`  ✅ [${created.educationLevel}] ${created.templateType}: ${created.title}`)
  }

  console.log(`  📊 Total: ${games.length} games seeded`)
}