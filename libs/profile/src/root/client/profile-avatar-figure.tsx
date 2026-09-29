/** @jsxImportSource solid-js */
/**
 * The picture on a person's own profile, described to someone listening as
 * their avatar: one image with a name, whatever draws it inside.
 */

import { useLingui } from '@lingui/solid/macro';
import type { JSX } from 'solid-js';

export function ProfileAvatarFigure(props: {
  readonly children: JSX.Element;
}): JSX.Element {
  const { t } = useLingui();
  return (
    <span class="box" role="img" aria-label={t`Your avatar`}>
      {props.children}
    </span>
  );
}
