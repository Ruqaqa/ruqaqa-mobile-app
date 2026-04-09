// jest-expo automocks react-native; StyleSheet.create will be undefined
// unless we unmock. Component tests need the real native module surface.
jest.unmock('react-native');

import React from 'react';
import { render, act } from '@testing-library/react-native';
import { MediaThumbnail } from '../MediaThumbnail';
import { ThemeProvider } from '@/theme';

// Control useAuthHeaders return value from tests
const mockUseAuthHeaders = jest.fn<{ Authorization: string } | undefined, []>();
jest.mock('@/hooks/useAuthHeaders', () => ({
  useAuthHeaders: () => mockUseAuthHeaders(),
}));

// Deterministic URL — avoids depending on config.apiBaseUrl
jest.mock('@/utils/mediaUrl', () => ({
  normalizeMediaUrl: (url: string | undefined) =>
    url ? `https://resolved/${url}` : null,
}));

jest.mock('lucide-react-native', () => ({
  ImageIcon: (props: any) => {
    const { View } = require('react-native');
    return <View testID="placeholder-icon" />;
  },
}));

function renderThumbnail(uri?: string) {
  return render(
    <ThemeProvider>
      <MediaThumbnail uri={uri} />
    </ThemeProvider>,
  );
}

describe('MediaThumbnail', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('does not render Image when authHeaders is undefined', () => {
    mockUseAuthHeaders.mockReturnValue(undefined);

    const { UNSAFE_queryAllByType } = renderThumbnail('photo.jpg');
    const { Image } = require('react-native');
    const images = UNSAFE_queryAllByType(Image);

    expect(images).toHaveLength(0);
  });

  it('renders Image with auth headers once they become available', () => {
    mockUseAuthHeaders.mockReturnValue({ Authorization: 'Bearer tok123' });

    const { UNSAFE_queryAllByType } = renderThumbnail('photo.jpg');
    const { Image } = require('react-native');
    const images = UNSAFE_queryAllByType(Image);

    expect(images).toHaveLength(1);
    expect(images[0].props.source).toEqual({
      uri: 'https://resolved/photo.jpg',
      headers: { Authorization: 'Bearer tok123' },
    });
  });

  it('resets error state when authHeaders changes from undefined to a value', () => {
    // Start with no auth — Image is not rendered
    mockUseAuthHeaders.mockReturnValue(undefined);

    const { UNSAFE_queryAllByType, rerender } = renderThumbnail('photo.jpg');
    const { Image } = require('react-native');

    expect(UNSAFE_queryAllByType(Image)).toHaveLength(0);

    // Simulate auth becoming available (e.g. token loaded after app data clear)
    mockUseAuthHeaders.mockReturnValue({ Authorization: 'Bearer fresh' });

    rerender(
      <ThemeProvider>
        <MediaThumbnail uri="photo.jpg" />
      </ThemeProvider>,
    );

    const images = UNSAFE_queryAllByType(Image);
    expect(images).toHaveLength(1);
    expect(images[0].props.source.headers).toEqual({
      Authorization: 'Bearer fresh',
    });
  });

  it('resets error after 401 when authHeaders transition from undefined to defined', () => {
    // Phase 1: auth is available — render Image, then simulate a load error (401)
    mockUseAuthHeaders.mockReturnValue({ Authorization: 'Bearer stale' });

    const { UNSAFE_queryAllByType, queryByTestId, rerender } =
      renderThumbnail('photo.jpg');
    const { Image } = require('react-native');

    let images = UNSAFE_queryAllByType(Image);
    expect(images).toHaveLength(1);

    // Trigger onError (simulates 401 response)
    act(() => {
      images[0].props.onError();
    });

    // Should now show error placeholder (ImageIcon), no Image
    expect(queryByTestId('placeholder-icon')).toBeTruthy();
    expect(UNSAFE_queryAllByType(Image)).toHaveLength(0);

    // Phase 2: auth headers change (token refreshed)
    mockUseAuthHeaders.mockReturnValue({ Authorization: 'Bearer refreshed' });

    rerender(
      <ThemeProvider>
        <MediaThumbnail uri="photo.jpg" />
      </ThemeProvider>,
    );

    // Error should be reset — Image rendered again with new headers
    images = UNSAFE_queryAllByType(Image);
    expect(images).toHaveLength(1);
    expect(images[0].props.source.headers).toEqual({
      Authorization: 'Bearer refreshed',
    });
  });
});
