import { AxiosError } from 'axios';
import { apiClient, uploadMultipart } from '@/services/apiClient';
import { ReceiptAttachment } from '../components/ReceiptPickerSection';

export class ReceiptUploadError extends Error {
  constructor(
    public code:
      | 'NETWORK'
      | 'FORBIDDEN'
      | 'NOT_FOUND'
      | 'INVALID_FILE'
      | 'FILE_TOO_LARGE'
      | 'SERVER'
      | 'UNKNOWN',
    message?: string,
  ) {
    super(message ?? code);
    this.name = 'ReceiptUploadError';
  }
}

function mapError(error: unknown): ReceiptUploadError {
  if (error instanceof ReceiptUploadError) return error;

  if (error instanceof AxiosError || (error as any)?.isAxiosError) {
    const axErr = error as AxiosError<any>;
    if (!axErr.response) return new ReceiptUploadError('NETWORK');

    const status = axErr.response.status;
    const errorCode = axErr.response.data?.error?.code;

    if (status === 400) {
      if (errorCode === 'INVALID_FILE_TYPE') {
        return new ReceiptUploadError('INVALID_FILE');
      }
      if (errorCode === 'FILE_TOO_LARGE') {
        return new ReceiptUploadError('FILE_TOO_LARGE');
      }
    }
    if (status === 403) return new ReceiptUploadError('FORBIDDEN');
    if (status === 404) return new ReceiptUploadError('NOT_FOUND');
    if (status >= 500) return new ReceiptUploadError('SERVER');
  }

  return new ReceiptUploadError('UNKNOWN');
}

/**
 * Upload a single receipt file. Returns the server-assigned receiptId.
 */
export async function uploadReceipt(
  attachment: ReceiptAttachment,
  onProgress?: (percent: number) => void,
): Promise<string> {
  try {
    const formData = new FormData();
    formData.append('file', {
      uri: attachment.uri,
      type: attachment.mimeType ?? 'image/jpeg',
      name: attachment.name ?? 'receipt',
    } as any);

    const response = await uploadMultipart(
      '/receipts/upload',
      formData,
      onProgress,
    );

    if (response.data?.success && response.data?.receiptId) {
      return response.data.receiptId;
    }

    throw new ReceiptUploadError('UNKNOWN', 'Invalid response from server');
  } catch (error) {
    if (error instanceof ReceiptUploadError) throw error;
    throw mapError(error);
  }
}

/**
 * Add-only mode: POST /transactions/add-receipts
 */
export async function addReceiptsToTransaction(
  transactionId: string,
  newReceiptIds: string[],
): Promise<void> {
  try {
    await apiClient.post('/transactions/add-receipts', {
      transactionId,
      newReceiptIds,
    });
  } catch (error) {
    throw mapError(error);
  }
}

/**
 * Full-edit mode: PUT /transactions with full receipt ID list
 */
export async function updateTransactionReceipts(
  transactionId: string,
  allReceiptIds: string[],
): Promise<void> {
  try {
    await apiClient.put('/transactions', {
      transactionId,
      receiptIds: allReceiptIds,
    });
  } catch (error) {
    throw mapError(error);
  }
}
