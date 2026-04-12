
# 🎮 WordIT - Gamified Virtual Learning Platform (Backend)

WordIT adalah platform pembelajaran berbasis web yang menghadirkan elemen permainan (gamified learning) ke dalam kelas. Proyek ini dikembangkan sebagai **Greenfield Development** menggunakan arsitektur full-stack modern untuk mendukung integrasi AI dan LMS Moodle.

## 🚀 Tech Stack
- **Runtime:** [Bun](https://bun.sh/) (Fast All-in-One JavaScript Runtime)
- **Language:** TypeScript
- **Framework:** ExpressJS
- **ORM:** Prisma v7
- **Database:** PostgreSQL (Containerized via Docker)
- **AI Providers:** Groq API (Llama 3) & Google Gemini API (Fallback)

## ✨ Fitur Utama
1. **The Golden Six Templates:** 6 template game interaktif yang terkurasi (Flashcard, Hangman, Word Search, Anagram, Maze Chase, Spin the Wheel).
2. **Education Level System:** Pemilihan jenjang pendidikan (SD, SMP/SMA, University) yang otomatis memfilter template game yang relevan.
3. **AI Quiz Generator:** Otomatisasi pembuatan soal dari materi pengajar menggunakan AI.
4. **AI Smart Grading:** Penilaian jawaban esai secara otomatis dengan analisis semantik.
5. **Moodle LMS Connector:** Integrasi LTI untuk akses langsung dari MyITS Classroom/Moodle.
6. **Learning Analytics:** Dashboard statistik performa belajar untuk pengajar dan siswa.

## 📂 Struktur Folder (Modular)
```text
src/
├── config/       # Konfigurasi database & environment
├── middleware/   # Auth (RBAC), Upload handling, Validation
├── modules/      # Logika Bisnis per Fitur
│   ├── auth/     # Login, Register, Logout
│   ├── user/     # Profil & Edit Akun
│   └── game/     # Game Engine & 6 Golden Templates
├── utils/        # Helper (Hashing, JWT, Response handler)
└── app.ts        # Entry point utama aplikasi
```

## 🛠️ Persyaratan Sistem
- [Bun](https://bun.sh/docs/installation) v1.1.x atau terbaru
- [Docker Desktop](https://www.docker.com/products/docker-desktop) (Pastikan sudah running)

## ⚙️ Cara Instalasi & Setup

### 1. Clone & Install
```bash
git clone https://github.com/Nopitrasari29/wordit-backend.git
cd wordit-backend
bun install
```

### 2. Environment Variables
Buat file `.env` di root folder dan isi dengan konfigurasi berikut (Port DB menggunakan **5434** untuk menghindari konflik dengan PostgreSQL lokal):
```env
POSTGRES_PORT=5434
POSTGRES_NAME=wordit_db
POSTGRES_USER=wordit_user
POSTGRES_PASSWORD=wordit_pass

DATABASE_URL="postgresql://wordit_user:wordit_pass@localhost:5434/wordit_db?schema=public"

JWT_SECRET=
JWT_EXPIRES_IN=24h

PORT=3000
NODE_ENV=development

GROQ_API_KEY=your_groq_key_here
GEMINI_API_KEY=your_gemini_key_here
```

### 3. Database & Seeding
Jalankan perintah ini secara berurutan:
```bash
# Nyalakan Docker Container
docker compose up -d

# Jalankan migrasi database
bun prisma migrate dev --name init_wordit

# Masukkan data awal (User & Golden Six Templates)
bun seed:dev
```

### 4. Menjalankan Server
```bash
# Mode Development
bun start dev

# Linting (Pastikan kode rapi sebelum commit)
bun lint fix
```

## 👥 Tim Pengembang
- **Aswalia Novitriasari** (Project Manager & Backend Lead)
- **Rafika Az Zahra Kusumastuti** (Frontend Lead)
- **Fadlilah Cantika Sari Hermawan** (AI Engineer)
- **Syela Zeruya Tandi Lalong** (Quality Assurance & Business Analyst)

---
*Proyek ini dikembangkan sebagai bagian dari Capstone Project Pengembangan Sistem dan Teknologi Informasi.*
```

