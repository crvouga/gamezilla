import type { SpecBundle } from '@crvouga/atlas';

/** The product is authored as one explorable machine, never a chart catalog. */
export function productStatechartSourceProblems(
  bundle: SpecBundle
): readonly string[] {
  if (bundle.charts.length !== 1) {
    return [
      `Expected exactly one product statechart; found ${bundle.charts.length}: ${bundle.charts.map((chart) => chart.file).join(', ') || 'none'}`,
    ];
  }
  const [chart] = bundle.charts;
  if (!chart) return ['The product statechart is missing'];
  const problems: string[] = [];
  if (chart.file !== 'product.machine.json') {
    problems.push(
      `The one product statechart must be specs/product.machine.json; found ${chart.file}`
    );
  }
  if (bundle.root !== chart.machine.id) {
    problems.push(
      `The Atlas root "${bundle.root}" does not identify the one product machine "${chart.machine.id}"`
    );
  }
  if (bundle.journeys.length === 0) {
    problems.push('The product statechart has no guided journeys');
  }
  return problems;
}
