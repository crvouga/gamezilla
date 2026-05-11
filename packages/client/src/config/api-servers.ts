/** Backwards-compat shim; api-servers config lives in `@gamezilla/client-runtime`. */
export {
  DEFAULT_LOCAL_PREVIEW_API_ORIGIN,
  PRODUCTION_API_HTTP_HOSTNAMES,
  assertTigerPolicyForResolvedApiOrigin,
  getApiBaseUrl,
  productionApiUrlTigerExceptionEnabled,
} from '@gamezilla/client-runtime/api-servers';
