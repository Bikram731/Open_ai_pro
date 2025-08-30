// Import necessary libraries
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config(); // This loads the .env file

// --- CONFIGURATION ---
const PORT = 3000;
const API_KEY = process.env.GEMINI_API_KEY; // Your Google AI API Key from the .env file
const MODEL_NAME = "gemini-1.5-flash-latest"; // <-- CORRECTED MODEL NAME

// --- INITIALIZATION ---
const app = express();
app.use(express.json()); // Allow the server to understand JSON
app.use(cors()); // Allow the frontend to communicate with this server

// Check for API Key
if (!API_KEY) {
  throw new Error("GEMINI_API_KEY is not set. Please create a .env file and add your key.");
}
const genAI = new GoogleGenerativeAI(API_KEY);

// --- LOAD THE KNOWLEDGE BASE ---
let knowledgeBase;
try {
  const rawData = fs.readFileSync('knowledge_base.json');
  knowledgeBase = JSON.parse(rawData);
  console.log("Successfully loaded the SimPhy knowledge base.");
} catch (error) {
  console.error("CRITICAL ERROR: Failed to load or parse knowledge_base.json:", error);
  process.exit(1);
}

// --- SYSTEM PROMPT (The AI's Core Instructions) ---
const systemPrompt = `You are an expert SimPhy script generator. Your task is to convert a user's prompt into a complete, runnable JavaScript script using the provided SimPhy API knowledge base.

RULES:
1.  **Analyze the Prompt**: Identify all objects, their properties, and their relationships from the user's request.
2.  **Use the Knowledge Base**: You MUST use the provided API summary and concept dictionary to map user ideas to the correct API functions. Do not invent functions.
3.  **Make Smart Assumptions**: If the user doesn't specify a size, position, or mass, choose reasonable, stable values that will produce a visible simulation. Place objects in a sensible layout.
4.  **Follow a Strict Build Order**:
    a. Always start the script with World.clearAll() and World.setGravity().
    b. Create all Body objects first.
    c. Set all properties for each Body (mass, color, charge, etc.).
    d. Create all Joints to connect the bodies last.
    e. Set any final initial conditions (like rotation or velocity).
5.  **Handle Special Cases**: An "electric field" cannot be created from the script. If the user asks for one, add comments and a print statement reminding them to create it manually in the UI and name it "E".
6.  **Output Format**: Your final output MUST be only the JavaScript code, with helpful comments explaining each step. Do not include any other text, greetings, or explanations outside of the code comments.`;

// --- API ENDPOINT for generating scripts ---
app.post('/generate', async (req, res) => {
  const userPrompt = req.body.prompt;

  if (!userPrompt) {
    return res.status(400).json({ error: 'Prompt is required' });
  }

  console.log(`Received prompt: "${userPrompt}"`);

  try {
    const model = genAI.getGenerativeModel({ model: MODEL_NAME });

    const augmentedPrompt = `
      ---
      HERE IS THE KNOWLEDGE BASE. USE ONLY THESE FUNCTIONS AND CONCEPTS:
      ${JSON.stringify(knowledgeBase, null, 2)}
      ---
      HERE IS THE USER'S REQUEST:
      "${userPrompt}"
      ---
      GENERATE THE SCRIPT:
    `;

    const generationConfig = {
      temperature: 0.4,
      topK: 1,
      topP: 1,
      maxOutputTokens: 4096,
    };

    const chat = model.startChat({
        generationConfig,
        history: [{ role: "user", parts: [{ text: systemPrompt }] }]
    });

    const result = await chat.sendMessage(augmentedPrompt);
    const response = await result.response;
    const generatedScript = response.text();
    
    console.log("Script generated successfully.");
    res.json({ script: generatedScript });

  } catch (error) {
    console.error('Error calling the AI model:', error);
    res.status(500).json({ error: 'Failed to generate script' });
  }
});

// --- START THE SERVER ---
app.listen(PORT, () => {
  console.log(`Backend server is running on http://localhost:${PORT}`);
});

