---
name: create-version
description: Crea una nueva versión completa de AIRecorder. Actualiza package.json, genera las notas de versión (changelog + whatsNew.json), lanza una build local de macOS para verificación, y guía al usuario en el flujo de release (tag → draft → CI multiplataforma vía .github/workflows/build-release.yml).
---

# Skill: create-version

Flujo completo de release para AIRecorder. Cuando el usuario invoca `/create-version`, sigue estos pasos en orden.

---

## Paso 1: Mostrar estado actual y pedir la nueva versión

```bash
node -p "require('./package.json').version"
git tag --sort=-version:refname | head -1
git log $(git tag --sort=-version:refname | head -1)..HEAD --oneline --no-merges | wc -l
git status --short
```

Muestra al usuario:

```
🚀 CREATE VERSION — AIRecorder

📦 Versión actual:  X.Y.Z
🏷️  Último tag git: vX.Y.Z
📝 Commits nuevos:  N commit(s) desde el último tag
🌿 Rama actual:     [rama]

¿Cuál es el número de la nueva versión? (ej. X.Y.Z)
```

Valida que la respuesta tenga formato semver (`X.Y.Z`). Si el usuario pasa la versión como argumento (`/create-version 0.2.3`), úsala directamente sin preguntar.

---

## Paso 2: Generar las notas de versión

Sigue exactamente el flujo de la skill `release-notes` a partir del Paso 2 (ya tienes la versión, no hace falta pedirla de nuevo):

1. Lee commits con `git log $(git tag --sort=-version:refname | head -1)..HEAD --oneline --no-merges`
2. Lee `src/data/whatsNew.json` y `docs/changelog.html` como referencia de estructura
3. Agrupa cambios por tipo (feat/fix/etc.), omite chore/ci/test
4. **Propón los cambios al usuario** y espera su confirmación antes de escribir:
   ```
   📋 PROPUESTA DE CHANGELOG — vX.Y.Z
   Categoría: ...
   Fecha: [Mes] [año]

   1. [emoji] [Título ES]
      ES: [Descripción]
      EN: [Description]
   ...

   ¿Quieres ajustar algo antes de continuar?
   ```
5. Tras confirmación: actualiza `src/data/whatsNew.json` y añade el entry en `docs/changelog.html`

---

## Paso 3: Actualizar package.json

Edita el campo `version` en `package.json`:

```json
{
  "version": "X.Y.Z"
}
```

Solo cambia el campo `version`. No toques ningún otro campo.

---

## Paso 4: Confirmar antes de la build local

La build real multiplataforma (Windows/macOS/Linux) la hace el CI (`.github/workflows/build-release.yml`) al pushear el tag — ver Paso 7. Este paso es solo una build LOCAL de macOS para verificar que todo compila antes de tagear.

Muestra un resumen de todo lo que se hará y pide confirmación explícita:

```
📋 RESUMEN — Lista para lanzar vX.Y.Z

Archivos actualizados:
  ✅ src/data/whatsNew.json
  ✅ docs/changelog.html
  ✅ package.json → "version": "X.Y.Z"

A continuación se ejecutará (verificación local, no es el release final):
  ▶ npm run electron:build
  (genera el DMG local para macOS arm64, tarda varios minutos)

¿Lanzar la build de verificación ahora? [s/n]
```

Si el usuario responde "n" o "no", para aquí y muestra los próximos pasos manuales (Paso 7).

---

## Paso 5: Ejecutar la build local de verificación

```bash
npm run electron:build
```

Este comando tarda varios minutos. Informa al usuario que la build está en curso. Cuando termine, verifica que no haya errores en la salida.

El DMG generado estará en `dist-electron/` (no `dist/` ni `release/` — ese es el `directories.output` configurado en electron-builder):
```bash
ls -lh dist-electron/*.dmg 2>/dev/null
```

Este DMG es solo para probar la app localmente. **No se sube a mano a la release** — el binario oficial de la release lo genera el CI en el Paso 7.

---

## Paso 6: Generar mensajes de release

Antes de mostrar el checklist final, genera los mensajes listos para copiar.

### Mensaje de commit

```
chore: release vX.Y.Z
```

### Mensaje de tag anotado (para `git tag -a`)

Usa los items del changelog confirmados en el Paso 2. Formato:

```
AIRecorder vX.Y.Z — [Título ES del release]

[Categoría: Nuevas funciones | Mejoras y correcciones]

• [emoji] [Título ES item 1]: [Descripción ES breve, máx. 1 línea]
• [emoji] [Título ES item 2]: [Descripción ES breve]
• ...

Changelog completo: https://rgarciade.github.io/airecorder/changelog.html
```

### Descripción de GitHub Release

Genera el cuerpo de la release en Markdown, en **español**, usando los mismos items:

