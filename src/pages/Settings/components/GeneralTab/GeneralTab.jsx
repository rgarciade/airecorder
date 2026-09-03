import React from 'react';
import StorageSection from './StorageSection';
import TranscriptionSection from './TranscriptionSection';
import ModelsSection from './ModelsSection';
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
      {/* "Modelos y descargas" (issue #149): gestiona inventario/descargas de
          modelos Whisper vía IPC `resources:*`. Sección DISTINTA del <select>
          de TranscriptionSection (que elige el modelo por defecto para nuevas
          transcripciones): esta sección administra qué modelos existen en
          disco, no cuál se usa. El filtrado de ese <select> a "solo
          instalados + CTA" (INV6) es tarea de PR4, no de esta sección. */}
      <ModelsSection />
      <AppearanceSection />
      <ProjectsSection />
      <AudioSection />
      <SystemSection />
      <PermissionsSection />
      <AboutSection />
    </>
  );
}
