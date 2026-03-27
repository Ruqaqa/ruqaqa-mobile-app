import React from 'react';
import { View } from 'react-native';

/**
 * This route is a no-op — the actual UI is rendered by the (app)/_layout.tsx
 * which manages Finance/Gallery shells directly.
 * expo-router requires an index file for each route group.
 */
export default function AppIndex() {
  return <View />;
}
