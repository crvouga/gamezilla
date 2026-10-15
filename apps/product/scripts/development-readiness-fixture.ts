import type { ServiceContext } from './dev-services';

/** A fixed startup plan; no listener, environment file or database is opened. */
export const DEVELOPMENT_PLAN: ServiceContext['plan'] = {
  options: {
    instanceId: 'dev',
    apiNodes: 2,
    syntheticPopulationWorkers: 1,
    withS3: true,
    withMqtt: true,
    observabilityBackend: 'native',
    withWeb: true,
    webPort: 5428,
    frozenWeb: false,
    testHooks: false,
    keepData: true,
    idpStateMode: 'memory',
    idpStatePath: null,
  },
  dataDir: '/retained-local-data',
  apiOrigin: 'http://127.0.0.1:53434',
  webOrigin: 'http://127.0.0.1:5428',
  ports: {
    api: 53434,
    google: 53435,
    apple: 53436,
    billing: 53437,
    postgres: 53438,
    openAi: 53439,
    s3: 53440,
    mqtt: 53441,
    mqttWs: 53442,
    web: 5428,
    observability: { collector: 53445, tempo: 53446, grafana: 53447 },
    apiNodes: [53448, 53449],
    population: [53450],
  },
};
