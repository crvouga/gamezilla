export class HarnessCrashError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'HarnessCrashError';
  }
}
