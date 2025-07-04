export async function getSystemMicrophones() {
  try {
    // Obtener la lista de dispositivos de audio
    const devices = await navigator.mediaDevices.enumerateDevices();
    
    // Filtrar solo los dispositivos de entrada de audio (micrófonos)
    const microphones = devices
      .filter(device => device.kind === 'audioinput')
      .map(device => ({
        value: device.deviceId,
        label: device.label || `Micrófono ${device.deviceId.slice(0, 5)}...`
      }));

    return microphones;
  } catch (error) {
    console.error('Error al obtener los micrófonos:', error);
    return [];
  }
} 