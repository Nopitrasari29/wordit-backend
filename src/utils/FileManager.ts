// src/utils/FileManager.ts
import fs from "fs/promises";
import path from "path";

export abstract class FileManager {
  
  // Fungsi untuk upload file (dipanggil di service)
  static async upload(folder: string, file: Express.Multer.File | undefined): Promise<string | undefined> {
    if (!file) return undefined;

    // Folder tujuan (misal: uploads/user/profile/123-abc.jpg)
    const uploadPath = path.join(process.cwd(), 'uploads', folder);

    // Pastikan folder tujuan ada (recursive: true artinya bikin folder induk kalau belum ada)
    await fs.mkdir(uploadPath, { recursive: true });

    // Nama file unik
    const fileName = `${Date.now()}-${file.originalname}`;
    const fullPath = path.join(uploadPath, fileName);

    // Simpan file ke disk
    await fs.writeFile(fullPath, file.buffer);

    // Return path relatif agar bisa disimpan di DB (misal: "uploads/user/profile/123-abc.jpg")
    return path.join('uploads', folder, fileName).replace(/\\/g, '/');
  }

  // Fungsi untuk hapus file (PENTING untuk fitur Edit Profil biar storage tidak penuh)
  static async remove(filePath: string | null | undefined): Promise<void> {
    if (!filePath) return;

    try {
      const fullPath = path.join(process.cwd(), filePath);
      await fs.unlink(fullPath);
    } catch (error) {
      console.error(`Gagal menghapus file: ${filePath}`, error);
    }
  }
}