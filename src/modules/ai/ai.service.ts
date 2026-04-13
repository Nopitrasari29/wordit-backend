import { errorResponse } from "../../utils/response";
import type { GenerateQuizInput } from "./ai.schema"; // ✅ FIXED: Tambahkan kata 'type'

export abstract class AIService {
  static async generateQuiz(data: GenerateQuizInput) {
    try {
      console.log("🤖 Mencoba generate quiz pakai Groq (Llama 3)...");
      // TODO: Panggil GroqProvider di sini
      
      // Simulasi error untuk mengetes logic fallback ke Gemini
      throw new Error("Groq Limit reached"); 
      
    } catch (error) {
      console.log("⚠️ Groq gagal/limit, beralih ke Gemini (Fallback)...");
      // TODO: Panggil GeminiProvider di sini
      
      return { 
        message: "Quiz berhasil di-generate via Gemini",
        data: [] // Placeholder untuk hasil generate
      };
    }
  }
}