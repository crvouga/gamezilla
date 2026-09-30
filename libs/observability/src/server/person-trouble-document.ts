import { ATTR } from '@pkgs/observability/core';
import { parseLocalClock, splitPlace } from '@pkgs/observability/query';

export type PersonPlant = {
  readonly name: string;
  readonly place: string;
  readonly at: string;
  readonly nowMs: number;
  readonly userId: string;
  readonly crashTraceId: string;
  readonly crashSpanId: string;
  readonly requestTraceId: string;
  readonly requestSpanId: string;
};

type Attribute = {
  readonly key: string;
  readonly value: { readonly stringValue: string };
};

type ResourceSpanInput = {
  readonly attributes: readonly Attribute[];
  readonly error: boolean;
  readonly instantMs: number;
  readonly name: string;
  readonly service: string;
  readonly spanId: string;
  readonly traceId: string;
};

/** Two traces: the person's own clock on the crash, and where the connection appeared. */
export function personTroubleDocument(plant: PersonPlant): {
  readonly resourceSpans: readonly unknown[];
} {
  const clock = parseLocalClock(plant.at, plant.nowMs);
  if (clock === undefined) {
    throw new Error(`The time ${JSON.stringify(plant.at)} needs a zone`);
  }
  const place = splitPlace(plant.place);
  return {
    resourceSpans: [
      resourceSpan({
        traceId: plant.crashTraceId,
        spanId: plant.crashSpanId,
        name: 'client.error',
        instantMs: clock.instantMs,
        error: true,
        service: 'gamezilla-client',
        attributes: [
          attribute(ATTR.USER_ID, plant.userId),
          attribute(ATTR.APP_DEVICE_TIMEZONE, clock.timeZone),
        ],
      }),
      resourceSpan({
        traceId: plant.requestTraceId,
        spanId: plant.requestSpanId,
        name: 'http.server.request',
        instantMs: clock.instantMs,
        error: false,
        service: 'gamezilla-server',
        attributes: placeAttributes(plant.userId, place.city, place.region),
      }),
    ],
  };
}

function placeAttributes(
  userId: string,
  city: string,
  region: string | undefined
): readonly Attribute[] {
  return [
    attribute(ATTR.USER_ID, userId),
    ...(city.length === 0 ? [] : [attribute(ATTR.APP_CLIENT_CITY, city)]),
    ...(region === undefined
      ? []
      : [attribute(ATTR.APP_CLIENT_REGION, region)]),
  ];
}

function resourceSpan(input: ResourceSpanInput): unknown {
  const start = String(input.instantMs * 1_000_000);
  return {
    resource: { attributes: [attribute(ATTR.SERVICE_NAME, input.service)] },
    scopeSpans: [
      {
        spans: [
          {
            traceId: input.traceId,
            spanId: input.spanId,
            name: input.name,
            startTimeUnixNano: start,
            endTimeUnixNano: String((input.instantMs + 1) * 1_000_000),
            status: input.error
              ? { code: 2, message: 'app crashed' }
              : { code: 1 },
            attributes: input.attributes,
          },
        ],
      },
    ],
  };
}

function attribute(key: string, value: string): Attribute {
  return { key, value: { stringValue: value } };
}
