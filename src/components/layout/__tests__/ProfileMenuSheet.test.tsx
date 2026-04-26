import React from 'react';
import renderer, { act } from 'react-test-renderer';

// ---------------------------------------------------------------------------
// Mocks — must come before imports
// ---------------------------------------------------------------------------

jest.mock('react-native', () => ({
  View: 'View',
  Text: 'Text',
  Pressable: 'Pressable',
  Modal: 'Modal',
  ActivityIndicator: 'ActivityIndicator',
  StyleSheet: { create: (s: any) => s },
  Platform: { OS: 'android' },
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, string>) => {
      if (key === 'greeting' && opts?.name) return `Hello, ${opts.name}`;
      if (key === 'logout') return 'Logout';
      return key;
    },
  }),
}));

jest.mock('lucide-react-native', () => ({
  LogOut: 'LogOutIcon',
}));

jest.mock('@/theme', () => ({
  useTheme: () => ({
    colors: {
      surface: '#fff',
      foreground: '#111',
      foregroundSecondary: '#666',
      border: '#e0e0e0',
      error: '#d32f2f',
      muted: '#f5f5f5',
      primary: '#005C97',
      onPrimary: '#fff',
    },
    typography: {
      headingSmall: { fontSize: 18 },
      bodyMedium: { fontSize: 14 },
      bodyLarge: { fontSize: 16 },
    },
    spacing: { xxs: 2, sm: 8, md: 12, base: 16, lg: 20, xl: 24, xxxl: 40 },
    radius: { md: 8, lg: 12, xl: 16, full: 999 },
    shadows: { lg: {} },
  }),
}));

jest.mock('@/services/tokenStorage', () => ({
  tokenStorage: {
    getAccessToken: jest.fn().mockResolvedValue(null),
  },
}));

jest.mock('@/utils/mediaUrl', () => ({
  normalizeMediaUrl: (url: string | null | undefined) => url || null,
}));

import { ProfileMenuSheet } from '../ProfileMenuSheet';
import type { Employee } from '../../../types/permissions';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const mockEmployee: Employee = {
  id: 'emp1',
  name: 'Bassel Ahmad',
  email: 'bassel@ruqaqa.sa',
};

function renderSheet(overrides: Partial<React.ComponentProps<typeof ProfileMenuSheet>> = {}) {
  const defaultProps = {
    visible: true,
    onClose: jest.fn(),
    employee: mockEmployee,
    onSignOut: jest.fn(),
    isSigningOut: false,
    ...overrides,
  };
  let root: renderer.ReactTestRenderer;
  act(() => {
    root = renderer.create(<ProfileMenuSheet {...defaultProps} />);
  });
  return { root: root!, props: defaultProps };
}

/** Recursively find all nodes matching a predicate. */
function findAll(tree: any, predicate: (node: any) => boolean): any[] {
  const results: any[] = [];
  if (!tree) return results;
  if (Array.isArray(tree)) {
    for (const item of tree) results.push(...findAll(item, predicate));
    return results;
  }
  if (predicate(tree)) results.push(tree);
  for (const child of tree.children || []) {
    if (typeof child === 'object') results.push(...findAll(child, predicate));
  }
  return results;
}

/** Check if any Text node in the tree contains the given string. */
function hasText(tree: any, text: string): boolean {
  const textNodes = findAll(tree, (n) => n.type === 'Text');
  return textNodes.some((node) =>
    (node.children || []).some((c: any) => typeof c === 'string' && c.includes(text)),
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ProfileMenuSheet', () => {
  it('renders greeting with employee name', () => {
    const { root } = renderSheet();
    const tree = root.toJSON();
    expect(hasText(tree, 'Hello, Bassel Ahmad')).toBe(true);
  });

  it('does not render profile section when employee is null', () => {
    const { root } = renderSheet({ employee: null });
    const tree = root.toJSON();
    expect(hasText(tree, 'Hello,')).toBe(false);
  });

  it('still renders sign out button when employee is null', () => {
    const { root } = renderSheet({ employee: null });
    const tree = root.toJSON();
    expect(hasText(tree, 'Logout')).toBe(true);
  });

  it('calls onSignOut when sign out button is pressed', () => {
    const { root, props } = renderSheet();
    // Find the Pressable with the sign out handler (the one that has LogOutIcon as child)
    const instance = root.root;
    const pressables = instance.findAllByType('Pressable' as any);
    // Sign out pressable is the one with onPress === onSignOut
    const signOutButton = pressables.find(
      (p: any) => p.props.onPress === props.onSignOut,
    );
    expect(signOutButton).toBeDefined();
    act(() => {
      signOutButton!.props.onPress();
    });
    expect(props.onSignOut).toHaveBeenCalledTimes(1);
  });

  it('disables sign out button when isSigningOut is true', () => {
    const { root } = renderSheet({ isSigningOut: true });
    const instance = root.root;
    const pressables = instance.findAllByType('Pressable' as any);
    // The sign out Pressable has disabled prop
    const signOutButton = pressables.find((p: any) => p.props.disabled === true);
    expect(signOutButton).toBeDefined();
  });

  it('shows ActivityIndicator instead of icon when isSigningOut is true', () => {
    const { root } = renderSheet({ isSigningOut: true });
    const tree = root.toJSON();
    const indicators = findAll(tree, (n) => n.type === 'ActivityIndicator');
    expect(indicators.length).toBeGreaterThan(0);
    // LogOut icon should not be present
    const icons = findAll(tree, (n) => n.type === 'LogOutIcon');
    expect(icons.length).toBe(0);
  });

  it('shows LogOut icon when not signing out', () => {
    const { root } = renderSheet({ isSigningOut: false });
    const tree = root.toJSON();
    const icons = findAll(tree, (n) => n.type === 'LogOutIcon');
    expect(icons.length).toBeGreaterThan(0);
    const indicators = findAll(tree, (n) => n.type === 'ActivityIndicator');
    expect(indicators.length).toBe(0);
  });

  it('reduces opacity when isSigningOut is true', () => {
    const { root } = renderSheet({ isSigningOut: true });
    const instance = root.root;
    const pressables = instance.findAllByType('Pressable' as any);
    const signOutButton = pressables.find((p: any) => p.props.disabled === true);
    // The style array should contain an object with opacity: 0.6
    const styleArr = signOutButton!.props.style;
    const hasReducedOpacity = styleArr.some(
      (s: any) => typeof s === 'object' && s.opacity === 0.6,
    );
    expect(hasReducedOpacity).toBe(true);
  });

  it('calls onClose when backdrop is pressed', () => {
    const { root, props } = renderSheet();
    const instance = root.root;
    const pressables = instance.findAllByType('Pressable' as any);
    // Backdrop pressable is the one with onPress === onClose
    const backdrop = pressables.find((p: any) => p.props.onPress === props.onClose);
    expect(backdrop).toBeDefined();
  });
});
