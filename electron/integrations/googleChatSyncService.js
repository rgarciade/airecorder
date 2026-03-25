/**
 * Google Chat Integration — OAuth 2.0 + Chat API v1
 *
 * Scopes necesarios:
 *   https://www.googleapis.com/auth/chat.messages.readonly
 *   https://www.googleapis.com/auth/chat.spaces.readonly
 *
 * El usuario debe crear un proyecto en Google Cloud Console y configurar:
 *   - client_id y client_secret en Settings → Integrations → Google Chat
 *   - Tipo de aplicación: "Desktop app"
 *   - URI de redirección autorizada: NO hace falta (usamos deep-link airecorder://)
 */

const { net } = require('electron');

const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_SPACES_URL = 'https://chat.googleapis.com/v1/spaces';
const SCOPES = [
  'https://www.googleapis.com/auth/chat.messages.readonly',
  'https://www.googleapis.com/auth/chat.spaces.readonly'
].join(' ');

/**
 * Construye la URL de autorización OAuth para Google.
 */
function buildAuthUrl(clientId, redirectUri, state) {
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: SCOPES,
    access_type: 'offline',
    prompt: 'consent',
    state
  });
  return `${GOOGLE_AUTH_URL}?${params.toString()}`;
}

/**
 * Intercambia un código de autorización por tokens.
 */
async function exchangeCodeForTokens(code, clientId, clientSecret, redirectUri) {
  const body = new URLSearchParams({
    code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: redirectUri,
    grant_type: 'authorization_code'
  });

  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString()
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Google token exchange failed: ${err}`);
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
async function refreshAccessToken(refreshToken, clientId, clientSecret) {
  const body = new URLSearchParams({
    refresh_token: refreshToken,
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: 'refresh_token'
  });

  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString()
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Google token refresh failed: ${err}`);
  }

  const data = await response.json();
  return {
    accessToken: data.access_token,
    expiresAt: new Date(Date.now() + data.expires_in * 1000).toISOString()
  };
}

/**
 * Obtiene el perfil del usuario autenticado.
 */
async function getUserInfo(accessToken) {
  const response = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  if (!response.ok) throw new Error('Failed to fetch Google user info');
  return response.json();
}

/**
 * Lista los spaces (canales/chats) accesibles por el usuario.
 * @returns {Array<{id, name, displayName, type}>}
 */
async function listSpaces(accessToken) {
  const spaces = [];
  let pageToken = null;

  do {
    const url = new URL(GOOGLE_SPACES_URL);
    url.searchParams.set('pageSize', '100');
    if (pageToken) url.searchParams.set('pageToken', pageToken);

    const response = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${accessToken}` }
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Google Chat listSpaces failed: ${err}`);
    }

    const data = await response.json();
    if (data.spaces) {
      for (const space of data.spaces) {
        spaces.push({
          id: space.name,
          name: space.name,
          displayName: space.displayName || space.name,
          type: space.spaceType || space.type || 'SPACE'
        });
      }
    }
    pageToken = data.nextPageToken || null;
  } while (pageToken);

  return spaces;
}

/**
 * Descarga mensajes de un space desde un timestamp dado.
 * @param {string} spaceName  e.g. "spaces/AAAA"
 * @param {string} accessToken
 * @param {string|null} after  ISO 8601 datetime — solo mensajes posteriores a este
 * @returns {Array<{speaker: string, text: string, timestamp: string}>}
 */
async function fetchMessages(spaceName, accessToken, after = null) {
  const messages = [];
  let pageToken = null;

  const baseUrl = `https://chat.googleapis.com/v1/${spaceName}/messages`;

  do {
    const url = new URL(baseUrl);
    url.searchParams.set('pageSize', '250');
    url.searchParams.set('orderBy', 'createTime asc');
    if (after) url.searchParams.set('filter', `createTime > "${after}"`);
    if (pageToken) url.searchParams.set('pageToken', pageToken);

    const response = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${accessToken}` }
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Google Chat fetchMessages failed: ${err}`);
    }

    const data = await response.json();
    if (data.messages) {
      for (const msg of data.messages) {
        // Ignorar mensajes sin texto (adjuntos, cards)
        const text = msg.text || msg.formattedText;
        if (!text || !text.trim()) continue;

        const speaker = msg.sender?.displayName || msg.sender?.name || 'Unknown';
        messages.push({ speaker, text: text.trim(), timestamp: msg.createTime });
      }
    }
    pageToken = data.nextPageToken || null;
  } while (pageToken);

  return messages;
}

module.exports = {
  buildAuthUrl,
  exchangeCodeForTokens,
  refreshAccessToken,
  getUserInfo,
  listSpaces,
  fetchMessages
};
