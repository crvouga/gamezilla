export class SimCrashError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SimCrashError';
  }
}
