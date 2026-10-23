import { z } from 'zod';
import {
  cellKey,
  inBounds,
  type NumberlinkDefinition,
  type NumberlinkIssue,
  PAIR_COLORS,
  type Validation,
} from './numberlink-types';

const cellSchema = z
  .object({ x: z.number().int(), y: z.number().int() })
  .strict();
const pairSchema = z
  .object({
    id: z.string().min(1).max(64),
    label: z.string().trim().min(1).max(8),
    color: z.enum(PAIR_COLORS),
    endpoints: z.tuple([cellSchema, cellSchema]),
  })
  .strict();

export const numberlinkDefinitionSchema = z
  .object({
    format: z.literal(1),
    width: z.number().int().min(2).max(20),
    height: z.number().int().min(2).max(20),
    coverage: z.enum(['all', 'pairs']),
    pairs: z.array(pairSchema).min(1).max(200),
  })
  .strict();

function endpointIssues(definition: NumberlinkDefinition): NumberlinkIssue[] {
  const issues: NumberlinkIssue[] = [];
  const ids = new Set<string>();
  const labels = new Set<string>();
  const cells = new Set<string>();
  for (const pair of definition.pairs) {
    if (ids.has(pair.id))
      issues.push({
        code: 'duplicate_pair',
        message: 'Each pair needs its own identifier.',
        pairId: pair.id,
      });
    if (labels.has(pair.label))
      issues.push({
        code: 'duplicate_label',
        message: 'Give each pair a different label.',
        pairId: pair.id,
      });
    ids.add(pair.id);
    labels.add(pair.label);
    for (const cell of pair.endpoints) {
      if (!inBounds(definition, cell))
        issues.push({
          code: 'endpoint_outside',
          message: 'Move this endpoint inside the board.',
          cell,
          pairId: pair.id,
        });
      if (cells.has(cellKey(cell)))
        issues.push({
          code: 'duplicate_endpoint',
          message: 'Only one endpoint can occupy a cell.',
          cell,
          pairId: pair.id,
        });
      cells.add(cellKey(cell));
    }
  }
  return issues;
}

/** Structural validity alone does not claim that a puzzle has a solution. */
export function validateNumberlinkDefinition(
  input: unknown
): Validation<NumberlinkDefinition> {
  const parsed = numberlinkDefinitionSchema.safeParse(input);
  if (!parsed.success)
    return {
      valid: false,
      issues: parsed.error.issues.map((issue) => ({
        code: 'invalid_definition',
        message: `${issue.path.join('.')}: ${issue.message}`,
      })),
    };
  const issues = endpointIssues(parsed.data);
  return issues.length === 0
    ? { valid: true, value: parsed.data }
    : { valid: false, issues };
}

export function decodeNumberlinkDefinition(
  text: string
): Validation<NumberlinkDefinition> {
  try {
    return validateNumberlinkDefinition(JSON.parse(text));
  } catch {
    return {
      valid: false,
      issues: [
        {
          code: 'invalid_json',
          message:
            'This puzzle cannot be read. Open a saved revision or repair its definition.',
        },
      ],
    };
  }
}

export function encodeNumberlinkDefinition(
  definition: NumberlinkDefinition
): string {
  const checked = validateNumberlinkDefinition(definition);
  if (!checked.valid)
    throw new Error('Cannot encode an invalid Numberlink definition');
  return JSON.stringify(checked.value);
}
