/** Playwright global setup — boot max-fidelity sidecars once per run. */
export default async function globalSetup() {
  process.env['SIM_FIDELITY'] = 'max';
  const { ensureMaxFidelityStack } = await import(
    './src/setup/max-fidelity-stack.ts'
  );
  await ensureMaxFidelityStack();
}
