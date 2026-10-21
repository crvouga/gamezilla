/**
 * Explorer entries: the closed primitives a screen is composed from
 * (layout, text, semantics, interaction, element handles).
 * Split from the other `registry-entries-*.ts` to keep each file under the
 * size cap.
 */

import type { ComponentEntry } from '@pkgs/ui-root-shared-ts/component-entry';
import { entry } from '@pkgs/ui-root-shared-ts/component-entry';
import CodeBlockExample from './code-block.example';
import DividerExample from './divider.example';
import ElementHandlesExample from './element-handles.example';
import FieldLabelExample from './field-label.example';
import GridExample from './grid.example';
import HeadingExample from './heading.example';
import IconExample from './icon.example';
import LandmarksExample from './landmarks.example';
import PressableExample from './pressable.example';
import SemanticListExample from './semantic-list.example';
import SparklineExample from './sparkline.example';
import StackExample from './stack.example';
import SurfaceExample from './surface.example';
import TextExample from './text.example';
import VisuallyHiddenExample from './visually-hidden.example';

const PRIMITIVES = 'Primitives';

export const PRIMITIVE_ENTRIES: readonly ComponentEntry[] = [
  entry('stack', 'Stack', PRIMITIVES, StackExample),
  entry('grid', 'Grid', PRIMITIVES, GridExample),
  entry('surface', 'Surface', PRIMITIVES, SurfaceExample),
  entry('divider', 'Divider', PRIMITIVES, DividerExample),
  entry('text', 'Text', PRIMITIVES, TextExample),
  entry('heading', 'Heading', PRIMITIVES, HeadingExample),
  entry('code-block', 'CodeBlock', PRIMITIVES, CodeBlockExample),
  entry('field-label', 'FieldLabel', PRIMITIVES, FieldLabelExample),
  entry('icon', 'Icon', PRIMITIVES, IconExample),
  entry('sparkline', 'Sparkline', PRIMITIVES, SparklineExample),
  entry('landmarks', 'Landmarks', PRIMITIVES, LandmarksExample),
  entry('semantic-list', 'Semantic lists', PRIMITIVES, SemanticListExample),
  entry('visually-hidden', 'VisuallyHidden', PRIMITIVES, VisuallyHiddenExample),
  entry('pressable', 'Pressable', PRIMITIVES, PressableExample),
  entry(
    'element-handles',
    'Focus, scroll and measure',
    PRIMITIVES,
    ElementHandlesExample
  ),
];
