export class AnagramService {
  static verifyAnswer(gameJson: any, index: number, selectedAnswer: string): boolean {
    const questionObj = gameJson.words[index];
    if (!questionObj || !questionObj.word) return false;
    return questionObj.word.toString().trim().toLowerCase() === (selectedAnswer || "").trim().toLowerCase();
  }

  static calculateScore(payload: any, gameJson: any): number {
    const baseScore = 150;
    const accuracy = payload.accuracy || 0;
    const timeSpent = payload.timeSpent || 0;
    let score = Math.round((baseScore * accuracy) / 100);
    if (accuracy === 100 && timeSpent < 20) score += (20 - timeSpent) * 5;
    return score;
  }
}