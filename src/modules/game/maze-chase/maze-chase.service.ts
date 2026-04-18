export class MazeChaseService {
  static verifyAnswer(gameJson: any, index: number, selectedAnswer: string): boolean {
    const questionObj = gameJson.questions[index];
    if (!questionObj) return false;
    // Mendukung pengecekan ke properti 'answer' atau 'a' (untuk kompatibilitas)
    const correctAnswer = questionObj.answer || questionObj.a;
    return correctAnswer.trim().toLowerCase() === (selectedAnswer || "").trim().toLowerCase();
  }

  static calculateScore(payload: any): number {
    const scorePerCorrect = 50;
    const correctAnswers = payload.answers?.filter((a: any) => a.isCorrect === true).length || 0;
    let totalScore = correctAnswers * scorePerCorrect;
    if (payload.accuracy === 100) totalScore += 100;
    return totalScore;
  }
}