const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const { v4: uuidv4 } = require('uuid');
const { chat } = require('./chat');

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// Store conversations in memory (simple start)
const sessions = {};

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Chatbot server is running' });
});

// Main chat endpoint
app.post('/api/chat', async (req, res) => {
  try {
    const { message, sessionId } = req.body;

    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    // Create or retrieve session
    const sid = sessionId || uuidv4();
    if (!sessions[sid]) {
      sessions[sid] = [];
    }

    // Add user message to history
    sessions[sid].push({ role: 'user', content: message });

    // Get AI response
    const reply = await chat(sessions[sid]);

    // Add AI response to history
    sessions[sid].push({ role: 'assistant', content: reply });

    res.json({ reply, sessionId: sid });

  } catch (error) {
    console.error('Chat error:', error.message);
    res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});