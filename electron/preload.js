const { contextBridge } = require('electron');

contextBridge.exposeInMainWorld('electron', {
  // Aquí expondremos funciones seguras para el frontend
}); 