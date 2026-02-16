import React, { useState, useMemo } from 'react';
import styles from './RecentUploadsTable.module.css';
import { MdFolderOpen, MdMoreVert, MdAddCircleOutline, MdSearch, MdOutlineDoNotDisturbOn } from 'react-icons/md';

export default function RecentUploadsTable({ recordings = [], projects = [], onAddToProject, onRemoveFromProject }) {
  const [showMenuId, setShowMenuId] = useState(null);
  const [projectSearch, setProjectSearch] = useState('');

  const filteredProjects = useMemo(() => {
    if (!projectSearch.trim()) return projects;
    return projects.filter(p => 
      p.name.toLowerCase().includes(projectSearch.toLowerCase())
    );
  }, [projects, projectSearch]);

  const handleOpenMenu = (id) => {
    setShowMenuId(showMenuId === id ? null : id);
    setProjectSearch(''); // Reset search when opening/closing
  };

  return (
    <div className={styles.container}>
      <div className={styles.tableWrapper}>
        <table className={styles.table}>
          <thead className={styles.header}>
            <tr>
              <th className={styles.headerCell}>Name</th>
              <th className={styles.headerCell}>Project</th>
              <th className={styles.headerCell}>Duration</th>
              <th className={styles.headerCell}>Status</th>
              <th className={styles.headerCell}>Date</th>
              <th className={styles.headerCell}></th>
            </tr>
          </thead>
          <tbody>
            {recordings.map((rec) => {
              const durationStr = rec.duration 
                ? `${Math.floor(rec.duration/60).toString().padStart(2,'0')}:${Math.floor(rec.duration%60).toString().padStart(2,'0')}`
                : '--:--';
              
              const isTranscribed = rec.hasTranscription || false;
              const status = rec.status || (isTranscribed ? 'transcribed' : 'recorded');

              let badgeClass = styles.badgeRecorded;
              let dotClass = styles.dotRecorded;
              let statusText = 'Recorded';

              if (status === 'analyzed') {
                badgeClass = styles.badgeAnalyzed;
                dotClass = styles.dotAnalyzed;
                statusText = 'Analyzed';
              } else if (status === 'transcribed') {
                badgeClass = styles.badgeTranscribed;
                dotClass = styles.dotTranscribed;
                statusText = 'Transcribed';
              } else if (status === 'processing') {
                badgeClass = styles.badgeProcessing;
                dotClass = styles.dotProcessing;
                statusText = 'Processing';
              }

              return (
                <tr key={rec.id} className={`${styles.row} ${showMenuId === rec.id ? styles.activeRow : ''}`}>
                  <td className={styles.cell}>
                    <div className={styles.cellName}>
                      <div className={styles.iconWrapper}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M9 18V5l12-2v13" strokeLinecap="round" strokeLinejoin="round"/>
                          <circle cx="6" cy="18" r="3" strokeLinecap="round" strokeLinejoin="round"/>
                          <circle cx="18" cy="16" r="3" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      </div>
                      <span>{rec.name}</span>
                    </div>
                  </td>
                  <td className={styles.cell}>
                    {rec.project ? (
                      <div className={styles.projectCell}>
                        <MdFolderOpen size={16} className={styles.projectIcon} />
                        <span className={styles.projectName}>{rec.project.name}</span>
                      </div>
                    ) : (
                      <span className={styles.noProject}>No project</span>
                    )}
                  </td>
                  <td className={styles.cell}>
                    <span className={styles.durationText}>{durationStr}</span>
                  </td>
                  <td className={styles.cell}>
                    <span className={`${styles.badge} ${badgeClass}`}>
                      <span className={`${styles.dot} ${dotClass}`}></span>
                      {statusText}
                    </span>
                  </td>
                  <td className={styles.cell}>
                    <span className={styles.dateText}>
                      {new Date(rec.createdAt || rec.date).toLocaleDateString()}
                    </span>
                  </td>
                  <td className={styles.cell}>
                    <div className="relative">
                      <button 
                        className={styles.actionBtn}
                        onClick={() => handleOpenMenu(rec.id)}
                      >
                        <MdMoreVert size={20} />
                      </button>
                      
                      {showMenuId === rec.id && (
                        <>
                          <div 
                            className="fixed inset-0 z-10" 
                            onClick={() => setShowMenuId(null)}
                          ></div>
                          <div className={styles.menu}>
                            <div className={styles.menuHeader}>
                              Add to Project
                            </div>
                            
                            <div className={styles.menuSearch}>
                              <MdSearch size={16} className={styles.searchIcon} />
                              <input 
                                type="text"
                                placeholder="Search project..."
                                value={projectSearch}
                                onChange={(e) => setProjectSearch(e.target.value)}
                                className={styles.searchInput}
                                autoFocus
                                onClick={(e) => e.stopPropagation()}
                              />
                            </div>

                            <div className={styles.menuList}>
                              {filteredProjects.slice(0, 3).map(project => (
                                <button
                                  key={project.id}
                                  className={`${styles.menuItem} ${rec.project?.id === project.id ? styles.menuItemActive : ''}`}
                                  onClick={() => {
                                    onAddToProject(rec, project);
                                    setShowMenuId(null);
                                  }}
                                >
                                  <MdAddCircleOutline size={14} />
                                  <span className="truncate">{project.name}</span>
                                </button>
                              ))}

                              {filteredProjects.length > 3 && (
                                <div className={styles.menuMoreIndicator}>
                                  Use search to see more projects...
                                </div>
                              )}
                              
                              {rec.project && (
                                <div className={styles.menuDivider}></div>
                              )}
                              
                              {rec.project && (
                                <button
                                  className={`${styles.menuItem} ${styles.unassignBtn}`}
                                  onClick={() => {
                                    onRemoveFromProject(rec);
                                    setShowMenuId(null);
                                  }}
                                >
                                  <MdOutlineDoNotDisturbOn size={14} />
                                  <span>Unassign from Project</span>
                                </button>
                              )}

                              {filteredProjects.length === 0 && !rec.project && (
                                <div className={styles.menuEmpty}>
                                  No matches found
                                </div>
                              )}
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
            {recordings.length === 0 && (
              <tr>
                <td colSpan="6" className={styles.cell} style={{textAlign: 'center', padding: '32px'}}>
                  No recent uploads found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
