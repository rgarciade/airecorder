/**
 * Microsoft Teams Integration — OAuth 2.0 + Microsoft Graph API
 *
 * Scopes necesarios:
 *   ChannelMessage.Read.All, Team.ReadBasic.All, Channel.ReadBasic.All, User.Read
 *
 * El usuario debe crear una app en Azure Portal → App registrations:
 *   - Tipo: "Mobile and desktop applications"
 *   - URI de redirección: airecorder://teams-callback
 *   - client_id y tenant_id disponibles en la app registrada
 *   - NO se necesita client_secret para apps de escritorio (flujo PKCE)
 *
 * Nota: usamos el flujo "public client" (sin client_secret) con PKCE,
 * que es el método correcto para apps de escritorio según Microsoft.
 */

const crypto = require('crypto');

const TENANT = 'common'; // permite cuentas personales y corporativas
const GRAPH_BASE = 'https://graph.microsoft.com/v1.0';
const AUTH_BASE = `https://login.microsoftonline.com/${TENANT}/oauth2/v2.0`;
const SCOPES = [
  'ChannelMessage.Read.All',
  'Team.ReadBasic.All',
  'Channel.ReadBasic.All',
  'User.Read',
  'offline_access'
].join(' ');

// ── PKCE helpers ──────────────────────────────────────────────────────────────

function generateCodeVerifier() {
  return crypto.randomBytes(32).toString('base64url');
}

function generateCodeChallenge(verifier) {
  return crypto.createHash('sha256').update(verifier).digest('base64url');
}

// Mapa en memoria para guardar el verifier durante el flujo OAuth
const pendingVerifiers = new Map();

/**
 * Construye la URL de autorización OAuth para Teams/Microsoft.
 * Guarda el code_verifier asociado al state para recuperarlo en el callback.
 */
function buildAuthUrl(clientId, redirectUri, state) {
  const verifier = generateCodeVerifier();
  const challenge = generateCodeChallenge(verifier);
  pendingVerifiers.set(state, verifier);

  const params = new URLSearchParams({
    client_id: clientId,
    response_type: 'code',
    redirect_uri: redirectUri,
    scope: SCOPES,
    response_mode: 'query',
    state,
    code_challenge: challenge,
    code_challenge_method: 'S256'
  });

  return `${AUTH_BASE}/authorize?${params.toString()}`;
}

/**
 * Intercambia un código de autorización por tokens (flujo PKCE, sin client_secret).
 */
async function exchangeCodeForTokens(code, clientId, redirectUri, state) {
  const verifier = pendingVerifiers.get(state);
  pendingVerifiers.delete(state);
  if (!verifier) throw new Error('PKCE verifier not found for state: ' + state);

  const body = new URLSearchParams({
    client_id: clientId,
    grant_type: 'authorization_code',
    code,
    redirect_uri: redirectUri,
    code_verifier: verifier
  });

  const response = await fetch(`${AUTH_BASE}/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString()
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Teams token exchange failed: ${err}`);
  }

  const data = await response.json();
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: new Date(Date.now() + data.expires_in * 1000).toISOString(),
    scopes: data.scope ? data.scope.split(' ') : []
  };
}

/**
 * Renueva el access_token usando el refresh_token.
 */
async function refreshAccessToken(refreshToken, clientId) {
  const body = new URLSearchParams({
    client_id: clientId,
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
    scope: SCOPES
  });

  const response = await fetch(`${AUTH_BASE}/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString()
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Teams token refresh failed: ${err}`);
  }

  const data = await response.json();
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token || refreshToken,
    expiresAt: new Date(Date.now() + data.expires_in * 1000).toISOString()
  };
}

/**
 * Obtiene el perfil del usuario autenticado.
 */
async function getUserInfo(accessToken) {
  const response = await fetch(`${GRAPH_BASE}/me`, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  if (!response.ok) throw new Error('Failed to fetch Teams user info');
  return response.json();
}

/**
 * Lista los teams a los que pertenece el usuario.
 */
async function listTeams(accessToken) {
  const response = await fetch(`${GRAPH_BASE}/me/joinedTeams`, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Teams listTeams failed: ${err}`);
  }
  const data = await response.json();
  return (data.value || []).map(t => ({ id: t.id, displayName: t.displayName }));
}

/**
 * Lista los canales de un team.
 */
async function listChannels(teamId, accessToken) {
  const response = await fetch(`${GRAPH_BASE}/teams/${teamId}/channels`, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Teams listChannels failed: ${err}`);
  }
  const data = await response.json();
  return (data.value || []).map(c => ({
    id: `${teamId}::${c.id}`,        // compuesto para identificar team+canal
    teamId,
    channelId: c.id,
    displayName: c.displayName,
    description: c.description || ''
  }));
}

/**
 * Descarga mensajes de un canal desde un timestamp dado.
 * channel_id esperado: "teamId::channelId"
 */
async function fetchMessages(channelId, accessToken, after = null) {
  const [teamId, realChannelId] = channelId.split('::');
  if (!teamId || !realChannelId) throw new Error(`Invalid Teams channel_id format: ${channelId}`);

  const messages = [];
  let url = `${GRAPH_BASE}/teams/${teamId}/channels/${realChannelId}/messages?$top=50&$orderby=createdDateTime asc`;

  while (url) {
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Teams fetchMessages failed: ${err}`);
    }

    const data = await response.json();
    for (const msg of data.value || []) {
      // Ignorar mensajes del sistema, mensajes sin contenido de texto
      if (msg.messageType !== 'message') continue;
      const text = msg.body?.content;
      if (!text || !text.trim() || text === '<p></p>') continue;

      // Filtrar mensajes anteriores al after (Graph API no soporta $filter por fecha en este endpoint en todos los tenants)
      if (after && msg.createdDateTime <= after) continue;

      // Limpiar HTML básico del body
      const cleanText = text
        .replace(/<[^>]+>/g, ' ')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/\s+/g, ' ')
        .trim();

      if (!cleanText) continue;

      const speaker = msg.from?.user?.displayName || msg.from?.application?.displayName || 'Unknown';
      messages.push({ speaker, text: cleanText, timestamp: msg.createdDateTime });
    }

    url = data['@odata.nextLink'] || null;
  }

  return messages;
}

module.exports = {
  buildAuthUrl,
  exchangeCodeForTokens,
  refreshAccessToken,
  getUserInfo,
  listTeams,
  listChannels,
  fetchMessages
};
