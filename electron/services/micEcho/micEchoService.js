const nodeFs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const REPORT_VERSION = 1;
const DEFAULT_TIMEOUT_MS = 30 * 60 * 1000;
const RESULT_PREFIX = 'ECHO_RESULT ';

/**
 * Default runner: spawns `audio_sync_analyzer echo-cancel` and parses the last
 * `ECHO_RESULT {json}` stdout line. Rejects on non-zero exit, timeout or
 * missing result line.
 * Argv contract: echo-cancel --mic <p> --ref <p> --out <p> --ffmpeg <p>
 */
function runEchoCancelWithPython({ micPath, refPath, outPath, timeoutMs = DEFAULT_TIMEOUT_MS }) {
  // Lazy require: keeps the factory importable without Electron.
  const { resolvePythonCommand } = require('../../utils/pythonCommand');
  return new Promise((resolve, reject) => {
    const { executable, args, ffmpegPath } = resolvePythonCommand('audio_sync_analyzer');
    const argv = [...args, 'echo-cancel', '--mic', micPath, '--ref', refPath, '--out', outPath];
    if (ffmpegPath) argv.push('--ffmpeg', ffmpegPath);

    const child = spawn(executable, argv, { env: { ...process.env, PYTHONUNBUFFERED: '1' } });
    let stdout = '';
    let stderr = '';
    let settled = false;
    const finish = (fn, value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      fn(value);
    };
    const timer = setTimeout(() => {
      child.kill();
      finish(reject, new Error('echo-cancel timed out'));
    }, timeoutMs);

    child.stdout.on('data', (chunk) => { stdout += chunk.toString(); });
    child.stderr.on('data', (chunk) => { stderr += chunk.toString(); });
    child.on('error', (error) => finish(reject, error));
    child.on('close', (code) => {
      if (code !== 0) {
        finish(reject, new Error(`echo-cancel exited with code ${code}: ${stderr.trim().slice(-500)}`));
        return;
      }
      const line = stdout.split(/\r?\n/).reverse().find((l) => l.startsWith(RESULT_PREFIX));
      if (!line) {
        finish(reject, new Error('echo-cancel produced no ECHO_RESULT line'));
        return;
      }
      try {
        finish(resolve, JSON.parse(line.slice(RESULT_PREFIX.length)));
      } catch (error) {
        finish(reject, new Error(`Invalid ECHO_RESULT: ${error.message}`));
      }
    });
  });
}

/**
 * @param {{ runEchoCancel: Function, fs?: object, logger?: object }} deps
 */
function createMicEchoService({ runEchoCancel, fs = nodeFs, logger = console } = {}) {
  const jobs = new Map(); // baseName -> { promise, resolve, started }

  function newJob() {
    let resolve;
    const promise = new Promise((res) => { resolve = res; });
    return { promise, resolve, started: false };
  }

  /** Registers a pending job synchronously so waitFor() blocks until it runs. */
  function reserve(baseName) {
    if (!jobs.has(baseName)) jobs.set(baseName, newJob());
  }

  /** Drops a reservation that never started (e.g. the handler failed early). */
  function release(baseName) {
    const job = jobs.get(baseName);
    if (job && !job.started) {
      jobs.delete(baseName);
      job.resolve();
    }
  }

  function waitFor(baseName) {
    const job = jobs.get(baseName);
    return job ? job.promise.then(() => undefined, () => undefined) : Promise.resolve();
  }

  const exists = async (p) => {
    try { await fs.promises.access(p); return true; } catch { return false; }
  };
  const remove = (p) => fs.promises.rm(p, { force: true }).catch(() => {});

  async function writeReport(dir, report) {
    try {
      const analysisDir = path.join(dir, 'analysis');
      await fs.promises.mkdir(analysisDir, { recursive: true });
      await fs.promises.writeFile(
        path.join(analysisDir, 'echo_cancellation.json'),
        JSON.stringify({ ...report, version: REPORT_VERSION, timestamp: new Date().toISOString() }, null, 2)
      );
    } catch (error) {
      logger.warn('[MicEcho] Could not write report:', error.message);
    }
  }

  async function process_(dir, baseName) {
    const micPath = path.join(dir, `${baseName}-microphone.webm`);
    const originalPath = path.join(dir, `${baseName}-microphone-original.webm`);
    const refPath = path.join(dir, `${baseName}-system.webm`);
    const tmpPath = path.join(dir, `${baseName}-echo-tmp.webm`);

    // Recovery: a crash between renames can leave only the original.
    if (!(await exists(micPath)) && (await exists(originalPath))) {
      await fs.promises.rename(originalPath, micPath);
    }
    if (!(await exists(micPath))) return { success: false, error: 'microphone track not found' };
    if (!(await exists(refPath))) return { success: true, applied: false, reason: 'no_reference' };

    const hasOriginal = await exists(originalPath);
    const source = hasOriginal ? originalPath : micPath;

    await remove(tmpPath);
    let result;
    try {
      result = await runEchoCancel({ micPath: source, refPath, outPath: tmpPath });
    } catch (error) {
      await remove(tmpPath);
      throw error;
    }

    if (!result || !result.applied) {
      await remove(tmpPath);
      const reason = result && result.reason;
      await writeReport(dir, { applied: false, reason });
      return { success: true, applied: false, reason };
    }

    if (!(await exists(tmpPath))) {
      throw new Error('echo-cancel reported success but wrote no output');
    }

    let movedAside = false;
    try {
      if (!hasOriginal) {
        await fs.promises.rename(micPath, originalPath);
        movedAside = true;
      }
      await fs.promises.rename(tmpPath, micPath);
    } catch (error) {
      if (movedAside) {
        try { await fs.promises.rename(originalPath, micPath); } catch (rollbackError) {
          logger.error('[MicEcho] Rollback failed:', rollbackError.message);
        }
      }
      await remove(tmpPath);
      throw error;
    }

    await writeReport(dir, { applied: true, delayMs: result.delayMs, erleDb: result.erleDb });
    return { success: true, applied: true, delayMs: result.delayMs, erleDb: result.erleDb };
  }

  /**
   * Replaces `{base}-microphone.webm` with an echo-cancelled version when echo
   * is found. Never throws: failures resolve `{ success: false, error }`.
   */
  async function cancelMicEcho(dir, baseName) {
    let job = jobs.get(baseName);
    if (!job) {
      job = newJob();
      jobs.set(baseName, job);
    }
    job.started = true;
    try {
      return await process_(dir, baseName);
    } catch (error) {
      logger.error('[MicEcho] Echo cancellation failed:', error.message);
      return { success: false, error: error.message || String(error) };
    } finally {
      if (jobs.get(baseName) === job) jobs.delete(baseName);
      job.resolve();
    }
  }

  return { cancelMicEcho, waitFor, reserve, release };
}

const micEchoService = createMicEchoService({ runEchoCancel: runEchoCancelWithPython });

module.exports = { createMicEchoService, micEchoService };
