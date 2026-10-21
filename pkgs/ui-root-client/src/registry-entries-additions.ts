/**
 * Explorer entries: the components that close the gaps product screens used
 * to fill with raw elements and classes (tabs, popover, toast, radio group,
 * table, spacer, layer, image, form, form field, textarea).
 * Split from the other `registry-entries-*.ts` to keep each file under the
 * size cap.
 */

import type { ComponentEntry } from '@pkgs/ui-root-shared/component-entry';
import { entry } from '@pkgs/ui-root-shared/component-entry';
import ActivityRegionExample from './activity-region.example';
import ArrowKeyGroupExample from './arrow-key-group.example';
import BadgedIconExample from './badged-icon.example';
import BoardFitExample from './board-fit.example';
import ChromeTitleExample from './chrome-title.example';
import EmbeddedFrameExample from './embedded-frame.example';
import FileTriggerExample from './file-trigger.example';
import FloatingPanelExample from './floating-panel.example';
import FormExample from './form.example';
import FormFieldExample from './form-field.example';
import ImageExample from './image.example';
import LayerExample from './layer.example';
import LogLineExample from './log-line.example';
import MiniPlayerExample from './mini-player.example';
import MoveStripExample from './move-strip.example';
import PaneExample from './pane.example';
import PopoverExample from './popover.example';
import RadioGroupExample from './radio-group.example';
import SpacerExample from './spacer.example';
import StatusIconSlotExample from './status-icon-slot.example';
import SuggestionListExample from './suggestion-list.example';
import TableExample from './table.example';
import TabsExample from './tabs.example';
import TestCommandProbeExample from './test-command-probe.example';
import TextareaExample from './textarea.example';
import ToastExample from './toast.example';
import ToolbarExample from './toolbar.example';

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
  entry('badged-icon', 'BadgedIcon', PRIMITIVES, BadgedIconExample),
  entry('arrow-key-group', 'ArrowKeyGroup', PRIMITIVES, ArrowKeyGroupExample),
  entry('activity-region', 'ActivityRegion', LAYOUT, ActivityRegionExample),
  entry('chrome-title', 'ChromeTitle', PRIMITIVES, ChromeTitleExample),
  entry('mini-player', 'MiniPlayerDock', LAYOUT, MiniPlayerExample),
  entry('status-icon-slot', 'StatusIconSlot', FEEDBACK, StatusIconSlotExample),
  entry('board-fit', 'BoardFit', LAYOUT, BoardFitExample),
  entry('move-strip', 'MoveStrip', LAYOUT, MoveStripExample),
  entry('toolbar', 'Toolbar', LAYOUT, ToolbarExample),
  entry('pane', 'Pane', LAYOUT, PaneExample),
  entry('embedded-frame', 'EmbeddedFrame', PRIMITIVES, EmbeddedFrameExample),
  entry('log-line', 'LogLine', PRIMITIVES, LogLineExample),
  entry('suggestion-list', 'SuggestionList', INPUTS, SuggestionListExample),
  entry('file-trigger', 'FileTrigger', INPUTS, FileTriggerExample),
  entry('floating-panel', 'FloatingPanel', OVERLAY, FloatingPanelExample),
  entry(
    'test-command-probe',
    'TestCommandProbe',
    PRIMITIVES,
    TestCommandProbeExample
  ),
];
