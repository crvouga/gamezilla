import type { HttpClient } from '@pkgs/http-client-shared/types';
import { normalizePersonName } from '@pkgs/observability-root-shared/person-name';
import { findPersonTrouble } from '@pkgs/observability-root-shared/person-trouble';
import { TempoTraceStore } from '@pkgs/observability-root-shared/tempo';
import type { PersonPlant } from './person-trouble-document';
import { personTroubleDocument } from './person-trouble-document';

export type PersonProbeCredentials = {
  readonly collectorToken: string;
  readonly collectorUrl: string;
  readonly collectorUser: string;
  readonly tempoToken: string;
  readonly tempoUrl: string;
  readonly tempoUser: string;
};

export type PersonRead = {
  readonly at: string;
  readonly name: string;
  readonly nowMs: number;
  readonly place: string;
  readonly userId: string;
};

export type PersonReadResult = {
  readonly code: 0 | 1 | 2;
  readonly sawTrouble: boolean;
  readonly text: string;
};

export async function plantPersonTrouble(
  http: HttpClient,
  credentials: PersonProbeCredentials,
  plant: PersonPlant
): Promise<boolean> {
  try {
    const response = await http.fetch(credentials.collectorUrl, {
      method: 'POST',
      headers: {
        Authorization: basicAuth(
          credentials.collectorUser,
          credentials.collectorToken
        ),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(personTroubleDocument(plant)),
    });
    return response.ok;
  } catch {
    return false;
  }
}

export async function readPersonTrouble(
  http: HttpClient,
  credentials: PersonProbeCredentials,
  question: PersonRead
): Promise<PersonReadResult> {
  const store = new TempoTraceStore({
    baseUrl: credentials.tempoUrl.replace(/\/$/, ''),
    fetch: (url, init) => http.fetch(url, init),
    now: () => question.nowMs,
    token: credentials.tempoToken,
    username: credentials.tempoUser,
  });
  const wanted = normalizePersonName(question.name);
  const report = await findPersonTrouble(
    store,
    {
      async resolvePeople(name) {
        return normalizePersonName(name) === wanted
          ? [{ userId: question.userId, matchedAs: 'name' }]
          : [];
      },
    },
    {
      name: question.name,
      at: question.at,
      place: question.place,
      nowMs: question.nowMs,
    }
  );
  return {
    code: report.code,
    sawTrouble: report.sawTrouble,
    text: report.text,
  };
}

function basicAuth(user: string, token: string): string {
  return `Basic ${btoa(`${user}:${token}`)}`;
}
