/**
 * Fixed search field for {@link CatalogList}.
 */

import type { LocalizedString } from '@pkgs/i18n';
import { useTheme } from '../../theme';
import { Box } from '../box';
import { SearchIcon } from '../icons';
import { TextInput } from '../text-input';

export type CatalogListSearchProps = {
  value: string;
  onChangeText: (value: string) => void;
  placeholder: LocalizedString;
};

export function CatalogListSearch({
  value,
  onChangeText,
  placeholder,
}: CatalogListSearchProps) {
  const theme = useTheme();

  return (
    <Box sx={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
      <SearchIcon size={18} color={theme.colors.icon} />
      <Box style={{ flex: 1 }}>
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          accessibilityLabel={placeholder}
          autoCorrect={false}
          autoCapitalize="none"
          clearButtonMode="while-editing"
        />
      </Box>
    </Box>
  );
}
