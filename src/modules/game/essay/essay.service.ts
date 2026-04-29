export class EssayService {
    static verifyAnswer(gameJson: any, index: number, selectedAnswer: string): boolean {
        // 🤖 Essay menggunakan AI Smart Grading di akhir permainan.
        // Untuk keperluan socket realtime (agar tidak error), kita defaultkan ke true.
        // Penilaian aslinya dilakukan di finishGame via AI.
        return true;
    }

    static calculateScore(payload: any, gameJson?: any): number {
        // Skor essay dihitung murni dari hasil tembakan API AI Groq (disimpan di FE dan dikirim via payload).
        // Jadi backend cukup mengembalikan nilai yang sudah diberikan oleh AI.
        const scoreFromAI = payload.scoreValue || 0;
        return scoreFromAI;
    }
}