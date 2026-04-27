export class HangmanService {
  static verifyAnswer(gameJson: any, index: number, selectedAnswer: string): boolean {
    const questionObj = gameJson.words[index]; // Ambil objek, bukan string langsung
    if (!questionObj || !questionObj.word) return false;
    return questionObj.word.trim().toLowerCase() === (selectedAnswer || "").trim().toLowerCase();
  }

  static calculateScore(payload: any, gameJson: any): number {
    const baseScorePerWord = 100;
    const accuracy = payload.accuracy || 0;
    const timeSpent = payload.timeSpent || 0;
    let score = Math.round((baseScorePerWord * accuracy) / 100);
    if (accuracy > 0 && timeSpent < 30) score += (30 - timeSpent) * 2;
    return score;
  }
}