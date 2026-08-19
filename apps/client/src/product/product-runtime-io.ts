import {
  createAlwaysAvailableOrigin,
  createHealthOriginAvailability,
  gateFetchUntilAvailable,
  type OriginAvailability,
} from '@pkgs/http-client';
import type { Io } from '@pkgs/io';

export function apiHealthUrl(apiBaseUrl: string): string {
  return `${apiBaseUrl.replace(/\/+$/, '')}/api/health`;
}

export function createGatedWallIo(args: {
  readonly wall: Io;
  readonly apiBaseUrl: string;
}): { io: Io; availability: OriginAvailability } {
  const healthUrl = apiHealthUrl(args.apiBaseUrl);
  const innerFetch = (input: RequestInfo | URL, init?: RequestInit) =>
    args.wall.http.fetch(input, init);
  const availability = createHealthOriginAvailability({
    healthUrl,
    fetch: innerFetch,
    timers: args.wall.timers,
    clock: args.wall.clock,
  });
  return {
    availability,
    io: {
      ...args.wall,
      http: {
        fetch: gateFetchUntilAvailable({
          fetch: innerFetch,
          availability,
        }),
      },
    },
  };
}

export function resolveProductRuntime(args: {
  readonly injectedIo: Io | undefined;
  readonly wall: Io;
  readonly apiBaseUrl: string;
}): { io: Io; availability: OriginAvailability } {
  if (args.injectedIo !== undefined) {
    return {
      io: args.injectedIo,
      availability: createAlwaysAvailableOrigin({
        healthUrl: apiHealthUrl(args.apiBaseUrl),
      }),
    };
  }
  return createGatedWallIo({
    wall: args.wall,
    apiBaseUrl: args.apiBaseUrl,
  });
}
