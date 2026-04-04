function handler(event) {
  var request = event.request;
  var headers = request.headers;
  var host = headers.host && headers.host.value ? headers.host.value : '';
  var uri = request.uri;
  var qs = request.querystring;

  var isCloudFront = host.indexOf('.cloudfront.net') !== -1;

  var useApexRedirect = ${use_apex_redirect};
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
}
