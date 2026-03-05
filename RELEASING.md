# 🚀 Guía de Releasing - AIRecorder

Documento rápido para hacer releases y distribuciones de AIRecorder.

---

## Checklist Rápido

```
[ ] Actualizar version en package.json
[ ] npm run electron:build (construir DMG)
[ ] git tag vX.X.X
[ ] git push origin vX.X.X
[ ] Crear GitHub Release con el DMG
[ ] Verificar que la app detecta la nueva versión
```

---

## Paso a Paso Detallado

### 1️⃣ Actualizar la versión

```bash
# Edita package.json
nano package.json

# Busca la línea:
# "version": "0.0.1"
# Cámbiala a la nueva versión, ej:
# "version": "0.0.2"

# Guarda (Ctrl+O, Enter, Ctrl+X en nano)
```

**Formato de versión:** Usa semántico (MAJOR.MINOR.PATCH)
- `0.0.1` → `0.0.2` (parche/bug fix)
- `0.0.2` → `0.1.0` (nueva funcionalidad)
- `0.1.0` → `1.0.0` (cambio mayor)

---

### 2️⃣ Construir el DMG

```bash
npm run electron:build
```

**Tiempo esperado:** 5-15 minutos (depende del PC)

**Salida esperada:**
- Archivo: `dist-electron/AIRecorder-0.0.2-arm64.dmg`
- Si hay errores en `better-sqlite3`, ejecuta:
  ```bash
  npm run rebuild
  npm run electron:build
  ```

---

### 3️⃣ Crear Tag en Git

```bash
# Confirma que el número de versión coincide con package.json
git tag v0.0.2

# Sube el tag a GitHub
git push origin v0.0.2
```

---

### 4️⃣ Crear la Release en GitHub

#### Opción A: Usando GitHub CLI (recomendado, más rápido)

```bash
# Verifica que tienes gh instalado
gh --version

# Si no, instala:
# brew install gh

# Autentica con GitHub (si es primera vez)
gh auth login

# Crea la release con el DMG
gh release create v0.0.2 \
  dist-electron/AIRecorder-0.0.2-arm64.dmg \
  --title "AIRecorder v0.0.2" \
  --notes "
## ✨ Nuevas Características
- Sistema de actualizaciones automáticas vía GitHub Releases
- Ofuscación de código en builds de producción
- Protección de ASAR contra extracción

## 🐛 Correcciones
- Corregido error en importación de audio

## 📦 Instalación
1. Descarga el DMG
2. Abre el DMG
3. Arrastra 'AIRecorder' a la carpeta 'Aplicaciones'
4. ¡Listo! Abre desde Aplicaciones
"
```

#### Opción B: Manual en GitHub Web

1. Ve a: https://github.com/rgarciade/airecorder/releases
2. Click "Draft a new release" (arriba a la derecha)
3. Completa los campos:
   - **Tag:** `v0.0.2`
   - **Release title:** `AIRecorder v0.0.2`
   - **Description:**
     ```
     ## ✨ Nuevas Características
     - Sistema de actualizaciones automáticas vía GitHub Releases
     - Ofuscación de código en builds de producción
     - Protección de ASAR contra extracción

     ## 🐛 Correcciones
     - Corregido error en importación de audio

     ## 📦 Instalación
     1. Descarga el DMG
     2. Abre el DMG
     3. Arrastra 'AIRecorder' a la carpeta 'Aplicaciones'
     ```
   - **Assets:** Arrastra el archivo `dist-electron/AIRecorder-0.0.2-arm64.dmg`
4. Click "Publish release"

---

### 5️⃣ Verificar que funciona

Cuando los usuarios reciban la actualización:

**Automáticamente (5 segundos después de arrancar la app):**
- Se muestra un diálogo: *"¡Hay una nueva versión de AIRecorder disponible! v0.0.2"*
- Usuario hace click en "Descargar" → abre el navegador

**Manualmente (en cualquier momento):**
- Settings → General → "Buscar actualizaciones"
- Click en "Buscar actualizaciones"
- Si hay una versión más nueva, muestra el diálogo

---

## Notas Importantes

### Seguridad del Código
- ✅ El DMG incluye código ofuscado (difícil de copiar)
- ✅ El ASAR está protegido con asarmor
- ✅ No es 100% imposible extraerlo (nada lo es), pero requiere mucho esfuerzo

### Rollback (si algo sale mal)
```bash
# Si necesitas revertir a una versión anterior:
git tag -d v0.0.2         # Elimina el tag localmente
git push --delete origin v0.0.2  # Elimina en GitHub

# Y en la página de releases, puedes borrar la release manualmente
```

### Cambios Futuros
Si modificas el `package.json` para cambiar campos como `"main"` o `"build.files"`, recuerda:
- En desarrollo: El campo `"main"` apunta a `electron/main.js`
- En build: `electron-builder` usa `"main"` de `build.extraMetadata` que apunta a `electron-obfuscated/main.js`
- El script `obfuscate:electron` maneja automáticamente todo

---

## Troubleshooting

### El build falla con error en better-sqlite3
```bash
npm run rebuild
npm run electron:build
```

### El DMG se ve corrupto
- Intenta de nuevo: `npm run electron:build`
- Asegúrate de que `dist-electron/` no tiene archivos de builds anteriores

### GitHub CLI no funciona
```bash
# Instala/actualiza
brew install gh

# Autentica
gh auth login

# Selecciona: GitHub.com (HTTPS)
```

### El release se creó pero sin el DMG
- Ve manualmente a la página del release en GitHub
- Arrastra el DMG a la sección "Assets"
- Guarda (click en el botón de guardar si es borrador)

---

## Referencia de Versiones Anteriores

| Versión | Fecha | Nota |
|---------|-------|------|
| v0.0.1 | [Fecha] | Primera versión con actualizaciones automáticas |

_(Actualiza esta tabla después de cada release)_
