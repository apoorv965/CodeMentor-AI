const { spawn, spawnSync } = require('child_process');
const fs = require('fs/promises');
const path = require('path');
const os = require('os');
const crypto = require('crypto');

const LANGUAGE_CONFIG = {
  python: { image: process.env.DOCKER_PYTHON_IMAGE || 'online-compiler-python:latest', filename: 'main.py', compileCmd: null, runCmd: ['python3', 'main.py'], localCmd: ['python3'] },
  cpp: { image: process.env.DOCKER_CPP_IMAGE || 'online-compiler-cpp:latest', filename: 'main.cpp', compileCmd: ['g++', 'main.cpp', '-O2', '-o', 'main'], runCmd: ['./main'], localCmd: ['g++'] },
  java: { image: process.env.DOCKER_JAVA_IMAGE || 'online-compiler-java:latest', filename: 'Main.java', compileCmd: ['javac', 'Main.java'], runCmd: ['java', '-XX:+UseSerialGC', '-Xmx256m', 'Main'], localCmd: ['javac'] },
};
const TIMEOUT_MS = parseInt(process.env.EXECUTION_TIMEOUT_MS || '10000', 10);
const MAX_OUTPUT_LENGTH = parseInt(process.env.MAX_OUTPUT_LENGTH || '20000', 10);
const hasDocker = () => Boolean(spawnSync('docker', ['info'], { stdio: 'ignore' }).status === 0);

function runProcess(command, args, cwd, input, timeoutMs) {
  return new Promise((resolve) => {
    const proc = spawn(command, args, { cwd, stdio: ['pipe', 'pipe', 'pipe'] });
    let stdout = ''; let stderr = ''; let timedOut = false; let truncated = false;
    const timer = setTimeout(() => { timedOut = true; proc.kill('SIGKILL'); }, timeoutMs);
    const collect = (current, chunk) => {
      const next = current + chunk.toString();
      if (next.length > MAX_OUTPUT_LENGTH) { truncated = true; return next.slice(0, MAX_OUTPUT_LENGTH); }
      return next;
    };
    proc.stdout.on('data', (data) => { stdout = collect(stdout, data); });
    proc.stderr.on('data', (data) => { stderr = collect(stderr, data); });
    proc.on('error', (err) => { clearTimeout(timer); resolve({ stdout, stderr: `${stderr}${err.message}`, exitCode: 1, timedOut, truncated }); });
    proc.on('close', (exitCode) => { clearTimeout(timer); resolve({ stdout, stderr, exitCode, timedOut, truncated }); });
    proc.stdin.end(input || '');
  });
}

function runInContainer(image, cmdArray, hostDir, input, timeoutMs) {
  const name = `compiler-job-${crypto.randomBytes(8).toString('hex')}`;
  return runProcess('docker', ['run', '--name', name, '--rm', '-i', '--network', 'none', '--memory', '128m', '--cpus', '0.5', '--pids-limit', '64', '--security-opt', 'no-new-privileges', '--cap-drop', 'ALL', '-v', `${hostDir}:/box:rw`, '-w', '/box', image, ...cmdArray], hostDir, input, timeoutMs);
}

async function executeCode(language, code, input) {
  const config = LANGUAGE_CONFIG[language];
  if (!config) throw new Error(`Unsupported language: ${language}`);
  const executionMode = process.env.EXECUTION_MODE || 'auto';
  if (executionMode === 'disabled') {
    const error = new Error('Code execution is temporarily disabled on this deployment. Configure a sandbox executor to enable it.');
    error.statusCode = 503;
    throw error;
  }
  const jobId = crypto.randomBytes(8).toString('hex');
  const hostDir = path.join(os.tmpdir(), 'compiler-jobs', jobId);
  await fs.mkdir(hostDir, { recursive: true });
  const start = Date.now();
  const dockerMode = hasDocker() && executionMode !== 'local';
  const localModeAllowed = executionMode === 'local' && process.env.ALLOW_UNSANDBOXED_EXECUTION === 'true';
  if (!dockerMode && !localModeAllowed) {
    const error = new Error('No sandbox executor is available. Use EXECUTION_MODE=local only for trusted development, or configure Docker-backed execution.');
    error.statusCode = 503;
    throw error;
  }
  try {
    await fs.writeFile(path.join(hostDir, config.filename), code, 'utf8');
    let compile;
    if (config.compileCmd) compile = dockerMode ? await runInContainer(config.image, config.compileCmd, hostDir, '', TIMEOUT_MS) : await runProcess(config.localCmd[0], config.compileCmd.slice(1), hostDir, '', TIMEOUT_MS);
    if (compile && (compile.timedOut || compile.exitCode !== 0)) return { success: false, output: compile.stdout, error: compile.timedOut ? 'Compilation timed out.' : (compile.stderr.trim() || 'Compilation failed.'), executionTime: `${Date.now() - start}ms`, stage: 'compile' };
    const run = dockerMode ? await runInContainer(config.image, config.runCmd, hostDir, input || '', TIMEOUT_MS) : await runProcess(config.runCmd[0], config.runCmd.slice(1), hostDir, input || '', TIMEOUT_MS);
    const executionTime = `${Date.now() - start}ms`;
    if (run.timedOut) return { success: false, output: run.stdout, error: `Execution timed out after ${TIMEOUT_MS}ms.`, executionTime, stage: 'runtime' };
    if (run.exitCode !== 0) return { success: false, output: run.stdout, error: run.stderr.trim() || `Process exited with code ${run.exitCode}.`, executionTime, stage: 'runtime' };
    return { success: true, output: run.truncated ? `${run.stdout}\n[output truncated]` : run.stdout, error: null, executionTime, stage: 'runtime', mode: dockerMode ? 'docker' : 'local' };
  } finally { await fs.rm(hostDir, { recursive: true, force: true }).catch(() => {}); }
}

module.exports = { executeCode, LANGUAGE_CONFIG };
