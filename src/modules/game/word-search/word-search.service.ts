export class WordSearchService {
  static verifyAnswer(gameJson: any, index: number, selectedAnswer: string): boolean {
    // Word Search memverifikasi apakah input user ada di daftar kata target
    const targetWords = gameJson.words.map((w: any) => w.word.toLowerCase());
    return targetWords.includes((selectedAnswer || "").trim().toLowerCase());
  }

  static calculateScore(payload: any): number {
    const scorePerCorrect = 100;
    const correctCount = payload.answers?.filter((a: any) => a.isCorrect === true).length || 0;
    return correctCount * scorePerCorrect;
  }
}