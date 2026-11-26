import { spawn } from 'node:child_process';
import net from 'node:net';
import path from 'node:path';

const syncHost = process.env.HOST || '127.0.0.1';
const syncPort = Number(process.env.PORT || 4174);

function isPortOpen(host, port) {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host, port });
    socket.once('connect', () => {
      socket.destroy();
      resolve(true);
    });
    socket.once('error', () => {
      socket.destroy();
      resolve(false);
    });
  });
}

async function waitForPort(host, port, timeoutMs = 6000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await isPortOpen(host, port)) return true;
    await new Promise((r) => setTimeout(r, 80));
  }
  return false;
}

const extraViteArgs = process.argv.slice(2);
const alreadyRunning = await isPortOpen(syncHost, syncPort);

let serverProc = null;
if (!alreadyRunning) {
  serverProc = spawn(process.execPath, [path.resolve('server/index.mjs')], {
    stdio: 'inherit',
    env: process.env,
  });
  await waitForPort(syncHost, syncPort);
}

const viteBin = path.resolve('node_modules/vite/bin/vite.js');
const viteProc = spawn(process.execPath, [viteBin, ...extraViteArgs], {
  stdio: 'inherit',
  env: process.env,
});

function shutdown(exitCode = 0) {
  if (serverProc && !serverProc.killed) {
    serverProc.kill('SIGTERM');
  }
  if (viteProc && !viteProc.killed) {
    viteProc.kill('SIGTERM');
  }
  process.exit(exitCode);
}

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));

if (serverProc) {
  serverProc.on('exit', (code) => {
    if (code && code !== 0 && !viteProc.killed) {
      viteProc.kill('SIGTERM');
      process.exit(code);
    }
  });
}

viteProc.on('exit', (code) => {
  if (serverProc && !serverProc.killed) {
    serverProc.kill('SIGTERM');
  }
  process.exit(code ?? 0);
});
