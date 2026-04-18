# 🎮 WordIT - Gamified Virtual Learning Platform (Backend)

**WordIT** adalah platform pembelajaran berbasis web yang menghadirkan elemen permainan (*gamified learning*) ke dalam kelas. Proyek ini dikembangkan menggunakan arsitektur modular yang berfokus pada performa *real-time*, otomatisasi AI, dan integrasi LMS Moodle.

## 🚀 Tech Stack

* **Runtime:** [Bun](https://bun.sh/) (Fast All-in-One JavaScript Runtime)
* **Language:** TypeScript
* **Framework:** ExpressJS
* **ORM:** Prisma v7
* **Database:** PostgreSQL (Containerized via Docker)
* **Caching & Leaderboard:** Redis (For high-speed ranking)
* **Real-time Engine:** Socket.io (Quizizz-style interactivity)
* **AI Providers:** Groq API (Llama 3) & Google Gemini API

---

## ✨ Fitur Utama

### 🏆 The Golden Six Templates
Enam template game interaktif yang terstandarisasi untuk berbagai metode belajar:
* **Anagram & Hangman:** Fokus pada penguasaan kosakata.
* **Word Search & Flashcard:** Memperkuat daya ingat visual.
* **Maze Chase & Spin the Wheel:** Gamifikasi kuis interaktif.

### 🎓 Smart Learning System
* **Education Level System:** Adaptasi konten untuk SD, SMP, SMA, dan University.
* **AI Quiz Generator:** Pembuatan soal otomatis berbasis materi pengajar.
* **Moodle LMS Connector:** Integrasi LTI untuk akses langsung dari MyITS Classroom.

---

## 📂 Struktur Folder Modular

```text
src/
├── config/             # Database, Env, & Redis Configuration
├── middleware/         # Auth (RBAC) & Upload Handling
├── modules/            # Business Logic per Feature
│   ├── ai/             # AI Services & Providers (Groq/Gemini)
│   ├── auth/           # Authentication System
│   ├── game/           # Game Engine & Golden Six Templates
│   └── user/           # User & Profile Management
├── types/              # Global TypeScript Definitions
├── utils/              # Hashing, JWT, & Response Handlers
├── app.ts              # Express App Setup
└── socket.ts           # WebSocket Room Management
```

---

## ⚙️ Instalasi & Setup

### 1. Clone & Install
```bash
git clone https://github.com/Nopitrasari29/wordit-backend.git
cd wordit-backend
bun install
```

### 2. Database & Seeding
```bash
# Nyalakan PostgreSQL Container
docker compose up -d

# Jalankan Migrasi & Generate Client
bun x prisma migrate dev --name init_wordit

# Jalankan Seeding (Data Dummy Explore)
bun run src/seed/index.ts
```

### 3. Menjalankan Server
```bash
# Mode Development
bun start dev
```

---

## 👥 Tim Pengembang

* **Aswalia Novitriasari:** Project Manager & Backend Lead
* **Rafika Az Zahra:** Frontend Lead
* **Fadlilah Cantika:** AI Engineer
* **Syela Zeruya:** Quality Assurance & Business Analyst

---
