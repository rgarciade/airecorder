import { useTranslation } from 'react-i18next';
// Mismo CSS Module que ProjectDetail: al importar el mismo archivo los nombres
// generados de las clases coinciden, así que el badge hereda el estilo existente.
import styles from '../../ProjectDetail.module.css';

/**
 * Badge de modo por grabación en la lista de contexto del chat de proyecto:
 * muestra la fuente usada en la última respuesta (`contextInfo.perRecordingMode`):
 * 'rag' | 'summary' | 'unavailable' | 'excluded'. Textos vía i18n
 * (`contextBar.sourceBadge.*`). Si no hay modo aún, no renderiza nada.
 */
export default function RecordingModeBadge({ mode }) {
  const { t } = useTranslation();

  if (!mode) return null;

  const badgeClass =
    mode === 'rag' ? styles.badgeRag :
    mode === 'summary' ? styles.badgeSummary :
    mode === 'excluded' ? styles.badgeExcluded :
    styles.badgeUnavailable;

  return (
    <span
      className={`${styles.chatContextItemBadge} ${badgeClass}`}
      title={t(`contextBar.sourceBadge.${mode}Tooltip`)}
    >
      {t(`contextBar.sourceBadge.${mode}`)}
    </span>
  );
}
