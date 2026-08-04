import type { Selector } from './selector';

/** Human-readable selector description for error messages. */
export function formatSelector(selector: Selector): string {
  switch (selector.kind) {
    case 'testId':
      return `testId("${selector.value}")`;
    case 'text': {
      const exact = selector.exact === false ? ', exact: false' : '';
      return `text("${selector.value}"${exact})`;
    }
    case 'label':
      return `label("${selector.value}")`;
    case 'role': {
      const name = selector.name ? `, name: "${selector.name}"` : '';
      return `role("${selector.role}"${name})`;
    }
  }
}
