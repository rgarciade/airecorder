import React from 'react';
import StorageSection from './StorageSection';
import TranscriptionSection from './TranscriptionSection';
import AppearanceSection from './AppearanceSection';
import ProjectsSection from './ProjectsSection';
import AudioSection from './AudioSection';
import SystemSection from './SystemSection';
import PermissionsSection from './PermissionsSection';
import AboutSection from './AboutSection';

export default function GeneralTab() {
  return (
    <>
      <StorageSection />
      <TranscriptionSection />
      <AppearanceSection />
      <ProjectsSection />
      <AudioSection />
      <SystemSection />
      <PermissionsSection />
      <AboutSection />
    </>
  );
}
