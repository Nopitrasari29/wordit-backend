export class MultipleChoiceService {
    static verifyAnswer(gameJson: any, index: number, selectedAnswer: string): boolean {
        const questionObj = gameJson.questions[index];
        if (!questionObj || !questionObj.correctAnswer) return false;
        // Cek apakah opsi yang dipilih sama persis dengan kunci jawaban
        return questionObj.correctAnswer.trim() === (selectedAnswer || "").trim();
    }

    static calculateScore(payload: any, gameJson?: any): number {
        const baseScorePerQuestion = 100;
        const accuracy = payload.accuracy || 0;
        // Semakin akurat, skor semakin besar
        let score = Math.round((baseScorePerQuestion * accuracy) / 100);
        return score;
    }
}