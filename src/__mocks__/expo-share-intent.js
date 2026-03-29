module.exports = {
  useShareIntent: () => ({
    isReady: true,
    hasShareIntent: false,
    shareIntent: { files: null, type: null, text: null, webUrl: null, meta: null },
    resetShareIntent: jest.fn(),
    error: null,
  }),
  ShareIntentProvider: ({ children }) => children,
  useShareIntentContext: () => ({
    isReady: true,
    hasShareIntent: false,
    shareIntent: { files: null, type: null, text: null, webUrl: null, meta: null },
    resetShareIntent: jest.fn(),
    error: null,
  }),
};
