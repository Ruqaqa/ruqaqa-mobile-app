import { renderHook, act } from '@testing-library/react-native';
import { useReconciliationForm } from '../hooks/useReconciliationForm';

// Mock dependencies that useReconciliationForm relies on
jest.mock('@/services/employeeCacheService', () => ({
  getEmployees: jest.fn().mockResolvedValue([]),
}));
jest.mock('@/services/financeChannelService', () => ({
  getFinanceChannels: jest.fn().mockResolvedValue([]),
}));
jest.mock('@/services/soundService', () => ({
  playSuccessSound: jest.fn(),
}));
jest.mock('../services/reconciliationSubmissionService', () => ({
  submitReconciliation: jest.fn().mockResolvedValue({ success: true }),
}));

describe('useReconciliationForm attachments', () => {
  it('starts with empty attachments', () => {
    const { result } = renderHook(() => useReconciliationForm());
    expect(result.current.form.attachments).toEqual([]);
  });

  it('addAttachment adds an attachment to form state', () => {
    const { result } = renderHook(() => useReconciliationForm());
    act(() => {
      result.current.addAttachment(
        'file:///tmp/photo.jpg',
        'image',
        'photo.jpg',
        'image/jpeg',
        1024,
      );
    });
    expect(result.current.form.attachments).toHaveLength(1);
    expect(result.current.form.attachments[0]).toMatchObject({
      uri: 'file:///tmp/photo.jpg',
      type: 'image',
      name: 'photo.jpg',
      mimeType: 'image/jpeg',
      fileSize: 1024,
    });
  });

  it('removeAttachment removes by id', () => {
    const { result } = renderHook(() => useReconciliationForm());
    act(() => {
      result.current.addAttachment('file:///a.jpg', 'image', 'a.jpg', 'image/jpeg');
    });
    const id = result.current.form.attachments[0].id;
    act(() => {
      result.current.removeAttachment(id);
    });
    expect(result.current.form.attachments).toHaveLength(0);
  });

  it('cannot exceed MAX_ATTACHMENTS', () => {
    const { result } = renderHook(() => useReconciliationForm());
    // Add 4 attachments (MAX_ATTACHMENTS)
    for (let i = 0; i < 4; i++) {
      act(() => {
        result.current.addAttachment(
          `file:///tmp/${i}.jpg`,
          'image',
          `${i}.jpg`,
          'image/jpeg',
        );
      });
    }
    expect(result.current.form.attachments).toHaveLength(4);
    expect(result.current.canAddMore).toBe(false);

    // 5th should be rejected
    let errorKey: string | null = null;
    act(() => {
      errorKey = result.current.addAttachment(
        'file:///tmp/5.jpg',
        'image',
        '5.jpg',
        'image/jpeg',
      );
    });
    expect(result.current.form.attachments).toHaveLength(4);
  });

  it('returns validation error for invalid file type', () => {
    const { result } = renderHook(() => useReconciliationForm());
    let errorKey: string | null = null;
    act(() => {
      errorKey = result.current.addAttachment(
        'file:///tmp/virus.exe',
        'document',
        'virus.exe',
        'application/x-msdownload',
        1024,
      );
    });
    expect(errorKey).toBe('invalidFileType');
    expect(result.current.form.attachments).toHaveLength(0);
  });

  it('reset clears attachments', () => {
    const { result } = renderHook(() => useReconciliationForm());
    act(() => {
      result.current.addAttachment('file:///a.jpg', 'image', 'a.jpg', 'image/jpeg');
    });
    expect(result.current.form.attachments).toHaveLength(1);
    act(() => {
      result.current.reset();
    });
    expect(result.current.form.attachments).toHaveLength(0);
  });
});
