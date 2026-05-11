/**
 * Re-export of `@gamezilla/api-types/cors`. Lives in api-types so feature
 * packages (e.g. `auth`) can build CORS-aware responses without depending on
 * the api package.
 */
export {
  apiCors,
  tryBetterAuthOptionsResponse,
  withBetterAuthBrowserCorsForRequest,
} from '@gamezilla/api-types/cors';
