import { describe, expect, it, afterEach, vi } from 'vitest';
import service from '../../../../electron/services/codexService.js';

function makeSdk(events, onStartThread = () => {}) {
  return { Codex: class {
    startThread(options) {
      onStartThread(options);
      return { id: 'thread-1', async runStreamed() { return { events: (async function* () { yield* events; })() }; } };
    }
  } };
}

describe('codexService', () => {
  afterEach(() => service.__resetForTests());
  it('emits only incremental agent-message chunks and returns final text', async () => {
    service.__setSdkLoader(async () => makeSdk([
      { type: 'item.updated', item: { id: 'm1', type: 'agent_message', text: 'Hola' } },
      { type: 'item.updated', item: { id: 'm1', type: 'agent_message', text: 'Hola mundo' } },
      { type: 'item.completed', item: { id: 'm1', type: 'agent_message', text: 'Hola mundo' } },
      { type: 'turn.completed', usage: {} },
    ]));
    const chunks = [];
    const result = await service.run({ requestId: 'r1', prompt: 'x', onChunk: c => chunks.push(c) });
    expect(chunks).toEqual(['Hola', ' mundo']);
    expect(result.text).toBe('Hola mundo');
  });
  it('maps an already-aborted request to the cancellation contract', async () => {
    const controller = new AbortController(); controller.abort();
    await expect(service.run({ requestId: 'r2', prompt: 'x', signal: controller.signal })).rejects.toMatchObject({ name: 'AbortError', code: 'CODEX_CANCELLED' });
  });
  it('passes only allowlisted reasoning effort to the SDK thread', async () => {
    const onStartThread = vi.fn();
    service.__setSdkLoader(async () => makeSdk([
      { type: 'item.completed', item: { id: 'm1', type: 'agent_message', text: 'ok' } },
    ], onStartThread));
    await service.run({ requestId: 'reasoning', prompt: 'x', model: 'gpt-test', reasoningEffort: 'xhigh' });
    expect(onStartThread).toHaveBeenCalledWith(expect.objectContaining({ model: 'gpt-test', modelReasoningEffort: 'xhigh' }));
    await service.run({ requestId: 'no-reasoning', prompt: 'x', model: 'gpt-test' });
    expect(onStartThread.mock.calls[1][0]).not.toHaveProperty('modelReasoningEffort');
    await expect(service.run({ requestId: 'bad-reasoning', prompt: 'x', reasoningEffort: 'max' })).rejects.toMatchObject({ code: 'CODEX_REASONING_EFFORT_INVALID' });
  });
});

