module.exports = {
  Image: {
    compress: jest.fn().mockResolvedValue('file:///cache/compressed.jpg'),
  },
  Video: {
    compress: jest.fn().mockResolvedValue('file:///cache/compressed.mp4'),
    cancelCompression: jest.fn().mockResolvedValue(undefined),
  },
  createVideoThumbnail: jest.fn().mockResolvedValue({ path: 'file:///cache/thumb.jpg' }),
};
