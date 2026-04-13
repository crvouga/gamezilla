import type { InjectionToken } from '../dependency-injection/dependency-injection-container';
import type { Logger } from './logger';

export const LoggerToken: InjectionToken<Logger> = Symbol('Logger');
