import { computeFileHash } from '../services/fileHashService';

// Mock expo-file-system's File class
const mockBytes = jest.fn();
jest.mock('expo-file-system', () => ({
  File: jest.fn().mockImplementation((uri: string) => ({
    uri,
    bytes: mockBytes,
  })),
}));

// Mock expo-crypto — use getter so `import * as Crypto` resolves the mock
const mockDigest = jest.fn();
jest.mock('expo-crypto', () => {
  return {
    __esModule: true,
    digest: (...args: any[]) => mockDigest(...args),
    CryptoDigestAlgorithm: { SHA256: 'SHA-256' },
  };
});

beforeEach(() => {
  jest.clearAllMocks();
});

describe('computeFileHash', () => {
  it('returns lowercase hex string of length 64', async () => {
    // SHA-256 of empty = e3b0c442...
    const hashBytes = new Uint8Array([
      0xe3, 0xb0, 0xc4, 0x42, 0x98, 0xfc, 0x1c, 0x14,
      0x9a, 0xfb, 0xf4, 0xc8, 0x99, 0x6f, 0xb9, 0x24,
      0x27, 0xae, 0x41, 0xe4, 0x64, 0x9b, 0x93, 0x4c,
      0xa4, 0x95, 0x99, 0x1b, 0x78, 0x52, 0xb8, 0x55,
    ]);
    mockBytes.mockResolvedValue(new Uint8Array([]));
    mockDigest.mockResolvedValue(hashBytes.buffer);

    const hash = await computeFileHash('file:///test/empty.bin');

    expect(hash).toHaveLength(64);
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
  });

  it('computes correct SHA-256 for known content', async () => {
    const hashBytes = new Uint8Array([
      0xe3, 0xb0, 0xc4, 0x42, 0x98, 0xfc, 0x1c, 0x14,
      0x9a, 0xfb, 0xf4, 0xc8, 0x99, 0x6f, 0xb9, 0x24,
      0x27, 0xae, 0x41, 0xe4, 0x64, 0x9b, 0x93, 0x4c,
      0xa4, 0x95, 0x99, 0x1b, 0x78, 0x52, 0xb8, 0x55,
    ]);
    mockBytes.mockResolvedValue(new Uint8Array([]));
    mockDigest.mockResolvedValue(hashBytes.buffer);

    const hash = await computeFileHash('file:///test/empty.bin');

    expect(hash).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
  });

  it('creates File with the given URI', async () => {
    const { File } = require('expo-file-system');
    const hashBytes = new Uint8Array(32).buffer;
    mockBytes.mockResolvedValue(new Uint8Array([1, 2, 3]));
    mockDigest.mockResolvedValue(hashBytes);

    await computeFileHash('file:///photos/image.jpg');

    expect(File).toHaveBeenCalledWith('file:///photos/image.jpg');
  });

  it('passes file bytes to crypto digest with SHA-256 algorithm', async () => {
    const fileContent = new Uint8Array([10, 20, 30, 40, 50]);
    const hashBytes = new Uint8Array(32).buffer;
    mockBytes.mockResolvedValue(fileContent);
    mockDigest.mockResolvedValue(hashBytes);

    await computeFileHash('file:///test/data.bin');

    expect(mockDigest).toHaveBeenCalledWith('SHA-256', fileContent);
  });

  it('propagates error when file read fails', async () => {
    mockBytes.mockRejectedValue(new Error('File not found'));

    await expect(computeFileHash('file:///nonexistent')).rejects.toThrow('File not found');
  });

  it('propagates error when crypto digest fails', async () => {
    mockBytes.mockResolvedValue(new Uint8Array([1, 2, 3]));
    mockDigest.mockRejectedValue(new Error('Crypto error'));

    await expect(computeFileHash('file:///test/data.bin')).rejects.toThrow('Crypto error');
  });

  it('pads single-digit hex values with leading zero', async () => {
    // Hash where first byte is 0x0a (should produce "0a", not "a")
    const hashBytes = new Uint8Array(32);
    hashBytes[0] = 0x0a;
    hashBytes[1] = 0x01;
    mockBytes.mockResolvedValue(new Uint8Array([]));
    mockDigest.mockResolvedValue(hashBytes.buffer);

    const hash = await computeFileHash('file:///test/file.bin');

    expect(hash.slice(0, 4)).toBe('0a01');
    expect(hash).toHaveLength(64);
  });
});
