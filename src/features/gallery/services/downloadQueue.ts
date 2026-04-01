import {
  DownloadJob,
  DownloadSnapshot,
  DownloadStatus,
  EMPTY_DOWNLOAD_SNAPSHOT,
  MAX_CONCURRENT_DOWNLOADS,
} from '../types';

type SnapshotListener = (snapshot: DownloadSnapshot) => void;
type JobExecutor = (
  job: DownloadJob,
  onProgress: (jobId: string, progress: number) => void,
) => Promise<string>; // returns saved URI

let idCounter = 0;

export function generateJobId(): string {
  idCounter += 1;
  return `${Date.now()}-${idCounter}`;
}

function computeSnapshot(jobs: DownloadJob[]): DownloadSnapshot {
  if (jobs.length === 0) return EMPTY_DOWNLOAD_SNAPSHOT;

  const completedCount = jobs.filter((j) => j.status === 'completed').length;
  const failedCount = jobs.filter((j) => j.status === 'failed').length;
  const isActive = jobs.some((j) => j.status === 'queued' || j.status === 'running');
  const batchProgress =
    jobs.length > 0
      ? jobs.reduce((sum, j) => sum + j.progress, 0) / jobs.length
      : 0;

  return {
    jobs: [...jobs],
    totalCount: jobs.length,
    completedCount,
    failedCount,
    isActive,
    batchProgress,
  };
}

function isTerminal(status: DownloadStatus): boolean {
  return status === 'completed' || status === 'failed' || status === 'canceled';
}

/**
 * Download queue coordinator.
 * Manages a list of download jobs with max concurrent execution.
 * Mirrors Flutter's DownloadCoordinator pattern.
 */
export class DownloadQueue {
  private jobs: DownloadJob[] = [];
  private runningIds = new Set<string>();
  private listeners = new Set<SnapshotListener>();
  private executor: JobExecutor;
  private processing = false;

  constructor(executor: JobExecutor) {
    this.executor = executor;
  }

  subscribe(listener: SnapshotListener): () => void {
    this.listeners.add(listener);
    // Emit current state immediately
    listener(this.getSnapshot());
    return () => {
      this.listeners.delete(listener);
    };
  }

  getSnapshot(): DownloadSnapshot {
    return computeSnapshot(this.jobs);
  }

  async enqueue(newJobs: DownloadJob[]): Promise<void> {
    for (const job of newJobs) {
      this.jobs.push({ ...job, status: 'queued', progress: 0 });
    }
    this.emit();
    this.processQueue();
  }

  cancelJob(jobId: string): void {
    const idx = this.jobs.findIndex((j) => j.id === jobId);
    if (idx < 0) return;
    if (isTerminal(this.jobs[idx].status)) return;

    this.jobs[idx] = { ...this.jobs[idx], status: 'canceled' };
    this.runningIds.delete(jobId);
    this.emit();
    this.processQueue();
  }

  cancelAll(): void {
    for (let i = 0; i < this.jobs.length; i++) {
      if (!isTerminal(this.jobs[i].status)) {
        this.jobs[i] = { ...this.jobs[i], status: 'canceled' };
      }
    }
    this.runningIds.clear();
    this.emit();
  }

  clearCompleted(): void {
    this.jobs = this.jobs.filter((j) => !isTerminal(j.status));
    this.emit();
  }

  private emit(): void {
    const snapshot = this.getSnapshot();
    for (const listener of this.listeners) {
      listener(snapshot);
    }
  }

  private async processQueue(): Promise<void> {
    if (this.processing) return;
    this.processing = true;

    try {
      while (this.runningIds.size < MAX_CONCURRENT_DOWNLOADS) {
        const nextIdx = this.jobs.findIndex(
          (j) => j.status === 'queued' && !this.runningIds.has(j.id),
        );
        if (nextIdx < 0) break;

        const job = this.jobs[nextIdx];
        this.jobs[nextIdx] = { ...job, status: 'running' };
        this.runningIds.add(job.id);
        this.emit();

        // Fire and forget — completion handled in callbacks
        this.executeJob(job.id);
      }
    } finally {
      this.processing = false;
    }
  }

  private async executeJob(jobId: string): Promise<void> {
    const idx = this.jobs.findIndex((j) => j.id === jobId);
    if (idx < 0) return;

    try {
      const savedUri = await this.executor(
        this.jobs[idx],
        (id, progress) => {
          const i = this.jobs.findIndex((j) => j.id === id);
          if (i < 0) return;
          this.jobs[i] = { ...this.jobs[i], progress: Math.min(progress, 1) };
          this.emit();
        },
      );

      const completedIdx = this.jobs.findIndex((j) => j.id === jobId);
      if (completedIdx >= 0) {
        this.jobs[completedIdx] = {
          ...this.jobs[completedIdx],
          status: 'completed',
          progress: 1,
          destinationUri: savedUri,
        };
      }
    } catch (err: any) {
      const failedIdx = this.jobs.findIndex((j) => j.id === jobId);
      if (failedIdx >= 0 && this.jobs[failedIdx].status !== 'canceled') {
        this.jobs[failedIdx] = {
          ...this.jobs[failedIdx],
          status: 'failed',
          error: err?.message ?? 'Download failed',
        };
      }
    } finally {
      this.runningIds.delete(jobId);
      this.emit();
      this.processQueue();
    }
  }
}
