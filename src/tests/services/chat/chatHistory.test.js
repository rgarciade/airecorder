import { describe, it, expect } from 'vitest';
import { normalizeChatHistory, serializeHistoryForPrompt } from '../../../services/chat/chatHistory.js';
import { mapHistoryToMessages } from '../../../prompts/common/ragPrompts.js';

describe('normalizeChatHistory', () => {
  it('returns [] for empty/null history', () => {
    expect(normalizeChatHistory(null)).toEqual([]);
    expect(normalizeChatHistory([])).toEqual([]);
  });

  it('passes through a V2 individual message as-is (tipo + contenido present)', () => {
    const history = [
      { id: 'm1', tipo: 'usuario', contenido: 'Hola', fecha: '2024-01-01T00:00:00Z', adjuntos: [] },
    ];
    const result = normalizeChatHistory(history);
    expect(result).toEqual([
      { id: 'm1', tipo: 'usuario', contenido: 'Hola', fecha: '2024-01-01T00:00:00Z', adjuntos: [] },
    ]);
  });

  it('expands a V2 pregunta/respuesta pair into two separate messages', () => {
    const history = [
      { tipo: 'usuario', pregunta: '¿Qué tal?', respuesta: 'Bien', fecha: '2024-01-02T00:00:00Z', adjuntos: [] },
    ];
    const result = normalizeChatHistory(history);
    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({ tipo: 'usuario', contenido: '¿Qué tal?', fecha: '2024-01-02T00:00:00Z' });
    expect(result[1]).toMatchObject({ tipo: 'asistente', contenido: 'Bien', fecha: '2024-01-02T00:00:00Z' });
  });

  it('expands a legacy V1 pregunta/respuesta pair (no tipo field) into two separate messages', () => {
    const history = [
      { pregunta: 'Vieja pregunta', respuesta: 'Vieja respuesta', fecha: '2024-01-03T00:00:00Z' },
    ];
    const result = normalizeChatHistory(history);
    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({ tipo: 'usuario', contenido: 'Vieja pregunta' });
    expect(result[1]).toMatchObject({ tipo: 'asistente', contenido: 'Vieja respuesta' });
  });

  it('does not expand a pregunta-only pair when respuesta is missing/falsy', () => {
    const history = [{ pregunta: 'Pregunta sin responder', respuesta: '', fecha: '2024-01-04T00:00:00Z' }];
    const result = normalizeChatHistory(history);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ tipo: 'usuario', contenido: 'Pregunta sin responder' });
  });

  it('keeps ⚠️ error messages (unlike mapHistoryToMessages, which filters them for the LLM)', () => {
    const history = [
      { id: 'e1', tipo: 'asistente', contenido: '⚠️ Error del proveedor', fecha: '2024-01-05T00:00:00Z' },
    ];
    const result = normalizeChatHistory(history);
    expect(result).toEqual([
      { id: 'e1', tipo: 'asistente', contenido: '⚠️ Error del proveedor', fecha: '2024-01-05T00:00:00Z', adjuntos: [] },
    ]);
  });

  it('bug #10: contenido present with falsy/absent tipo is classified the same way as mapHistoryToMessages (fallback to assistant/asistente)', () => {
    const edgeCaseItem = { id: 'x1', contenido: 'mensaje sin tipo', fecha: '2024-01-06T00:00:00Z' };

    const normalized = normalizeChatHistory([edgeCaseItem]);
    // Antes del fix, la guarda exigía `item.tipo &&`, así que este mensaje NO caía en el
    // "Caso 1" y se interpretaba erróneamente como un par pregunta/respuesta legacy,
    // perdiendo el contenido real (buscaba `item.pregunta`, que no existe aquí).
    expect(normalized).toHaveLength(1);
    expect(normalized[0].contenido).toBe('mensaje sin tipo');

    const mapped = mapHistoryToMessages([edgeCaseItem]);
    expect(mapped).toHaveLength(1);

    // Paridad exacta con la función canónica: mismo criterio de clasificación.
    expect(normalized[0].tipo).toBe('asistente');
    expect(mapped[0].role).toBe('assistant');
  });

  it('bug #10: contenido present with tipo === "usuario" is still classified as usuario (regression guard)', () => {
    const item = { id: 'x2', tipo: 'usuario', contenido: 'mensaje de usuario', fecha: '2024-01-07T00:00:00Z' };

    const normalized = normalizeChatHistory([item]);
    const mapped = mapHistoryToMessages([item]);

    expect(normalized[0].tipo).toBe('usuario');
    expect(mapped[0].role).toBe('user');
  });
});

describe('serializeHistoryForPrompt', () => {
  it('returns "" for empty/null input', () => {
    expect(serializeHistoryForPrompt(null)).toBe('');
    expect(serializeHistoryForPrompt([])).toBe('');
  });

  it('serializes user/assistant messages with role labels, separated by a blank line', () => {
    const messages = [
      { role: 'user', content: 'Pregunta' },
      { role: 'assistant', content: 'Respuesta' },
    ];
    expect(serializeHistoryForPrompt(messages)).toBe('[USUARIO]: Pregunta\n\n[ASISTENTE]: Respuesta');
  });
});
