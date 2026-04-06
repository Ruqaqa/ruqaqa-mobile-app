import React from 'react';
import renderer, { act } from 'react-test-renderer';

// Provide minimal react-native mock for StyleSheet + rendering
jest.mock('react-native', () => ({
  View: 'View',
  Text: 'Text',
  Image: 'Image',
  StyleSheet: {
    create: (styles: any) => styles,
  },
  Platform: { OS: 'android' },
}));

jest.mock('lucide-react-native', () => ({
  User: 'UserIcon',
}));

jest.mock('@/services/tokenStorage', () => ({
  tokenStorage: {
    getAccessToken: jest.fn().mockResolvedValue(null),
  },
}));

jest.mock('@/utils/mediaUrl', () => ({
  normalizeMediaUrl: (url: string | null | undefined) => url || null,
}));

jest.mock('@/theme', () => ({
  useTheme: () => ({
    colors: {
      muted: '#e0e0e0',
      foregroundSecondary: '#666',
      primary: '#005C97',
      onPrimary: '#FFFFFF',
    },
    radius: { full: 999 },
  }),
}));

import { getInitials, ProfileAvatar } from '../ProfileAvatar';

// ─── getInitials unit tests ───

describe('getInitials', () => {
  it('returns two initials for a two-word name', () => {
    expect(getInitials('Bassel Ahmad')).toBe('BA');
  });

  it('returns one initial for a single-word name', () => {
    expect(getInitials('Bassel')).toBe('B');
  });

  it('returns first and last initials for a three+ word name', () => {
    expect(getInitials('Bassel Al Ahmad')).toBe('BA');
  });

  it('handles Arabic names', () => {
    expect(getInitials('باسل أحمد')).toBe('بأ');
  });

  it('returns empty string for empty input', () => {
    expect(getInitials('')).toBe('');
  });

  it('returns empty string for whitespace-only input', () => {
    expect(getInitials('   ')).toBe('');
  });

  it('uppercases Latin initials', () => {
    expect(getInitials('john doe')).toBe('JD');
  });

  it('handles single character name', () => {
    expect(getInitials('B')).toBe('B');
  });
});

// ─── Component rendering tests ───

function renderAvatar(props: { url?: string | null; name?: string | null; size?: number }) {
  let root: renderer.ReactTestRenderer;
  act(() => {
    root = renderer.create(<ProfileAvatar {...props} />);
  });
  return root!.toJSON();
}

function hasChild(tree: any, type: string): boolean {
  if (!tree) return false;
  if (Array.isArray(tree)) return tree.some(t => hasChild(t, type));
  if (tree.type === type) return true;
  return (tree.children || []).some((child: any) =>
    typeof child === 'object' ? hasChild(child, type) : false
  );
}

function findTextContent(tree: any, text: string): boolean {
  if (!tree) return false;
  if (Array.isArray(tree)) return tree.some(t => findTextContent(t, text));
  if (tree.type === 'Text' && tree.children?.includes(text)) return true;
  return (tree.children || []).some((child: any) =>
    typeof child === 'object' ? findTextContent(child, text) : false
  );
}

describe('ProfileAvatar component', () => {
  it('renders User icon when no url and no name', () => {
    const tree = renderAvatar({});
    expect(hasChild(tree, 'UserIcon')).toBe(true);
  });

  it('renders initials when no url but name is provided', () => {
    const tree = renderAvatar({ name: 'Bassel Ahmad' });
    expect(findTextContent(tree, 'BA')).toBe(true);
    expect(hasChild(tree, 'UserIcon')).toBe(false);
  });

  it('renders User icon when no url and name is empty', () => {
    const tree = renderAvatar({ name: '' });
    expect(hasChild(tree, 'UserIcon')).toBe(true);
  });

  it('renders single initial for single-word name', () => {
    const tree = renderAvatar({ name: 'Bassel' });
    expect(findTextContent(tree, 'B')).toBe(true);
  });
});
