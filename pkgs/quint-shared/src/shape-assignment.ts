import { byKind, issue } from './shape-model';
import type { ModelShapeIssue, ParsedModel } from './shape-model';

/** Operators inside a parenthesized value cannot become action guards. */
function outerExpression(source: string): string {
  let depth = 0;
  let outer = '';
  for (const char of source) {
    if (depth === 0 && (char === ',' || char === '}')) break;
    if ('([{'.includes(char)) {
      depth++;
      outer += ' ';
      continue;
    }
    if (')]}'.includes(char)) {
      depth--;
      outer += ' ';
      continue;
    }
    outer += depth === 0 ? char : ' ';
  }
  return outer;
}

export function assignmentShapeIssues(
  model: ParsedModel
): readonly ModelShapeIssue[] {
  const issues: ModelShapeIssue[] = [];
  for (const action of byKind(model, 'action')) {
    for (const assignment of action.body.matchAll(/\b(\w+)'\s*=\s*(?!=)/g)) {
      const after = (assignment.index ?? 0) + assignment[0].length;
      if (
        !/\b(and|or|implies|iff)\b/.test(
          outerExpression(action.body.slice(after))
        )
      )
        continue;
      const line =
        action.line +
        action.body.slice(0, assignment.index).split('\n').length -
        1;
      issues.push(
        issue(
          'compound-assignment',
          line,
          `${assignment[1]}' has an unparenthesized Boolean expression; put the whole assigned value in parentheses so model checking cannot turn part of it into a guard`
        )
      );
    }
  }
  return issues;
}
