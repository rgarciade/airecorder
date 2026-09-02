import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { aiQueueService } from '../../services/ai/aiQueueService';
import styles from './ChatInterface.module.css';

// Nombres literales usados en `queueMeta.name` por tasksCommand.js/noteCommand.js —
// deben coincidir EXACTAMENTE para que este indicador reconozca sus propias tareas
// en la cola global de IA. Mapean al mismo i18nKey ya usado por `commandRunning` en
// ChatInterface.jsx (`chatCommands.tareas`/`chatCommands.nota`), reutilizando la clave
// `.running` existente en vez de crear i18n nuevo.
const BACKGROUND_COMMAND_I18N_KEYS = {
  'Tareas desde el chat': 'chatCommands.tareas',
  'Nota desde el chat': 'chatCommands.nota',
};

/**
 * Píldora pequeña y no bloqueante que se muestra mientras un comando de chat marcado
 * `runsInBackground` (`/tareas`, `/nota`) está corriendo en la cola global de IA.
 *
 * Independiente de `commandRunning` (que sigue cubriendo los comandos síncronos como
 * `/compact`/`/resumen`/`/buscar`) — ambos indicadores coexisten. Nunca deshabilita el
 * input: `/tareas` y `/nota` ya no bloquean el chat mientras corren (ver
 * `useChatCommands.js`), así que este indicador es solo informativo.
 */
export default function BackgroundTaskIndicator() {
  const { t } = useTranslation();
  const [i18nKey, setI18nKey] = useState(null);

  useEffect(() => {
    const unsubscribe = aiQueueService.subscribe((state) => {
      const currentName = state.current?.name;
      setI18nKey(currentName ? BACKGROUND_COMMAND_I18N_KEYS[currentName] || null : null);
    });
    return unsubscribe;
  }, []);

  if (!i18nKey) return null;

  return (
    <div className={styles.backgroundTaskPill} title={t(`${i18nKey}.running`)}>
      <span className={styles.backgroundTaskSpinner} />
      {t(`${i18nKey}.running`)}
    </div>
  );
}
