const listeners = new Set();

const notifyListeners = (settings) => {
  listeners.forEach(listener => listener(settings));
};

export const addSettingsListener = (listener) => {
  listeners.add(listener);
  // Opcional: devolver una función para desuscribirse
  return () => listeners.delete(listener);
};

export const removeSettingsListener = (listener) => {
  listeners.delete(listener);
};

export const saveSettings = async (settings) => {
  try {
    const result = await window.electronAPI.saveSettings(settings);
    if (!result.success) {
      throw new Error(result.error);
    }
    notifyListeners(settings); // Notificar a los listeners después de guardar
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
      // Gemini Pro
      geminiApiKey: '',
      geminiModel: 'gemini-2.0-flash',
      // Gemini Free
      geminiFreeApiKey: '',
      // DeepSeek
      deepseekApiKey: '',
      deepseekModel: 'deepseek-chat',
      // Kimi
      kimiApiKey: '',
      kimiModel: 'kimi-k2',
      // Ollama
      ollamaModel: '',
      ollamaHost: 'http://localhost:11434',
      ollamaModelSupportsStreaming: false,
      // LM Studio
      lmStudioModel: '',
      lmStudioHost: 'http://localhost:1234/v1',
      aiProvider: 'ollama' // Cambiado a ollama por defecto según petición
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
    
    const result = await saveSettings(updatedSettings);
    notifyListeners(updatedSettings); // También notificar aquí para asegurar que se propaga
    return result;
  } catch (error) {
    console.error('Error updating settings:', error);
    throw error;
  }
}; 