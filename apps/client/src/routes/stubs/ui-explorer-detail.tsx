/** @jsxImportSource solid-js */
import { ExplorerDetail, useLocalSearchParams } from '@pkgs/ui';
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
