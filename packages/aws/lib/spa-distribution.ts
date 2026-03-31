import * as cdk from 'aws-cdk-lib';
import * as acm from 'aws-cdk-lib/aws-certificatemanager';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as s3 from 'aws-cdk-lib/aws-s3';
import type { Construct } from 'constructs';

/**
 * Viewer-request routing for static + SPA:
 * - Paths that look like files (contain ".") go to S3 as-is (.js, .wasm, images, etc.).
 * - Other paths fetch "/index.html" (client-side routes) without relying on
 *   custom error responses — so a missing .wasm returns real 404 + MIME, not HTML.
 * - Optional apex → www redirect for custom domain distributions.
 */
function spaViewerRequestFunctionCode(useCustomDomainApexRedirect: boolean): string {
  return `function handler(event) {
  var request = event.request;
  var headers = request.headers;
  var host = headers.host && headers.host.value ? headers.host.value : '';
  var uri = request.uri;
  var qs = request.querystring;

  var isCloudFront = host.indexOf('.cloudfront.net') !== -1;
  var useApexRedirect = ${useCustomDomainApexRedirect};
  if (useApexRedirect && !isCloudFront && host && !host.startsWith('www.')) {
    var loc = 'https://www.' + host + uri + (qs && qs.length > 0 ? '?' + qs : '');
    return {
      statusCode: 301,
      statusDescription: 'Moved Permanently',
      headers: { location: { value: loc } }
    };
  }

  var q = uri.indexOf('?');
  var pathOnly = q >= 0 ? uri.slice(0, q) : uri;
  if (pathOnly.indexOf('.') !== -1) {
    return request;
  }
  request.uri = '/index.html';
  return request;
}`;
}

export function createSpaDistribution(
  scope: Construct,
  id: string,
  bucket: s3.Bucket,
  props: {
    certificate?: acm.ICertificate;
    domainNames?: string[];
  }
): cloudfront.Distribution {
  const customTls =
    props.certificate !== undefined && props.domainNames !== undefined
      ? { certificate: props.certificate, domainNames: props.domainNames }
      : {};

  const useApexRedirect =
    props.domainNames !== undefined && props.domainNames.length > 0;

  const spaRouterFn = new cloudfront.Function(
    scope,
    `${id}SpaRouterFn`,
    {
      code: cloudfront.FunctionCode.fromInline(
        spaViewerRequestFunctionCode(useApexRedirect)
      ),
      runtime: cloudfront.FunctionRuntime.JS_2_0,
    }
  );

  const functionAssociations: cloudfront.FunctionAssociation[] = [
    {
      function: spaRouterFn,
      eventType: cloudfront.FunctionEventType.VIEWER_REQUEST,
    },
  ];

  return new cloudfront.Distribution(scope, id, {
    defaultBehavior: {
      origin: origins.S3BucketOrigin.withOriginAccessControl(bucket),
      viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
      allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD_OPTIONS,
      cachedMethods: cloudfront.CachedMethods.CACHE_GET_HEAD_OPTIONS,
      compress: true,
      functionAssociations,
    },
    defaultRootObject: 'index.html',
    ...customTls,
    minimumProtocolVersion: cloudfront.SecurityPolicyProtocol.TLS_V1_2_2021,
    errorResponses: [
      {
        httpStatus: 403,
        responseHttpStatus: 200,
        responsePagePath: '/index.html',
        ttl: cdk.Duration.minutes(0),
      },
    ],
  });
}
