/**
 * Servicio para consultar información de modelos en Hugging Face
 */

// Prefijo para la caché en localStorage
const CACHE_PREFIX = 'hf_model_vision_';

/**
 * Comprueba si un modelo es compatible con visión (puede analizar imágenes)
 * utilizando la API de Hugging Face y guardando en caché el resultado.
 * 
 * @param {string} modelName - El nombre del modelo (ej. 'llava', 'qwen-vl', 'llama3')
 * @returns {Promise<boolean>} - True si el modelo soporta visión, false en caso contrario
 */
export async function checkModelVisionSupport(modelName) {
  if (!modelName) return false;

  // Normalizar el nombre del modelo para la búsqueda (quitar tags comunes si es de ollama)
  // ej: 'llava:latest' -> 'llava'
  const searchName = modelName.split(':')[0];

  const cacheKey = `${CACHE_PREFIX}${searchName}`;
  const cachedResult = localStorage.getItem(cacheKey);

  if (cachedResult !== null) {
    return cachedResult === 'true';
  }

  try {
    // Buscar el modelo en Hugging Face
    const response = await fetch(`https://huggingface.co/api/models?search=${encodeURIComponent(searchName)}&limit=5`);
    
    if (!response.ok) {
      console.warn(`[HF Service] Error HTTP ${response.status} al buscar modelo: ${searchName}`);
      return false;
    }

    const data = await response.json();
    
    // Si no hay resultados, asumimos que no tiene visión
    if (!data || data.length === 0) {
      localStorage.setItem(cacheKey, 'false');
      return false;
    }

    // Buscamos si el primer resultado relevante tiene vision (buscamos entre los primeros resultados por si hay homónimos de texto puro)
    let isVisionModel = false;
    for (const modelInfo of data) {
      const hasVisionPipeline = modelInfo.pipeline_tag === 'image-text-to-text';
      const hasVisionTag = Array.isArray(modelInfo.tags) && modelInfo.tags.includes('vision');
      
      if (hasVisionPipeline || hasVisionTag) {
        isVisionModel = true;
        break;
      }
    }
    
    // Guardar en caché el resultado
    localStorage.setItem(cacheKey, isVisionModel.toString());
    
    console.log(`[HF Service] Modelo evaluado: ${searchName} -> Vision: ${isVisionModel}`);
    return isVisionModel;

  } catch (error) {
    console.error(`[HF Service] Error al comprobar el modelo ${searchName}:`, error);
    return false;
  }
}
