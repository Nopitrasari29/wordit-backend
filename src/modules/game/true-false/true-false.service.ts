export class TrueFalseService {
    static verifyAnswer(gameJson: any, index: number, selectedAnswer: boolean): boolean {
        const questionObj = gameJson.questions[index];
        if (!questionObj || typeof questionObj.correctAnswer !== "boolean") return false;
        // Membandingkan nilai boolean secara langsung
        return questionObj.correctAnswer === selectedAnswer;
    }

    static calculateScore(payload: any, gameJson?: any): number {
        const baseScorePerQuestion = 50; // Skor agak lebih kecil karena kesulitannya 50:50
        const accuracy = payload.accuracy || 0;
        const timeSpent = payload.timeSpent || 0;

        let score = Math.round((baseScorePerQuestion * accuracy) / 100);

        // Bonus tambahan untuk True/False jika dijawab dengan sangat cepat (refleks bagus)
        if (accuracy > 80 && timeSpent < 15) {
            score += 20;
        }
        return score;
    }
}