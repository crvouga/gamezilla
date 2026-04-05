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
    request.uri = encodeS3Uri(uri);
    return request;
  }
  request.uri = '/index.html';
  return request;
}

// Re-encode each path segment so S3 OAC SigV4 signing handles
// characters like @ and + that cause AccessDenied when sent literally.
function encodeS3Uri(uri) {
  return uri.split('/').map(function (seg) {
    try { seg = decodeURIComponent(seg); } catch (e) { /* already literal */ }
    return seg.replace(/[^A-Za-z0-9\-._~]/g, function (ch) {
      var hex = ch.charCodeAt(0).toString(16).toUpperCase();
      return '%' + (hex.length < 2 ? '0' + hex : hex);
    });
  }).join('/');
}
