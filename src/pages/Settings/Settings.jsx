import React, { useState, useEffect } from 'react';
import { getSystemMicrophones } from '../../services/audioService';
import { getSettings, updateSettings } from '../../services/settingsService';
import { getAvailableModels, checkOllamaAvailability } from '../../services/ollamaService';

const mockLanguages = [
  { value: 'es', label: 'Español' },
  { value: 'en', label: 'English' },
  { value: 'fr', label: 'Français' },
];

export default function Settings({ onBack }) {
  const [selectedLanguage, setSelectedLanguage] = useState('');
  const [selectedMicrophone, setSelectedMicrophone] = useState('');
  const [microphones, setMicrophones] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [geminiApiKey, setGeminiApiKey] = useState('');
  const [aiProvider, setAiProvider] = useState('gemini');
  const [ollamaModel, setOllamaModel] = useState('');
  const [ollamaModels, setOllamaModels] = useState([]);
  const [ollamaAvailable, setOllamaAvailable] = useState(false);

  useEffect(() => {
    const loadSettings = async () => {
      try {
        setIsLoading(true);
        // Cargar micrófonos
        const systemMicrophones = await getSystemMicrophones();
        setMicrophones(systemMicrophones);
        
        // Verificar disponibilidad de Ollama
        const isOllamaAvailable = await checkOllamaAvailability();
        setOllamaAvailable(isOllamaAvailable);
        
        // Cargar configuración guardada
        const savedSettings = await getSettings();
        console.log('Settings cargados:', savedSettings); // Debug
        
        if (savedSettings) {
          setSelectedLanguage(savedSettings.language || '');
          setSelectedMicrophone(savedSettings.microphone || (systemMicrophones.length > 0 ? systemMicrophones[0].value : ''));
          setGeminiApiKey(savedSettings.geminiApiKey || '');
          setAiProvider(savedSettings.aiProvider || 'gemini');
          setOllamaModel(savedSettings.ollamaModel || '');
          
          // Si el proveedor es Ollama y está disponible, cargar modelos
          if (savedSettings.aiProvider === 'ollama' && isOllamaAvailable) {
            try {
              const models = await getAvailableModels();
              setOllamaModels(models);
              console.log('Modelos de Ollama cargados:', models); // Debug
            } catch (error) {
              console.error('Error cargando modelos de Ollama:', error);
            }
          }
        } else if (systemMicrophones.length > 0) {
          setSelectedMicrophone(systemMicrophones[0].value);
        }
        
        // Marcar que los settings se han cargado
        setHasLoadedSettings(true);
      } catch (error) {
        console.error('Error loading settings:', error);
        setHasLoadedSettings(true); // Marcar como cargado incluso si hay error
      } finally {
        setIsLoading(false);
      }
    };

    loadSettings();
  }, []);

  // Cargar modelos de Ollama cuando se selecciona ese proveedor
  useEffect(() => {
    const loadOllamaModels = async () => {
      if (aiProvider === 'ollama' && ollamaAvailable) {
        try {
          const models = await getAvailableModels();
          setOllamaModels(models);
          console.log('Modelos cargados en useEffect:', models); // Debug
          
          // Si no hay modelo seleccionado y hay modelos disponibles, seleccionar el primero
          if (!ollamaModel && models.length > 0) {
            console.log('Seleccionando primer modelo:', models[0].name); // Debug
            setOllamaModel(models[0].name);
          }
        } catch (error) {
          console.error('Error cargando modelos de Ollama:', error);
        }
      }
    };

    loadOllamaModels();
  }, [aiProvider, ollamaAvailable, ollamaModel]);

  // Estado para controlar si es la carga inicial
  const [hasLoadedSettings, setHasLoadedSettings] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');

  // Función para guardar configuración manualmente
  const handleSaveSettings = async () => {
    setIsSaving(true);
    setSaveMessage('');
    
    try {
      console.log('Guardando settings:', { selectedLanguage, selectedMicrophone, geminiApiKey, aiProvider, ollamaModel }); // Debug
      await updateSettings({
        language: selectedLanguage,
        microphone: selectedMicrophone,
        geminiApiKey: geminiApiKey,
        aiProvider: aiProvider,
        ollamaModel: ollamaModel
      });
      setSaveMessage('Configuración guardada correctamente');
      setTimeout(() => setSaveMessage(''), 3000); // Ocultar mensaje después de 3 segundos
    } catch (error) {
      console.error('Error saving settings:', error);
      setSaveMessage('Error al guardar la configuración');
      setTimeout(() => setSaveMessage(''), 5000); // Ocultar mensaje de error después de 5 segundos
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div
      className="flex min-h-screen flex-col bg-[#221112]"
      style={{
        '--select-button-svg': 'url(\'data:image/svg+xml,%3csvg xmlns=%27http://www.w3.org/2000/svg%27 width=%2724px%27 height=%2724px%27 fill=%27rgb(200,146,149)%27 viewBox=%270 0 256 256%27%3e%3cpath d=%27M181.66,170.34a8,8,0,0,1,0,11.32l-48,48a8,8,0,0,1-11.32,0l-48-48a8,8,0,0,1,11.32-11.32L128,212.69l42.34-42.35A8,8,0,0,1,181.66,170.34Zm-96-84.68L128,43.31l42.34,42.35a8,8,0,0,0,11.32-11.32l-48-48a8,8,0,0,0-11.32,0l-48,48A8,8,0,0,0,85.66,85.66Z%27%3e%3c/path%3e%3c/svg%3e\')',
        fontFamily: '"Plus Jakarta Sans", "Noto Sans", sans-serif',
      }}
    >
      <header className="flex items-center justify-between whitespace-nowrap border-b border-solid border-b-[#472426] px-10 py-3">
        <div className="flex items-center gap-4 text-white">
          <div className="size-4">
            <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path
                d="M42.4379 44C42.4379 44 36.0744 33.9038 41.1692 24C46.8624 12.9336 42.2078 4 42.2078 4L7.01134 4C7.01134 4 11.6577 12.932 5.96912 23.9969C0.876273 33.9029 7.27094 44 7.27094 44L42.4379 44Z"
                fill="currentColor"
              ></path>
            </svg>
          </div>
          <h2 className="text-white text-lg font-bold leading-tight tracking-[-0.015em]">Meeting Recorder</h2>
        </div>
        <div className="flex flex-1 justify-end gap-8">
          <button
            onClick={onBack}
            className="flex max-w-[480px] cursor-pointer items-center justify-center overflow-hidden rounded-full h-10 bg-[#472426] text-white gap-2 text-sm font-bold leading-normal tracking-[0.015em] min-w-0 px-2.5"
          >
            <div className="text-white">
              <svg xmlns="http://www.w3.org/2000/svg" width="20px" height="20px" fill="currentColor" viewBox="0 0 256 256">
                <path d="M224,128a8,8,0,0,1-8,8H40a8,8,0,0,1,0-16H216A8,8,0,0,1,224,128ZM40,72H216a8,8,0,0,0,0-16H40a8,8,0,0,0,0,16ZM216,184H40a8,8,0,0,0,0,16H216a8,8,0,0,0,0-16Z"></path>
              </svg>
            </div>
          </button>
          <div
            className="bg-center bg-no-repeat aspect-square bg-cover rounded-full size-10"
            style={{
              backgroundImage:
                'url("https://lh3.googleusercontent.com/aida-public/AB6AXuDPjrv1quc1LGf7kEkjFYWw3TxeOKlWUpU38FN4p_DyS9-ESGJbX4xJuAKZr6c1wq-DZYRcnRl6wwaJOHg13ux1hdjQ03tHrT66coitnJzmlFWdZT-9Pz8Ce7VQcmUBlUMkwjzD2s3OjLynln8X7I6gaupZOXRqkrp0pp4weruw6jgzoqSkJlHN5MUwNXK9lUYpCdeFkFYB4s9V4-dKTNiSBMJMT-gijrkLFrPtlJ8wzy86cxymQU31pEx9rYdIY9sjoD_rO_s")',
            }}
          ></div>
        </div>
      </header>
      <div className="px-40 flex flex-1 justify-center py-5">
        <div className="layout-content-container flex flex-col w-[512px] max-w-[512px] py-5 max-w-[960px] flex-1">
          <div className="flex flex-wrap justify-between gap-3 p-4">
            <p className="text-white tracking-light text-[32px] font-bold leading-tight min-w-72">Settings</p>
          </div>
          <h3 className="text-white text-lg font-bold leading-tight tracking-[-0.015em] px-4 pb-2 pt-4">Audio</h3>
          <div className="flex max-w-[480px] flex-wrap items-end gap-4 px-4 py-3">
            <label className="flex flex-col min-w-40 flex-1">
              <p className="text-white text-base font-medium leading-normal pb-2">Language</p>
              <select
                value={selectedLanguage}
                onChange={(e) => setSelectedLanguage(e.target.value)}
                disabled={isLoading}
                className={`form-input flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded-xl text-white focus:outline-0 focus:ring-0 border border-[#663336] bg-[#331a1b] focus:border-[#663336] h-14 bg-[image:--select-button-svg] bg-[length:24px] bg-no-repeat bg-[center_right_1rem] appearance-none placeholder:text-[#c89295] p-[15px] text-base font-normal leading-normal ${isLoading ? 'opacity-50' : ''}`}
              >
                <option value="" disabled>
                  {isLoading ? 'Charging...' : 'Select a language'}
                </option>
                {mockLanguages.map((lang) => (
                  <option key={lang.value} value={lang.value}>
                    {lang.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="flex max-w-[480px] flex-wrap items-end gap-4 px-4 py-3">
            <label className="flex flex-col min-w-40 flex-1">
              <p className="text-white text-base font-medium leading-normal pb-2">Microphone</p>
              <select
                value={selectedMicrophone}
                onChange={(e) => setSelectedMicrophone(e.target.value)}
                disabled={isLoading}
                className={`form-input flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded-xl text-white focus:outline-0 focus:ring-0 border border-[#663336] bg-[#331a1b] focus:border-[#663336] h-14 bg-[image:--select-button-svg] bg-[length:24px] bg-no-repeat bg-[center_right_1rem] appearance-none placeholder:text-[#c89295] p-[15px] text-base font-normal leading-normal ${isLoading ? 'opacity-50' : ''}`}
              >
                <option value="" disabled>
                  {isLoading ? 'Charging...' : 'Select a microphone'}
                </option>
                {microphones.map((mic) => (
                  <option key={mic.value} value={mic.value}>
                    {mic.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <h3 className="text-white text-lg font-bold leading-tight tracking-[-0.015em] px-4 pb-2 pt-4">Proveedor de IA</h3>
          <div className="flex max-w-[480px] flex-wrap items-end gap-4 px-4 py-3">
            <label className="flex flex-col min-w-40 flex-1">
              <p className="text-white text-base font-medium leading-normal pb-2">Seleccionar Proveedor</p>
              <select
                value={aiProvider}
                onChange={(e) => setAiProvider(e.target.value)}
                disabled={isLoading}
                className={`form-input flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded-xl text-white focus:outline-0 focus:ring-0 border border-[#663336] bg-[#331a1b] focus:border-[#663336] h-14 bg-[image:--select-button-svg] bg-[length:24px] bg-no-repeat bg-[center_right_1rem] appearance-none placeholder:text-[#c89295] p-[15px] text-base font-normal leading-normal ${isLoading ? 'opacity-50' : ''}`}
              >
                <option value="gemini">Gemini</option>
                <option value="ollama">Ollama</option>
              </select>
            </label>
          </div>

          {aiProvider === 'gemini' && (
            <div className="flex max-w-[480px] flex-wrap items-end gap-4 px-4 py-3">
              <label className="flex flex-col min-w-40 flex-1">
                <p className="text-white text-base font-medium leading-normal pb-2">Gemini API Key</p>
                <input
                  type="text"
                  value={geminiApiKey}
                  onChange={e => setGeminiApiKey(e.target.value)}
                  className="form-input flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded-xl text-white focus:outline-0 focus:ring-0 border border-[#663336] bg-[#331a1b] focus:border-[#663336] h-14 placeholder:text-[#c89295] p-[15px] text-base font-normal leading-normal"
                  placeholder="Introduce tu Gemini API Key"
                />
              </label>
            </div>
          )}

          {aiProvider === 'ollama' && (
            <div className="flex max-w-[480px] flex-wrap items-end gap-4 px-4 py-3">
              <label className="flex flex-col min-w-40 flex-1">
                <p className="text-white text-base font-medium leading-normal pb-2">Modelo de Ollama</p>
                {!ollamaAvailable ? (
                  <div className="text-[#c89295] text-sm p-4 bg-[#331a1b] rounded-xl border border-[#663336]">
                    Ollama no está disponible. Asegúrate de que esté corriendo en http://localhost:11434
                  </div>
                ) : ollamaModels.length === 0 ? (
                  <div className="text-[#c89295] text-sm p-4 bg-[#331a1b] rounded-xl border border-[#663336]">
                    No hay modelos disponibles. Instala un modelo con: ollama pull llama2
                  </div>
                ) : (
                  <select
                    value={ollamaModel}
                    onChange={(e) => setOllamaModel(e.target.value)}
                    disabled={isLoading}
                    className={`form-input flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded-xl text-white focus:outline-0 focus:ring-0 border border-[#663336] bg-[#331a1b] focus:border-[#663336] h-14 bg-[image:--select-button-svg] bg-[length:24px] bg-no-repeat bg-[center_right_1rem] appearance-none placeholder:text-[#c89295] p-[15px] text-base font-normal leading-normal ${isLoading ? 'opacity-50' : ''}`}
                  >
                    <option value="" disabled>
                      Selecciona un modelo
                    </option>
                    {ollamaModels.map((model) => (
                      <option key={model.name} value={model.name}>
                        {model.name}
                      </option>
                    ))}
                  </select>
                )}
              </label>
            </div>
          )}

          {/* Botón de guardar y mensaje de estado */}
          <div className="flex flex-col gap-4 px-4 py-6">
            <button
              onClick={handleSaveSettings}
              disabled={isSaving || !hasLoadedSettings}
              className={`flex items-center justify-center gap-2 px-6 py-3 rounded-xl text-white font-medium transition-all ${
                isSaving || !hasLoadedSettings
                  ? 'bg-gray-600 cursor-not-allowed opacity-50'
                  : 'bg-[#e92932] hover:bg-[#d41f27] hover:shadow-lg'
              }`}
            >
              {isSaving ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  Guardando...
                </>
              ) : (
                <>
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 256 256">
                    <path d="M224,48H176V40a24,24,0,0,0-48,0v8H80A16,16,0,0,0,64,64V208a16,16,0,0,0,16,16H176a16,16,0,0,0,16-16V64A16,16,0,0,0,224,48ZM128,24a16,16,0,0,1,16,16v8H112V40A16,16,0,0,1,128,24Zm80,184H80V64H96V96a8,8,0,0,0,8,8h48a8,8,0,0,0,8-8V64h16V208Z"></path>
                  </svg>
                  Guardar Configuración
                </>
              )}
            </button>

            {/* Mensaje de estado */}
            {saveMessage && (
              <div className={`px-4 py-2 rounded-lg text-sm font-medium ${
                saveMessage.includes('Error') 
                  ? 'bg-red-900/20 border border-red-600/30 text-red-400'
                  : 'bg-green-900/20 border border-green-600/30 text-green-400'
              }`}>
                {saveMessage}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
} 