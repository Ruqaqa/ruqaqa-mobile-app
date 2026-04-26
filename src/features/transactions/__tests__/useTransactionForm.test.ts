// jest-expo automocks react-native; hook tests need it unmocked.
jest.unmock('react-native');

// useTransactionForm transitively imports ReceiptPickerSection which
// imports lucide-react-native. Stub it to avoid the native react-native-svg
// boot sequence.
jest.mock('lucide-react-native', () => {
  const stub = () => null;
  return new Proxy(
    {},
    {
      get: () => stub,
    },
  );
});

jest.mock('expo-constants', () => ({
  expoConfig: {
    version: '1.0.0',
    extra: { releaseChannel: 'development' },
  },
}));

jest.mock('@/services/employeeCacheService', () => ({
  getEmployees: jest.fn().mockResolvedValue([]),
}));

jest.mock('@/services/formCacheService', () => ({
  getLastClientAndProject: jest.fn().mockResolvedValue({ client: null, project: null }),
  saveLastClientAndProject: jest.fn().mockResolvedValue(undefined),
}));

import { renderHook, act, waitFor } from '@testing-library/react-native';
import { useTransactionForm } from '../hooks/useTransactionForm';
import { getLastClientAndProject } from '@/services/formCacheService';
import { UserPermissions } from '@/types/permissions';

const mockGetLastClientAndProject = getLastClientAndProject as jest.MockedFunction<
  typeof getLastClientAndProject
>;

const NO_PERMS: UserPermissions = {
  canAccessFinance: true,
  canAccessGallery: false,
  canCreateTransactions: true,
  canViewTransactionHistory: false,
  canViewAllTransactions: false,
  canUpdateTransactions: false,
  canSelectPartner: false,
  canAddReceiptsToSubmitted: false,
  canCreateReconciliation: false,
  canViewReconciliationHistory: false,
  canViewAllReconciliations: false,
  canUpdateReconciliation: false,
  canViewGallery: false,
  canCreateGallery: false,
  canUpdateGallery: false,
  canDeleteGallery: false,
};

async function mountForm() {
  const hook = renderHook(() =>
    useTransactionForm({ permissions: NO_PERMS, employee: null }),
  );
  // Wait for initial async effect (employees + cache load) to settle so we
  // observe a stable starting state and effects don't overwrite our updates.
  await waitFor(() => expect(hook.result.current.employees).toBeDefined());
  return hook;
}

describe('useTransactionForm — client free-text submission', () => {
  it('submits picked existing client (with valid ObjectId) by label', async () => {
    const { result } = await mountForm();

    act(() => {
      result.current.updateField('client', {
        id: '507f1f77bcf86cd799439011',
        label: 'Existing Client',
      });
    });

    const payload = result.current.buildSanitizedPayload();
    expect(payload['اسم العميل']).toBe('Existing Client');
  });

  it('submits free-text client (empty id) by label so backend auto-creates', async () => {
    const { result } = await mountForm();

    act(() => {
      result.current.updateField('client', { id: '', label: 'New Co' });
    });

    const payload = result.current.buildSanitizedPayload();
    expect(payload['اسم العميل']).toBe('New Co');
  });

  it('whitespace-only client label collapses to null in payload', async () => {
    const { result } = await mountForm();

    act(() => {
      result.current.updateField('client', { id: '', label: '   ' });
    });

    const payload = result.current.buildSanitizedPayload();
    expect(payload['اسم العميل']).toBeNull();
  });

  it('cleared client (null) sends null in payload', async () => {
    const { result } = await mountForm();

    act(() => {
      result.current.updateField('client', null);
    });

    const payload = result.current.buildSanitizedPayload();
    expect(payload['اسم العميل']).toBeNull();
  });
});

