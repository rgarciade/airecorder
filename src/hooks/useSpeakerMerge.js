import { useEffect, useMemo, useState } from 'react';
import speakersService from '../services/speakersService';

export default function useSpeakerMerge({
  speakers,
  loadSpeakers,
  setCurrentPage,
  t
}) {
  const [mergeModalOpen, setMergeModalOpen] = useState(false);
  const [mergeSourceId, setMergeSourceId] = useState(null);
  const [mergeTargetId, setMergeTargetId] = useState(null);
  const [mergeInProgress, setMergeInProgress] = useState(false);
  const [mergeModalError, setMergeModalError] = useState(null);
  const [mergeStatus, setMergeStatus] = useState(null); // { success, message }
  const [preview, setPreview] = useState(null);

  const mergeSourceSpeaker = useMemo(
    () => speakers.find((speaker) => speaker.id === mergeSourceId),
    [speakers, mergeSourceId]
  );

  const mergeTargetSpeaker = useMemo(
    () => speakers.find((speaker) => speaker.id === mergeTargetId),
    [speakers, mergeTargetId]
  );

  const canMerge = Boolean(mergeSourceId && mergeTargetId && mergeSourceId !== mergeTargetId);

  useEffect(() => {
    if (!mergeStatus) return undefined;
    const timer = setTimeout(() => setMergeStatus(null), 4000);
    return () => clearTimeout(timer);
  }, [mergeStatus]);

  useEffect(() => {
    let isCancelled = false;

    async function loadPreview() {
      if (!canMerge) {
        setPreview(null);
        return;
      }

      const result = await speakersService.previewMergeSpeakers(mergeSourceId, mergeTargetId);
      if (isCancelled) return;

      if (result?.success) {
        setPreview(result.data || null);
        setMergeModalError(null);
      } else {
        setPreview(null);
        setMergeModalError(t('speakers.mergeError', { error: result?.error || 'Error desconocido' }));
      }
    }

    loadPreview();
    return () => {
      isCancelled = true;
    };
  }, [canMerge, mergeSourceId, mergeTargetId, t]);

  const handleOpenMergeModal = () => {
    setMergeSourceId(null);
    setMergeTargetId(null);
    setMergeModalError(null);
    setPreview(null);
    setMergeModalOpen(true);
  };

  const handleCloseMergeModal = () => {
    if (mergeInProgress) return;
    setMergeModalOpen(false);
    setMergeModalError(null);
    setPreview(null);
  };

  const handleMerge = async () => {
    if (!mergeSourceId || !mergeTargetId) {
      setMergeModalError(t('speakers.selectBothError'));
      return;
    }
    if (mergeSourceId === mergeTargetId) {
      setMergeModalError(t('speakers.sameSpeakerError'));
      return;
    }

    setMergeInProgress(true);
    setMergeModalError(null);

    const fallbackSourceName = mergeSourceSpeaker?.displayName || mergeSourceId;
    const fallbackTargetName = mergeTargetSpeaker?.displayName || mergeTargetId;

    const finalSourceId = preview?.finalSourceId || mergeSourceId;
    const finalTargetId = preview?.finalTargetId || mergeTargetId;
    const finalSourceSpeaker = speakers.find((speaker) => speaker.id === finalSourceId);
    const finalTargetSpeaker = speakers.find((speaker) => speaker.id === finalTargetId);

    const sourceName = finalSourceSpeaker?.displayName || fallbackSourceName;
    const targetName = finalTargetSpeaker?.displayName || fallbackTargetName;

    const result = await speakersService.mergeSimilarSpeaker(finalTargetId, finalSourceId);

    setMergeInProgress(false);

    if (result.success) {
      setMergeModalOpen(false);
      setPreview(null);
      setMergeStatus({
        success: true,
        message: t('speakers.mergeSuccess', { source: sourceName, target: result.mergedName || targetName })
      });
      setCurrentPage(1);
      await loadSpeakers();
    } else {
      setMergeModalError(t('speakers.mergeError', { error: result.error || 'Error desconocido' }));
    }
  };

  return {
    mergeModalOpen,
    mergeSourceId,
    setMergeSourceId,
    mergeTargetId,
    setMergeTargetId,
    mergeInProgress,
    mergeModalError,
    mergeStatus,
    preview,
    mergeSourceSpeaker,
    mergeTargetSpeaker,
    canMerge,
    handleOpenMergeModal,
    handleCloseMergeModal,
    handleMerge,
    clearMergeModalError: () => setMergeModalError(null)
  };
}
