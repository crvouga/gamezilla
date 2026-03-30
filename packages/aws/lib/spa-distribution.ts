import * as cdk from 'aws-cdk-lib';
import * as acm from 'aws-cdk-lib/aws-certificatemanager';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as s3 from 'aws-cdk-lib/aws-s3';
import type { Construct } from 'constructs';

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

  const functionAssociations: cloudfront.FunctionAssociation[] = [];

  if (props.domainNames) {
    const apexRedirectFn = new cloudfront.Function(
      scope,
      `${id}ApexRedirectFn`,
      {
        code: cloudfront.FunctionCode.fromInline(`\
function handler(event) {
  var host = event.request.headers.host.value;
  if (!host.startsWith("www.")) {
    return {
      statusCode: 301,
      statusDescription: "Moved Permanently",
      headers: { location: { value: "https://www." + host + event.request.uri } }
    };
  }
  return event.request;
}`),
        runtime: cloudfront.FunctionRuntime.JS_2_0,
      }
    );
    functionAssociations.push({
      function: apexRedirectFn,
      eventType: cloudfront.FunctionEventType.VIEWER_REQUEST,
    });
  }

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
      {
        httpStatus: 404,
        responseHttpStatus: 200,
        responsePagePath: '/index.html',
        ttl: cdk.Duration.minutes(0),
      },
    ],
  });
}
