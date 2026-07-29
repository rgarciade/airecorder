import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as googleChatSyncService from '../../../../electron/integrations/googleChatSyncService.js';

// HALLAZGO: googleChatSyncService.js hace `const { net } = require('electron');`
// a nivel de módulo, pero `net` NUNCA se usa en ningún sitio del archivo —
// todas las llamadas HTTP (exchangeCodeForTokens, refreshAccessToken,
// getUserInfo, listSpaces, fetchMessages) usan `fetch` global, exactamente
// igual que teamsSyncService.js. Es un import muerto/vestigial (confirmado
// con `rg -n "net\\b"` sobre el archivo: solo aparece en la línea del
// require). Por eso, a diferencia de paths.js/updateChecker.js, este archivo
// NO necesita el workaround de inyectar un mock en require.cache: fuera de
// un proceso Electron real, `require('electron')` devuelve un string (no
// lanza), y desestructurar `{ net }` de un string simplemente da
// `undefined` sin tocarlo nunca — confirmado ejecutando el módulo con
// `node -e "require('./googleChatSyncService.js')"` en Node plano, sin
// mocks. Un import estático normal (igual que chatSyncUtils.test.js) es
// suficiente. Este es un candidato a limpieza (eliminar el require muerto),
// aunque no se toca aquí: no es responsabilidad de esta tarea de tests.
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