describe('Codex device-auth output safety', () => {
  it('accepts only the official HTTPS auth host', () => {
    expect(service.__approvedDeviceAuthUrl('https://auth.openai.com/device')).toBe('https://auth.openai.com/device');
  });
  it('rejects HTTP, credentials, ports, and lookalike hosts', () => {
    for (const url of ['http://auth.openai.com/device', 'https://x@auth.openai.com/device', 'https://auth.openai.com:444/device', 'https://auth.openai.com.evil.test/device']) expect(service.__approvedDeviceAuthUrl(url)).toBeNull();
  });
  it('strips real and degraded ANSI while preserving only structured public auth data', () => {
    const progress = service.__publicProgress('\u001b[90mWelcome to Codex\u001b[0m [90mVisit https://auth.openai.com/device[0m one-time code: ABCD-12345 token: secret', 'r');
    expect(progress).toEqual({ requestId: 'r', phase: 'device-auth', url: 'https://auth.openai.com/device', code: 'ABCD-12345' });
    expect(JSON.stringify(progress)).not.toMatch(/Welcome|\[90m|secret/);
  });
  it('strips escaped ANSI representations without removing the public code or URL', () => {
    const progress = service.__publicProgress('\\x1b[90mhttps://auth.openai.com/device\\x1b[0m Device code is WXYZ-98765', 'r');
    expect(progress).toMatchObject({ url: 'https://auth.openai.com/device', code: 'WXYZ-98765' });
  });
  it('extracts the real Codex code output with an expiry clause and ANSI', () => {
    expect(service.__extractDeviceCode('\u001b[1mEnter this one-time code (expires in 15 minutes) \u001b[36mI7GK-YAWPT\u001b[0m')).toBe('I7GK-YAWPT');
  });
  it('normalizes a compact official code but rejects unrelated words, URLs, and tokens', () => {
    expect(service.__extractDeviceCode('Your device code is i7gkyawpt')).toBe('I7GK-YAWPT');
    for (const output of [
      'Welcome to Codex AUTHENTICATE https://auth.openai.com/device',
      'one-time code available at https://auth.openai.com/device',
      'token: I7GK-YAWPT',
      'https://example.test/one-time/code/I7GK-YAWPT',
      'one-time code: TOO-LONGTOKEN',
    ]) expect(service.__extractDeviceCode(output)).toBeNull();
  });
});

function fakeChild({ stdout = [], stderr = [], code = 0, error, pending = false } = {}) {
  const lifecycle = new Map(); const stdoutListeners = new Set(); const stderrListeners = new Set();
  const stream = listeners => ({ on: (name, fn) => { if (name === 'data') listeners.add(fn); }, removeListener: (name, fn) => { if (name === 'data') listeners.delete(fn); } });
  const emitLifecycle = (name, value) => { const fn = lifecycle.get(name); lifecycle.delete(name); fn?.(value); };
  const child = {
    stdout: stream(stdoutListeners), stderr: stream(stderrListeners),
    once: (name, fn) => lifecycle.set(name, fn),
    removeListener: (name, fn) => { if (lifecycle.get(name) === fn) lifecycle.delete(name); },
    kill: () => { child.killed = true; emitLifecycle('close', null); },
    emitStdout: value => stdoutListeners.forEach(fn => fn(Buffer.from(value))),
    emitClose: value => emitLifecycle('close', value),
    emitError: value => emitLifecycle('error', value),
    listenerCount: name => lifecycle.has(name) ? 1 : 0,
  };
  if (!pending) setTimeout(() => { for (const value of stdout) child.emitStdout(value); for (const value of stderr) stderrListeners.forEach(fn => fn(Buffer.from(value))); if (error) child.emitError(error); else child.emitClose(code); }, 0);
  return child;
}

describe('Codex model catalog', () => {
  afterEach(() => { vi.useRealTimers(); service.__resetForTests(); });

  it('runs exact debug models args without a shell, filters hidden models, and normalizes official shapes', async () => {
    const payload = {
      models: [
        { slug: 'gpt-default', display_name: 'GPT Default', description: 'Default model', supported_reasoning_levels: [{ effort: 'low', description: 'Fast' }, { effort: 'high', description: 'Deep' }], default_reasoning_level: 'high', visibility: 'list' },
        { slug: 'hidden-model', visibility: 'hide', supported_reasoning_levels: [] },
        { slug: 'internal-model', visibility: 'none', supported_reasoning_levels: [] },
      ],
    };
    const spawn = vi.fn(() => fakeChild({ stdout: [JSON.stringify(payload)] }));
    service.__setExecutableResolver(() => '/mock/codex'); service.__setSpawn(spawn);

    await expect(service.listModels()).resolves.toEqual([{
      id: 'gpt-default', model: 'gpt-default', displayName: 'GPT Default', description: 'Default model',
      supportedReasoningEfforts: ['low', 'high'], defaultReasoningEffort: 'high', isDefault: false,
    }]);
    expect(spawn).toHaveBeenCalledWith('/mock/codex', ['debug', 'models'], { shell: false, stdio: ['ignore', 'pipe', 'pipe'] });
  });

  it('keeps gpt-5.6-sol usable when Codex advertises a future effort and default', async () => {
    const payload = {
      models: [{
        slug: 'gpt-5.6-sol',
        display_name: 'GPT-5.6 Sol',
        supported_reasoning_levels: [
          { effort: 'low' },
          { effort: 'max' },
          { effort: 'high' },
          { effort: 'low' },
        ],
        default_reasoning_level: 'max',
        visibility: 'list',
      }],
    };
    service.__setExecutableResolver(() => '/mock/codex');
    service.__setSpawn(() => fakeChild({ stdout: [JSON.stringify(payload)] }));

    await expect(service.listModels()).resolves.toEqual([{
      id: 'gpt-5.6-sol',
      model: 'gpt-5.6-sol',
      displayName: 'GPT-5.6 Sol',
      description: '',
      supportedReasoningEfforts: ['low', 'high'],
      defaultReasoningEffort: null,
      isDefault: false,
    }]);
  });

  it('fails explicitly for malformed JSON and invalid catalog shapes', async () => {
    const children = [fakeChild({ stdout: ['not-json'] }), fakeChild({ stdout: [JSON.stringify({ models: [{ description: 'missing id' }] })] })];
    service.__setExecutableResolver(() => 'codex'); service.__setSpawn(() => children.shift());
    await expect(service.listModels()).rejects.toMatchObject({ code: 'CODEX_MODELS_JSON_INVALID' });
    await expect(service.listModels()).rejects.toMatchObject({ code: 'CODEX_MODELS_SHAPE_INVALID' });
  });

  it('kills the mocked process on timeout and output limit', async () => {
    vi.useFakeTimers();
    const timeoutChild = fakeChild({ pending: true });
    service.__setExecutableResolver(() => 'codex'); service.__setSpawn(() => timeoutChild);
    const timedOut = service.listModels({ timeout: 10 });
    const timedOutExpectation = expect(timedOut).rejects.toMatchObject({ code: 'CODEX_CLI_TIMEOUT' });
    await vi.advanceTimersByTimeAsync(10);
    await timedOutExpectation;
    expect(timeoutChild.killed).toBe(true);

    const outputChild = fakeChild({ pending: true });
    service.__setSpawn(() => outputChild);
    const limited = service.listModels({ maxStdoutBytes: 4, maxOutputBytes: 4 });
    const limitedExpectation = expect(limited).rejects.toMatchObject({ code: 'CODEX_CLI_OUTPUT_LIMIT' });
    outputChild.emitStdout('12345');
    await limitedExpectation;
    expect(outputChild.killed).toBe(true);
  });
});

describe('Codex device-auth process lifecycle', () => {
  afterEach(() => service.__resetForTests());
  it('preserves partial output, publishes structured progress, and reports success', async () => {
    const children = [fakeChild({ stdout: ['\u001b[90mWelcome to Codex\u001b[0m\nVisit https://auth.openai.com/device\n', '\u001b[1mEnter this one-time code (expires in 15 minutes) I7GK-', 'YAWPT\u001b[0m'], code: 0 }), fakeChild({ stdout: ['Logged in'], code: 0 })];
    service.__setExecutableResolver(() => 'codex'); service.__setSpawn(() => children.shift());
    const progress = []; const result = await service.startLogin({ requestId: 'login-success', onProgress: value => progress.push(value) });
    expect(progress).toContainEqual(expect.objectContaining({ requestId: 'login-success', url: 'https://auth.openai.com/device' }));
    expect(progress).toContainEqual(expect.objectContaining({ requestId: 'login-success', code: 'I7GK-YAWPT' }));
    expect(progress.filter(value => value.url)).toHaveLength(1);
    expect(progress.filter(value => value.code)).toHaveLength(1);
    expect(JSON.stringify(progress)).not.toMatch(/Welcome|\[90m/);
    expect(result).toMatchObject({ success: true, connected: true });
  });
  it('reports process errors and clears the active login entry', async () => {
    service.__setExecutableResolver(() => 'codex'); service.__setSpawn(() => fakeChild({ error: new Error('broken process') }));
    const result = await service.startLogin({ requestId: 'login-error' });
    expect(result.success).toBe(false); expect(service.cancelLogin('login-error')).toBe(false);
  });
  it('kills and cleans up a cancelled login', async () => {
    const child = fakeChild({ pending: true }); service.__setExecutableResolver(() => 'codex'); service.__setSpawn(() => child);
    const pending = service.startLogin({ requestId: 'login-cancel', statusPollIntervalMs: 1000 });
    expect(service.cancelLogin('login-cancel')).toBe(true); expect(child.killed).toBe(true);
    expect(service.cancelLogin('login-cancel')).toBe(false);
    await expect(pending).resolves.toMatchObject({ success: false, connected: false });
    child.emitClose(0);
    child.emitError(new Error('late error'));
    expect(child.listenerCount('close')).toBe(0);
    expect(child.listenerCount('error')).toBe(0);
  });
  it('resolves from bounded status polling before device-auth closes and ignores late lifecycle events', async () => {
    vi.useFakeTimers();
    const loginChild = fakeChild({ pending: true });
    const statusChild = fakeChild({ pending: true });
    const spawn = vi.fn((_executable, args) => args.includes('--device-auth') ? loginChild : statusChild);
    service.__setExecutableResolver(() => 'codex'); service.__setSpawn(spawn);

    const resultPromise = service.startLogin({ requestId: 'login-polled', statusPollIntervalMs: 10, timeoutMs: 1000 });
    await vi.advanceTimersByTimeAsync(10);
    statusChild.emitStdout('Logged in using ChatGPT');
    statusChild.emitClose(0);
    const result = await resultPromise;

    expect(result).toMatchObject({ success: true, connected: true });
    expect(loginChild.killed).toBe(true);
    expect(spawn.mock.calls.filter(([, args]) => args.join(' ') === 'login status')).toHaveLength(1);
    expect(service.cancelLogin('login-polled')).toBe(false);
    expect(vi.getTimerCount()).toBe(0);
    loginChild.emitClose(1);
    loginChild.emitError(new Error('late error'));
    vi.useRealTimers();
  });
  it('never overlaps login status checks and stops scheduling after cancellation', async () => {
    vi.useFakeTimers();
    const loginChild = fakeChild({ pending: true });
    const firstStatus = fakeChild({ pending: true });
    const secondStatus = fakeChild({ stdout: ['not logged in'], code: 1 });
    const statusChildren = [firstStatus, secondStatus];
    const spawn = vi.fn((_executable, args) => args.includes('--device-auth') ? loginChild : statusChildren.shift());
    service.__setExecutableResolver(() => 'codex'); service.__setSpawn(spawn);

    const resultPromise = service.startLogin({ requestId: 'login-no-overlap', statusPollIntervalMs: 10, timeoutMs: 1000 });
    await vi.advanceTimersByTimeAsync(10);
    await vi.advanceTimersByTimeAsync(100);
    expect(spawn.mock.calls.filter(([, args]) => args.join(' ') === 'login status')).toHaveLength(1);

    firstStatus.emitStdout('Not logged in');
    firstStatus.emitClose(1);
    await vi.advanceTimersByTimeAsync(10);
    expect(spawn.mock.calls.filter(([, args]) => args.join(' ') === 'login status')).toHaveLength(2);
    expect(service.cancelLogin('login-no-overlap')).toBe(true);
    await expect(resultPromise).resolves.toMatchObject({ success: false });
    await vi.runAllTimersAsync();
    expect(spawn.mock.calls.filter(([, args]) => args.join(' ') === 'login status')).toHaveLength(2);
    expect(vi.getTimerCount()).toBe(0);
    vi.useRealTimers();
  });
});

it('kills a timed out login process and returns an actionable timeout error', async () => {
  vi.useFakeTimers();
  const child = fakeChild({ pending: true }); service.__setExecutableResolver(() => 'codex'); service.__setSpawn(() => child);
  const resultPromise = service.startLogin({ requestId: 'login-timeout', timeoutMs: 10, statusPollIntervalMs: 1000 });
  await vi.advanceTimersByTimeAsync(10); const result = await resultPromise;
  expect(child.killed).toBe(true); expect(result).toMatchObject({ success: false }); expect(result.error).toMatch(/agotó el tiempo/i); expect(service.cancelLogin('login-timeout')).toBe(false);
  vi.useRealTimers();
});
