import { describe, it, expect } from 'vitest';
import { buildOpenAIToolMessages, parseOpenAIToolMessage } from '../../../services/ai/openAIToolChat.js';

describe('buildOpenAIToolMessages', () => {
  const toolCallMessage = {
    role: 'assistant',
    content: '',
    toolCalls: [{ id: 'call-1', name: 'find_tasks', arguments: { query: '' } }],
  };

  it('stringifies function.arguments by default (true OpenAI spec — DeepSeek/Kimi/LM Studio/OpenAI)', () => {
    const [built] = buildOpenAIToolMessages([toolCallMessage]);
    expect(built.tool_calls[0].function.arguments).toBe('{"query":""}');
    expect(typeof built.tool_calls[0].function.arguments).toBe('string');
  });

  it('regression (bug real, Ollama + gemma3): keeps arguments as a raw object when stringifyArguments:false', () => {
    // Ollama devuelve function.arguments como objeto nativo en su propia respuesta
    // (confirmado en producción) y rechaza con 400 ("Value looks like object, but
    // can't find closing '}' symbol") si se lo reenvía re-serializado como string.
    const [built] = buildOpenAIToolMessages([toolCallMessage], { stringifyArguments: false });
    expect(built.tool_calls[0].function.arguments).toEqual({ query: '' });
    expect(typeof built.tool_calls[0].function.arguments).toBe('object');
  });

  it('maps a tool-result message to {role, tool_call_id, content} regardless of stringifyArguments', () => {
    const toolResult = { role: 'tool', toolCallId: 'call-1', name: 'find_tasks', content: '{"tasks":[]}' };
    const [built] = buildOpenAIToolMessages([toolResult], { stringifyArguments: false });
    expect(built).toEqual({ role: 'tool', tool_call_id: 'call-1', content: '{"tasks":[]}' });
  });
});

describe('parseOpenAIToolMessage', () => {
  it('accepts function.arguments already as an object (Ollama dialect)', () => {
    const { toolCalls } = parseOpenAIToolMessage({
      tool_calls: [{ id: 'call-1', function: { name: 'find_tasks', arguments: { query: 'login' } } }],
    });
    expect(toolCalls[0].arguments).toEqual({ query: 'login' });
  });

  it('accepts function.arguments as a JSON string (true OpenAI spec)', () => {
    const { toolCalls } = parseOpenAIToolMessage({
      tool_calls: [{ id: 'call-1', function: { name: 'find_tasks', arguments: '{"query":"login"}' } }],
    });
    expect(toolCalls[0].arguments).toEqual({ query: 'login' });
  });

  it('returns toolCalls:null when there are no tool_calls in the message', () => {
    const result = parseOpenAIToolMessage({ content: 'hola' });
    expect(result).toEqual({ text: 'hola', toolCalls: null });
  });
});
