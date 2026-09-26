import type { AttributeValue } from '@opentelemetry/api';
import {
  ATTR_CODE_FILE_PATH,
  ATTR_CODE_FUNCTION_NAME,
  ATTR_DB_OPERATION_NAME,
  ATTR_DB_QUERY_TEXT,
  ATTR_DB_SYSTEM_NAME,
  ATTR_DEPLOYMENT_ENVIRONMENT_NAME,
  ATTR_EXCEPTION_MESSAGE,
  ATTR_EXCEPTION_STACKTRACE,
  ATTR_EXCEPTION_TYPE,
  ATTR_HTTP_REQUEST_METHOD,
  ATTR_HTTP_RESPONSE_STATUS_CODE,
  ATTR_HTTP_ROUTE,
  ATTR_SERVICE_NAME,
  ATTR_SERVICE_VERSION,
} from '@opentelemetry/semantic-conventions';
import {
  ATTR_SESSION_ID,
  ATTR_USER_ID,
} from '@opentelemetry/semantic-conventions/incubating';

export const ATTR = {
  USER_ID: ATTR_USER_ID,
  SESSION_ID: ATTR_SESSION_ID,
  SERVICE_NAME: ATTR_SERVICE_NAME,
  SERVICE_VERSION: ATTR_SERVICE_VERSION,
  DEPLOYMENT_ENVIRONMENT_NAME: ATTR_DEPLOYMENT_ENVIRONMENT_NAME,
  DB_SYSTEM_NAME: ATTR_DB_SYSTEM_NAME,
  DB_OPERATION_NAME: ATTR_DB_OPERATION_NAME,
  DB_QUERY_TEXT: ATTR_DB_QUERY_TEXT,
  CODE_FILE_PATH: ATTR_CODE_FILE_PATH,
  CODE_FUNCTION_NAME: ATTR_CODE_FUNCTION_NAME,
  EXCEPTION_TYPE: ATTR_EXCEPTION_TYPE,
  EXCEPTION_MESSAGE: ATTR_EXCEPTION_MESSAGE,
  EXCEPTION_STACKTRACE: ATTR_EXCEPTION_STACKTRACE,
  HTTP_REQUEST_METHOD: ATTR_HTTP_REQUEST_METHOD,
  HTTP_ROUTE: ATTR_HTTP_ROUTE,
  HTTP_RESPONSE_STATUS_CODE: ATTR_HTTP_RESPONSE_STATUS_CODE,
  APP_MUTATION_ID: 'app.mutation.id',
  APP_MUTATION_ORIGIN_TIME_MS: 'app.mutation.origin_time_ms',
  APP_DEVICE_ID: 'app.device.id',
  APP_BUILD_SHA: 'app.build.sha',
  APP_SYNC_BATCH_SIZE: 'app.sync.batch_size',
  APP_TEST_ID: 'app.test.id',
  APP_TEST_PACKAGE: 'app.test.package',
  APP_TEST_FILE: 'app.test.file',
  APP_TEST_LINE: 'app.test.line',
  APP_CI_RUN_ID: 'app.ci.run_id',
  APP_CLOCK_SKEW_MS: 'app.clock_skew_ms',
  APP_INTERACTION_OUTCOME: 'app.interaction.outcome',
  APP_INTERACTION_TYPE: 'app.interaction.type',
  APP_INTERACTION_TARGET: 'app.interaction.target',
  APP_LOG_SEVERITY: 'app.log.severity',
  APP_LOG_MESSAGE: 'app.log.message',
  APP_LOG_NAME: 'app.log.name',
  APP_ERROR_TRACE_ID: 'app.error.trace_id',
  APP_ROOM_CONNECTION_ID: 'app.room.connection_id',
  APP_ROOM_MESSAGE_BYTES: 'app.room.message_bytes',
  APP_ROOM_MODULE: 'app.room.module',
  APP_ROOM_OUTCOME: 'app.room.outcome',
  APP_ROOM_TOPIC: 'app.room.topic',
} as const;

export type AttrValue = {
  'user.id': string;
  'session.id': string;
  'service.name': string;
  'service.version': string;
  'deployment.environment.name': string;
  'db.system.name': string;
  'db.operation.name': string;
  'db.query.text': string;
  'code.file.path': string;
  'code.function.name': string;
  'exception.type': string;
  'exception.message': string;
  'exception.stacktrace': string;
  'http.request.method': string;
  'http.route': string;
  'http.response.status_code': number;
  'app.mutation.id': string;
  'app.mutation.origin_time_ms': number;
  'app.device.id': string;
  'app.build.sha': string;
  'app.sync.batch_size': number;
  'app.test.id': string;
  'app.test.package': string;
  'app.test.file': string;
  'app.test.line': number;
  'app.ci.run_id': string;
  'app.clock_skew_ms': number;
  'app.interaction.outcome': 'navigation' | 'mutation' | 'request' | 'no_op';
  'app.interaction.type': 'click' | 'submit' | 'route';
  'app.interaction.target': string;
  'app.log.severity': 'debug' | 'info' | 'warn' | 'error';
  'app.log.message': string;
  'app.log.name': string;
  'app.error.trace_id': string;
  'app.room.connection_id': string;
  'app.room.message_bytes': number;
  'app.room.module': string;
  'app.room.outcome':
    | 'accepted'
    | 'closed'
    | 'error'
    | 'invalid_frame'
    | 'rejected';
  'app.room.topic': string;
};

export type Attributes = Partial<AttrValue>;

export type { AttributeValue };

export const ALLOWED_ATTRIBUTE_KEYS = new Set<string>(Object.values(ATTR));
