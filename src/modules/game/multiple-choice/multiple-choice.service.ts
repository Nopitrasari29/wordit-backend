export class MultipleChoiceService {
    static verifyAnswer(gameJson: any, index: number, selectedAnswer: string): boolean {
        const questionObj = gameJson.questions[index];
        if (!questionObj || !questionObj.correctAnswer) return false;
        // Cek apakah opsi yang dipilih sama persis dengan kunci jawaban
        return questionObj.correctAnswer.trim() === (selectedAnswer || "").trim();
    }

    static calculateScore(payload: any, gameJson?: any): number {
        const correctAnswers = payload.answersDetail?.filter((ans: any) =>
            MultipleChoiceService.verifyAnswer(gameJson, ans.questionIndex, ans.selectedAnswer)
        ).length || 0;
        return correctAnswers * 100;
    }
}