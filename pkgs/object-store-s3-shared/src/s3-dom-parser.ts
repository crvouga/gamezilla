/**
 * The worker bundle loads the AWS SDK's browser XML parser, which
 * constructs `DOMParser`. workerd has none, so a ListObjects response
 * (success or error XML) throws and `/api/reports` is 500. Install xmldom
 * only when this runtime has no parser of its own.
 */
import { DOMParser } from '@xmldom/xmldom';

const XML_NODE = {
  ELEMENT_NODE: 1,
  TEXT_NODE: 3,
  DOCUMENT_NODE: 9,
} as const;

type DomScope = {
  DOMParser?: unknown;
  Node?: unknown;
};

export function installS3DomParser(): void {
  const scope = globalThis as DomScope;
  if (typeof scope.DOMParser === 'function') return;
  scope.DOMParser = DOMParser;
  if (typeof scope.Node === 'undefined') scope.Node = XML_NODE;
}