```markdown
## AIRecorder vX.Y.Z — [Título ES]

[Categoría badge: ⭐ Nuevas funciones | 🔧 Mejoras y correcciones]

### ¿Qué hay de nuevo?

| | Cambio | Descripción |
|---|---|---|
| [emoji] | **[Título ES]** | [Descripción ES, 1 frase] |
| [emoji] | **[Título ES]** | [Descripción ES, 1 frase] |

### Instalación

> ⚠️ La app no está firmada. Tras instalar ejecuta:
> ```
> xattr -cr /Applications/AIRecorder.app
> ```
> Luego ve a **Ajustes del sistema → Privacidad → Grabación de pantalla** y activa AIRecorder.

**[Descargar AIRecorder-X.Y.Z-arm64.dmg](#)** · Requiere macOS · Apple Silicon

---
[Ver changelog completo](https://rgarciade.github.io/airecorder/changelog.html)
```

---

## Paso 7: Próximos pasos (post-build)

Muestra siempre este checklist al finalizar, tanto si la build local se ejecutó como si no:

```
✅ VERSIÓN vX.Y.Z LISTA

📦 DMG local de verificación: [ruta/nombre.dmg] (dist-electron/)

PRÓXIMOS PASOS (manuales):

  1. Revisa el DMG local y prueba la app

  2. Commit de los cambios:
       git add package.json src/data/whatsNew.json docs/changelog.html
       git commit -m "chore: release vX.Y.Z"

  3. Crea el tag anotado (usa el mensaje generado arriba):
       git tag -a vX.Y.Z -m "[mensaje de tag]"

  4. Sube el tag al remoto — esto DISPARA el workflow de CI
     (.github/workflows/build-release.yml: build-win + build-mac + build-linux
     en paralelo, tarda varios minutos):
       git push origin main --tags

  5. INMEDIATAMENTE después del push, crea la release en GitHub como borrador
     con la MISMA tag (usa la descripción generada arriba). El tag ya existe
     en remoto por el paso 4, así que `gh release create` lo reutiliza sin
     crear uno nuevo. NO adjuntes archivos acá — el CI los adjunta al terminar:
       gh release create vX.Y.Z \
         --title "AIRecorder vX.Y.Z" \
         --notes-file /tmp/release-notes-vX.Y.Z.md \
         --draft
     (Si te da "release already exists" es que el CI terminó antes y creó el
     borrador él mismo — en ese caso ponle título y notas con:
       gh release edit vX.Y.Z --title "..." --notes-file ... --draft)

  6. Espera a que termine el workflow (revisa la pestaña Actions o
     `gh run watch`). Su job final `release` encuentra ESTE borrador por el
     nombre del tag y le adjunta los binarios (.dmg, .exe, .AppImage, .deb)
     sin crear uno nuevo ni publicarlo.

  7. Revisa el borrador con los 3 binarios adjuntos y publícalo manualmente
       (Releases → editar borrador → "Publish release")
```

**Por qué este orden (tag → push → recién ahí crear el draft):** si el draft
se crea ANTES de que el tag exista en remoto, `gh release create` (a diferencia
de la UI web de GitHub) crea automáticamente un tag apuntando al HEAD de la
rama por defecto en ese mismo momento — puede no coincidir con el commit real
del release y pisar el tag que se sube después. Pusheando el tag primero se
evita esa ambigüedad por completo.

---

## Notas

- **Nunca crees commits ni tags de forma autónoma** — el usuario gestiona git
- La release de GitHub se crea siempre como **draft** (`--draft`) — el usuario la publica manualmente tras revisarla
- El binario oficial de la release (Windows/macOS/Linux) lo genera **`.github/workflows/build-release.yml`** al pushear el tag, no la build local del Paso 5 (esa es solo verificación en macOS)
- El tag que se pushea debe coincidir **EXACTAMENTE** (con el prefijo `v`) con el tag usado en `gh release create` — el workflow dispara por `push: tags: v*` y el job `release` busca el draft por ese mismo nombre de tag
- El CI reconstruye `.env` desde GitHub secrets (`VITE_SENTRY_DSN`, `VITE_WIKI_URL`, y opcionalmente `SENTRY_ORG`/`SENTRY_PROJECT`/`SENTRY_AUTH_TOKEN` para subir sourcemaps) — si esos secrets no están configurados en el repo, los binarios del CI salen sin Sentry ni wiki URL
- Si la build local falla, muestra el error completo y sugiere ejecutar `npm run rebuild` antes de reintentar
- El campo `version` en `package.json` debe actualizarse **antes** de la build para que quede reflejado en el ejecutable
- Si el usuario ya tiene cambios sin commitear no relacionados con la release, avísale antes de continuar
