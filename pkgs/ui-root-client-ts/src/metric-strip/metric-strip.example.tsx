/** @jsxImportSource solid-js */
import { useLingui } from '@lingui/solid/macro';
import { formatCompactNumber } from '@pkgs/ui-root-client-ts/compact-number';
import { GameStat } from '@pkgs/ui-root-client-ts/game-stat';
import { Grid } from '@pkgs/ui-root-client-ts/grid';
import { EyeIcon, UsersIcon } from '@pkgs/ui-root-client-ts/icons';
import { MetricStrip } from '@pkgs/ui-root-client-ts/metric-strip';
import { StackHorizontal, StackVertical } from '@pkgs/ui-root-client-ts/stack';
import { StatPill } from '@pkgs/ui-root-client-ts/stat-pill';
import type { JSX } from 'solid-js';
import { ExampleRoot } from '../../storybook/fixtures/example-root';
import { ExampleSection } from '../../storybook/fixtures/example-section';
import { SchemePreview } from '../../storybook/fixtures/scheme-preview';

function Strips(): JSX.Element {
  const { i18n } = useLingui();
  const compact = (value: number): string =>
    formatCompactNumber(value, i18n().locale);
  return (
    <>
      <ExampleSection title="MetricStrip: small numbers stay exact">
        <MetricStrip
          aria-label="Summary"
          metrics={[
            { label: 'Items', value: 128 },
            { label: 'Completed', value: 96 },
            { label: 'Elapsed', value: '2.4 s', detail: 'Recorded duration' },
          ]}
        />
      </ExampleSection>
      <ExampleSection title="MetricStrip: counts from 1,000 are compact">
        <MetricStrip
          aria-label="Totals"
          metrics={[
            { label: 'Played', value: compact(1_000) },
            { label: 'Watched', value: compact(12_400) },
            { label: 'Moves', value: compact(1_250_000) },
          ]}
        />
      </ExampleSection>
      <ExampleSection title="GameStat">
        <Grid columns={3} gap="lg">
          <GameStat label="Wins" value={42} detail={null} />
          <GameStat label="Games" value={compact(12_400)} detail="All time" />
          <GameStat label="Rating" value={1520} detail="Ratings stay exact" />
        </Grid>
      </ExampleSection>
    </>
  );
}

function Pills(): JSX.Element {
  return (
    <ExampleSection title="StatPill: sunken when inactive, soft blue when active, compact from 1,000">
      <StackHorizontal gap="sm" align="center" wrap>
        <StatPill value={7} label="watching" icon={EyeIcon} />
        <StatPill value={12_400} label="watching" icon={EyeIcon} />
        <StatPill value={1_250_000} label="players" icon={UsersIcon} />
        <StatPill value={3} label="points" active />
        <StatPill value={999} label="points" />
      </StackHorizontal>
    </ExampleSection>
  );
}

export default function MetricStripExample(): JSX.Element {
  return (
    <ExampleRoot>
      <SchemePreview>
        <StackVertical gap="lg">
          <Strips />
          <Pills />
        </StackVertical>
      </SchemePreview>
    </ExampleRoot>
  );
}
