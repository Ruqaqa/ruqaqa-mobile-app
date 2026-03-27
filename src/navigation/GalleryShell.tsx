import React, { useState } from 'react';
import { View, StyleSheet, Pressable, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../theme';
import { useAppModuleContext } from './AppModuleContext';
import { AppBar } from '../components/layout/AppBar';

function PlaceholderTab({ label }: { label: string }) {
  const { colors, typography, spacing } = useTheme();
  return (
    <View style={[styles.placeholder, { backgroundColor: colors.background }]}>
      <Text style={[typography.headingMedium, { color: colors.foregroundSecondary }]}>
        {label}
      </Text>
      <Text style={[typography.bodySmall, { color: colors.foregroundSecondary, marginTop: spacing.sm }]}>
        Coming in Phase 6-7
      </Text>
    </View>
  );
}

type GalleryTab = 'albums' | 'upload';

/**
 * Gallery module shell with bottom tab navigation.
 * Tabs: Albums (always visible), Upload (permission-gated).
 */
export function GalleryShell() {
  const { t } = useTranslation();
  const { colors, typography, spacing, radius } = useTheme();
  const { permissions } = useAppModuleContext();
  const [activeTab, setActiveTab] = useState<GalleryTab>('albums');

  const tabs: GalleryTab[] = permissions.canCreateGallery
    ? ['albums', 'upload']
    : ['albums'];

  const tabLabels: Record<GalleryTab, string> = {
    albums: t('galleryTab'),
    upload: t('upload'),
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <AppBar />

      <View style={styles.content}>
        <View style={[styles.tabContent, { display: activeTab === 'albums' ? 'flex' : 'none' }]}>
          <PlaceholderTab label={tabLabels.albums} />
        </View>
        {permissions.canCreateGallery && (
          <View style={[styles.tabContent, { display: activeTab === 'upload' ? 'flex' : 'none' }]}>
            <PlaceholderTab label={tabLabels.upload} />
          </View>
        )}
      </View>

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
  placeholder: { flex: 1, alignItems: 'center', justifyContent: 'center' },
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
