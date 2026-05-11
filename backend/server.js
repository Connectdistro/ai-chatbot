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
  saveDocument, getTenantDocuments, deleteDocument,
  getAllBots, createBot, assignBotToTenant, getBotsByTenant, removeBotFromTenant
} = require('./tenants');
const { chat } = require('./chat');
const {
  logAnalytics, saveMessage,
  getSessionHistory, getTenantAnalytics, saveRating
} = require('./analytics');
const supabase = require('./db'); // needed for direct bot update/delete

const app = express();
const upload = multer({ storage: multer.memoryStorage() });

app.use(cors());
app.use(express.json());

// ══════════════════════════════════════════
// STATIC FILES
// ══════════════════════════════════════════

const frontendPath = path.join(__dirname, '../frontend');
const adminPath = path.join(__dirname, '../admin');

console.log('Frontend path:', frontendPath);
console.log('Admin path:', adminPath);

app.use(express.static(frontendPath));
app.use('/admin', express.static(adminPath));

app.get('/admin', (req, res) => {
  res.sendFile(path.join(adminPath, 'index.html'));
});
app.get('/admin/index.html', (req, res) => {
  res.sendFile(path.join(adminPath, 'index.html'));
});
app.get('/admin/login.html', (req, res) => {
  res.sendFile(path.join(adminPath, 'login.html'));
});
app.get('/chatbot.js', (req, res) => {
  res.sendFile(path.join(frontendPath, 'chatbot.js'));
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
app.get('/api/admin/tenants', verifyToken, async (req, res) => {
  try {
    const tenants = await getAllTenants();
    res.json(tenants);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/admin/tenants', verifyToken, async (req, res) => {
  try {
    const tenant = await createTenant(req.body);
    res.json(tenant);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/admin/tenants/:id', verifyToken, async (req, res) => {
  try {
    const tenant = await getTenantById(req.params.id);
    res.json(tenant);
  } catch (error) {
    res.status(404).json({ error: 'Tenant not found' });
  }
});

app.put('/api/admin/tenants/:id', verifyToken, async (req, res) => {
  try {
    const tenant = await updateTenant(req.params.id, req.body);
    res.json(tenant);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/admin/tenants/:id', verifyToken, async (req, res) => {
  try {
    await deleteTenant(req.params.id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

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

app.get('/api/admin/tenants/:id/documents', verifyToken, async (req, res) => {
  try {
    const docs = await getTenantDocuments(req.params.id);
    res.json(docs);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/admin/documents/:docId', verifyToken, async (req, res) => {
  try {
    await deleteDocument(req.params.docId);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/admin/tenants/:id/analytics', verifyToken, async (req, res) => {
  try {
    const analytics = await getTenantAnalytics(req.params.id);
    res.json(analytics);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ══════════════════════════════════════════
// BOT MANAGEMENT ROUTES
// ══════════════════════════════════════════

// Get all bots (library)
app.get('/api/admin/bots', verifyToken, async (req, res) => {
  try {
    const bots = await getAllBots();
    res.json(bots);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create a new bot
app.post('/api/admin/bots', verifyToken, async (req, res) => {
  try {
    const bot = await createBot(req.body);
    res.json(bot);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update a bot
app.put('/api/admin/bots/:id', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, botName, botColor, systemPrompt } = req.body;
    const { data, error } = await supabase
      .from('bots')
      .update({
        name,
        description,
        bot_name: botName,
        bot_color: botColor,
        system_prompt: systemPrompt
      })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete a bot
app.delete('/api/admin/bots/:id', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    // First delete any assignments to avoid foreign key conflicts
    await supabase.from('tenant_bots').delete().eq('bot_id', id);
    const { error } = await supabase.from('bots').delete().eq('id', id);
    if (error) throw error;
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Assign a bot to a tenant
app.post('/api/admin/tenants/:tenantId/bots/:botId', verifyToken, async (req, res) => {
  try {
    const { tenantId, botId } = req.params;
    const assignment = await assignBotToTenant(tenantId, parseInt(botId));
    res.json({ success: true, assignment });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get all bots assigned to a specific tenant
app.get('/api/admin/tenants/:tenantId/bots', verifyToken, async (req, res) => {
  try {
    const bots = await getBotsByTenant(req.params.tenantId);
    res.json(bots);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Remove a bot from a tenant
app.delete('/api/admin/tenants/:tenantId/bots/:botId', verifyToken, async (req, res) => {
  try {
    const { tenantId, botId } = req.params;
    await removeBotFromTenant(tenantId, parseInt(botId));
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ══════════════════════════════════════════
// HELPER: Get effective bot config for a tenant
// Uses first assigned library bot, otherwise falls back to tenant's own config
// ══════════════════════════════════════════
async function getEffectiveBotConfig(tenantId) {
  const assignedBots = await getBotsByTenant(tenantId);
  if (assignedBots && assignedBots.length > 0) {
    // Use the first assigned bot from the library
    return {
      bot_name: assignedBots[0].bot_name,
      bot_color: assignedBots[0].bot_color,
      system_prompt: assignedBots[0].system_prompt
    };
  }
  // Fallback to tenant's own config (legacy)
  const tenant = await getTenantById(tenantId);
  return {
    bot_name: tenant.bot_name,
    bot_color: tenant.bot_color,
    system_prompt: tenant.system_prompt
  };
}

// ══════════════════════════════════════════
// PUBLIC CHAT ROUTES (per tenant)
// ══════════════════════════════════════════

// Tenant chat – now uses assigned library bots if available
app.post('/api/chat/:tenantId', async (req, res) => {
  try {
    const { tenantId } = req.params;
    const { message, sessionId } = req.body;

    if (!message) return res.status(400).json({ error: 'Message is required' });

    const tenant = await getTenantById(tenantId);
    if (!tenant || !tenant.is_active) {
      return res.status(404). json({ error: 'Chatbot not found or inactive' });
    }

    // Get effective bot config (library bot first, then tenant's own)
    const botConfig = await getEffectiveBotConfig(tenantId);

    const sid = sessionId || uuidv4();
    const history = await getSessionHistory(tenantId, sid);
    history.push({ role: 'user', content: message });

    // Use botConfig.system_prompt for the chat
    const reply = await chat(tenantId, botConfig.system_prompt, history);

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