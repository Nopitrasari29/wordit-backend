export class FlashcardService {
  static verifyAnswer(gameJson: any, index: number, selectedAnswer: string): boolean {
    const card = gameJson.cards[index];
    if (!card) return false;
    return card.back.trim().toLowerCase() === (selectedAnswer || "").trim().toLowerCase();
  }

  static calculateScore(payload: any): number {
    const scorePerCard = 20;
    const cardsFinished = payload.answers?.length || 0;
    return cardsFinished * scorePerCard;
  }
}