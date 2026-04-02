import React, { useState, useCallback } from 'react';
import { View, StyleSheet, Pressable, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Plus } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../theme';
import { useAppModuleContext } from './AppModuleContext';
import { AppBar } from '../components/layout/AppBar';
import { AlbumGridScreen } from '../features/gallery/components/AlbumGridScreen';
import { UploadTabContainer } from '../features/gallery/components/UploadTabContainer';

type GalleryTab = 'albums' | 'upload';

/**
 * Gallery module shell with bottom tab navigation.
 * Tabs: Albums (always visible), Upload (permission-gated).
 */
export function GalleryShell() {
  const { t } = useTranslation();
  const { colors, typography, spacing, radius, shadows } = useTheme();
  const { permissions } = useAppModuleContext();
  const [activeTab, setActiveTab] = useState<GalleryTab>('albums');
  const [showCreateSheet, setShowCreateSheet] = useState(false);
  const [isInAlbumDetail, setIsInAlbumDetail] = useState(false);

  const tabs: GalleryTab[] = permissions.canCreateGallery
    ? ['albums', 'upload']
    : ['albums'];

  const tabLabels: Record<GalleryTab, string> = {
    albums: t('galleryTab'),
    upload: t('upload'),
  };

  const openCreateSheet = useCallback(() => setShowCreateSheet(true), []);
  const closeCreateSheet = useCallback(() => setShowCreateSheet(false), []);

  const showFab = activeTab === 'albums' && permissions.canCreateGallery && !isInAlbumDetail;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <AppBar />

      <View style={styles.content}>
        <View style={[styles.tabContent, { display: activeTab === 'albums' ? 'flex' : 'none' }]}>
          <AlbumGridScreen
            permissions={permissions}
            showCreateSheet={showCreateSheet}
            onCreateSheetClose={closeCreateSheet}
            onDetailVisibleChange={setIsInAlbumDetail}
          />
        </View>
        {permissions.canCreateGallery && (
          <View style={[styles.tabContent, { display: activeTab === 'upload' ? 'flex' : 'none' }]}>
            <UploadTabContainer />
          </View>
        )}
      </View>

      {/* FAB — only on Albums tab with create permission */}
      {showFab && (
        <Pressable
          onPress={openCreateSheet}
          style={({ pressed }) => [
            styles.fab,
            {
              backgroundColor: colors.primary,
              borderRadius: radius.full,
              opacity: pressed ? 0.85 : 1,
              ...shadows.gradient,
            },
          ]}
          accessibilityLabel={t('createAlbum')}
          accessibilityRole="button"
          testID="fab-create-album"
        >
          <Plus size={28} color={colors.onPrimary} strokeWidth={2.5} />
        </Pressable>
      )}

      {tabs.length > 1 && (
        <View
          style={[
            styles.tabBar,
            { backgroundColor: colors.surface, borderTopColor: colors.border },
          ]}
        >
          {tabs.map((tab) => {
            const isActive = activeTab === tab;
            return (
              <Pressable
                key={tab}
                onPress={() => setActiveTab(tab)}
                style={styles.tabItem}
                accessibilityRole="tab"
                accessibilityState={{ selected: isActive }}
                accessibilityLabel={tabLabels[tab]}
              >
                <View
                  style={[
                    styles.tabIndicator,
                    {
                      backgroundColor: isActive ? colors.primary : 'transparent',
                      borderRadius: radius.full,
                    },
                  ]}
                />
                <Text
                  style={[
                    typography.labelSmall,
                    {
                      color: isActive ? colors.primary : colors.foregroundSecondary,
                      marginTop: spacing.xxs,
                    },
                  ]}
                >
                  {tabLabels[tab]}
                </Text>
              </Pressable>
            );
          })}
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { flex: 1 },
  tabContent: { flex: 1 },
  fab: {
    position: 'absolute',
    bottom: 80,
    end: 20,
    width: 56,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  tabBar: {
    flexDirection: 'row',
    borderTopWidth: 1,
    paddingBottom: 4,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    minHeight: 56,
  },
  tabIndicator: { width: 4, height: 4 },
});
