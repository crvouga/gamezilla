/** @jsxImportSource solid-js */
/**
 * Landmarks -- `Nav`, `Main`, `Section`, `Article`, `Aside`, `Header`,
 * `Footer`. Each adds the element's meaning and nothing else: it renders
 * with `display: contents`, so it has no box and its children lay out in the
 * nearest layout ancestor as if the landmark were not there.
 *
 * Meaning and layout are separate components. Wrap a stack in a landmark, or
 * a landmark in a stack; never ask one component for both.
 *
 * - Name a landmark that appears more than once on a screen (`aria-label`,
 *   or `aria-labelledby` pointing at its heading). A `Section` is a landmark
 *   only when it is named.
 * - One `Main` per screen.
 * - A landmark has no box, so it cannot take focus, be scrolled to or be
 *   measured; give those handles to the stack inside it.
 *
 * @example
 * ```tsx
 * <Nav aria-label={t`Sections`}>
 *   <StackHorizontal gap="sm">…</StackHorizontal>
 * </Nav>
 * <Section aria-labelledby="friends-title">
 *   <StackVertical gap="md">
 *     <H2 id="friends-title">{t`Friends`}</H2>
 *     …
 *   </StackVertical>
 * </Section>
 * ```
 */

import { componentId } from '@pkgs/ui-root-shared-ts/component-id';
import type { JSX } from 'solid-js';

export type LandmarkProps = {
  children?: JSX.Element | undefined;
  /** Names the landmark for assistive technology. */
  'aria-label'?: string | undefined;
  /** `id` of the heading that names the landmark. */
  'aria-labelledby'?: string | undefined;
  id?: string | undefined;
  /** Rendered as `data-testid`. */
  testId?: string | undefined;
};

/** Links for moving around the app or the screen. */
export function Nav(props: LandmarkProps): JSX.Element {
  return (
    <nav
      class="contents"
      id={props.id}
      data-testid={props.testId}
      data-component={componentId('Nav')}
      aria-label={props['aria-label']}
      aria-labelledby={props['aria-labelledby']}
    >
      {props.children}
    </nav>
  );
}

/** The primary content of the screen. One per screen. */
export function Main(props: LandmarkProps): JSX.Element {
  return (
    <main
      class="contents"
      id={props.id}
      data-testid={props.testId}
      data-component={componentId('Main')}
      aria-label={props['aria-label']}
      aria-labelledby={props['aria-labelledby']}
    >
      {props.children}
    </main>
  );
}

/** A thematic part of the screen, named by its heading. */
export function Section(props: LandmarkProps): JSX.Element {
  return (
    <section
      class="contents"
      id={props.id}
      data-testid={props.testId}
      data-component={componentId('Section')}
      aria-label={props['aria-label']}
      aria-labelledby={props['aria-labelledby']}
    >
      {props.children}
    </section>
  );
}

/** A self-contained item: a post, a card in a feed, a comment. */
export function Article(props: LandmarkProps): JSX.Element {
  return (
    <article
      class="contents"
      id={props.id}
      data-testid={props.testId}
      data-component={componentId('Article')}
      aria-label={props['aria-label']}
      aria-labelledby={props['aria-labelledby']}
    >
      {props.children}
    </article>
  );
}

/** Content beside the main content: a sidebar, a related panel. */
export function Aside(props: LandmarkProps): JSX.Element {
  return (
    <aside
      class="contents"
      id={props.id}
      data-testid={props.testId}
      data-component={componentId('Aside')}
      aria-label={props['aria-label']}
      aria-labelledby={props['aria-labelledby']}
    >
      {props.children}
    </aside>
  );
}

/** Introductory content of the screen or of its nearest section. */
export function Header(props: LandmarkProps): JSX.Element {
  return (
    <header
      class="contents"
      id={props.id}
      data-testid={props.testId}
      data-component={componentId('Header')}
      aria-label={props['aria-label']}
      aria-labelledby={props['aria-labelledby']}
    >
      {props.children}
    </header>
  );
}

/** Closing content of the screen or of its nearest section. */
export function Footer(props: LandmarkProps): JSX.Element {
  return (
    <footer
      class="contents"
      id={props.id}
      data-testid={props.testId}
      data-component={componentId('Footer')}
      aria-label={props['aria-label']}
      aria-labelledby={props['aria-labelledby']}
    >
      {props.children}
    </footer>
  );
}
