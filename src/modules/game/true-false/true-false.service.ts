export class TrueFalseService {
    static verifyAnswer(gameJson: any, index: number, selectedAnswer: boolean): boolean {
        const questionObj = gameJson.questions[index];
        if (!questionObj || typeof questionObj.correctAnswer !== "boolean") return false;
        // Membandingkan nilai boolean secara langsung
        return questionObj.correctAnswer === selectedAnswer;
    }

    static calculateScore(payload: any, gameJson?: any): number {
        const correctAnswers = payload.answersDetail?.filter((ans: any) =>
            TrueFalseService.verifyAnswer(gameJson, ans.questionIndex, ans.selectedAnswer)
        ).length || 0;
        let score = correctAnswers * 100;

        // Bonus tambahan untuk True/False jika dijawab dengan sangat cepat (refleks bagus)
        const timeSpent = payload.timeSpent || 0;
        if (payload.accuracy > 80 && timeSpent < 15) {
            score += 20;
        }
        return score;
    }
}