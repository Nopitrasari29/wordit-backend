import dotenv from "dotenv";
import Groq from "groq-sdk";

dotenv.config();

console.log("Testing API Keys...");
console.log("GROQ_API_KEY:", process.env.GROQ_API_KEY ? "EXISTS" : "MISSING");
console.log("GEMINI_API_KEY:", process.env.GEMINI_API_KEY ? "EXISTS" : "MISSING");

async function testGroq() {
  try {
    console.log("\n--- Testing Groq ---");
    const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
    const response = await groq.chat.completions.create({
      messages: [
        { role: "user", content: "Hello, reply with only one word: 'Success'" }
      ],
      model: "llama-3.1-8b-instant",
    });
    console.log("Groq Response:", response.choices[0]?.message?.content);
    console.log("Groq Test: SUCCESS ✅");
  } catch (error) {
    console.error("Groq Test: FAILED ❌", error.message);
    if (error.response) {
      console.error("Groq Response Error:", error.response.data);
    }
  }
}

async function testGemini(modelName) {
  try {
    console.log(`\n--- Testing Gemini with model: ${modelName} ---`);
    const apiKey = process.env.GEMINI_API_KEY;
    const url = `https://generativelanguage.googleapis.com/v1/models/${modelName}:generateContent?key=${apiKey}`;
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          { parts: [{ text: "Hello, reply with only one word: 'Success'" }] }
        ]
      })
    });
    const data = await response.json();
    if (!response.ok) {
      console.error(`Gemini Error Response (${response.status}):`, JSON.stringify(data, null, 2));
    } else {
      console.log("Gemini Response:", data?.candidates?.[0]?.content?.parts?.[0]?.text);
      console.log(`Gemini Test (${modelName}): SUCCESS ✅`);
    }
  } catch (error) {
    console.error(`Gemini Test (${modelName}): FAILED ❌`, error.message);
  }
}

async function run() {
  await testGroq();
  await testGemini("gemini-2.5-flash");
  await testGemini("gemini-1.5-flash");
  await testGemini("gemini-2.0-flash");
}

run();