describe('useTransactionForm — project free-text submission', () => {
  it('submits picked existing project (with valid ObjectId) by label', async () => {
    const { result } = await mountForm();

    act(() => {
      result.current.updateField('project', {
        id: 'ffeeddccbbaa998877665544',
        label: 'Existing Project',
      });
    });

    const payload = result.current.buildSanitizedPayload();
    expect(payload['رمز المشروع']).toBe('Existing Project');
  });

  it('submits free-text project (empty id) by label so backend auto-creates', async () => {
    const { result } = await mountForm();

    act(() => {
      result.current.updateField('project', { id: '', label: 'New Project' });
    });

    const payload = result.current.buildSanitizedPayload();
    expect(payload['رمز المشروع']).toBe('New Project');
  });

  it('whitespace-only project label collapses to null in payload', async () => {
    const { result } = await mountForm();

    act(() => {
      result.current.updateField('project', { id: '', label: '   ' });
    });

    const payload = result.current.buildSanitizedPayload();
    expect(payload['رمز المشروع']).toBeNull();
  });

  it('cleared project (null) sends null in payload', async () => {
    const { result } = await mountForm();

    act(() => {
      result.current.updateField('project', null);
    });

    const payload = result.current.buildSanitizedPayload();
    expect(payload['رمز المشروع']).toBeNull();
  });
});

describe('useTransactionForm — last-write-wins for client/project', () => {
  it('switching from picked client to free-text overwrites cleanly', async () => {
    const { result } = await mountForm();

    act(() => {
      result.current.updateField('client', {
        id: '507f1f77bcf86cd799439011',
        label: 'Existing Client',
      });
    });
    act(() => {
      result.current.updateField('client', { id: '', label: 'Replaced' });
    });

    const payload = result.current.buildSanitizedPayload();
    expect(payload['اسم العميل']).toBe('Replaced');
  });

  it('switching from picked project to free-text overwrites cleanly', async () => {
    const { result } = await mountForm();

    act(() => {
      result.current.updateField('project', {
        id: 'ffeeddccbbaa998877665544',
        label: 'Existing Project',
      });
    });
    act(() => {
      result.current.updateField('project', { id: '', label: 'Replaced' });
    });

    const payload = result.current.buildSanitizedPayload();
    expect(payload['رمز المشروع']).toBe('Replaced');
  });
});

describe('useTransactionForm — cached client/project rehydration', () => {
  it('rehydrates cached client/project as chip-shaped items with sentinel id', async () => {
    mockGetLastClientAndProject.mockResolvedValueOnce({
      client: 'Acme',
      project: 'Atlas',
    });

    const { result } = await mountForm();

    await waitFor(() => {
      expect(result.current.form.client).not.toBeNull();
      expect(result.current.form.project).not.toBeNull();
    });

    expect(result.current.form.client).toEqual({ id: '__cached__', label: 'Acme' });
    expect(result.current.form.project).toEqual({ id: '__cached__', label: 'Atlas' });
  });

  it('submits cached client/project by label with no sentinel leaking to payload', async () => {
    mockGetLastClientAndProject.mockResolvedValueOnce({
      client: 'Acme',
      project: 'Atlas',
    });

    const { result } = await mountForm();

    await waitFor(() => {
      expect(result.current.form.client).not.toBeNull();
      expect(result.current.form.project).not.toBeNull();
    });

    const payload = result.current.buildSanitizedPayload();
    expect(payload['اسم العميل']).toBe('Acme');
    expect(payload['رمز المشروع']).toBe('Atlas');
    expect(JSON.stringify(payload)).not.toContain('__cached__');
  });

  it('clearing then typing fresh free-text client yields { id: "", label } shape', async () => {
    mockGetLastClientAndProject.mockResolvedValueOnce({
      client: 'Acme',
      project: null,
    });

    const { result } = await mountForm();

    await waitFor(() => {
      expect(result.current.form.client).not.toBeNull();
    });

    act(() => {
      result.current.updateField('client', null);
    });
    act(() => {
      result.current.updateField('client', { id: '', label: 'New Co' });
    });

    expect(result.current.form.client).toEqual({ id: '', label: 'New Co' });
  });

  it('empty cache leaves client/project as null', async () => {
    const { result } = await mountForm();

    expect(result.current.form.client).toBeNull();
    expect(result.current.form.project).toBeNull();
  });
});
