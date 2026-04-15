import Groq from "groq-sdk";

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

export const getGroqResponse = async (systemPrompt: string, userPrompt: string) => {
  try {
    console.log("[Groq] Request start...");

    const response = await groq.chat.completions.create({
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      // Menggunakan model Llama 3.1 terbaru
      model: "llama-3.1-8b-instant", 
      temperature: 0.7,
      response_format: { type: "json_object" },
    });

    console.log("[Groq] Success ✅");
    return response.choices[0]?.message?.content;
  } catch (error: any) {
    console.error("[Groq Error]:", error.message);
    throw error;
  }
};