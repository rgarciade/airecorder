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
      language: '',
      microphone: ''
    };
  } catch (error) {
    console.error('Error getting settings:', error);
    throw error;
  }
};

export const updateSettings = async (settings) => {
  try {
    return await saveSettings(settings);
  } catch (error) {
    console.error('Error updating settings:', error);
    throw error;
  }
}; 