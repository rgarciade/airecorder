/**
 * BottomLeftStack.jsx — contenedor `column-reverse` compartido para el
 * `DownloadIndicator` global y `RecordingOverlay` (design.md D9).
 *
 * Reemplaza el `position: fixed; bottom: 24px; left: 24px` que antes vivía
 * únicamente en `RecordingOverlay.module.css` (`.overlay`, L3-6): ese
 * posicionamiento se movió acá, y `RecordingOverlay` recibe la clase
 * modificadora `inStack` para neutralizar el suyo propio y participar del
 * layout flex en su lugar (IND6).
 *
 * `flex-direction: column-reverse`: el PRIMER hijo en el orden de fuente
 * queda al fondo del stack visual (más cerca de `bottom: 24px`), los
 * siguientes se apilan encima. Por eso `RecordingOverlay` debe montarse
 * ANTES que `DownloadIndicator` en `App.jsx` — así el bocadillo queda
 * "encima" del overlay, tal como pide D9, sin cálculos de altura frágiles.
 */
import styles from './BottomLeftStack.module.css';

export default function BottomLeftStack({ children }) {
  return (
    <div className={styles.stack} data-testid="bottom-left-stack">
      {children}
    </div>
  );
}
