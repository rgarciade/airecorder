import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import crypto from 'crypto';
import * as teamsSyncService from '../../../../electron/integrations/teamsSyncService.js';

// teamsSyncService.js es CJS puro (`require('crypto')` + `module.exports`),
// pero a diferencia de paths.js/updateChecker.js no requiere ningún módulo
// de Electron a nivel superior — solo el core module 'crypto', que funciona
// igual dentro y fuera de un proceso Electron real. Por eso NO hace falta el
// workaround de require.cache: un import estático normal es suficiente aquí,
// igual que en chatSyncUtils.test.js. `fetch` es global y se resuelve en
// tiempo de llamada, así que `vi.stubGlobal` funciona sin importar el orden
// respecto al import (mismo patrón que embeddingService.test.js / ai.test.js).
const fetchSpy = vi.fn();
vi.stubGlobal('fetch', fetchSpy);

function jsonResponse(body, { ok = true, status = 200 } = {}) {
  return {
    ok,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body),
  };
}

function errorResponse(bodyText, status = 400) {
  return {
    ok: false,
    status,
    text: async () => bodyText,
  };
}

describe('teamsSyncService', () => {
  beforeEach(() => {
    fetchSpy.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('buildAuthUrl', () => {
    it('construye la URL base y el host correctos', () => {
      const url = teamsSyncService.buildAuthUrl('client-1', 'airecorder://callback', 'state-base-url');
      expect(url.startsWith('https://login.microsoftonline.com/common/oauth2/v2.0/authorize?')).toBe(true);
    });

    it('incluye todos los query params requeridos por el flujo PKCE', () => {
      const url = teamsSyncService.buildAuthUrl('client-1', 'airecorder://callback', 'state-params');
      const params = new URL(url).searchParams;

      expect(params.get('client_id')).toBe('client-1');
      expect(params.get('response_type')).toBe('code');
      expect(params.get('redirect_uri')).toBe('airecorder://callback');
      expect(params.get('response_mode')).toBe('query');
      expect(params.get('state')).toBe('state-params');
      expect(params.get('code_challenge_method')).toBe('S256');
      expect(params.get('code_challenge')).toBeTruthy();
    });

    it('junta los scopes en un único string separado por espacios', () => {
      const url = teamsSyncService.buildAuthUrl('client-1', 'airecorder://callback', 'state-scopes');
      const scope = new URL(url).searchParams.get('scope');

      expect(scope).toBe(
        'ChannelMessage.Read.All Team.ReadBasic.All Channel.ReadBasic.All User.Read offline_access'
      );
    });

    it('URL-encodea caracteres especiales en redirectUri y state', () => {
      const url = teamsSyncService.buildAuthUrl(
        'client-1',
        'airecorder://callback?x=1&y=2',
        'state with spaces & symbols'
      );
      const params = new URL(url).searchParams;

      // El getter de URLSearchParams ya decodea; comprobamos que el string
      // crudo de la URL NO contiene los caracteres especiales sin escapar.
      expect(url).not.toContain('airecorder://callback?x=1&y=2&');
      expect(params.get('redirect_uri')).toBe('airecorder://callback?x=1&y=2');
      expect(params.get('state')).toBe('state with spaces & symbols');
    });

    it('con params vacíos/undefined no lanza y los serializa como string vacío o "undefined"', () => {
      expect(() => teamsSyncService.buildAuthUrl(undefined, undefined, 'state-empty-params')).not.toThrow();

      const url = teamsSyncService.buildAuthUrl('', '', 'state-empty-2');
      const params = new URL(url).searchParams;
      expect(params.get('client_id')).toBe('');
      expect(params.get('redirect_uri')).toBe('');
    });

    it('el code_challenge tiene 43 caracteres en alfabeto base64url (RFC 7636)', () => {
      const url = teamsSyncService.buildAuthUrl('client-1', 'airecorder://callback', 'state-challenge-shape');
      const challenge = new URL(url).searchParams.get('code_challenge');

      expect(challenge).toHaveLength(43);
      expect(challenge).toMatch(/^[A-Za-z0-9_-]{43}$/);
      expect(challenge).not.toContain('=');
    });

    it('genera un code_challenge distinto en cada llamada (verifier aleatorio por llamada)', () => {
      const url1 = teamsSyncService.buildAuthUrl('client-1', 'airecorder://callback', 'state-random-1');
      const url2 = teamsSyncService.buildAuthUrl('client-1', 'airecorder://callback', 'state-random-2');

      const challenge1 = new URL(url1).searchParams.get('code_challenge');
      const challenge2 = new URL(url2).searchParams.get('code_challenge');

      expect(challenge1).not.toBe(challenge2);
    });

    it('code_challenge = base64url(sha256(code_verifier)) — se valida el round-trip completo vía exchangeCodeForTokens', async () => {
      // buildAuthUrl no expone el verifier directamente (queda en un Map
      // interno), pero exchangeCodeForTokens lo envía en el body de la
      // petición de token — lo capturamos ahí para validar la transformación
      // PKCE end-to-end contra la implementación de referencia de Node.
      const state = 'state-pkce-roundtrip';
      const url = teamsSyncService.buildAuthUrl('client-1', 'airecorder://callback', state);
      const expectedChallenge = new URL(url).searchParams.get('code_challenge');

      fetchSpy.mockResolvedValue(
        jsonResponse({ access_token: 'at', refresh_token: 'rt', expires_in: 3600, scope: 'a b' })
      );

      await teamsSyncService.exchangeCodeForTokens('auth-code', 'client-1', 'airecorder://callback', state);

      const sentBody = fetchSpy.mock.calls[0][1].body;
      const verifier = new URLSearchParams(sentBody).get('code_verifier');

      expect(verifier).toHaveLength(43);
      expect(verifier).toMatch(/^[A-Za-z0-9_-]{43}$/);

      const recomputedChallenge = crypto.createHash('sha256').update(verifier).digest('base64url');
      expect(recomputedChallenge).toBe(expectedChallenge);
    });
  });

  describe('exchangeCodeForTokens', () => {
    it('lanza sin llamar a fetch si no hay verifier pendiente para el state', async () => {
      await expect(
        teamsSyncService.exchangeCodeForTokens('code', 'client-1', 'airecorder://callback', 'state-never-built')
      ).rejects.toThrow('PKCE verifier not found for state: state-never-built');

      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it('camino feliz: intercambia el code y devuelve accessToken/refreshToken/expiresAt/scopes', async () => {
      const state = 'state-exchange-ok';
      teamsSyncService.buildAuthUrl('client-1', 'airecorder://callback', state);

      const now = Date.now();
      fetchSpy.mockResolvedValue(
        jsonResponse({ access_token: 'at-1', refresh_token: 'rt-1', expires_in: 3600, scope: 'A B C' })
      );

      const result = await teamsSyncService.exchangeCodeForTokens('code-1', 'client-1', 'airecorder://callback', state);

      expect(result.accessToken).toBe('at-1');
      expect(result.refreshToken).toBe('rt-1');
      expect(result.scopes).toEqual(['A', 'B', 'C']);
      expect(new Date(result.expiresAt).getTime()).toBeGreaterThanOrEqual(now + 3600 * 1000 - 1000);
    });

    it('scope ausente en la respuesta → scopes: []', async () => {
      const state = 'state-exchange-no-scope';
      teamsSyncService.buildAuthUrl('client-1', 'airecorder://callback', state);
      fetchSpy.mockResolvedValue(jsonResponse({ access_token: 'at', expires_in: 60 }));

      const result = await teamsSyncService.exchangeCodeForTokens('code', 'client-1', 'airecorder://callback', state);

      expect(result.scopes).toEqual([]);
    });

    it('el verifier se consume: una segunda llamada con el mismo state falla (protección contra replay)', async () => {
      const state = 'state-exchange-replay';
      teamsSyncService.buildAuthUrl('client-1', 'airecorder://callback', state);
      fetchSpy.mockResolvedValue(jsonResponse({ access_token: 'at', expires_in: 60 }));

      await teamsSyncService.exchangeCodeForTokens('code', 'client-1', 'airecorder://callback', state);

      await expect(
        teamsSyncService.exchangeCodeForTokens('code', 'client-1', 'airecorder://callback', state)
      ).rejects.toThrow('PKCE verifier not found for state: state-exchange-replay');
    });

    it('respuesta no-2xx: propaga el mensaje de error del servidor (ej. invalid_grant)', async () => {
      const state = 'state-exchange-error';
      teamsSyncService.buildAuthUrl('client-1', 'airecorder://callback', state);
      fetchSpy.mockResolvedValue(errorResponse('{"error":"invalid_grant"}', 400));

      await expect(
        teamsSyncService.exchangeCodeForTokens('code', 'client-1', 'airecorder://callback', state)
      ).rejects.toThrow(/invalid_grant/);
    });
  });

  describe('refreshAccessToken', () => {
    it('camino feliz: devuelve accessToken/refreshToken/expiresAt', async () => {
      fetchSpy.mockResolvedValue(jsonResponse({ access_token: 'at-2', refresh_token: 'rt-2', expires_in: 1800 }));

      const result = await teamsSyncService.refreshAccessToken('old-refresh-token', 'client-1');

      expect(result.accessToken).toBe('at-2');
      expect(result.refreshToken).toBe('rt-2');
      expect(result.expiresAt).toBeTruthy();
    });

    it('boundary: si la respuesta no trae refresh_token nuevo, conserva el original', async () => {
      fetchSpy.mockResolvedValue(jsonResponse({ access_token: 'at-3', expires_in: 60 }));

      const result = await teamsSyncService.refreshAccessToken('original-refresh-token', 'client-1');

      expect(result.refreshToken).toBe('original-refresh-token');
    });

    it('respuesta no-2xx: lanza con el mensaje de error del servidor', async () => {
      fetchSpy.mockResolvedValue(errorResponse('{"error":"invalid_grant"}', 400));

      await expect(teamsSyncService.refreshAccessToken('bad-token', 'client-1')).rejects.toThrow(/invalid_grant/);
    });
  });

  describe('getUserInfo', () => {
    it('camino feliz: devuelve el JSON del perfil', async () => {
      fetchSpy.mockResolvedValue(jsonResponse({ id: 'u1', displayName: 'Ana' }));

      const result = await teamsSyncService.getUserInfo('token-x');

      expect(result).toEqual({ id: 'u1', displayName: 'Ana' });
      expect(fetchSpy).toHaveBeenCalledWith(
        'https://graph.microsoft.com/v1.0/me',
        expect.objectContaining({ headers: { Authorization: 'Bearer token-x' } })
      );
    });

    it('respuesta no-2xx: lanza un mensaje genérico (sin detalle del servidor)', async () => {
      fetchSpy.mockResolvedValue(errorResponse('unauthorized', 401));

      await expect(teamsSyncService.getUserInfo('bad-token')).rejects.toThrow('Failed to fetch Teams user info');
    });
  });

  describe('listTeams', () => {
    it('camino feliz: mapea data.value a {id, displayName}', async () => {
      fetchSpy.mockResolvedValue(
        jsonResponse({ value: [{ id: 't1', displayName: 'Team One', extra: 'ignored' }] })
      );

      const result = await teamsSyncService.listTeams('token-x');

      expect(result).toEqual([{ id: 't1', displayName: 'Team One' }]);
    });

    it('boundary: cero teams devuelve array vacío', async () => {
      fetchSpy.mockResolvedValue(jsonResponse({ value: [] }));

      expect(await teamsSyncService.listTeams('token-x')).toEqual([]);
    });

    it('boundary: data.value ausente no lanza, devuelve array vacío', async () => {
      fetchSpy.mockResolvedValue(jsonResponse({}));

      expect(await teamsSyncService.listTeams('token-x')).toEqual([]);
    });

    it('respuesta no-2xx: propaga el error del servidor', async () => {
      fetchSpy.mockResolvedValue(errorResponse('forbidden', 403));

      await expect(teamsSyncService.listTeams('token-x')).rejects.toThrow(/Teams listTeams failed/);
    });
  });

  describe('listChannels', () => {
    it('camino feliz: compone id como "teamId::channelId" y aplica fallback de description', async () => {
      fetchSpy.mockResolvedValue(
        jsonResponse({ value: [{ id: 'c1', displayName: 'General' }] })
      );

      const result = await teamsSyncService.listChannels('t1', 'token-x');

      expect(result).toEqual([{ id: 't1::c1', teamId: 't1', channelId: 'c1', displayName: 'General', description: '' }]);
    });

    it('boundary: cero canales devuelve array vacío', async () => {
      fetchSpy.mockResolvedValue(jsonResponse({ value: [] }));

      expect(await teamsSyncService.listChannels('t1', 'token-x')).toEqual([]);
    });

    it('boundary: data.value ausente no lanza, devuelve array vacío', async () => {
      fetchSpy.mockResolvedValue(jsonResponse({}));

      expect(await teamsSyncService.listChannels('t1', 'token-x')).toEqual([]);
    });

    it('respuesta no-2xx: propaga el error del servidor', async () => {
      fetchSpy.mockResolvedValue(errorResponse('team not found', 404));

      await expect(teamsSyncService.listChannels('t1', 'token-x')).rejects.toThrow(/Teams listChannels failed/);
    });
  });

  describe('fetchMessages', () => {
    it('boundary: channelId sin "::" lanza sin llamar a fetch', async () => {
      await expect(teamsSyncService.fetchMessages('no-separator', 'token-x')).rejects.toThrow(
        'Invalid Teams channel_id format: no-separator'
      );
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it('boundary: channelId con más de un "::" solo toma los dos primeros segmentos', async () => {
      fetchSpy.mockResolvedValue(jsonResponse({ value: [] }));

      await teamsSyncService.fetchMessages('team1::chan1::extra', 'token-x');

      expect(fetchSpy).toHaveBeenCalledWith(
        expect.stringContaining('/teams/team1/channels/chan1/messages'),
        expect.anything()
      );
    });

    it('camino feliz: parsea, limpia HTML y asigna speaker', async () => {
      fetchSpy.mockResolvedValue(
        jsonResponse({
          value: [
            {
              messageType: 'message',
              body: { content: '<p>Hola &amp; chau</p>' },
              from: { user: { displayName: 'Ana' } },
              createdDateTime: '2024-01-01T00:00:00Z',
            },
          ],
        })
      );

      const result = await teamsSyncService.fetchMessages('t1::c1', 'token-x');

      expect(result).toEqual([{ speaker: 'Ana', text: 'Hola & chau', timestamp: '2024-01-01T00:00:00Z' }]);
    });

    it('boundary: cero mensajes devuelve array vacío', async () => {
      fetchSpy.mockResolvedValue(jsonResponse({ value: [] }));

      expect(await teamsSyncService.fetchMessages('t1::c1', 'token-x')).toEqual([]);
    });

    it('boundary: data.value ausente no lanza, devuelve array vacío', async () => {
      fetchSpy.mockResolvedValue(jsonResponse({}));

      expect(await teamsSyncService.fetchMessages('t1::c1', 'token-x')).toEqual([]);
    });

    it('filtra mensajes de sistema (messageType !== "message")', async () => {
      fetchSpy.mockResolvedValue(
        jsonResponse({
          value: [{ messageType: 'systemEventMessage', body: { content: 'alguien se unió' } }],
        })
      );

      expect(await teamsSyncService.fetchMessages('t1::c1', 'token-x')).toEqual([]);
    });

    it('filtra mensajes con body vacío ("<p></p>" literal)', async () => {
      fetchSpy.mockResolvedValue(
        jsonResponse({ value: [{ messageType: 'message', body: { content: '<p></p>' } }] })
      );

      expect(await teamsSyncService.fetchMessages('t1::c1', 'token-x')).toEqual([]);
    });

    it('boundary: body cuyo único contenido es una etiqueta con espacio en blanco queda vacío tras la limpieza', async () => {
      fetchSpy.mockResolvedValue(
        jsonResponse({ value: [{ messageType: 'message', body: { content: '<p> </p>' } }] })
      );

      expect(await teamsSyncService.fetchMessages('t1::c1', 'token-x')).toEqual([]);
    });

    it('boundary: after es null → no filtra por fecha (incluye todos los mensajes)', async () => {
      fetchSpy.mockResolvedValue(
        jsonResponse({
          value: [
            {
              messageType: 'message',
              body: { content: 'msg' },
              createdDateTime: '2020-01-01T00:00:00Z',
            },
          ],
        })
      );

      const result = await teamsSyncService.fetchMessages('t1::c1', 'token-x', null);

      expect(result).toHaveLength(1);
    });

    it('boundary: mensaje con createdDateTime === after se excluye (comparación <=)', async () => {
      fetchSpy.mockResolvedValue(
        jsonResponse({
          value: [{ messageType: 'message', body: { content: 'msg' }, createdDateTime: '2024-01-01T00:00:00Z' }],
        })
      );

      const result = await teamsSyncService.fetchMessages('t1::c1', 'token-x', '2024-01-01T00:00:00Z');

      expect(result).toEqual([]);
    });

    it('boundary: mensaje con createdDateTime posterior a after se incluye', async () => {
      fetchSpy.mockResolvedValue(
        jsonResponse({
          value: [{ messageType: 'message', body: { content: 'msg' }, createdDateTime: '2024-01-02T00:00:00Z' }],
        })
      );

      const result = await teamsSyncService.fetchMessages('t1::c1', 'token-x', '2024-01-01T00:00:00Z');

      expect(result).toHaveLength(1);
    });

    it('speaker cae a from.application.displayName si no hay from.user', async () => {
      fetchSpy.mockResolvedValue(
        jsonResponse({
          value: [
            {
              messageType: 'message',
              body: { content: 'msg' },
              from: { application: { displayName: 'Webhook Bot' } },
            },
          ],
        })
      );

      const [msg] = await teamsSyncService.fetchMessages('t1::c1', 'token-x');

      expect(msg.speaker).toBe('Webhook Bot');
    });

    it('speaker cae a "Unknown" si no hay from', async () => {
      fetchSpy.mockResolvedValue(
        jsonResponse({ value: [{ messageType: 'message', body: { content: 'msg' } }] })
      );

      const [msg] = await teamsSyncService.fetchMessages('t1::c1', 'token-x');

      expect(msg.speaker).toBe('Unknown');
    });

    it('sigue la paginación vía @odata.nextLink hasta que ya no hay más', async () => {
      fetchSpy
        .mockResolvedValueOnce(
          jsonResponse({
            value: [{ messageType: 'message', body: { content: 'primero' }, createdDateTime: '2024-01-01T00:00:00Z' }],
            '@odata.nextLink': 'https://graph.microsoft.com/v1.0/next-page',
          })
        )
        .mockResolvedValueOnce(
          jsonResponse({
            value: [{ messageType: 'message', body: { content: 'segundo' }, createdDateTime: '2024-01-02T00:00:00Z' }],
          })
        );

      const result = await teamsSyncService.fetchMessages('t1::c1', 'token-x');

      expect(fetchSpy).toHaveBeenCalledTimes(2);
      expect(fetchSpy).toHaveBeenNthCalledWith(2, 'https://graph.microsoft.com/v1.0/next-page', expect.anything());
      expect(result.map((m) => m.text)).toEqual(['primero', 'segundo']);
    });

    it('respuesta no-2xx: propaga el error del servidor', async () => {
      fetchSpy.mockResolvedValue(errorResponse('channel not found', 404));

      await expect(teamsSyncService.fetchMessages('t1::c1', 'token-x')).rejects.toThrow(/Teams fetchMessages failed/);
    });
  });
});
