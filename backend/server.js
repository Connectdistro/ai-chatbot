const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const pdfParse = require('pdf-parse');

dotenv.config();

const { loginAdmin, verifyToken } = require('./auth');
const {
  createTenant, getAllTenants, getTenantById,
  getTenantByApiKey, updateTenant, deleteTenant,
  saveDocument, getTenantDocuments, deleteDocument
} = require('./tenants');
const { chat } = require('./chat');
const {
  logAnalytics, saveMessage,
  getSessionHistory, getTenantAnalytics, saveRating
} = require('./analytics');

const app = express();
const upload = multer({ storage: multer.memoryStorage() });

app.use(cors());
app.use(express.json());

// ══════════════════════════════════════════
// STATIC FILES
// ══════════════════════════════════════════

// Serve frontend files
app.use(express.static(path.join(__dirname, '../frontend')));

// Serve admin files
app.use('/admin', express.static(path.join(__dirname, '../admin')));

// Explicit routes for admin pages
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, '../admin/index.html'));
});
app.get('/admin/index.html', (req, res) => {
  res.sendFile(path.join(__dirname, '../admin/index.html'));
});
app.get('/admin/login.html', (req, res) => {
  res.sendFile(path.join(__dirname, '../admin/login.html'));
});

// Serve chat widget explicitly
app.get('/chatbot.js', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/chatbot.js'));
});

// ══════════════════════════════════════════
// HEALTH CHECK
// ══════════════════════════════════════════

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Multi-tenant chatbot server running' });
});

// ══════════════════════════════════════════
// AUTH ROUTES
// ══════════════════════════════════════════

app.post('/api/admin/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const token = await loginAdmin(username, password);
    res.json({ success: true, token });
  } catch (error) {
    res.status(401).json({ error: error.message });
  }
});

// ══════════════════════════════════════════
// TENANT MANAGEMENT ROUTES (protected)
// ══════════════════════════════════════════

// Get all tenants
app.get('/api/admin/tenants', verifyToken, async (req, res) => {
  try {
    const tenants = await getAllTenants();
    res.json(tenants);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create tenant
app.post('/api/admin/tenants', verifyToken, async (req, res) => {
  try {
    const tenant = await createTenant(req.body);
    res.json(tenant);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get single tenant
app.get('/api/admin/tenants/:id', verifyToken, async (req, res) => {
  try {
    const tenant = await getTenantById(req.params.id);
    res.json(tenant);
  } catch (error) {
    res.status(404).json({ error: 'Tenant not found' });
  }
});

// Update tenant
app.put('/api/admin/tenants/:id', verifyToken, async (req, res) => {
  try {
    const tenant = await updateTenant(req.params.id, req.body);
    res.json(tenant);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete tenant
app.delete('/api/admin/tenants/:id', verifyToken, async (req, res) => {
  try {
    await deleteTenant(req.params.id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Upload document for tenant
app.post('/api/admin/tenants/:id/documents', verifyToken, upload.single('file'), async (req, res) => {
  try {
    const { id } = req.params;
    const file = req.file;
    if (!file) return res.status(400).json({ error: 'No file uploaded' });

    let content = '';
    if (file.mimetype === 'application/pdf') {
      const parsed = await pdfParse(file.buffer);
      content = parsed.text;
    } else {
      content = file.buffer.toString('utf-8');
    }

    const doc = await saveDocument(id, file.originalname, content);
    res.json({ success: true, document: doc });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get tenant documents
app.get('/api/admin/tenants/:id/documents', verifyToken, async (req, res) => {
  try {
    const docs = await getTenantDocuments(req.params.id);
    res.json(docs);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete document
app.delete('/api/admin/documents/:docId', verifyToken, async (req, res) => {
  try {
    await deleteDocument(req.params.docId);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get tenant analytics
app.get('/api/admin/tenants/:id/analytics', verifyToken, async (req, res) => {
  try {
    const analytics = await getTenantAnalytics(req.params.id);
    res.json(analytics);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ══════════════════════════════════════════
// PUBLIC CHAT ROUTES (per tenant)
// ══════════════════════════════════════════

// Tenant chat
app.post('/api/chat/:tenantId', async (req, res) => {
  try {
    const { tenantId } = req.params;
    const { message, sessionId } = req.body;

    if (!message) return res.status(400).json({ error: 'Message is required' });

    const tenant = await getTenantById(tenantId);
    if (!tenant || !tenant.is_active) {
      return res.status(404).json({ error: 'Chatbot not found or inactive' });
    }

    const sid = sessionId || uuidv4();
    const history = await getSessionHistory(tenantId, sid);
    history.push({ role: 'user', content: message });

    const reply = await chat(tenantId, tenant.system_prompt, history);

    await saveMessage(tenantId, sid, 'user', message);
    await saveMessage(tenantId, sid, 'assistant', reply);
    await logAnalytics(tenantId, sid, message, reply);

    res.json({ reply, sessionId: sid });

  } catch (error) {
    console.error('Chat error:', error.message);
    res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
});

// Rate a response
app.post('/api/chat/:tenantId/rate', async (req, res) => {
  try {
    const { tenantId } = req.params;
    const { sessionId, rating } = req.body;
    await saveRating(tenantId, sessionId, rating);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Legacy chat route (no tenant)
app.post('/api/chat', async (req, res) => {
  res.status(400).json({
    error: 'Please use /api/chat/:tenantId — see your admin dashboard for your tenant ID.'
  });
});

// ══════════════════════════════════════════
// START SERVER
// ══════════════════════════════════════════

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ Multi-tenant server running on http://localhost:${PORT}`);
  console.log(`🔧 Admin dashboard: http://localhost:${PORT}/admin`);
  console.log(`💬 Chat API: http://localhost:${PORT}/api/chat/:tenantId`);
});