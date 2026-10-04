import type { CheckerOptions } from './ui-quality-check-types';

export interface Arguments {
  command: string;
  inputs: string[];
  json: boolean;
  help: boolean;
  options: CheckerOptions;
  good?: string;
  bad?: string;
  output?: string;
  config?: string;
  sourcePath?: string;
  maxFalsePositiveRate?: number;
}

const COMMANDS = new Set([
  'image',
  'video',
  'check',
  'setup',
  'calibrate',
  'benchmark',
]);
const NUMBERS = new Map<string, keyof CheckerOptions>([
  ['threshold', 'threshold'],
  ['batch-size', 'batchSize'],
  ['concurrency', 'concurrency'],
  ['sampling-fps', 'samplingFps'],
  ['dedupe-threshold', 'dedupeThreshold'],
  ['confirmation-window-ms', 'confirmationWindowMs'],
  ['worst-frames', 'maxWorstFrames'],
  ['failure-clip-ms', 'failureClipMs'],
]);
const STRINGS = new Map<string, keyof CheckerOptions>([
  ['model-dir', 'modelDir'],
  ['provider', 'provider'],
  ['cache-dir', 'cacheDir'],
  ['artifacts', 'artifactsDir'],
  ['ffmpeg', 'ffmpegPath'],
  ['aggregation', 'aggregation'],
]);

function option(args: Arguments, name: string, value: string): void {
  const number = NUMBERS.get(name);
  const string = STRINGS.get(name);
  if (number) {
    if (!value.trim() || !Number.isFinite(Number(value)))
      throw new Error(`--${name} requires a finite number.`);
    args.options = { ...args.options, [number]: Number(value) };
    return;
  }
  if (string) {
    if (
      string === 'provider' &&
      !['auto', 'cpu', 'webgpu', 'coreml', 'cuda', 'dml'].includes(value)
    )
      throw new Error(
        'Invalid provider. Use auto, cpu, webgpu, coreml, cuda or dml.'
      );
    if (string === 'aggregation' && !['minimum', 'confirmed'].includes(value))
      throw new Error('Aggregation must be minimum or confirmed.');
    args.options = { ...args.options, [string]: value };
    return;
  }
  if (name === 'max-false-positive-rate') {
    args.maxFalsePositiveRate = Number(value);
    return;
  }
  const field = (
    {
      good: 'good',
      bad: 'bad',
      output: 'output',
      config: 'config',
      'source-path': 'sourcePath',
    } as const
  )[name as 'good'];
  if (!field) throw new Error(`Unknown option: --${name}`);
  args[field] = value;
}

export function parseArguments(argv: readonly string[]): Arguments {
  const args: Arguments = {
    command: 'check',
    inputs: [],
    json: false,
    help: false,
    options: {},
  };
  let start = 0;
  if (argv[0] && COMMANDS.has(argv[0])) {
    args.command = argv[0];
    start = 1;
  }
  for (let i = start; i < argv.length; i++) {
    const token = argv[i] ?? '';
    if (token === '--') {
      args.inputs.push(...argv.slice(i + 1));
      break;
    }
    if (token === '--json') {
      args.json = true;
      continue;
    }
    if (['--help', '-h'].includes(token)) {
      args.help = true;
      continue;
    }
    if (token === '--include-empty') {
      args.options = { ...args.options, ignoreEmptyFrames: false };
      continue;
    }
    if (!token.startsWith('-')) {
      args.inputs.push(token);
      continue;
    }
    if (!token.startsWith('--')) throw new Error(`Unknown option: ${token}`);
    const [name, inline] = token.slice(2).split('=', 2);
    const value = inline ?? argv[++i];
    if (!name || value === undefined || value.startsWith('--'))
      throw new Error(`${token} requires a value.`);
    option(args, name, value);
  }
  return args;
}