describe('googleChatSyncService', () => {
  beforeEach(() => {
    fetchSpy.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('buildAuthUrl', () => {
    it('construye la URL base y el host correctos', () => {
      const url = googleChatSyncService.buildAuthUrl('client-1', 'airecorder://callback', 'state-1');
      expect(url.startsWith('https://accounts.google.com/o/oauth2/v2/auth?')).toBe(true);
    });

    it('incluye todos los query params requeridos', () => {
      const url = googleChatSyncService.buildAuthUrl('client-1', 'airecorder://callback', 'state-params');
      const params = new URL(url).searchParams;

      expect(params.get('client_id')).toBe('client-1');
      expect(params.get('redirect_uri')).toBe('airecorder://callback');
      expect(params.get('response_type')).toBe('code');
      expect(params.get('access_type')).toBe('offline');
      expect(params.get('prompt')).toBe('consent');
      expect(params.get('state')).toBe('state-params');
    });

    it('junta los scopes en un único string separado por espacios', () => {
      const url = googleChatSyncService.buildAuthUrl('client-1', 'airecorder://callback', 'state-scopes');
      const scope = new URL(url).searchParams.get('scope');

      expect(scope).toBe(
        'https://www.googleapis.com/auth/chat.messages.readonly https://www.googleapis.com/auth/chat.spaces.readonly'
      );
    });

    it('URL-encodea caracteres especiales en redirectUri y state', () => {
      const url = googleChatSyncService.buildAuthUrl(
        'client-1',
        'airecorder://callback?x=1&y=2',
        'state with spaces & symbols'
      );
      const params = new URL(url).searchParams;

      expect(url).not.toContain('airecorder://callback?x=1&y=2&');
      expect(params.get('redirect_uri')).toBe('airecorder://callback?x=1&y=2');
      expect(params.get('state')).toBe('state with spaces & symbols');
    });

    it('con params vacíos/undefined no lanza y los serializa como string vacío o "undefined"', () => {
      expect(() => googleChatSyncService.buildAuthUrl(undefined, undefined, undefined)).not.toThrow();

      const url = googleChatSyncService.buildAuthUrl('', '', '');
      const params = new URL(url).searchParams;
      expect(params.get('client_id')).toBe('');
      expect(params.get('redirect_uri')).toBe('');
      expect(params.get('state')).toBe('');
    });
  });

  describe('exchangeCodeForTokens', () => {
    it('camino feliz: envía el body correcto y devuelve accessToken/refreshToken/expiresAt/scopes', async () => {
      const now = Date.now();
      fetchSpy.mockResolvedValue(
        jsonResponse({ access_token: 'at-1', refresh_token: 'rt-1', expires_in: 3600, scope: 'a b' })
      );

      const result = await googleChatSyncService.exchangeCodeForTokens(
        'code-1',
        'client-1',
        'secret-1',
        'airecorder://callback'
      );

      expect(fetchSpy).toHaveBeenCalledWith(
        'https://oauth2.googleapis.com/token',
        expect.objectContaining({ method: 'POST' })
      );
      const sentBody = new URLSearchParams(fetchSpy.mock.calls[0][1].body);
      expect(sentBody.get('code')).toBe('code-1');
      expect(sentBody.get('client_id')).toBe('client-1');
      expect(sentBody.get('client_secret')).toBe('secret-1');
      expect(sentBody.get('grant_type')).toBe('authorization_code');

      expect(result.accessToken).toBe('at-1');
      expect(result.refreshToken).toBe('rt-1');
      expect(result.scopes).toEqual(['a', 'b']);
      expect(new Date(result.expiresAt).getTime()).toBeGreaterThanOrEqual(now + 3600 * 1000 - 1000);
    });

    it('boundary: scope ausente en la respuesta → scopes: []', async () => {
      fetchSpy.mockResolvedValue(jsonResponse({ access_token: 'at', expires_in: 60 }));

      const result = await googleChatSyncService.exchangeCodeForTokens('code', 'cid', 'secret', 'redirect');

      expect(result.scopes).toEqual([]);
    });

    it('respuesta no-2xx: propaga el mensaje de error del servidor (ej. invalid_grant)', async () => {
      fetchSpy.mockResolvedValue(errorResponse('{"error":"invalid_grant"}', 400));

      await expect(
        googleChatSyncService.exchangeCodeForTokens('bad-code', 'cid', 'secret', 'redirect')
      ).rejects.toThrow(/invalid_grant/);
    });
  });

  describe('refreshAccessToken', () => {
    it('camino feliz: devuelve accessToken y expiresAt', async () => {
      fetchSpy.mockResolvedValue(jsonResponse({ access_token: 'at-2', expires_in: 1800 }));

      const result = await googleChatSyncService.refreshAccessToken('refresh-token', 'cid', 'secret');

      expect(result.accessToken).toBe('at-2');
      expect(result.expiresAt).toBeTruthy();
      expect(result.refreshToken).toBeUndefined();
    });

    it('respuesta no-2xx: lanza con el mensaje de error del servidor', async () => {
      fetchSpy.mockResolvedValue(errorResponse('{"error":"invalid_grant"}', 400));

      await expect(googleChatSyncService.refreshAccessToken('bad-token', 'cid', 'secret')).rejects.toThrow(
        /invalid_grant/
      );
    });
  });

  describe('getUserInfo', () => {
    it('camino feliz: devuelve el JSON del perfil', async () => {
      fetchSpy.mockResolvedValue(jsonResponse({ id: 'u1', name: 'Ana' }));

      const result = await googleChatSyncService.getUserInfo('token-x');

      expect(result).toEqual({ id: 'u1', name: 'Ana' });
      expect(fetchSpy).toHaveBeenCalledWith(
        'https://www.googleapis.com/oauth2/v2/userinfo',
        expect.objectContaining({ headers: { Authorization: 'Bearer token-x' } })
      );
    });

    it('respuesta no-2xx: lanza un mensaje genérico (sin detalle del servidor)', async () => {
      fetchSpy.mockResolvedValue(errorResponse('unauthorized', 401));

      await expect(googleChatSyncService.getUserInfo('bad-token')).rejects.toThrow(
        'Failed to fetch Google user info'
      );
    });
  });

  describe('listSpaces', () => {
    it('camino feliz: mapea spaces con displayName y type', async () => {
      fetchSpy.mockResolvedValue(
        jsonResponse({
          spaces: [{ name: 'spaces/AAA', displayName: 'Proyecto X', spaceType: 'SPACE' }],
        })
      );

      const result = await googleChatSyncService.listSpaces('token-x');

      expect(result).toEqual([{ id: 'spaces/AAA', name: 'spaces/AAA', displayName: 'Proyecto X', type: 'SPACE' }]);
    });

    it('boundary: displayName ausente cae a space.name', async () => {
      fetchSpy.mockResolvedValue(jsonResponse({ spaces: [{ name: 'spaces/BBB' }] }));

      const [space] = await googleChatSyncService.listSpaces('token-x');

      expect(space.displayName).toBe('spaces/BBB');
      expect(space.type).toBe('SPACE');
    });

    it('boundary: type cae a "type" y luego a "SPACE" si spaceType falta', async () => {
      fetchSpy.mockResolvedValue(jsonResponse({ spaces: [{ name: 's', type: 'DM' }] }));

      const [space] = await googleChatSyncService.listSpaces('token-x');

      expect(space.type).toBe('DM');
    });

    it('boundary: cero spaces devuelve array vacío', async () => {
      fetchSpy.mockResolvedValue(jsonResponse({ spaces: [] }));

      expect(await googleChatSyncService.listSpaces('token-x')).toEqual([]);
    });

    it('boundary: data.spaces ausente no lanza, devuelve array vacío', async () => {
      fetchSpy.mockResolvedValue(jsonResponse({}));

      expect(await googleChatSyncService.listSpaces('token-x')).toEqual([]);
    });

    it('sigue la paginación vía nextPageToken hasta que ya no hay más', async () => {
      fetchSpy
        .mockResolvedValueOnce(
          jsonResponse({ spaces: [{ name: 'spaces/AAA' }], nextPageToken: 'page-2' })
        )
        .mockResolvedValueOnce(jsonResponse({ spaces: [{ name: 'spaces/BBB' }] }));

      const result = await googleChatSyncService.listSpaces('token-x');

      expect(fetchSpy).toHaveBeenCalledTimes(2);
      const secondCallUrl = new URL(fetchSpy.mock.calls[1][0]);
      expect(secondCallUrl.searchParams.get('pageToken')).toBe('page-2');
      expect(result.map((s) => s.id)).toEqual(['spaces/AAA', 'spaces/BBB']);
    });

    it('respuesta no-2xx: propaga el error del servidor', async () => {
      fetchSpy.mockResolvedValue(errorResponse('forbidden', 403));

      await expect(googleChatSyncService.listSpaces('token-x')).rejects.toThrow(/Google Chat listSpaces failed/);
    });
  });

  describe('fetchMessages', () => {
    it('camino feliz: parsea mensajes y asigna speaker', async () => {
      fetchSpy.mockResolvedValue(
        jsonResponse({
          messages: [
            {
              text: 'hola',
              sender: { displayName: 'Ana' },
              createTime: '2024-01-01T00:00:00Z',
            },
          ],
        })
      );

      const result = await googleChatSyncService.fetchMessages('spaces/AAA', 'token-x');

      expect(result).toEqual([{ speaker: 'Ana', text: 'hola', timestamp: '2024-01-01T00:00:00Z' }]);
    });

    it('boundary: cero mensajes devuelve array vacío', async () => {
      fetchSpy.mockResolvedValue(jsonResponse({ messages: [] }));

      expect(await googleChatSyncService.fetchMessages('spaces/AAA', 'token-x')).toEqual([]);
    });

    it('boundary: data.messages ausente no lanza, devuelve array vacío', async () => {
      fetchSpy.mockResolvedValue(jsonResponse({}));

      expect(await googleChatSyncService.fetchMessages('spaces/AAA', 'token-x')).toEqual([]);
    });

    it('ignora mensajes sin texto (adjuntos/cards) sin lanzar', async () => {
      fetchSpy.mockResolvedValue(
        jsonResponse({
          messages: [
            { sender: { displayName: 'Ana' }, createTime: '2024-01-01T00:00:00Z' }, // sin text ni formattedText
            { text: '   ', sender: { displayName: 'Ana' }, createTime: '2024-01-01T00:00:01Z' }, // solo whitespace
          ],
        })
      );

      expect(await googleChatSyncService.fetchMessages('spaces/AAA', 'token-x')).toEqual([]);
    });

    it('usa formattedText como fallback si text falta', async () => {
      fetchSpy.mockResolvedValue(
        jsonResponse({
          messages: [{ formattedText: 'con formato', sender: { displayName: 'Ana' }, createTime: 't1' }],
        })
      );

      const [msg] = await googleChatSyncService.fetchMessages('spaces/AAA', 'token-x');

      expect(msg.text).toBe('con formato');
    });

    it('speaker cae a sender.name si no hay displayName, y a "Unknown" si no hay sender', async () => {
      fetchSpy.mockResolvedValue(
        jsonResponse({
          messages: [
            { text: 'msg1', sender: { name: 'users/123' }, createTime: 't1' },
            { text: 'msg2', createTime: 't2' },
          ],
        })
      );

      const result = await googleChatSyncService.fetchMessages('spaces/AAA', 'token-x');

      expect(result[0].speaker).toBe('users/123');
      expect(result[1].speaker).toBe('Unknown');
    });

    it('boundary: after=null no añade el filtro de fecha a la query', async () => {
      fetchSpy.mockResolvedValue(jsonResponse({ messages: [] }));

      await googleChatSyncService.fetchMessages('spaces/AAA', 'token-x', null);

      const calledUrl = new URL(fetchSpy.mock.calls[0][0]);
      expect(calledUrl.searchParams.has('filter')).toBe(false);
    });

    it('boundary: after con cursor real añade filter=createTime > "<after>"', async () => {
      fetchSpy.mockResolvedValue(jsonResponse({ messages: [] }));

      await googleChatSyncService.fetchMessages('spaces/AAA', 'token-x', '2024-01-01T00:00:00Z');

      const calledUrl = new URL(fetchSpy.mock.calls[0][0]);
      expect(calledUrl.searchParams.get('filter')).toBe('createTime > "2024-01-01T00:00:00Z"');
    });

    it('sigue la paginación vía nextPageToken hasta que ya no hay más', async () => {
      fetchSpy
        .mockResolvedValueOnce(
          jsonResponse({
            messages: [{ text: 'primero', sender: { displayName: 'Ana' }, createTime: 't1' }],
            nextPageToken: 'page-2',
          })
        )
        .mockResolvedValueOnce(
          jsonResponse({ messages: [{ text: 'segundo', sender: { displayName: 'Bruno' }, createTime: 't2' }] })
        );

      const result = await googleChatSyncService.fetchMessages('spaces/AAA', 'token-x');

      expect(fetchSpy).toHaveBeenCalledTimes(2);
      const secondCallUrl = new URL(fetchSpy.mock.calls[1][0]);
      expect(secondCallUrl.searchParams.get('pageToken')).toBe('page-2');
      expect(result.map((m) => m.text)).toEqual(['primero', 'segundo']);
    });

    it('respuesta no-2xx: propaga el error del servidor', async () => {
      fetchSpy.mockResolvedValue(errorResponse('space not found', 404));

      await expect(googleChatSyncService.fetchMessages('spaces/AAA', 'token-x')).rejects.toThrow(
        /Google Chat fetchMessages failed/
      );
    });
  });
});
