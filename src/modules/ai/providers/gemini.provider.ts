export const getGeminiResponse = async (
  systemPrompt: string,
  userPrompt: string
) => {
  const apiKey = (process.env.GEMINI_API_KEY || "").trim();

  if (!apiKey) {
    throw new Error("GEMINI_API_KEY belum diset");
  }

  const url = `https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

  try {
    console.log("[Gemini] Request start...");

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: `${systemPrompt}\n\n${userPrompt}`,
              },
            ],
          },
        ],
      }),
    });

    const data: any = await response.json();

    if (!response.ok) {
      console.error("[Gemini API Error]:", JSON.stringify(data, null, 2));
      throw new Error(data.error?.message || "Gemini API error");
    }

    const text =
      data?.candidates?.[0]?.content?.parts?.find((p: any) => p?.text)?.text;

    if (!text) {
      throw new Error("Response Gemini kosong / tidak valid");
    }

    console.log("[Gemini] Success ✅");
    return text;
  } catch (error: any) {
    console.error("[Gemini Error]:", error.message);
    throw error;
  }
};