import { UiTestError } from './ui-test-error';

/** The active driver does not implement the requested operation. */
export class NotImplementedError extends UiTestError {
  readonly operation: string;
  readonly driverKind: string;

  constructor(driverKind: string, operation: string, detail?: string) {
    const suffix = detail ? `: ${detail}` : '';
    super(
      `Driver "${driverKind}" does not implement "${operation}"${suffix}`
    );
    this.name = 'NotImplementedError';
    this.driverKind = driverKind;
    this.operation = operation;
  }
}
