import { useSpaceActions } from '@gamezilla/client/spaces/space-actions';
import { SpaceCard } from '@gamezilla/client/spaces/space-card';
import type { SpaceFilter } from '@gamezilla/client/spaces/types';
import {
  useCurrentMembership,
  useSpaces,
} from '@gamezilla/client/spaces/use-spaces';
import { useAccountActions } from '@gamezilla/client/ui/use-account-actions';
import {
  Box,
  Pressable,
  ScreenBase,
  ScrollView,
  SegmentedControl,
  Text,
  TextInput,
  useBreakpoint,
  useTheme,
} from '@gamezilla/lib/ui';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';

export default function SpacesScreen() {
  const [filter, setFilter] = useState<SpaceFilter>('all');
  const [adding, setAdding] = useState(false);
  const [titleInput, setTitleInput] = useState('');
  const accountActions = useAccountActions();
  const isMobile = useBreakpoint() === 'mobile';
  const theme = useTheme();
  const router = useRouter();
  const { spaces, loading } = useSpaces(filter);
  const current = useCurrentMembership();
  const { createSpace } = useSpaceActions();

  const shortcutSpace = useMemo(() => {
    if (!current.activeSpaceId) return null;
    return spaces.find((s) => s.id === current.activeSpaceId) ?? null;
  }, [spaces, current.activeSpaceId]);

  const addSpace = async () => {
    const name = titleInput.trim();
    if (!name) {
      setAdding(false);
      return;
    }
    const newId = await createSpace(name);
    setTitleInput('');
    setAdding(false);
    if (newId) {
      router.push({ pathname: '/space/[id]', params: { id: newId } });
    }
  };

  return (
    <ScreenBase
      breadcrumbs={[
        {
          name: 'Spaces',
          subtitle: 'Rooms to play with friends',
        },
      ]}
      actions={isMobile ? accountActions : []}
      content={({ sx }) => (
        <Box style={sx}>
          <Box sx={{ pt: 2, pb: 2 }}>
            <SegmentedControl<SpaceFilter>
              segments={[
                { key: 'all', label: 'All' },
                { key: 'live', label: 'Live' },
              ]}
              selected={filter}
              onSelect={setFilter}
            />
          </Box>

          {!current.loading && current.activeSpaceId ? (
            <Box sx={{ mb: 3 }}>
              <Pressable
                onPress={() => {
                  const id = current.activeSpaceId;
                  if (id) {
                    router.push({
                      pathname: '/space/[id]',
                      params: { id },
                    });
                  }
                }}
                accessibilityRole="button"
                accessibilityLabel="Open your current space"
              >
                <Box
                  sx={{
                    borderRadius: 12,
                    borderWidth: 1,
                    borderColor: 'border',
                    p: 3,
                    background: 'surface',
                  }}
                >
                  <Text variant="label" label="Your space" />
                  <Text
                    variant="bodyBold"
                    sx={{ mt: 1 }}
                    label={
                      shortcutSpace?.title ??
                      (loading ? 'Loading…' : 'Continue')
                    }
                  />
                  <Text
                    variant="caption"
                    sx={{ color: 'textSecondary', mt: 0.5 }}
                    label="Tap to open"
                  />
                </Box>
              </Pressable>
            </Box>
          ) : null}

          {adding ? (
            <Box sx={{ flexDirection: 'row', gap: 2, mb: 3 }}>
              <TextInput
                sx={{
                  flex: 1,
                  borderWidth: 1,
                  borderRadius: 8,
                  px: 3,
                  py: 2.5,
                  fontSize: 16,
                  background: 'surface',
                  color: 'text',
                  borderColor: 'border',
                }}
                placeholder="Space title…"
                placeholderTextColor={theme.colors.icon}
                value={titleInput}
                onChangeText={setTitleInput}
                onSubmitEditing={addSpace}
                onBlur={() => {
                  if (!titleInput.trim()) setAdding(false);
                }}
                autoFocus
              />
              <Pressable
                onPress={addSpace}
                style={theme.sx({ justifyContent: 'center', px: 4 })}
              >
                <Text variant="bodyBold" label="Create" />
              </Pressable>
            </Box>
          ) : (
            <Pressable
              onPress={() => setAdding(true)}
              style={[
                theme.sx({
                  py: 3,
                  px: 4,
                  borderRadius: 8,
                  mb: 4,
                  alignItems: 'center',
                }),
                { backgroundColor: theme.colors.tintMuted },
              ]}
            >
              <Text variant="bodyBold" label="+ New space" />
            </Pressable>
          )}

          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{
              paddingBottom: 24,
              gap: 12,
            }}
          >
            {loading ? (
              <Box sx={{ py: 8, alignItems: 'center' }}>
                <Text
                  variant="body"
                  sx={{ color: 'textSecondary' }}
                  label="Loading…"
                />
              </Box>
            ) : spaces.length === 0 ? (
              <Box sx={{ py: 8, alignItems: 'center' }}>
                <Text
                  variant="body"
                  sx={{ color: 'textSecondary' }}
                  label="No spaces match this filter."
                />
              </Box>
            ) : (
              spaces.map((space) => (
                <Box key={space.id} sx={{ mb: 3 }}>
                  <SpaceCard space={space} />
                </Box>
              ))
            )}
          </ScrollView>
        </Box>
      )}
    />
  );
}
