const axios = require('axios');
const { searchDocuments } = require('./ingest');
const config = require('../config');

async function chat(history) {
  const lastMessage = history[history.length - 1].content;

  // Search for relevant documents
  const contextDocs = await searchDocuments(lastMessage);
  const context = contextDocs.length > 0
    ? `Relevant information from company documents:\n${contextDocs.join('\n\n')}`
    : 'No specific document context found.';

  // Build system prompt from config
  const systemPrompt = config.systemPrompt
    .replace('{botName}', config.botName)
    .replace('{businessName}', config.businessName)
    + `\n\n${context}`;

  const messages = [
    { role: 'system', content: systemPrompt },
    ...history
  ];

  try {
    const response = await axios.post(
      'https://api.deepseek.com/chat/completions',
      {
        model: 'deepseek-chat',
        messages,
        max_tokens: 500,
        temperature: 0.7
      },
      {
        headers: {
          'Authorization': `Bearer ${process.env.DEEPSEEK_API_KEY}`,
          'Content-Type': 'application/json'
        },
        timeout: 30000
      }
    );

    return response.data.choices[0].message.content;

  } catch (error) {
    if (error.response) {
      console.error('DeepSeek API Error:', error.response.status, JSON.stringify(error.response.data));
    } else {
      console.error('Chat error:', error.message);
    }
    throw error;
  }
}

module.exports = { chat };