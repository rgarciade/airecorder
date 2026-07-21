---
name: create-version
description: Crea una nueva versión completa de AIRecorder. Actualiza package.json, genera las notas de versión (changelog + whatsNew.json), lanza la build de producción macOS DMG, y guía al usuario en los pasos finales de release.
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

## Paso 4: Confirmar antes de la build

Muestra un resumen de todo lo que se hará y pide confirmación explícita:

```
📋 RESUMEN — Lista para lanzar vX.Y.Z

Archivos actualizados:
  ✅ src/data/whatsNew.json
  ✅ docs/changelog.html
  ✅ package.json → "version": "X.Y.Z"

A continuación se ejecutará:
  ▶ npm run electron:build
  (genera el DMG para macOS arm64, tarda varios minutos)

¿Lanzar la build ahora? [s/n]
```

Si el usuario responde "n" o "no", para aquí y muestra los próximos pasos manuales (Paso 6).

---

## Paso 5: Ejecutar la build

```bash
npm run electron:build
```

Este comando tarda varios minutos. Informa al usuario que la build está en curso. Cuando termine, verifica que no haya errores en la salida.

El DMG generado estará en `dist/` o `release/` (busca el archivo `.dmg` al finalizar):
```bash
ls -lh dist/*.dmg 2>/dev/null || ls -lh release/*.dmg 2>/dev/null
```

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

Muestra siempre este checklist al finalizar, tanto si la build se ejecutó como si no:

```
✅ VERSIÓN vX.Y.Z LISTA

📦 DMG generado: [ruta/nombre.dmg]

PRÓXIMOS PASOS (manuales):

  1. Revisa el DMG y prueba la app

  2. Commit de los cambios:
       git add package.json src/data/whatsNew.json docs/changelog.html
       git commit -m "chore: release vX.Y.Z"

  3. Crea el tag anotado (usa el mensaje generado arriba):
       git tag -a vX.Y.Z -m "[mensaje de tag]"

  4. Sube el tag al remoto:
       git push origin main --tags

  5. Crea la release en GitHub como borrador (usa la descripción generada arriba):
       gh release create vX.Y.Z [ruta/nombre.dmg] \
         --title "AIRecorder vX.Y.Z" \
         --notes-file /tmp/release-notes-vX.Y.Z.md \
         --draft

  6. Revisa el borrador en GitHub y publícalo manualmente cuando esté listo
       (Releases → editar borrador → "Publish release")
```

---

## Notas

- **Nunca crees commits ni tags de forma autónoma** — el usuario gestiona git
- La release de GitHub se crea siempre como **draft** (`--draft`) — el usuario la publica manualmente tras revisarla
- Si la build falla, muestra el error completo y sugiere ejecutar `npm run rebuild` antes de reintentar
- El campo `version` en `package.json` debe actualizarse **antes** de la build para que quede reflejado en el ejecutable
- Si el usuario ya tiene cambios sin commitear no relacionados con la release, avísale antes de continuar
