import React, { useState, useCallback } from 'react';
import { Alert } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useTranslation } from 'react-i18next';
import { GalleryAlbum, PickerItem, MAX_IMAGES } from '../types';
import {
  fetchAlbums,
  fetchTags,
  createTag,
  createAlbum,
  fetchProjects,
  createProject,
} from '../services/galleryService';
import { useUploadForm } from '../hooks/useUploadForm';
import { useUploadPipeline } from '../hooks/useUploadPipeline';
import { UploadScreen } from './UploadScreen';
import { SearchablePickerSheet } from './SearchablePickerSheet';
import { DuplicateSheet } from './DuplicateSheet';
import { UploadProgressCard } from './UploadProgressCard';

/**
 * Container that wires the UploadScreen UI with:
 * - useUploadForm hook (state management)
 * - useUploadPipeline hook (upload pipeline orchestrator)
 * - expo-image-picker (media selection)
 * - SearchablePickerSheet (album, tag, project pickers)
 * - DuplicateSheet (duplicate detection during upload)
 * - UploadProgressCard (pipeline progress display)
 *
 * This is the component that GalleryShell renders for the Upload tab.
 */
export function UploadTabContainer() {
  const { t, i18n } = useTranslation();
  const form = useUploadForm();
  const pipeline = useUploadPipeline();
  const locale = (i18n.language === 'ar' ? 'ar' : 'en') as 'ar' | 'en';

  // Note: keep-awake is handled by the UploadPipeline class itself

  // Picker sheet visibility
  const [albumPickerVisible, setAlbumPickerVisible] = useState(false);
  const [tagPickerVisible, setTagPickerVisible] = useState(false);
  const [projectPickerVisible, setProjectPickerVisible] = useState(false);

  // Video loading state
  const [isLoadingVideo, setIsLoadingVideo] = useState(false);

  // Use pipeline stage to determine lock state (overrides form stage)
  const effectiveStage = pipeline.stage !== 'idle' ? pipeline.stage : form.state.stage;
  const isLocked =
    effectiveStage === 'processing' ||
    effectiveStage === 'done' ||
    effectiveStage === 'error';

  const pipelineFinished = pipeline.stage === 'done' || pipeline.stage === 'error';

  // --- Media picking ---

  const handlePickImages = useCallback(async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      selectionLimit: MAX_IMAGES - form.state.images.length,
      quality: 1,
    });

    if (result.canceled || result.assets.length === 0) return;

    const added = form.addImages(result.assets);
    if (added < result.assets.length) {
      Alert.alert('', t('galleryMaxImagesReached', { max: MAX_IMAGES }));
    }
  }, [form, t]);

  const handlePickVideo = useCallback(async () => {
    setIsLoadingVideo(true);
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['videos'],
        allowsMultipleSelection: false,
        quality: 1,
      });

      if (result.canceled || result.assets.length === 0) return;
      form.setVideo(result.assets[0]);
    } finally {
      setIsLoadingVideo(false);
    }
  }, [form]);

  const handleRemoveImage = useCallback(
    (index: number) => form.removeImage(index),
    [form],
  );

  const handleRemoveVideo = useCallback(() => form.setVideo(null), [form]);

  const handleRemoveAllImages = useCallback(() => {
    const count = form.state.images.length;
    for (let i = count - 1; i >= 0; i--) {
      form.removeImage(i);
    }
  }, [form]);

  // --- Album search for picker ---

  const searchAlbums = useCallback(
    async (query: string): Promise<GalleryAlbum[]> => {
      const result = await fetchAlbums({ search: query });
      return result.albums;
    },
    [],
  );

  const handleCreateAlbum = useCallback(
    async (name: string): Promise<GalleryAlbum | null> => {
      try {
        return await createAlbum(name, locale);
      } catch {
        return null;
      }
    },
    [locale],
  );

  // --- Tag search for picker ---

  const searchTags = useCallback(
    async (query: string): Promise<PickerItem[]> => {
      return fetchTags(query);
    },
    [],
  );

  const handleCreateTag = useCallback(
    async (name: string): Promise<PickerItem | null> => {
      return createTag(name, locale);
    },
    [locale],
  );

  // --- Project search for picker ---

  const searchProjects = useCallback(
    async (query: string): Promise<PickerItem[]> => {
      return fetchProjects(query);
    },
    [],
  );

  const handleCreateProject = useCallback(
    async (name: string): Promise<PickerItem | null> => {
      return createProject(name);
    },
    [],
  );

  // --- Upload pipeline ---

  const handleUpload = useCallback(() => {
    if (!form.canUpload) return;

    pipeline.startUpload({
      images: form.state.images,
      video: form.state.video,
      albums: form.state.albums,
      tags: form.state.tags,
      project: form.state.project,
      watermarkDrafts: form.state.watermarkDrafts,
    });

    form.setStage('processing');
  }, [form, pipeline]);

  // --- Duplicate resolution ---

  const handleDuplicateResult = useCallback(
    (result: { action: 'addToAlbums' | 'skip'; applyToAll: boolean }) => {
      pipeline.resolveDuplicate(result.action, result.applyToAll);
    },
    [pipeline],
  );

  // --- Reset after completion ---

  const handleReset = useCallback(() => {
    pipeline.reset();
    form.reset();
  }, [pipeline, form]);

  // --- Pipeline progress content (injected into UploadScreen) ---

  const pipelineContent =
    pipeline.pipelineStatus && pipeline.stage !== 'idle' ? (
      <UploadProgressCard
        status={pipeline.pipelineStatus}
        result={pipeline.result}
        errorMessage={pipeline.errorMessage}
      />
    ) : null;

  return (
    <>
      <UploadScreen
        images={form.state.images}
        video={form.state.video}
        isLoadingVideo={isLoadingVideo}
        selectedAlbums={form.state.albums}
        selectedTags={form.state.tags}
        selectedProject={form.state.project}
        isLocked={isLocked}
        canUpload={form.canUpload}
        onPickImages={handlePickImages}
        onPickVideo={handlePickVideo}
        onRemoveImage={handleRemoveImage}
        onRemoveVideo={handleRemoveVideo}
        onRemoveAllImages={handleRemoveAllImages}
        onOpenAlbumPicker={() => setAlbumPickerVisible(true)}
        onOpenTagPicker={() => setTagPickerVisible(true)}
        onOpenProjectPicker={() => setProjectPickerVisible(true)}
        onAlbumsChange={form.setAlbums}
        onTagsChange={form.setTags}
        onProjectChange={form.setProject}
        onUpload={pipelineFinished ? handleReset : handleUpload}
        uploadButtonTitle={pipelineFinished ? t('galleryUploadNewUpload') : undefined}
        showButtonWhenLocked={pipelineFinished}
        pipelineContent={pipelineContent}
      />

      {/* Album Picker Sheet */}
      <SearchablePickerSheet<GalleryAlbum>
        visible={albumPickerVisible}
        onClose={() => setAlbumPickerVisible(false)}
        title={t('galleryAlbums')}
        multiSelect
        onMultiSelectionChanged={form.setAlbums}
        onSearch={searchAlbums}
        displayString={(a) => a.title}
        itemId={(a) => a.id}
        initialSelection={form.state.albums}
        allowCreate
        onCreate={handleCreateAlbum}
        createLabel={t('galleryCreateAlbum')}
        searchHint={t('gallerySearchAlbumsHint')}
        emptyLabel={t('galleryNoAlbumsFound')}
        persistentCreateLabel={t('galleryNew')}
      />

      {/* Tag Picker Sheet */}
      <SearchablePickerSheet<PickerItem>
        visible={tagPickerVisible}
        onClose={() => setTagPickerVisible(false)}
        title={t('galleryTags')}
        multiSelect
        onMultiSelectionChanged={form.setTags}
        onSearch={searchTags}
        displayString={(tag) => tag.name}
        itemId={(tag) => tag.id}
        initialSelection={form.state.tags}
        allowCreate
        onCreate={handleCreateTag}
        createLabel={t('galleryCreateTag')}
        searchHint={t('gallerySearchTagsHint')}
        emptyLabel={t('galleryNoTagsFound')}
        persistentCreateLabel={t('galleryNew')}
      />

      {/* Project Picker Sheet */}
      <SearchablePickerSheet<PickerItem>
        visible={projectPickerVisible}
        onClose={() => setProjectPickerVisible(false)}
        title={t('project')}
        multiSelect={false}
        onSingleSelect={(project) => {
          form.setProject(project);
          setProjectPickerVisible(false);
        }}
        onSearch={searchProjects}
        displayString={(p) => p.name}
        itemId={(p) => p.id}
        initialSelection={form.state.project ? [form.state.project] : []}
        allowCreate
        onCreate={handleCreateProject}
        createLabel={t('galleryCreateProject')}
        searchHint={t('gallerySearchProjectsHint')}
        emptyLabel={t('galleryNoProjectsFound')}
        persistentCreateLabel={t('galleryNew')}
      />

      {/* Duplicate Sheet — shown when pipeline pauses for duplicate decision */}
      {pipeline.pendingDuplicate && (
        <DuplicateSheet
          visible={!!pipeline.pendingDuplicate}
          info={pipeline.pendingDuplicate.info}
          onResult={handleDuplicateResult}
        />
      )}
    </>
  );
}
