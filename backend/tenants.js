const supabase = require('./db');
const { v4: uuidv4 } = require('uuid');

// Create a new tenant
async function createTenant(data) {
  const apiKey = 'tk_' + uuidv4().replace(/-/g, '');

  const { data: tenant, error } = await supabase
    .from('tenants')
    .insert([{
      name: data.name,
      website: data.website || '',
      bot_name: data.botName || 'AI Assistant',
      bot_color: data.botColor || '#DAA520',
      system_prompt: data.systemPrompt || `You are a helpful AI assistant for ${data.name}. Be friendly, concise, and professional. Answer questions using the provided context. If unsure, say so honestly.`,
      api_key: apiKey,
      is_active: true
    }])
    .select()
    .single();

  if (error) throw error;
  return tenant;
}

// Get all tenants
async function getAllTenants() {
  const { data, error } = await supabase
    .from('tenants')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data;
}

// Get single tenant by ID
async function getTenantById(id) {
  const { data, error } = await supabase
    .from('tenants')
    .select('*')
    .eq('id', id)
    .single();

  if (error) throw error;
  return data;
}

// Get tenant by API key
async function getTenantByApiKey(apiKey) {
  const { data, error } = await supabase
    .from('tenants')
    .select('*')
    .eq('api_key', apiKey)
    .eq('is_active', true)
    .single();

  if (error) return null;
  return data;
}

// Update tenant
async function updateTenant(id, updates) {
  const { data, error } = await supabase
    .from('tenants')
    .update({
      name: updates.name,
      website: updates.website,
      bot_name: updates.botName,
      bot_color: updates.botColor,
      system_prompt: updates.systemPrompt,
      is_active: updates.isActive
    })
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

// Delete tenant
async function deleteTenant(id) {
  const { error } = await supabase
    .from('tenants')
    .delete()
    .eq('id', id);

  if (error) throw error;
  return true;
}

// Save document for tenant
async function saveDocument(tenantId, filename, content) {
  // Delete existing document with same filename
  await supabase
    .from('documents')
    .delete()
    .eq('tenant_id', tenantId)
    .eq('filename', filename);

  const { data, error } = await supabase
    .from('documents')
    .insert([{ tenant_id: tenantId, filename, content }])
    .select()
    .single();

  if (error) throw error;
  return data;
}

// Get all documents for tenant
async function getTenantDocuments(tenantId) {
  const { data, error } = await supabase
    .from('documents')
    .select('*')
    .eq('tenant_id', tenantId);

  if (error) throw error;
  return data || [];
}

// Delete document
async function deleteDocument(documentId) {
  const { error } = await supabase
    .from('documents')
    .delete()
    .eq('id', documentId);

  if (error) throw error;
  return true;
}

// ========== BOT MANAGEMENT (new) ==========

// Get all bots (library)
async function getAllBots() {
  const { data, error } = await supabase
    .from('bots')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data;
}

// Create a new bot in the library
async function createBot(botData) {
  const { data, error } = await supabase
    .from('bots')
    .insert([{
      name: botData.name,
      description: botData.description || '',
      bot_name: botData.botName,
      bot_color: botData.botColor || '#DAA520',
      system_prompt: botData.systemPrompt
    }])
    .select()
    .single();
  if (error) throw error;
  return data;
}

// Assign an existing bot to a tenant
async function assignBotToTenant(tenantId, botId) {
  const { data, error } = await supabase
    .from('tenant_bots')
    .insert([{ tenant_id: tenantId, bot_id: botId }])
    .select()
    .single();
  if (error) throw error;
  return data;
}

// Get all bots assigned to a specific tenant
async function getBotsByTenant(tenantId) {
  const { data, error } = await supabase
    .from('tenant_bots')
    .select('bot_id, bots(*)')
    .eq('tenant_id', tenantId);
  if (error) throw error;
  // Return just the bot objects
  return data.map(item => item.bots);
}

// Remove a bot assignment from a tenant
async function removeBotFromTenant(tenantId, botId) {
  const { error } = await supabase
    .from('tenant_bots')
    .delete()
    .eq('tenant_id', tenantId)
    .eq('bot_id', botId);
  if (error) throw error;
  return { success: true };
}

module.exports = {
  createTenant,
  getAllTenants,
  getTenantById,
  getTenantByApiKey,
  updateTenant,
  deleteTenant,
  saveDocument,
  getTenantDocuments,
  deleteDocument,
  // New exports
  getAllBots,
  createBot,
  assignBotToTenant,
  getBotsByTenant,
  removeBotFromTenant
};