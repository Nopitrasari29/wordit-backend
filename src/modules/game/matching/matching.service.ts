export class MatchingService {
    static verifyAnswer(gameJson: any, index: number, selectedAnswer: any): boolean {
        // Asumsi selectedAnswer adalah objek { leftItem: "A", rightItem: "B" }
        if (!selectedAnswer || !selectedAnswer.leftItem || !selectedAnswer.rightItem) return false;

        const pair = gameJson.pairs?.find((p: any) => p.leftItem === selectedAnswer.leftItem);
        if (!pair) return false;

        return pair.rightItem.trim() === selectedAnswer.rightItem.trim();
    }

    static calculateScore(payload: any, gameJson?: any): number {
        const scorePerMatch = 30;
        const correctMatches = payload.answers?.filter((a: any) => a.isCorrect === true).length || 0;

        let totalScore = correctMatches * scorePerMatch;

        // Bonus jika berhasil memasangkan semuanya tanpa salah (akurasi 100%)
        if (payload.accuracy === 100) {
            totalScore += 50;
        }
        return totalScore;
    }
}