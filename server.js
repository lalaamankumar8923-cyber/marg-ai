require('dotenv').config();
const { GoogleGenAI } = require('@google/genai');
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');

const ai = new GoogleGenAI({});
const app = express();
app.use(express.json());
app.use(cors());

// Connect to MongoDB Atlas (Cloud)
mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log("🔥 Connected to MongoDB Atlas (Cloud) successfully!"))
    .catch(err => console.error("MongoDB Connection Error:", err));


const bcrypt = require('bcrypt');

// ==== USER SCHEMA (Account Data) ====
const userSchema = new mongoose.Schema({
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true }
});
const User = mongoose.model('User', userSchema);

// ==== SIGNUP API ====
app.post('/api/signup', async (req, res) => {
    try {
        const { email, password } = req.body;
        
        // Check karein agar email pehle se hai
        const existingUser = await User.findOne({ email: email });
        if (existingUser) {
            return res.status(400).json({ error: "Ye email pehle se registered hai!" });
        }

        // Password ko encrypt karna
        const hashedPassword = await bcrypt.hash(password, 10);
        
        // Naya user save karna
        const newUser = new User({ email: email, password: hashedPassword });
        await newUser.save();
        
        res.json({ success: true, message: "Account successfully ban gaya!" });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Signup fail ho gaya." });
    }
});

// ==== LOGIN API ====
app.post('/api/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        
        // User ko database mein dhoondhna
        const user = await User.findOne({ email: email });
        if (!user) {
            return res.status(400).json({ error: "Account nahi mila. Pehle Signup karein." });
        }

        // Password match karna
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(400).json({ error: "Galat password!" });
        }

        res.json({ success: true, message: "Login successful!", email: user.email });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Login fail ho gaya." });
    }
});

// 2. Database Schema (Roadmap save karne ka format)
const roadmapSchema = new mongoose.Schema({
    email: String,
    goal: String,
    level: String,
    date: String,
    roadmapData: Array
});
const Roadmap = mongoose.model('Roadmap', roadmapSchema);

app.post('/api/generate-roadmap', async (req, res) => {
    try {
        // 1. User ka goal aur level receive karna
        const { goal, level } = req.body;
        console.log(`[REAL AI MODE] Generating roadmap for goal: ${goal}, level: ${level}`);

        // 2. Updated Prompt (Short Goal + 6 Milestones)
        const prompt = `You are a career counselor. The user asked: "${goal}". 
        Extract ONLY the core career goal in 1 to 3 words. Format it in Title Case (Capitalize the first letter of each word).
        Create a roadmap for this goal at a "${level}" level. Provide exactly 6 milestones.
        Return ONLY a valid JSON object in this exact format:
        {
            "shortGoal": "Extracted Title Case Goal",
            "roadmap": [
                { "step": 1, "title": "Title here", "desc": "Description here" }
            ]
        }
        Make sure to return exactly 6 objects in the roadmap array. Do not include markdown or extra text.`;

        // 3. Google Gemini API Call (Yahan apna sahi model name rakhna)
        const response = await ai.models.generateContent({
            model: 'gemini-3.8-flash', 
            contents: prompt,
        });

        // 4. AI ke response ko clean aur parse karna
        let aiResponseText = response.text.trim();
        aiResponseText = aiResponseText.replace(/```json/g, '').replace(/```/g, '').trim();
        const data = JSON.parse(aiResponseText);

        // 5. Cleaned data ko frontend par bhejna
        res.json({ 
            shortTitle: data.shortGoal, 
            roadmap: data.roadmap 
        });

    } catch (error) {
        // 6. Agar koi error aaye toh server crash na ho
        console.error("AI Generation Error:", error);
        res.status(500).json({ error: "Failed to generate AI roadmap." });
    }
});

const PORT = 3000;
app.listen(PORT, () => console.log(`🚀 Marg.ai Server running on http://localhost:${PORT}`));