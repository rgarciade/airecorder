export const saveSettings = async (settings) => {
  try {
    const result = await window.electronAPI.saveSettings(settings);
    if (!result.success) {
      throw new Error(result.error);
    }
    return result;
  } catch (error) {
    console.error('Error saving settings:', error);
    throw error;
  }
};

export const getSettings = async () => {
  try {
    const result = await window.electronAPI.loadSettings();
    if (!result.success) {
      throw new Error(result.error);
    }
    return result.settings || {
      isFirstRun: true, // Por defecto true para nuevos usuarios
      notificationsEnabled: true,
      language: 'es',
      microphone: '',
      geminiApiKey: '',
      aiProvider: 'gemini', // 'gemini' | 'ollama'
      ollamaModel: '',
      ollamaHost: 'http://localhost:11434'
    };
  } catch (error) {
    console.error('Error getting settings:', error);
    throw error;
  }
};

export const updateSettings = async (newSettings) => {
  try {
    // Obtener configuración actual para preservar valores existentes
    const currentSettings = await getSettings();
    
    // Combinar configuración actual con los nuevos valores
    const updatedSettings = {
      ...currentSettings,
      ...newSettings
    };
    
    console.log('Actualizando settings:', { currentSettings, newSettings, updatedSettings }); // Debug
    
    return await saveSettings(updatedSettings);
  } catch (error) {
    console.error('Error updating settings:', error);
    throw error;
  }
}; 