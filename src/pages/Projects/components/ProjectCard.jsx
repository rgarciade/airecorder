import React, { useState } from 'react';
import styles from './ProjectCard.module.css';
import { MdEdit, MdDeleteOutline } from 'react-icons/md';

export default function ProjectCard({ project, onClick, onEdit, onDelete, recordingCount = 0 }) {
  const [showDropdown, setShowDropdown] = useState(false);

  const handleOptionsClick = (e) => {
    e.stopPropagation();
    setShowDropdown(!showDropdown);
  };

  const handleEdit = (e) => {
    e.stopPropagation();
    setShowDropdown(false);
    if (onEdit) onEdit(project);
  };

  const handleDelete = (e) => {
    e.stopPropagation();
    setShowDropdown(false);
    if (onDelete) onDelete(project);
  };

  return (
    <div className={styles.card} onClick={() => onClick(project)}>
      <div className={styles.cardContent}>
        <div className={styles.header}>
          <div className={styles.icon}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <div className={styles.optionsWrapper}>
            <button className={styles.optionsBtn} onClick={handleOptionsClick}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="1"></circle>
                <circle cx="12" cy="5" r="1"></circle>
                <circle cx="12" cy="19" r="1"></circle>
              </svg>
            </button>
            
            {showDropdown && (
              <>
                <div className="fixed inset-0 z-0" onClick={() => setShowDropdown(false)}></div>
                <div className={styles.dropdown}>
                  <button className={styles.dropdownItem} onClick={handleEdit}>
                    <MdEdit size={16} />
                    Edit Details
                  </button>
                  <button className={`${styles.dropdownItem} ${styles.deleteItem}`} onClick={handleDelete}>
                    <MdDeleteOutline size={16} />
                    Delete Project
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
        
        <h3 className={styles.title}>{project.name}</h3>
        <p className={styles.description}>
          {project.description || "No description provided."}
        </p>
      </div>
      
      <div className={styles.footer}>
        <div className={styles.recordingsCount}>
          <span className={`${styles.statusDot} ${project.is_updated === 0 ? styles.needsUpdate : ''}`}></span>
          <span className={styles.statusText}>{recordingCount} Recordings</span>
        </div>
        <span className={styles.date}>
          {project.updatedAt ? new Date(project.updatedAt).toLocaleDateString() : 'Just now'}
        </span>
      </div>
    </div>
  );
}
