const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const { v4: uuidv4 } = require('uuid');
const { chat } = require('./chat');
const { ingestDocuments, loadDocumentsOnStartup } = require('./ingest');
const path = require('path');

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// Store conversations in memory
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

    const sid = sessionId || uuidv4();
    if (!sessions[sid]) sessions[sid] = [];

    sessions[sid].push({ role: 'user', content: message });
    const reply = await chat(sessions[sid]);
    sessions[sid].push({ role: 'assistant', content: reply });

    res.json({ reply, sessionId: sid });

  } catch (error) {
    console.error('Chat error:', error.message);
    res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
});

// Ingest documents endpoint
app.post('/api/ingest', async (req, res) => {
  try {
    const count = await ingestDocuments();
    res.json({ success: true, message: `${count} chunks ingested successfully` });
  } catch (error) {
    console.error('Ingest error:', error.message);
    res.status(500).json({ error: 'Failed to ingest documents' });
  }
});

const PORT = process.env.PORT || 3000;
// Serve the chat widget
app.get('/chatbot.js', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/chatbot.js'));
});
app.use(express.static(path.join(__dirname, '../frontend')));
app.listen(PORT, async () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log('Loading documents...');
  await loadDocumentsOnStartup();
  console.log('Ready!');
});