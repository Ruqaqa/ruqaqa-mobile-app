import { useState, useCallback, useRef, useEffect } from 'react';
import type { ImagePickerAsset } from 'expo-image-picker';
import { Asset } from 'expo-asset';

import { playSuccessSound } from '@/services/soundService';
import {
  PipelineStatus,
  PipelineResult,
  UploadStage,
  DuplicateInfo,
  DuplicateDecision,
  GalleryAlbum,
  PickerItem,
  WatermarkDraft,
} from '../types';
import { UploadPipeline, DuplicateDecisionCallback } from '../services/uploadPipeline';

// Bundled watermark logo — resolved to a local file URI on first use
// eslint-disable-next-line @typescript-eslint/no-var-requires
const LOGO_MODULE = require('../../../../assets/logo-green.png');

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface UseUploadPipelineReturn {
  /** Start the upload pipeline with the given form state. */
  startUpload: (params: StartUploadParams) => void;
  /** Current pipeline status (progress, item states). */
  pipelineStatus: PipelineStatus | null;
  /** Final pipeline result (available after completion). */
  result: PipelineResult | null;
  /** Current upload stage. */
  stage: UploadStage;
  /** Error message if pipeline threw. */
  errorMessage: string | null;
  /** Pending duplicate info — set when pipeline is paused awaiting decision. */
  pendingDuplicate: PendingDuplicate | null;
  /** Resolve the pending duplicate decision and resume pipeline. */
  resolveDuplicate: (decision: DuplicateDecision, applyToAll: boolean) => void;
  /** Reset hook state for a new upload. */
  reset: () => void;
}

export interface StartUploadParams {
  images: ImagePickerAsset[];
  video: ImagePickerAsset | null;
  albums: GalleryAlbum[];
  tags: PickerItem[];
  project: PickerItem | null;
  watermarkDrafts: Record<string, WatermarkDraft> | null;
}

export interface PendingDuplicate {
  info: DuplicateInfo;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

const INITIAL_STATUS: PipelineStatus = {
  progress: 0,
  completedCount: 0,
  failedCount: 0,
  totalCount: 0,
  items: [],
};

/**
 * React hook that wraps the UploadPipeline orchestrator.
 * Manages pipeline lifecycle, duplicate detection flow, and result handling.
 *
 * Mirrors the upload logic from Flutter's `_upload()` in `gallery_upload_page.dart`.
 */
export function useUploadPipeline(): UseUploadPipelineReturn {
  const [pipelineStatus, setPipelineStatus] = useState<PipelineStatus | null>(null);
  const [result, setResult] = useState<PipelineResult | null>(null);
  const [stage, setStage] = useState<UploadStage>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [pendingDuplicate, setPendingDuplicate] = useState<PendingDuplicate | null>(null);

  // Ref to hold the resolve function for the duplicate decision promise
  const duplicateResolveRef = useRef<
    ((value: { decision: DuplicateDecision; applyToAll: boolean }) => void) | null
  >(null);

  // Track mounted state to avoid state updates after unmount
  const mountedRef = useRef(true);
  // Set on first render; useEffect cleanup handles unmount
  // (Caller should use this hook at the top level of a component that persists
  // for the entire upload lifecycle)

  // Pre-resolve the bundled watermark logo to a local file URI
  const logoUriRef = useRef<string | undefined>(undefined);
  useEffect(() => {
    const asset = Asset.fromModule(LOGO_MODULE);
    asset.downloadAsync().then(() => {
      logoUriRef.current = asset.localUri ?? undefined;
    }).catch(() => {
      // Non-fatal — watermark will be skipped if logo isn't available
    });
  }, []);

  const startUpload = useCallback((params: StartUploadParams) => {
    const {
      images,
      video,
      albums,
      tags,
      project,
      watermarkDrafts,
    } = params;

    setStage('processing');
    setPipelineStatus(INITIAL_STATUS);
    setResult(null);
    setErrorMessage(null);
    setPendingDuplicate(null);

    const albumIds = albums.map((a) => a.id);
    const tagIds = tags.length > 0 ? tags.map((t) => t.id) : undefined;
    const projectId = project?.id;

    const onDuplicateFound: DuplicateDecisionCallback = (info) => {
      return new Promise<{ decision: DuplicateDecision; applyToAll: boolean }>((resolve) => {
        duplicateResolveRef.current = resolve;
        setPendingDuplicate({ info });
      });
    };

    const pipeline = new UploadPipeline({
      images,
      video,
      albumIds,
      tagIds,
      projectId,
      watermarkDrafts,
      logoUri: logoUriRef.current,
      onStatusChanged: (status) => {
        setPipelineStatus(status);
      },
      onDuplicateFound,
    });

    pipeline
      .run()
      .then((pipelineResult) => {
        playSuccessSound();
        setResult(pipelineResult);

        if (pipelineResult.successCount > 0) {
          setStage('done');
        } else if (pipelineResult.failedCount > 0) {
          setStage('error');
          setErrorMessage('Upload failed');
        } else {
          // All skipped or oversized
          setStage('done');
        }
      })
      .catch(() => {
        // No success sound on error — it only plays on completion
        setStage('error');
        // Never expose raw error.message — it may contain server internals or stack traces
        setErrorMessage('Upload failed');
      });
  }, []);

  const resolveDuplicate = useCallback(
    (decision: DuplicateDecision, applyToAll: boolean) => {
      if (duplicateResolveRef.current) {
        duplicateResolveRef.current({ decision, applyToAll });
        duplicateResolveRef.current = null;
      }
      setPendingDuplicate(null);
    },
    [],
  );

  const reset = useCallback(() => {
    setPipelineStatus(null);
    setResult(null);
    setStage('idle');
    setErrorMessage(null);
    setPendingDuplicate(null);
    duplicateResolveRef.current = null;
  }, []);

  return {
    startUpload,
    pipelineStatus,
    result,
    stage,
    errorMessage,
    pendingDuplicate,
    resolveDuplicate,
    reset,
  };
}
