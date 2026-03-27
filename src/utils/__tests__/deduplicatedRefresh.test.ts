import { createDeduplicatedRefresh } from '../deduplicatedRefresh';

describe('createDeduplicatedRefresh', () => {
  it('concurrent calls return the same promise', async () => {
    let callCount = 0;
    const refresh = createDeduplicatedRefresh(async () => {
      callCount++;
      return true;
    });

    const p1 = refresh();
    const p2 = refresh();
    const p3 = refresh();

    // All three should be the exact same promise reference
    expect(p1).toBe(p2);
    expect(p2).toBe(p3);

    await Promise.all([p1, p2, p3]);
    expect(callCount).toBe(1);
  });

  it('promise is cleared after completion', async () => {
    let callCount = 0;
    const refresh = createDeduplicatedRefresh(async () => {
      callCount++;
      return true;
    });

    await refresh();
    expect(callCount).toBe(1);

    // After completion, a new call should invoke the function again
    await refresh();
    expect(callCount).toBe(2);
  });

  it('promise is cleared even after rejection', async () => {
    let callCount = 0;
    const refresh = createDeduplicatedRefresh(async () => {
      callCount++;
      if (callCount === 1) throw new Error('fail');
      return true;
    });

    await expect(refresh()).rejects.toThrow('fail');
    expect(callCount).toBe(1);

    // After rejection, a new call should work
    const result = await refresh();
    expect(result).toBe(true);
    expect(callCount).toBe(2);
  });

  it('concurrent calls all reject when the underlying function rejects', async () => {
    const refresh = createDeduplicatedRefresh(async () => {
      throw new Error('boom');
    });

    const p1 = refresh();
    const p2 = refresh();

    await expect(p1).rejects.toThrow('boom');
    await expect(p2).rejects.toThrow('boom');
  });
});
