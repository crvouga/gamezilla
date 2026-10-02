/**
 * Explorer entries: Foundation / Brand / Layout / Icons / Inputs.
 * Split from `registry-entries-display.ts` to keep each file under the size cap.
 */
import ActionBarExample from '../action-bar/action-bar.example';
import AppFrameExample from '../app-frame/app-frame.example';
import AppHeaderIslandExample from '../app-header-island/app-header-island.example';
import AppLogoExample from '../app-logo/app-logo.example';
import BottomActionBarExample from '../bottom-action-bar/bottom-action-bar.example';
import BrandIconExample from '../brand-icon/brand-icon.example';
import ButtonExample from '../button/button.example';
import CardExample from '../card/card.example';
import CatalogExample from '../catalog/catalog.example';
import CheckboxExample from '../checkbox/checkbox.example';
import ChipGroupExample from '../chip-group/chip-group.example';
import CodeEditorExample from '../code-editor/code-editor.example';
import ComboboxExample from '../combobox/combobox.example';
import CopyToClipboardFieldExample from '../copy-to-clipboard-field/copy-to-clipboard-field.example';
import FloatingActionButtonExample from '../floating-action-button/floating-action-button.example';
import FormActionsFooterExample from '../form-actions-footer/form-actions-footer.example';
import GradientBoxExample from '../gradient-box/gradient-box.example';
import IconButtonExample from '../icon-button/icon-button.example';
import IconLinkExample from '../icon-link/icon-link.example';
import IslandExample from '../island/island.example';
import IslandGridExample from '../island-grid/island-grid.example';
import MarkdownEditorExample from '../markdown-editor/markdown-editor.example';
import MultiSelectSwatchGridExample from '../multi-select-swatch/multi-select-swatch-grid.example';
import NumberStepperExample from '../number-stepper/number-stepper.example';
import OverflowMenuButtonExample from '../overflow-menu-button/overflow-menu-button.example';
import PickerExample from '../picker/picker.example';
import PickerSectionExample from '../picker-section/picker-section.example';
import ScreenBaseExample from '../screen-base/screen-base.example';
import ScreenTitleExample from '../screen-title/screen-title.example';
import ScrollViewExample from '../scroll-view/scroll-view.example';
import SegmentedControlExample from '../segmented-control/segmented-control.example';
import SelectExample from '../select/select.example';
import SocialSignInButtonExample from '../social-sign-in-button/social-sign-in-button.example';
import SwitchExample from '../switch/switch.example';
import TextInputExample from '../text-input/text-input.example';
import TextLinkExample from '../text-link/text-link.example';
import ThemeTokensExample from '../theme-tokens/theme-tokens.example';
import TooltipExample from '../tooltip/tooltip.example';
import { type ComponentEntry, entry } from './component-entry';

const FOUNDATION = 'Foundation';
const LAYOUT = 'Layout';
const INPUTS = 'Inputs';

export const CORE_ENTRIES: readonly ComponentEntry[] = [
  entry('theme-tokens', 'Theme Tokens', FOUNDATION, ThemeTokensExample),
  entry('gradient-box', 'GradientBox', FOUNDATION, GradientBoxExample),

  entry('app-logo', 'AppLogo', 'Brand', AppLogoExample),

  entry('scroll-view', 'ScrollView', LAYOUT, ScrollViewExample),
  entry('screen-base', 'ScreenBase', LAYOUT, ScreenBaseExample),
  entry('screen-title', 'ScreenLargeTitle', LAYOUT, ScreenTitleExample),
  entry('app-frame', 'AppFrame', LAYOUT, AppFrameExample),
  entry('app-header-island', 'AppHeaderIsland', LAYOUT, AppHeaderIslandExample),
  entry('island', 'Island', LAYOUT, IslandExample),
  entry('card', 'Card', LAYOUT, CardExample),
  entry('island-grid', 'IslandGrid', LAYOUT, IslandGridExample),
  entry('catalog', 'Catalog', LAYOUT, CatalogExample),

  entry('brand-icon', 'BrandIcon', 'Icons', BrandIconExample),

  entry(
    'form-actions-footer',
    'FormActionsFooter',
    INPUTS,
    FormActionsFooterExample
  ),
  entry('button', 'Button', INPUTS, ButtonExample),
  entry(
    'floating-action-button',
    'FloatingActionButton',
    INPUTS,
    FloatingActionButtonExample
  ),
  entry('icon-button', 'IconButton', INPUTS, IconButtonExample),
  entry('icon-link', 'IconLink', INPUTS, IconLinkExample),
  entry(
    'overflow-menu-button',
    'OverflowMenuButton',
    INPUTS,
    OverflowMenuButtonExample
  ),
  entry('action-bar', 'ActionBar', INPUTS, ActionBarExample),
  entry('bottom-action-bar', 'BottomActionBar', INPUTS, BottomActionBarExample),
  entry('tooltip', 'Tooltip', INPUTS, TooltipExample),
  entry(
    'social-sign-in-button',
    'SocialSignInButton',
    INPUTS,
    SocialSignInButtonExample
  ),
  entry('text-input', 'TextInput', INPUTS, TextInputExample),
  entry('text-link', 'TextLink', INPUTS, TextLinkExample),
  entry('code-editor', 'CodeEditor', INPUTS, CodeEditorExample),
  entry('markdown-editor', 'MarkdownEditor', INPUTS, MarkdownEditorExample),
  entry(
    'copy-to-clipboard-field',
    'CopyToClipboardField',
    INPUTS,
    CopyToClipboardFieldExample
  ),
  entry('switch', 'Switch', INPUTS, SwitchExample),
  entry('checkbox', 'Checkbox', INPUTS, CheckboxExample),
  entry('select', 'Select', INPUTS, SelectExample),
  entry('combobox', 'Combobox', INPUTS, ComboboxExample),
  entry(
    'segmented-control',
    'SegmentedControl',
    INPUTS,
    SegmentedControlExample
  ),
  entry('picker', 'Picker', INPUTS, PickerExample),
  entry('picker-section', 'PickerSection', INPUTS, PickerSectionExample),
  entry('chip-group', 'ChipGroup', INPUTS, ChipGroupExample),
  entry('number-stepper', 'NumberStepper', INPUTS, NumberStepperExample),
  entry(
    'multi-select-swatch',
    'MultiSelectSwatchGrid',
    INPUTS,
    MultiSelectSwatchGridExample
  ),
];
