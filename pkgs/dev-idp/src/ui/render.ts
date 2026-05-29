/**
 * Server-side adapter: turns the {@link ./page.ChooserPage} Hono JSX
 * component into a complete HTML document string.
 */
import { ChooserPage, type DevIdpClientConfig } from './page';

export async function renderChooserPage(props: {
  config: DevIdpClientConfig;
  clientBundleUrl: string;
}): Promise<string> {
  const element = ChooserPage(props);
  const node = element instanceof Promise ? await element : element;
  const body = await Promise.resolve(node.toString());
  return `<!doctype html>\n${body}`;
}
