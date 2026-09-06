import { killListenersOnPorts } from '@pkgs/os/kill-port';

function readPort(name: string, fallback: number): number {
  const raw = process.env[name]?.trim();
  if (raw === undefined || raw === '') return fallback;
  const n = Number.parseInt(raw, 10);
  return Number.isInteger(n) && n >= 1 && n <= 65_535 ? n : fallback;
}

killListenersOnPorts([
  8081, // vite.config.mts dev server
  readPort('PREVIEW_PORT', 5173),
]);
