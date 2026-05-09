const supabase = require('./db');

// Log a conversation exchange
async function logAnalytics(tenantId, sessionId, question, response) {
  const { error } = await supabase
    .from('analytics')
    .insert([{ tenant_id: tenantId, session_id: sessionId, question, response }]);

  if (error) console.error('Analytics log error:', error.message);
}

// Save conversation message
async function saveMessage(tenantId, sessionId, role, message) {
  const { error } = await supabase
    .from('conversations')
    .insert([{ tenant_id: tenantId, session_id: sessionId, role, message }]);

  if (error) console.error('Message save error:', error.message);
}

// Get conversation history for a session
async function getSessionHistory(tenantId, sessionId) {
  const { data, error } = await supabase
    .from('conversations')
    .select('role, message')
    .eq('tenant_id', tenantId)
    .eq('session_id', sessionId)
    .order('created_at', { ascending: true });

  if (error) return [];
  return data.map(row => ({ role: row.role, content: row.message }));
}

// Get analytics summary for a tenant
async function getTenantAnalytics(tenantId) {
  // Total messages
  const { count: totalMessages } = await supabase
    .from('analytics')
    .select('*', { count: 'exact', head: true })
    .eq('tenant_id', tenantId);

  // Total sessions
  const { data: sessions } = await supabase
    .from('analytics')
    .select('session_id')
    .eq('tenant_id', tenantId);

  const uniqueSessions = new Set(sessions?.map(s => s.session_id) || []).size;

  // Top questions (last 50)
  const { data: recentQuestions } = await supabase
    .from('analytics')
    .select('question, created_at')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })
    .limit(50);

  // Average rating
  const { data: ratings } = await supabase
    .from('analytics')
    .select('rating')
    .eq('tenant_id', tenantId)
    .not('rating', 'is', null);

  const avgRating = ratings?.length
    ? (ratings.reduce((sum, r) => sum + r.rating, 0) / ratings.length).toFixed(1)
    : 'No ratings yet';

  return {
    totalMessages: totalMessages || 0,
    uniqueSessions,
    recentQuestions: recentQuestions || [],
    avgRating
  };
}

// Save rating for a response
async function saveRating(tenantId, sessionId, rating) {
  const { error } = await supabase
    .from('analytics')
    .update({ rating })
    .eq('tenant_id', tenantId)
    .eq('session_id', sessionId)
    .order('created_at', { ascending: false })
    .limit(1);

  if (error) console.error('Rating save error:', error.message);
}

module.exports = {
  logAnalytics,
  saveMessage,
  getSessionHistory,
  getTenantAnalytics,
  saveRating
};