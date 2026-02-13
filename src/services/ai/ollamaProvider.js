// Servicio para interactuar con Ollama local

const OLLAMA_BASE_URL = 'http://localhost:11434';

/**
 * Obtiene la lista de modelos disponibles en Ollama
 * @returns {Promise<Array>} Lista de modelos
 */
export async function getAvailableModels() {
  try {
    const response = await fetch(`${OLLAMA_BASE_URL}/api/tags`);
    
    if (!response.ok) {
      throw new Error(`Error al obtener modelos de Ollama: ${response.status}`);
    }
    
    const data = await response.json();
    return data.models || [];
  } catch (error) {
    console.error('Error obteniendo modelos de Ollama:', error);
    // Si Ollama no está disponible, devolver array vacío
    if (error.message.includes('fetch')) {
      throw new Error('Ollama no está disponible. Asegúrate de que esté corriendo en http://localhost:11434');
    }
    throw error;
  }
}

/**
 * Verifica si Ollama está disponible
 * @returns {Promise<boolean>} true si Ollama está disponible
 */
export async function checkOllamaAvailability() {
  try {
    const response = await fetch(`${OLLAMA_BASE_URL}/api/tags`);
    return response.ok;
  } catch (error) {
    return false;
  }
}

/**
 * Genera contenido usando un modelo de Ollama
 * @param {string} model - Nombre del modelo a usar
 * @param {string} prompt - Prompt para el modelo
 * @param {Object} options - Opciones adicionales (ej: { format: 'json' })
 * @returns {Promise<string>} Respuesta generada
 */
export async function generateContent(model, prompt, options = {}) {
  try {
    const response = await fetch(`${OLLAMA_BASE_URL}/api/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: model,
        prompt: prompt,
        stream: false, // Desactivar streaming para simplificar
        ...options // Inyectar opciones como format: 'json'
      }),
    });

    if (!response.ok) {
      throw new Error(`Error en la API de Ollama: ${response.status}`);
    }

    const data = await response.json();
    return data.response || '';
  } catch (error) {
    console.error('Error generando contenido con Ollama:', error);
    throw error;
  }
}

/**
 * Genera contenido usando un modelo de Ollama (versión con streaming)
 * @param {string} model - Nombre del modelo a usar
 * @param {string} prompt - Prompt para el modelo
 * @param {Function} onChunk - Callback para cada chunk recibido
 * @returns {Promise<string>} Respuesta completa generada
 */
export async function generateContentStreaming(model, prompt, onChunk) {
  try {
    const response = await fetch(`${OLLAMA_BASE_URL}/api/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: model,
        prompt: prompt,
        stream: true,
      }),
    });

    if (!response.ok) {
      throw new Error(`Error en la API de Ollama: ${response.status}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let fullResponse = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value);
      const lines = chunk.split('\n').filter(line => line.trim());

      for (const line of lines) {
        try {
          const data = JSON.parse(line);
          if (data.response) {
            fullResponse += data.response;
            if (onChunk) onChunk(data.response);
          }
        } catch (e) {
          console.error('Error parseando chunk:', e);
        }
      }
    }

    return fullResponse;
  } catch (error) {
    console.error('Error generando contenido con Ollama (streaming):', error);
    throw error;
  }
}

