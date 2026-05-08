const fs = require('fs');
const path = require('path');
const pdfParse = require('pdf-parse');
const { ChromaClient } = require('chromadb');

const client = new ChromaClient({ path: "http://localhost:8000" });

// Simple in-memory vector store (no external server needed)
let documentChunks = [];

// Split text into chunks
function chunkText(text, chunkSize = 500, overlap = 50) {
  const words = text.split(/\s+/);
  const chunks = [];
  for (let i = 0; i < words.length; i += chunkSize - overlap) {
    const chunk = words.slice(i, i + chunkSize).join(' ');
    if (chunk.trim().length > 20) chunks.push(chunk);
  }
  return chunks;
}

// Simple keyword search (no embeddings server needed)
function searchDocuments(query, nResults = 3) {
  if (documentChunks.length === 0) return [];
  
  const queryWords = query.toLowerCase().split(/\s+/);
  
  // Score each chunk by keyword matches
  const scored = documentChunks.map(chunk => {
    const chunkLower = chunk.toLowerCase();
    const score = queryWords.reduce((acc, word) => {
      return acc + (chunkLower.includes(word) ? 1 : 0);
    }, 0);
    return { chunk, score };
  });

  // Return top results with at least one match
  return scored
    .filter(item => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, nResults)
    .map(item => item.chunk);
}

// Ingest all documents from the data folder
async function ingestDocuments() {
  const dataDir = path.join(__dirname, '../data');
  const files = fs.readdirSync(dataDir).filter(f =>
    f.endsWith('.txt') || f.endsWith('.pdf') || f.endsWith('.md')
  );

  if (files.length === 0) {
    console.log('No documents found in /data folder');
    return;
  }

  documentChunks = []; // Reset

  for (const file of files) {
    console.log(`Processing: ${file}`);
    const filePath = path.join(dataDir, file);
    let text = '';

    if (file.endsWith('.pdf')) {
      const buffer = fs.readFileSync(filePath);
      const parsed = await pdfParse(buffer);
      text = parsed.text;
    } else {
      text = fs.readFileSync(filePath, 'utf-8');
    }

    const chunks = chunkText(text);
    documentChunks.push(...chunks);
    console.log(`  ✓ ${file} — ${chunks.length} chunks loaded`);
  }

  console.log(`\nDone! ${documentChunks.length} total chunks ready for search`);
  return documentChunks.length;
}

// Load documents automatically on startup
async function loadDocumentsOnStartup() {
  try {
    await ingestDocuments();
  } catch (err) {
    console.log('No documents loaded:', err.message);
  }
}

module.exports = { ingestDocuments, searchDocuments, loadDocumentsOnStartup };