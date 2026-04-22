# 🎮 WordIT - Gamified Virtual Learning Platform (Backend)

**WordIT** adalah platform pembelajaran berbasis web yang menghadirkan elemen permainan (*gamified learning*) ke dalam kelas. Proyek ini dikembangkan menggunakan arsitektur modular yang berfokus pada performa *real-time*, otomatisasi AI, dan integrasi LMS Moodle (MyITS Classroom).

## 🚀 Tech Stack

* **Runtime:** [Bun](https://bun.sh/) (Fast All-in-One JavaScript Runtime)
* **Language:** TypeScript
* **Framework:** ExpressJS
* **ORM:** Prisma v7 (With `prisma.config.ts`)
* **Database:** PostgreSQL 16 (Containerized via Docker with **Persistent Volumes**)
* **Caching & Leaderboard:** Redis (For high-speed ranking & session management)
* **Real-time Engine:** Socket.io (Quizizz-style interactivity)
* **AI Providers:** Groq API (Llama 3) & Google Gemini API

---

## ⚙️ Instalasi & Setup

### 1. Clone & Install
```bash
git clone https://github.com/Nopitrasari29/wordit-backend.git
cd wordit-backend
bun install
```

### 2. Environment Variables
Buat file `.env` di root directory dan sesuaikan konfigurasinya:
```env
# Database (Port 5434 untuk akses dari luar Docker)
POSTGRES_PORT=5434
POSTGRES_NAME=wordit_db
POSTGRES_USER=wordit_user
POSTGRES_PASSWORD=wordit_pass
DATABASE_URL="postgresql://wordit_user:wordit_pass@localhost:5434/wordit_db"

# Security
JWT_SECRET=your_secret_key
PORT=3000

# AI Configuration
GROQ_API_KEY=your_groq_key
GEMINI_API_KEY=your_gemini_key
```

### 3. Database & Persistence
Proyek ini menggunakan **Named Volumes** agar data kuis tidak hilang saat container dimatikan.
```bash
# 🐘 Nyalakan PostgreSQL & Redis Container
docker-compose up -d

# 🔄 Jalankan Migrasi Prisma 7 (Pastikan prisma.config.ts sudah ada di root)
bunx prisma migrate dev --name init_wordit

# 🌱 Jalankan Seeding (Memasukkan kuis bawaan ke database)
bunx prisma db seed
```

### 4. Menjalankan Server
```bash
# Mode Development
bun run dev
```

---

## ✨ Fitur Utama

### 🏆 The Golden Six Templates
* **Anagram & Hangman:** Fokus pada penguasaan kosakata dan *spelling*.
* **Word Search & Flashcard:** Memperkuat daya ingat visual dan terminologi.
* **Maze Chase & Spin the Wheel:** Gamifikasi kuis interaktif dengan elemen keberuntungan & aksi.

### 🎓 Smart Learning System
* **Multi-level Education:** Adaptasi konten untuk SD, SMP, SMA, dan University.
* **AI Quiz Generator:** Membuat soal instan hanya dengan memasukkan materi atau topik.
* **LTI Connector:** Dukungan standar LtiContext untuk integrasi *seamless* dengan Moodle/Canvas.

---

## 📂 Struktur Folder Modular

```text
src/
├── config/             # Database, Env, & Redis Configuration
├── modules/            # Business Logic per Feature
│   ├── ai/             # AI Services (Groq/Gemini Integration)
│   ├── auth/           # RBAC Authentication System
│   ├── game/           # Game Engine & Logic (Golden Six)
│   └── user/           # Profile & Point Management
├── prisma/             # Schema & Database Migrations
├── seed/               # Data Dummy & Initial Seeding
├── app.ts              # Express Core Setup
└── socket.ts           # WebSocket Room & Event Management
```

---

## 👥 Tim Pengembang

* **Aswalia Novitriasari:** Project Manager & Backend Lead
* **Rafika Az Zahra:** Frontend Lead
* **Fadlilah Cantika:** AI Engineer
* **Syela Zeruya:** Quality Assurance & Business Analyst

