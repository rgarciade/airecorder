import { useEffect, useMemo, useState } from 'react';

const DEFAULT_ITEMS_PER_PAGE = 10;

function sortByCreatedAtDesc(list) {
  return [...list].sort((a, b) => {
    const dateA = new Date(a.createdAt || 0);
    const dateB = new Date(b.createdAt || 0);
    return dateB - dateA;
  });
}

export default function useSpeakerList({ speakers = [], itemsPerPage = DEFAULT_ITEMS_PER_PAGE } = {}) {
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [embeddingFilter, setEmbeddingFilter] = useState('all'); // 'all' | 'with-embeddings' | 'no-embeddings'

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, embeddingFilter]);

  const withEmbeddingsCount = useMemo(
    () => speakers.filter((speaker) => (speaker.embeddingsCount || 0) > 0).length,
    [speakers]
  );

  const noEmbeddingsCount = useMemo(
    () => speakers.filter((speaker) => (speaker.embeddingsCount || 0) === 0).length,
    [speakers]
  );

  const filteredSpeakers = useMemo(() => {
    const normalizedSearch = searchTerm.toLowerCase();
    return sortByCreatedAtDesc(speakers).filter((speaker) => {
      const matchesSearch = (speaker.displayName || '').toLowerCase().includes(normalizedSearch);
      if (!matchesSearch) return false;

      const hasEmbeddings = (speaker.embeddingsCount || 0) > 0;
      if (embeddingFilter === 'with-embeddings' && !hasEmbeddings) return false;
      if (embeddingFilter === 'no-embeddings' && hasEmbeddings) return false;
      return true;
    });
  }, [speakers, searchTerm, embeddingFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredSpeakers.length / itemsPerPage));
  const safePage = Math.min(currentPage, totalPages);

  const paginatedSpeakers = useMemo(
    () => filteredSpeakers.slice((safePage - 1) * itemsPerPage, safePage * itemsPerPage),
    [filteredSpeakers, safePage, itemsPerPage]
  );

  const mergeSpeakers = useMemo(() => sortByCreatedAtDesc(speakers), [speakers]);

  return {
    searchTerm,
    setSearchTerm,
    currentPage,
    setCurrentPage,
    embeddingFilter,
    setEmbeddingFilter,
    filteredSpeakers,
    totalPages,
    safePage,
    paginatedSpeakers,
    mergeSpeakers,
    withEmbeddingsCount,
    noEmbeddingsCount
  };
}
