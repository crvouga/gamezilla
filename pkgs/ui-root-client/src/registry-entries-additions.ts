/**
 * Explorer entries: the components that close the gaps product screens used
 * to fill with raw elements and classes (tabs, popover, toast, radio group,
 * table, spacer, layer, image, form, form field, textarea).
 * Split from the other `registry-entries-*.ts` to keep each file under the
 * size cap.
 */

import type { ComponentEntry } from '@pkgs/ui-root-shared/component-entry';
import { entry } from '@pkgs/ui-root-shared/component-entry';
import FormExample from './form.example';
import FormFieldExample from './form-field.example';
import ImageExample from './image.example';
import LayerExample from './layer.example';
import PopoverExample from './popover.example';
import RadioGroupExample from './radio-group.example';
import SpacerExample from './spacer.example';
import TableExample from './table.example';
import TabsExample from './tabs.example';
import TextareaExample from './textarea.example';
import ToastExample from './toast.example';

const LAYOUT = 'Layout';
const INPUTS = 'Inputs';
const FEEDBACK = 'Feedback';
const OVERLAY = 'Overlay';
const PRIMITIVES = 'Primitives';
const DISCLOSURE = 'Disclosure';

export const ADDITION_ENTRIES: readonly ComponentEntry[] = [
  entry('spacer', 'Spacer', LAYOUT, SpacerExample),
  entry('layer', 'Layer', LAYOUT, LayerExample),
  entry('image', 'Image', PRIMITIVES, ImageExample),
  entry('table', 'Table', PRIMITIVES, TableExample),
  entry('form', 'Form', INPUTS, FormExample),
  entry('form-field', 'FormField', INPUTS, FormFieldExample),
  entry('textarea', 'Textarea', INPUTS, TextareaExample),
  entry('radio-group', 'RadioGroup', INPUTS, RadioGroupExample),
  entry('tabs', 'Tabs', DISCLOSURE, TabsExample),
  entry('popover', 'Popover', OVERLAY, PopoverExample),
  entry('toast', 'Toast', FEEDBACK, ToastExample),
];
