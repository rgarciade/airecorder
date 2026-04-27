import React from 'react';
import LocalProvidersSection from './LocalProvidersSection';
import CloudProvidersSection from './CloudProvidersSection';

export default function AgentsTab() {
  return (
    <>
      <LocalProvidersSection />
      <CloudProvidersSection />
    </>
  );
}
