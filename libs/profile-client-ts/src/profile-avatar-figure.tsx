/** @jsxImportSource @solidjs/web */
/**
 * The picture on a person's own profile, described to someone listening as
 * their avatar: one image with a name, whatever draws it inside.
 */

import { useLingui } from '@pkgs/lingui-solid-client-ts/macro';
import { StackVertical } from '@pkgs/ui-root-client-ts/stack';
import type { JSX } from '@solidjs/web';

export function ProfileAvatarFigure(props: {
  readonly children: JSX.Element;
}): JSX.Element {
  const { t } = useLingui();
  return (
    <StackVertical role="img" aria-label={t`Your avatar`}>
      {props.children}
    </StackVertical>
  );
}
