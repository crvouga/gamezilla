/** @jsxImportSource solid-js */

import { ExplorerList } from '@pkgs/ui';
import type { JSX } from 'solid-js';

export default function UiExplorerRoute(): JSX.Element {
  return <ExplorerList hrefFor={(id) => `/ui/${id}`} />;
}
