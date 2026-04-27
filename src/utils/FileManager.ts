// src/utils/FileManager.ts
import fs from "fs/promises";
import path from "path";

export abstract class FileManager {
  static async upload(folder: string, file: Express.Multer.File | undefined): Promise<string | null> {
    if (!file) return null; // ✅ Ubah undefined jadi null

    const uploadPath = path.join(process.cwd(), 'uploads', folder);
    await fs.mkdir(uploadPath, { recursive: true });

    const fileName = `${Date.now()}-${file.originalname}`;
    const fullPath = path.join(uploadPath, fileName);

    await fs.writeFile(fullPath, file.buffer);

    return path.join('uploads', folder, fileName).replace(/\\/g, '/');
  }

  static async remove(filePath: string | null | undefined): Promise<void> {
    if (!filePath) return;

    try {
      // ✅ Cek apakah file benar-benar ada sebelum dihapus
      const fullPath = path.join(process.cwd(), filePath);
      await fs.unlink(fullPath);
    } catch (error) {
      console.error(`Gagal menghapus file: ${filePath}`, error);
    }
  }
}