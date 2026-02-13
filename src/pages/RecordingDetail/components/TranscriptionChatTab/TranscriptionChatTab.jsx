import React, { useState, useRef, useEffect } from 'react';
import styles from './TranscriptionChatTab.module.css';
import TranscriptionViewer from '../../../../components/TranscriptionViewer/TranscriptionViewer';
import ChatInterface from '../../../../components/ChatInterface/ChatInterface';
import { MdSearch, MdKeyboardArrowUp, MdKeyboardArrowDown, MdClose } from 'react-icons/md';

export default function TranscriptionChatTab({ 
  transcription, 
  transcriptionLoading, 
  transcriptionError,
  chatProps 
}) {
  const [chatWidth, setChatWidth] = useState(350);
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef(null);

  // Search State
  const [searchTerm, setSearchTerm] = useState('');
  const [currentMatchIndex, setCurrentMatchIndex] = useState(0);
  const [totalMatches, setTotalMatches] = useState(0);

  const startResizing = (e) => {
    setIsDragging(true);
    e.preventDefault(); // Prevent text selection
  };

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!isDragging) return;
      if (!containerRef.current) return;

      const containerRect = containerRef.current.getBoundingClientRect();
      const newWidth = containerRect.right - e.clientX;

      if (newWidth < 300) return;
      if (newWidth > containerRect.width - 400) return;
      if (newWidth > 800) return;

      setChatWidth(newWidth);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging]);

  const handleSearchChange = (e) => {
    setSearchTerm(e.target.value);
    setCurrentMatchIndex(0);
  };

  const handleNextMatch = () => {
    if (totalMatches === 0) return;
    setCurrentMatchIndex((prev) => (prev + 1) % totalMatches);
  };

  const handlePrevMatch = () => {
    if (totalMatches === 0) return;
    setCurrentMatchIndex((prev) => (prev - 1 + totalMatches) % totalMatches);
  };

  const handleClearSearch = () => {
    setSearchTerm('');
    setCurrentMatchIndex(0);
  };

  return (
    <div className={styles.container} ref={containerRef}>
      <div className={styles.transcriptionColumn}>
        <div className={styles.transcriptionHeader}>
          <div className={styles.searchContainer}>
            <MdSearch className={styles.searchIcon} size={20} />
            <input 
              type="text" 
              className={styles.searchInput} 
              placeholder="Search transcript..." 
              value={searchTerm}
              onChange={handleSearchChange}
            />
            {searchTerm && (
              <div className={styles.searchControls}>
                <span className={styles.matchCount}>
                  {totalMatches > 0 ? `${currentMatchIndex + 1} of ${totalMatches}` : '0 results'}
                </span>
                <button onClick={handlePrevMatch} disabled={totalMatches === 0} className={styles.navBtn}>
                  <MdKeyboardArrowUp size={16} />
                </button>
                <button onClick={handleNextMatch} disabled={totalMatches === 0} className={styles.navBtn}>
                  <MdKeyboardArrowDown size={16} />
                </button>
                <button onClick={handleClearSearch} className={styles.navBtn}>
                  <MdClose size={14} />
                </button>
              </div>
            )}
          </div>
          <div className={styles.filters}>
            <button className={`${styles.filterChip} ${styles.activeFilter}`}>Transcript</button>
            <button className={`${styles.filterChip} ${styles.inactiveFilter}`}>Highlights</button>
          </div>
        </div>
        <TranscriptionViewer 
          transcription={transcription} 
          loading={transcriptionLoading} 
          error={transcriptionError} 
          searchTerm={searchTerm}
          currentMatchIndex={currentMatchIndex}
          onMatchesFound={setTotalMatches}
        />
      </div>
      
      {/* Resizer Handle */}
      <div 
        className={`${styles.resizer} ${isDragging ? styles.resizing : ''}`}
        onMouseDown={startResizing}
      />

      <div 
        className={styles.chatColumn} 
        style={{ width: `${chatWidth}px` }}
      >
        <ChatInterface {...chatProps} />
      </div>
    </div>
  );
}
