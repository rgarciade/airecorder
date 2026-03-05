# Guía de Actualización de AIRecorder

Esta guía describe los pasos necesarios para actualizar AIRecorder cuando hay una nueva versión disponible, dado que la aplicación está en desarrollo preliminar y aún no está firmada por Apple.

## Pasos para actualizar:

1. **Descargar:** Descarga la nueva versión (`.dmg` o `.zip`) desde la página de Releases en GitHub.
2. **Reinstalar:** Borra la app actual de tu carpeta de Aplicaciones (o de donde la tengas) y arrastra/copia la nueva versión que acabas de descargar.
3. **Permisos de Captura de Pantalla:** Cuando la aplicación te pida permisos de grabación de pantalla (o accesibilidad), debes ir a **Ajustes del Sistema > Privacidad y seguridad**, **eliminar** el permiso actual que tenía la versión anterior de la app (seleccionándola y dándole al botón `-`) y **volver a dárselo** (añadiéndola de nuevo con el botón `+`).
4. **Abrir la app (Atributos extendidos):** Como la app no está firmada, macOS puede bloquear su ejecución indicando que está dañada o que no se puede abrir. Para solucionarlo, abre la Terminal y ejecuta el siguiente comando:

   ```bash
   xattr -cr /Applications/AIRecorder.app
   ```
   *(Asegúrate de cambiar la ruta si no la has instalado en la carpeta de Aplicaciones)*

---

⚠️ **Aviso:** La app está en desarrollo preliminar y aún no está firmada.
