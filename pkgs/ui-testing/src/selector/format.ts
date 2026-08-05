import type { Selector } from './selector';

/** Human-readable selector description for error messages. */
export function formatSelector(selector: Selector): string {
  const nthSuffix = selector.nth !== undefined ? `, nth: ${selector.nth}` : '';
  switch (selector.kind) {
    case 'testId':
      return `testId("${selector.value}"${nthSuffix})`;
    case 'text': {
      const exact = selector.exact === false ? ', exact: false' : '';
      return `text("${selector.value}"${exact}${nthSuffix})`;
    }
    case 'label':
      return `label("${selector.value}"${nthSuffix})`;
    case 'role': {
      const name = selector.name ? `, name: "${selector.name}"` : '';
      return `role("${selector.role}"${name}${nthSuffix})`;
    }
  }
}
