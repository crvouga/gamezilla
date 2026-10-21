/** @jsxImportSource solid-js */

import { useLocalSearchParams } from '@pkgs/ui-root-client-ts/app-router';
import { ExplorerDetail } from '@pkgs/ui-root-client-ts/explorer-detail';
import type { JSX } from 'solid-js';

export default function UiExplorerDetailRoute(): JSX.Element {
  const params = useLocalSearchParams<{ component?: string | undefined }>();
  const componentId = () => params().component ?? '';
  return (
    <ExplorerDetail
      componentId={componentId()}
      hrefFor={(id) => `/ui/${id}`}
      listHref="/ui"
    />
  );
}
