import React from 'react';
import { render } from '@testing-library/react-native';
import { AlbumMosaic } from '../AlbumMosaic';
import { ThemeProvider } from '@/theme';

// Mock MediaThumbnail to avoid auth/network concerns — just render a testID with the uri
jest.mock('../MediaThumbnail', () => ({
  MediaThumbnail: ({ uri }: { uri: string }) => {
    const { View, Text } = require('react-native');
    return (
      <View testID={`thumb-${uri}`}>
        <Text>{uri}</Text>
      </View>
    );
  },
}));

// Mock lucide icon
jest.mock('lucide-react-native', () => ({
  ImageIcon: (props: any) => {
    const { View } = require('react-native');
    return <View testID="placeholder-icon" />;
  },
}));

function renderMosaic(thumbnails: string[]) {
  return render(
    <ThemeProvider>
      <AlbumMosaic thumbnails={thumbnails} />
    </ThemeProvider>,
  );
}

describe('AlbumMosaic', () => {
  it('shows placeholder icon when thumbnails is empty', () => {
    const { getByTestId, queryByTestId } = renderMosaic([]);
    expect(getByTestId('placeholder-icon')).toBeTruthy();
    expect(queryByTestId(/^thumb-/)).toBeNull();
  });

  it('renders 1 thumbnail when given 1 URL', () => {
    const { getByTestId } = renderMosaic(['url-a']);
    expect(getByTestId('thumb-url-a')).toBeTruthy();
  });

  it('renders 2 thumbnails when given 2 URLs', () => {
    const { getByTestId } = renderMosaic(['url-a', 'url-b']);
    expect(getByTestId('thumb-url-a')).toBeTruthy();
    expect(getByTestId('thumb-url-b')).toBeTruthy();
  });

  it('renders 3 thumbnails when given 3 URLs', () => {
    const { getByTestId } = renderMosaic(['url-a', 'url-b', 'url-c']);
    expect(getByTestId('thumb-url-a')).toBeTruthy();
    expect(getByTestId('thumb-url-b')).toBeTruthy();
    expect(getByTestId('thumb-url-c')).toBeTruthy();
  });

  it('renders exactly 4 thumbnails when given 4 URLs', () => {
    const { getByTestId } = renderMosaic(['url-a', 'url-b', 'url-c', 'url-d']);
    expect(getByTestId('thumb-url-a')).toBeTruthy();
    expect(getByTestId('thumb-url-b')).toBeTruthy();
    expect(getByTestId('thumb-url-c')).toBeTruthy();
    expect(getByTestId('thumb-url-d')).toBeTruthy();
  });

  it('caps at 4 thumbnails when given more than 4 URLs', () => {
    const { getByTestId, queryByTestId } = renderMosaic([
      'url-a', 'url-b', 'url-c', 'url-d', 'url-e',
    ]);
    expect(getByTestId('thumb-url-a')).toBeTruthy();
    expect(getByTestId('thumb-url-d')).toBeTruthy();
    expect(queryByTestId('thumb-url-e')).toBeNull();
  });
});
