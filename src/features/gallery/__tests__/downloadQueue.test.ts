import { DownloadQueue, generateJobId } from '../services/downloadQueue';
import { DownloadJob, DownloadSnapshot, MAX_CONCURRENT_DOWNLOADS } from '../types';

function makeJob(overrides: Partial<DownloadJob> = {}): DownloadJob {
  return {
    id: overrides.id ?? generateJobId(),
    sourceUrl: overrides.sourceUrl ?? 'https://example.com/file.jpg',
    destinationUri: overrides.destinationUri ?? '/cache/file.jpg',
    displayFilename: overrides.displayFilename ?? 'file.jpg',
    status: overrides.status ?? 'queued',
    progress: overrides.progress ?? 0,
    error: overrides.error,
  };
}

type Resolve = (uri: string) => void;
type Reject = (err: Error) => void;

/**
 * Creates a controllable executor where each job execution can be
 * individually resolved or rejected from the test.
 */
function createControllableExecutor() {
  const pending = new Map<string, { resolve: Resolve; reject: Reject }>();
  const progressCalls: Array<{ jobId: string; progress: number }> = [];

  const executor = jest.fn(
    (
      job: DownloadJob,
      onProgress: (jobId: string, progress: number) => void,
    ): Promise<string> => {
      return new Promise<string>((resolve, reject) => {
        pending.set(job.id, { resolve, reject });
        // Store onProgress so tests can call it
        (executor as any).__onProgress = onProgress;
        (executor as any).__progressMap = (executor as any).__progressMap ?? new Map();
        (executor as any).__progressMap.set(job.id, onProgress);
      });
    },
  );

  return {
    executor,
    pending,
    progressCalls,
    resolveJob: (jobId: string, uri = '/saved/file.jpg') => {
      const p = pending.get(jobId);
      if (!p) throw new Error(`No pending job: ${jobId}`);
      p.resolve(uri);
      pending.delete(jobId);
    },
    rejectJob: (jobId: string, message = 'Download failed') => {
      const p = pending.get(jobId);
      if (!p) throw new Error(`No pending job: ${jobId}`);
      p.reject(new Error(message));
      pending.delete(jobId);
    },
    sendProgress: (jobId: string, progress: number) => {
      const onProgress = (executor as any).__progressMap?.get(jobId);
      if (onProgress) onProgress(jobId, progress);
    },
  };
}

// Flush microtask queue so async processQueue completes
const flush = () => new Promise((r) => setTimeout(r, 0));

