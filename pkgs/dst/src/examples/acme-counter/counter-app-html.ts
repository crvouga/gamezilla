/**
 * Bun maps bare `*.html` imports to {@link Bun.HTMLBundle}. With
 * `with { type: 'text' }` the runtime value is a string — cast once here.
 */
import html from './counter-app.html' with { type: 'text' };

export const counterAppHtml: string = html as unknown as string;
