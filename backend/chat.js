const axios = require('axios');
const { getTenantDocuments } = require('./tenants');

// Simple keyword search across tenant documents
function searchDocuments(docs, query, nResults = 3) {
  if (!docs || docs.length === 0) return [];

  const queryWords = query.toLowerCase().split(/\s+/);
  const chunks = [];

  // Break each document into chunks
  docs.forEach(doc => {
    const words = doc.content.split(/\s+/);
    for (let i = 0; i < words.length; i += 450) {
      chunks.push(words.slice(i, i + 500).join(' '));
    }
  });

  const scored = chunks.map(chunk => {
    const lower = chunk.toLowerCase();
    const score = queryWords.reduce((acc, w) => acc + (lower.includes(w) ? 1 : 0), 0);
    return { chunk, score };
  });

  return scored
    .filter(item => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, nResults)
    .map(item => item.chunk);
}

async function chat(tenantId, systemPrompt, history) {
  const lastMessage = history[history.length - 1].content;

  // Load tenant documents and search
  let context = 'No specific document context available.';
  try {
    const docs = await getTenantDocuments(tenantId);
    const results = searchDocuments(docs, lastMessage);
    if (results.length > 0) {
      context = `Relevant information from company documents:\n\n${results.join('\n\n')}`;
    }
  } catch (err) {
    console.error('Document search error:', err.message);
  }

  const fullSystemPrompt = `${systemPrompt}\n\n${context}`;

  const messages = [
    { role: 'system', content: fullSystemPrompt },
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
      console.error('DeepSeek Error:', error.response.status, JSON.stringify(error.response.data));
    } else {
      console.error('Chat error:', error.message);
    }
    throw error;
  }
}

module.exports = { chat };