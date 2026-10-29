import { serviceName } from '@libs/product-identity-shared-ts/technical-names';
import { ATTR } from '@pkgs/observability-root-shared-ts/attributes';
import { PROBE_ENVIRONMENT } from '@pkgs/observability-root-shared-ts/deployment-environment';
import { parseLocalClock } from '@pkgs/observability-root-shared-ts/local-clock';
import { splitPlace } from '@pkgs/observability-root-shared-ts/place';

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
        service: serviceName('client'),
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
        service: serviceName('server'),
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
    resource: {
      attributes: [
        attribute(ATTR.SERVICE_NAME, input.service),
        // Planted next to real traces: say so, or the crash reads as an incident.
        attribute(ATTR.DEPLOYMENT_ENVIRONMENT_NAME, PROBE_ENVIRONMENT),
      ],
    },
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

const MINUTE_MS = 60_000;

/**
 * Live traces must arrive near their timestamp to be searchable in Tempo.
 * Move the fixture's clock to now, keeping the zone and differences between
 * the person's clock and the team's question.
 */
export function personProbeClock(
  at: string,
  referenceAt: string,
  nowMs: number
): string {
  const reference = parseLocalClock(referenceAt, nowMs);
  const clock = parseLocalClock(at, reference?.instantMs ?? nowMs);
  if (reference === undefined || clock === undefined)
    throw new Error(`The time ${JSON.stringify(at)} needs a zone`);
  const shifted = new Date(
    nowMs +
      clock.instantMs -
      reference.instantMs +
      clock.offsetMinutes * MINUTE_MS
  );
  const hour = String(shifted.getUTCHours()).padStart(2, '0');
  const minute = String(shifted.getUTCMinutes()).padStart(2, '0');
  return `${hour}:${minute} ${clock.timeZone}`;
}
