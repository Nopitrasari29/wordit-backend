# WordIT - Gamified Virtual Learning Platform (Backend)

**WordIT** adalah platform pembelajaran berbasis web yang menghadirkan elemen permainan (*gamified learning*) ke dalam kelas. Dikembangkan menggunakan arsitektur modular yang berfokus pada performa *real-time*, otomatisasi AI, dan standalone web app.

## Tech Stack

| Layer | Teknologi |
|-------|-----------|
| **Runtime** | [Bun](https://bun.sh/) |
| **Language** | TypeScript |
| **Framework** | ExpressJS |
| **ORM** | Prisma v7 (dengan `prisma.config.ts`) |
| **Database** | PostgreSQL 16 (Docker + Named Volume) |
| **Cache & Leaderboard** | Redis |
| **Real-time** | Socket.io |
| **AI** | Groq API (Llama 3) & Google Gemini API |

---

## Instalasi & Setup (Fresh Install)

### 1. Clone & Install
```bash
git clone https://github.com/Nopitrasari29/wordit-backend.git
cd wordit-backend
bun install
```

### 2. Environment Variables
Buat file `.env` di root directory:
```env
# Database
POSTGRES_PORT=5434
POSTGRES_NAME=wordit_db
POSTGRES_USER=wordit_user
POSTGRES_PASSWORD=wordit_pass
DATABASE_URL="postgresql://wordit_user:wordit_pass@localhost:5434/wordit_db"

# Security
JWT_SECRET=your_secret_key
PORT=3000

# AI
GROQ_API_KEY=your_groq_key
GEMINI_API_KEY=your_gemini_key
```

### 3. Jalankan Database (Docker)
```bash
docker-compose up -d
```
> Data tersimpan di Docker **named volume** `wordit_postgres_data` — tidak hilang saat container dimatikan.

### 4. Migrasi & Seeding
```bash
bunx prisma migrate deploy
bun run seed
```

### 5. Jalankan Server
```bash
bun run dev
```

---

## Panduan Startup Harian

### Setiap kali mau development (setelah setup awal):
```bash
# 1. Nyalakan Docker
docker-compose up -d

# 2. Langsung jalankan server
bun run dev
```
> Tidak perlu migrate atau seed lagi selama tidak ada perubahan schema.

### Cek Docker berjalan:
```bash
docker ps   # Pastikan wordit-database & wordit-redis statusnya "Up"
```

### Kalau port 3000 sudah terpakai:
```bash
# Cari PID yang pakai port 3000
netstat -ano | findstr :3000

# Kill proses-nya (ganti 1234 dengan PID yang ditemukan)
taskkill /F /PID 1234
```

---

## Kapan Perlu Migrate / Generate / Seed?

| Situasi | Command |
|---------|---------|
| Fresh install pertama kali | `migrate deploy` → `seed` → `dev` |
| Ada perubahan `schema.prisma` | `migrate dev --name <nama>` → `generate` → `dev` |
| node_modules hilang / reinstall | `bun install` → `generate` → `dev` |
| Database kosong / reset | `seed` (aman, tidak hapus data user) |
| Sehari-hari | `docker-compose up -d` → `bun run dev` |

---

## Akun Bawaan (Setelah Seed)

| Role | Email | Password | Status |
|------|-------|----------|--------|
| **ADMIN** | `admin@wordit.com` | `admin123` | APPROVED |
| TEACHER (SD) | `sari@wordit.com` | `password123` | APPROVED |
| TEACHER (Univ) | `budi@wordit.com` | `password123` | APPROVED |
| STUDENT | `andi@wordit.com` | `password123` | APPROVED |

> **Penting:** Admin **tidak bisa** register via endpoint. Admin hanya dibuat melalui seed/database langsung.

---

## API Endpoints Utama

### Auth
| Method | Endpoint | Akses | Keterangan |
|--------|----------|-------|------------|
| POST | `/api/auth/register` | Public | Hanya STUDENT & TEACHER. Teacher → status PENDING |
| POST | `/api/auth/login` | Public | Teacher PENDING/REJECTED akan ditolak |
| POST | `/api/auth/logout` | Login | Logout |

### Users (Admin)
| Method | Endpoint | Akses | Keterangan |
|--------|----------|-------|------------|
| GET | `/api/users` | Admin | List semua user (filter: role, approvalStatus, search) |
| PATCH | `/api/users/:id/approve` | Admin | Approve/Reject Teacher (`{ action: "APPROVE" \| "REJECT" }`) |
| PATCH | `/api/users/:id/role` | Admin | Ganti role user |
| DELETE | `/api/users/:id` | Admin | Hapus user |
| GET | `/api/users/profile` | Login | Lihat profil sendiri |
| PATCH | `/api/users/profile` | Login | Update profil |

### Games
| Method | Endpoint | Akses | Keterangan |
|--------|----------|-------|------------|
| GET | `/api/games` | Public | List game (filter: level, template, search) |
| POST | `/api/games` | Teacher | Buat game baru |
| PATCH | `/api/games/:id` | Teacher | Edit game |
| PATCH | `/api/games/:id/publish` | Teacher | Publish/unpublish |
| DELETE | `/api/games/:id` | Teacher | Hapus game |
| POST | `/api/games/:id/play` | Student/Teacher | Mulai sesi bermain |
| POST | `/api/games/:id/submit` | Student/Teacher | Submit jawaban (real-time Redis+Socket) |
| POST | `/api/games/:id/finish` | Student/Teacher | Simpan skor final ke database |

---

## Fitur Utama

### The Golden Six Templates
- **Anagram & Hangman** — Penguasaan kosakata dan spelling
- **Word Search & Flashcard** — Daya ingat visual dan terminologi
- **Maze Chase & Spin the Wheel** — Gamifikasi kuis interaktif

### Sistem Role & Approval
- **Student** — Langsung aktif setelah register
- **Teacher** — Status PENDING, perlu approval Admin sebelum bisa login
- **Admin** — Hanya via seed/database, tidak bisa register

---

## Struktur Folder

```
src/
├── config/         # Database, Env, Redis
├── modules/
│   ├── ai/         # Groq/Gemini Integration
│   ├── auth/       # Authentication & Authorization
│   ├── game/       # Game Engine (Golden Six)
│   └── user/       # Profile & User Management
├── middleware/     # Auth, Upload
├── utils/          # Helper functions
├── app.ts          # Express setup
└── socket.ts       # WebSocket (Socket.io)
prisma/
├── schema.prisma   # Database schema
├── migrations/     # Migration history
├── seed/           # Seed data
└── prisma.config.ts
```

---

## Tim Pengembang

| Nama | Role |
|------|------|
| **Aswalia Novitriasari** | Project Manager & Backend Lead |
| **Rafika Az Zahra** | Frontend Lead |
| **Fadlilah Cantika** | AI Engineer |
| **Syela Zeruya** | Quality Assurance & Business Analyst |