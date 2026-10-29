import { describe, expect, test } from 'bun:test';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';

import { installS3DomParser } from '@pkgs/object-store-s3-shared-ts/s3-dom-parser';

const INDEX_KEY =
  'spec-reports/index/0000000000001-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.json';

/** A namespaced R2 ListObjects result, the body the worker fails to read. */
const LIST_XML = `<?xml version="1.0" encoding="UTF-8"?>
<ListBucketResult xmlns="http://s3.amazonaws.com/doc/2006-03-01/">
  <Name>acme-reports</Name>
  <Prefix>spec-reports/index/</Prefix>
  <KeyCount>1</KeyCount>
  <IsTruncated>false</IsTruncated>
  <Contents>
    <Key>${INDEX_KEY}</Key>
  </Contents>
</ListBucketResult>`;

type DomScope = {
  DOMParser?: unknown;
  Node?: unknown;
};

type XmlParser = {
  parseXML: (xml: string) => unknown;
};

function collectStrings(value: unknown, out: string[]): void {
  if (typeof value === 'string') {
    out.push(value);
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) collectStrings(item, out);
    return;
  }
  if (value !== null && typeof value === 'object') {
    for (const item of Object.values(value)) collectStrings(item, out);
  }
}

function hideDomGlobals(): () => void {
  const scope = globalThis as DomScope;
  const parser = Object.getOwnPropertyDescriptor(globalThis, 'DOMParser');
  const node = Object.getOwnPropertyDescriptor(globalThis, 'Node');
  Reflect.deleteProperty(scope, 'DOMParser');
  Reflect.deleteProperty(scope, 'Node');
  return () => {
    defineBack('DOMParser', parser);
    defineBack('Node', node);
  };
}

/** The parser the worker bundle actually loads, resolved from the S3 client. */
async function loadBrowserParser(): Promise<XmlParser> {
  const clientPkg = import.meta.resolve('@aws-sdk/client-s3/package.json');
  const require = createRequire(clientPkg);
  const xmlPkg = require.resolve('@aws-sdk/xml-builder/package.json');
  const file = join(dirname(xmlPkg), 'dist-es/xml-parser.browser.js');
  return (await import(pathToFileURL(file).href)) as XmlParser;
}

function defineBack(
  name: 'DOMParser' | 'Node',
  descriptor: PropertyDescriptor | undefined
): void {
  if (descriptor === undefined) {
    Reflect.deleteProperty(globalThis, name);
    return;
  }
  Object.defineProperty(globalThis, name, descriptor);
}

describe('S3 XML on a DOM-less runtime', () => {
  test('the browser parser reads ListBucketResult once DOMParser exists', async () => {
    // regression: reports-api-domparser
    const restore = hideDomGlobals();
    try {
      const browser = await loadBrowserParser();
      expect(() => browser.parseXML(LIST_XML)).toThrow(/DOMParser/);
      installS3DomParser();
      const strings: string[] = [];
      collectStrings(browser.parseXML(LIST_XML), strings);
      expect(strings).toContain(INDEX_KEY);
    } finally {
      restore();
    }
  });
});
