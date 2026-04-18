export class SpinTheWheelService {
  static verifyAnswer(gameJson: any, index: number, selectedAnswer: string): boolean {
    const questionObj = gameJson.questions[index];
    if (!questionObj) return false;
    return questionObj.answer.trim().toLowerCase() === (selectedAnswer || "").trim().toLowerCase();
  }

  static calculateScore(payload: any): number {
    const scorePerItem = 100;
    const itemsCompleted = payload.answers?.length || 0;
    const accuracy = payload.accuracy || 0;
    return Math.round((itemsCompleted * scorePerItem * accuracy) / 100);
  }
}