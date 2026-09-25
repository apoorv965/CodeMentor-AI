const { spawn } = require('child_process');

const backendPort = String(process.env.BACKEND_PORT || 5001);
const publicPort = String(process.env.PORT || 10000);

function start(name, command, args, env) {
  const child = spawn(command, args, { env: { ...process.env, ...env }, stdio: ['ignore', 'pipe', 'pipe'] });
  child.stdout.on('data', (chunk) => process.stdout.write(`[${name}] ${chunk}`));
  child.stderr.on('data', (chunk) => process.stderr.write(`[${name}] ${chunk}`));
  child.on('exit', (code, signal) => {
    if (!shuttingDown) {
      console.error(`[${name}] exited unexpectedly: code=${code} signal=${signal || 'none'}`);
      shutdown(code || 1);
    }
  });
  return child;
}

let shuttingDown = false;
const backend = start('api', 'node', ['src/server.js'], {
  PORT: backendPort,
  PERSISTENCE_MODE: process.env.PERSISTENCE_MODE || 'mongo',
  EXECUTION_MODE: process.env.EXECUTION_MODE || 'disabled',
  ALLOW_UNSANDBOXED_EXECUTION: 'false',
});
const frontend = start('web', 'node', ['serve.js'], {
  PORT: publicPort,
  BACKEND_URL: `http://127.0.0.1:${backendPort}`,
});

function shutdown(code = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const child of [frontend, backend]) {
    if (!child.killed) child.kill('SIGTERM');
  }
  setTimeout(() => process.exit(code), 5000).unref();
}

for (const signal of ['SIGTERM', 'SIGINT']) process.on(signal, () => shutdown(0));
process.on('uncaughtException', (error) => { console.error(error); shutdown(1); });
process.on('unhandledRejection', (error) => { console.error(error); shutdown(1); });