describe('DownloadQueue', () => {
  describe('enqueue', () => {
    it('adds jobs to the queue and emits snapshot', async () => {
      const { executor } = createControllableExecutor();
      const queue = new DownloadQueue(executor);
      const snapshots: DownloadSnapshot[] = [];
      queue.subscribe((s) => snapshots.push(s));

      const job = makeJob({ id: 'job-1' });
      await queue.enqueue([job]);
      await flush();

      // Should have emitted after enqueue + after starting the job
      const lastSnapshot = snapshots[snapshots.length - 1];
      expect(lastSnapshot.totalCount).toBe(1);
      expect(lastSnapshot.isActive).toBe(true);
    });

    it('enqueues multiple jobs', async () => {
      const { executor } = createControllableExecutor();
      const queue = new DownloadQueue(executor);

      const jobs = [makeJob({ id: 'j1' }), makeJob({ id: 'j2' }), makeJob({ id: 'j3' })];
      await queue.enqueue(jobs);
      await flush();

      const snap = queue.getSnapshot();
      expect(snap.totalCount).toBe(3);
    });
  });

  describe('concurrent execution', () => {
    it('runs at most MAX_CONCURRENT_DOWNLOADS jobs at a time', async () => {
      const { executor } = createControllableExecutor();
      const queue = new DownloadQueue(executor);

      const jobs = [
        makeJob({ id: 'j1' }),
        makeJob({ id: 'j2' }),
        makeJob({ id: 'j3' }),
      ];
      await queue.enqueue(jobs);
      await flush();

      // Only first 2 should be started (MAX_CONCURRENT_DOWNLOADS = 2)
      expect(executor).toHaveBeenCalledTimes(MAX_CONCURRENT_DOWNLOADS);

      const snap = queue.getSnapshot();
      const running = snap.jobs.filter((j) => j.status === 'running');
      const queued = snap.jobs.filter((j) => j.status === 'queued');
      expect(running).toHaveLength(2);
      expect(queued).toHaveLength(1);
    });

    it('starts next queued job when a running job completes', async () => {
      const { executor, resolveJob } = createControllableExecutor();
      const queue = new DownloadQueue(executor);

      const jobs = [
        makeJob({ id: 'j1' }),
        makeJob({ id: 'j2' }),
        makeJob({ id: 'j3' }),
      ];
      await queue.enqueue(jobs);
      await flush();

      expect(executor).toHaveBeenCalledTimes(2);

      // Complete first job
      resolveJob('j1');
      await flush();

      // Third job should now start
      expect(executor).toHaveBeenCalledTimes(3);
      const snap = queue.getSnapshot();
      const completed = snap.jobs.filter((j) => j.status === 'completed');
      expect(completed).toHaveLength(1);
      expect(completed[0].id).toBe('j1');
    });

    it('starts next queued job when a running job fails', async () => {
      const { executor, rejectJob } = createControllableExecutor();
      const queue = new DownloadQueue(executor);

      const jobs = [
        makeJob({ id: 'j1' }),
        makeJob({ id: 'j2' }),
        makeJob({ id: 'j3' }),
      ];
      await queue.enqueue(jobs);
      await flush();

      rejectJob('j1', 'Network error');
      await flush();

      expect(executor).toHaveBeenCalledTimes(3);
      const snap = queue.getSnapshot();
      const failed = snap.jobs.filter((j) => j.status === 'failed');
      expect(failed).toHaveLength(1);
      expect(failed[0].error).toBe('Network error');
    });
  });

  describe('FIFO ordering', () => {
    it('starts jobs in the order they were enqueued', async () => {
      const executionOrder: string[] = [];
      const pending = new Map<string, { resolve: (uri: string) => void }>();

      const executor = jest.fn(
        (job: DownloadJob): Promise<string> =>
          new Promise((resolve) => {
            executionOrder.push(job.id);
            pending.set(job.id, { resolve });
          }),
      );

      const queue = new DownloadQueue(executor);
      await queue.enqueue([
        makeJob({ id: 'first' }),
        makeJob({ id: 'second' }),
        makeJob({ id: 'third' }),
      ]);
      await flush();

      // First two started (max concurrent = 2)
      expect(executionOrder).toEqual(['first', 'second']);

      // Complete first, third should start
      pending.get('first')!.resolve('/saved');
      await flush();

      expect(executionOrder).toEqual(['first', 'second', 'third']);
    });
  });

  describe('state transitions', () => {
    it('moves job from queued to running to completed', async () => {
      const { executor, resolveJob } = createControllableExecutor();
      const queue = new DownloadQueue(executor);
      const statusTransitions: string[] = [];

      queue.subscribe((snap) => {
        const job = snap.jobs.find((j) => j.id === 'j1');
        if (job && statusTransitions[statusTransitions.length - 1] !== job.status) {
          statusTransitions.push(job.status);
        }
      });

      await queue.enqueue([makeJob({ id: 'j1' })]);
      await flush();

      resolveJob('j1');
      await flush();

      expect(statusTransitions).toEqual(['queued', 'running', 'completed']);
    });

    it('moves job from queued to running to failed on error', async () => {
      const { executor, rejectJob } = createControllableExecutor();
      const queue = new DownloadQueue(executor);
      const statusTransitions: string[] = [];

      queue.subscribe((snap) => {
        const job = snap.jobs.find((j) => j.id === 'j1');
        if (job && statusTransitions[statusTransitions.length - 1] !== job.status) {
          statusTransitions.push(job.status);
        }
      });

      await queue.enqueue([makeJob({ id: 'j1' })]);
      await flush();

      rejectJob('j1');
      await flush();

      expect(statusTransitions).toEqual(['queued', 'running', 'failed']);
    });

    it('completed job has progress=1', async () => {
      const { executor, resolveJob } = createControllableExecutor();
      const queue = new DownloadQueue(executor);

      await queue.enqueue([makeJob({ id: 'j1' })]);
      await flush();

      resolveJob('j1');
      await flush();

      const snap = queue.getSnapshot();
      const job = snap.jobs.find((j) => j.id === 'j1');
      expect(job?.progress).toBe(1);
      expect(job?.status).toBe('completed');
    });

    it('failed job stores error message', async () => {
      const { executor, rejectJob } = createControllableExecutor();
      const queue = new DownloadQueue(executor);

      await queue.enqueue([makeJob({ id: 'j1' })]);
      await flush();

      rejectJob('j1', 'Server returned 500');
      await flush();

      const snap = queue.getSnapshot();
      const job = snap.jobs.find((j) => j.id === 'j1');
      expect(job?.status).toBe('failed');
      expect(job?.error).toBe('Server returned 500');
    });
  });

  describe('progress tracking', () => {
    it('updates job progress when executor reports progress', async () => {
      const { executor, sendProgress, resolveJob } = createControllableExecutor();
      const queue = new DownloadQueue(executor);
      const progressValues: number[] = [];

      queue.subscribe((snap) => {
        const job = snap.jobs.find((j) => j.id === 'j1');
        if (job) progressValues.push(job.progress);
      });

      await queue.enqueue([makeJob({ id: 'j1' })]);
      await flush();

      sendProgress('j1', 0.5);
      await flush();

      sendProgress('j1', 0.9);
      await flush();

      expect(progressValues).toContain(0.5);
      expect(progressValues).toContain(0.9);

      resolveJob('j1');
      await flush();
    });

    it('clamps progress to max 1.0', async () => {
      const { executor, sendProgress, resolveJob } = createControllableExecutor();
      const queue = new DownloadQueue(executor);

      await queue.enqueue([makeJob({ id: 'j1' })]);
      await flush();

      sendProgress('j1', 1.5);
      await flush();

      const snap = queue.getSnapshot();
      const job = snap.jobs.find((j) => j.id === 'j1');
      expect(job!.progress).toBeLessThanOrEqual(1);

      resolveJob('j1');
      await flush();
    });

    it('computes batchProgress as average of all job progresses', async () => {
      const { executor, sendProgress } = createControllableExecutor();
      const queue = new DownloadQueue(executor);

      await queue.enqueue([makeJob({ id: 'j1' }), makeJob({ id: 'j2' })]);
      await flush();

      sendProgress('j1', 0.6);
      sendProgress('j2', 0.4);
      await flush();

      const snap = queue.getSnapshot();
      expect(snap.batchProgress).toBeCloseTo(0.5, 1);
    });
  });

  describe('cancelJob', () => {
    it('cancels a queued job', async () => {
      const { executor } = createControllableExecutor();
      const queue = new DownloadQueue(executor);

      await queue.enqueue([
        makeJob({ id: 'j1' }),
        makeJob({ id: 'j2' }),
        makeJob({ id: 'j3' }),
      ]);
      await flush();

      // j3 is still queued (only 2 run concurrently)
      queue.cancelJob('j3');
      await flush();

      const snap = queue.getSnapshot();
      const j3 = snap.jobs.find((j) => j.id === 'j3');
      expect(j3?.status).toBe('canceled');
    });

    it('cancels a running job and starts next queued job', async () => {
      const { executor } = createControllableExecutor();
      const queue = new DownloadQueue(executor);

      await queue.enqueue([
        makeJob({ id: 'j1' }),
        makeJob({ id: 'j2' }),
        makeJob({ id: 'j3' }),
      ]);
      await flush();

      expect(executor).toHaveBeenCalledTimes(2);

      queue.cancelJob('j1');
      await flush();

      // j3 should now start
      expect(executor).toHaveBeenCalledTimes(3);
      const snap = queue.getSnapshot();
      expect(snap.jobs.find((j) => j.id === 'j1')?.status).toBe('canceled');
    });

    it('does not cancel an already completed job', async () => {
      const { executor, resolveJob } = createControllableExecutor();
      const queue = new DownloadQueue(executor);

      await queue.enqueue([makeJob({ id: 'j1' })]);
      await flush();

      resolveJob('j1');
      await flush();

      queue.cancelJob('j1');
      await flush();

      const snap = queue.getSnapshot();
      expect(snap.jobs.find((j) => j.id === 'j1')?.status).toBe('completed');
    });

    it('does nothing for non-existent job ID', async () => {
      const { executor } = createControllableExecutor();
      const queue = new DownloadQueue(executor);

      await queue.enqueue([makeJob({ id: 'j1' })]);
      await flush();

      // Should not throw
      queue.cancelJob('nonexistent');
      await flush();

      const snap = queue.getSnapshot();
      expect(snap.totalCount).toBe(1);
    });
  });

  describe('cancelAll', () => {
    it('cancels all non-terminal jobs', async () => {
      const { executor, resolveJob } = createControllableExecutor();
      const queue = new DownloadQueue(executor);

      await queue.enqueue([
        makeJob({ id: 'j1' }),
        makeJob({ id: 'j2' }),
        makeJob({ id: 'j3' }),
      ]);
      await flush();

      // Complete j1 first
      resolveJob('j1');
      await flush();

      queue.cancelAll();
      await flush();

      const snap = queue.getSnapshot();
      expect(snap.jobs.find((j) => j.id === 'j1')?.status).toBe('completed');
      expect(snap.jobs.find((j) => j.id === 'j2')?.status).toBe('canceled');
      expect(snap.jobs.find((j) => j.id === 'j3')?.status).toBe('canceled');
    });

    it('sets isActive to false after cancelAll', async () => {
      const { executor } = createControllableExecutor();
      const queue = new DownloadQueue(executor);

      await queue.enqueue([makeJob({ id: 'j1' })]);
      await flush();

      queue.cancelAll();
      await flush();

      const snap = queue.getSnapshot();
      expect(snap.isActive).toBe(false);
    });
  });

  describe('clearCompleted', () => {
    it('removes completed, failed, and canceled jobs from the list', async () => {
      const { executor, resolveJob, rejectJob } = createControllableExecutor();
      const queue = new DownloadQueue(executor);

      await queue.enqueue([
        makeJob({ id: 'j1' }),
        makeJob({ id: 'j2' }),
        makeJob({ id: 'j3' }),
      ]);
      await flush();

      resolveJob('j1');
      await flush();

      rejectJob('j2', 'error');
      await flush();

      // j3 should be running now
      queue.clearCompleted();
      await flush();

      const snap = queue.getSnapshot();
      // j1 (completed) and j2 (failed) should be removed; j3 should remain
      const ids = snap.jobs.map((j) => j.id);
      expect(ids).not.toContain('j1');
      expect(ids).not.toContain('j2');
      expect(ids).toContain('j3');
    });
  });

  describe('snapshot', () => {
    it('returns empty snapshot when no jobs', () => {
      const executor = jest.fn(() => Promise.resolve('/saved'));
      const queue = new DownloadQueue(executor);

      const snap = queue.getSnapshot();
      expect(snap.totalCount).toBe(0);
      expect(snap.completedCount).toBe(0);
      expect(snap.failedCount).toBe(0);
      expect(snap.isActive).toBe(false);
      expect(snap.batchProgress).toBe(0);
      expect(snap.jobs).toEqual([]);
    });

    it('counts completed and failed correctly', async () => {
      const { executor, resolveJob, rejectJob } = createControllableExecutor();
      const queue = new DownloadQueue(executor);

      await queue.enqueue([
        makeJob({ id: 'j1' }),
        makeJob({ id: 'j2' }),
      ]);
      await flush();

      resolveJob('j1');
      await flush();

      rejectJob('j2', 'err');
      await flush();

      const snap = queue.getSnapshot();
      expect(snap.completedCount).toBe(1);
      expect(snap.failedCount).toBe(1);
      expect(snap.isActive).toBe(false);
    });
  });

  describe('subscribe', () => {
    it('emits current state immediately on subscribe', () => {
      const executor = jest.fn(() => Promise.resolve('/saved'));
      const queue = new DownloadQueue(executor);

      const listener = jest.fn();
      queue.subscribe(listener);

      expect(listener).toHaveBeenCalledTimes(1);
      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({ totalCount: 0 }),
      );
    });

    it('returns an unsubscribe function that stops further emissions', async () => {
      const { executor } = createControllableExecutor();
      const queue = new DownloadQueue(executor);

      const listener = jest.fn();
      const unsub = queue.subscribe(listener);
      const callCount = listener.mock.calls.length;

      unsub();

      await queue.enqueue([makeJob({ id: 'j1' })]);
      await flush();

      // No new calls after unsubscribe
      expect(listener).toHaveBeenCalledTimes(callCount);
    });
  });

  describe('generateJobId', () => {
    it('generates unique IDs', () => {
      const ids = new Set<string>();
      for (let i = 0; i < 100; i++) {
        ids.add(generateJobId());
      }
      expect(ids.size).toBe(100);
    });
  });

  describe('executor error does not set failed if job was canceled', () => {
    it('keeps canceled status when executor rejects after cancel', async () => {
      const pending = new Map<string, { resolve: (uri: string) => void; reject: (err: Error) => void }>();
      const executor = jest.fn(
        (job: DownloadJob): Promise<string> =>
          new Promise((resolve, reject) => {
            pending.set(job.id, { resolve, reject });
          }),
      );

      const queue = new DownloadQueue(executor);
      await queue.enqueue([makeJob({ id: 'j1' })]);
      await flush();

      // Cancel while running
      queue.cancelJob('j1');
      await flush();

      // Then the executor rejects (the real download task finally returns)
      pending.get('j1')!.reject(new Error('canceled by user'));
      await flush();

      const snap = queue.getSnapshot();
      expect(snap.jobs.find((j) => j.id === 'j1')?.status).toBe('canceled');
    });
  });

  describe('AbortController support', () => {
    it('passes an AbortSignal to the executor as third argument', async () => {
      const receivedSignals = new Map<string, AbortSignal>();
      const pending = new Map<string, { resolve: (uri: string) => void }>();
      const executor = jest.fn(
        (
          job: DownloadJob,
          _onProgress: (jobId: string, progress: number) => void,
          signal: AbortSignal,
        ): Promise<string> =>
          new Promise((resolve) => {
            receivedSignals.set(job.id, signal);
            pending.set(job.id, { resolve });
          }),
      );

      const queue = new DownloadQueue(executor);
      await queue.enqueue([makeJob({ id: 'j1' })]);
      await flush();

      expect(receivedSignals.has('j1')).toBe(true);
      expect(receivedSignals.get('j1')).toBeInstanceOf(AbortSignal);
      expect(receivedSignals.get('j1')!.aborted).toBe(false);

      pending.get('j1')!.resolve('/saved');
      await flush();
    });

    it('aborts the signal when cancelJob is called on a running job', async () => {
      const receivedSignals = new Map<string, AbortSignal>();
      const pending = new Map<string, { resolve: (uri: string) => void; reject: (err: Error) => void }>();
      const executor = jest.fn(
        (
          job: DownloadJob,
          _onProgress: (jobId: string, progress: number) => void,
          signal: AbortSignal,
        ): Promise<string> =>
          new Promise((resolve, reject) => {
            receivedSignals.set(job.id, signal);
            pending.set(job.id, { resolve, reject });
          }),
      );

      const queue = new DownloadQueue(executor);
      await queue.enqueue([makeJob({ id: 'j1' })]);
      await flush();

      queue.cancelJob('j1');
      await flush();

      expect(receivedSignals.get('j1')!.aborted).toBe(true);

      // Clean up: reject so finally block runs
      pending.get('j1')!.reject(new Error('aborted'));
      await flush();
    });

    it('aborts all running signals when cancelAll is called', async () => {
      const receivedSignals = new Map<string, AbortSignal>();
      const pending = new Map<string, { resolve: (uri: string) => void; reject: (err: Error) => void }>();
      const executor = jest.fn(
        (
          job: DownloadJob,
          _onProgress: (jobId: string, progress: number) => void,
          signal: AbortSignal,
        ): Promise<string> =>
          new Promise((resolve, reject) => {
            receivedSignals.set(job.id, signal);
            pending.set(job.id, { resolve, reject });
          }),
      );

      const queue = new DownloadQueue(executor);
      await queue.enqueue([makeJob({ id: 'j1' }), makeJob({ id: 'j2' })]);
      await flush();

      queue.cancelAll();
      await flush();

      expect(receivedSignals.get('j1')!.aborted).toBe(true);
      expect(receivedSignals.get('j2')!.aborted).toBe(true);

      // Clean up
      pending.get('j1')!.reject(new Error('aborted'));
      pending.get('j2')!.reject(new Error('aborted'));
      await flush();
    });

    it('does not abort signal for a completed job', async () => {
      const receivedSignals = new Map<string, AbortSignal>();
      const pending = new Map<string, { resolve: (uri: string) => void }>();
      const executor = jest.fn(
        (
          job: DownloadJob,
          _onProgress: (jobId: string, progress: number) => void,
          signal: AbortSignal,
        ): Promise<string> =>
          new Promise((resolve) => {
            receivedSignals.set(job.id, signal);
            pending.set(job.id, { resolve });
          }),
      );

      const queue = new DownloadQueue(executor);
      await queue.enqueue([makeJob({ id: 'j1' })]);
      await flush();

      // Complete the job first
      pending.get('j1')!.resolve('/saved');
      await flush();

      // Cancel after completion should not abort
      queue.cancelJob('j1');
      await flush();

      expect(receivedSignals.get('j1')!.aborted).toBe(false);
    });
  });
});
