/** Playwright global setup — boot real-mode sidecars once per run. */
export default async function globalSetup() {
  process.env['SIM_MODE'] = 'max';
  const { ensureMaxFidelityStack } = await import(
    './src/setup/real-mode-stack.ts'
  );
  await ensureMaxFidelityStack();
}
