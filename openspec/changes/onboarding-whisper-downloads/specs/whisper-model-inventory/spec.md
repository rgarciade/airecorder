# Whisper Model Inventory Specification

## Purpose

Catálogo versionado y única fuente de verdad para los modelos Whisper disponibles en la aplicación: qué modelos existen, su tamaño de descarga, su estado (no descargado / descargando / listo / falló), el espacio que ocupan en disco, y la ubicación de caché controlada por la app. Todos los selectores de modelo de la aplicación (Home, RecordingOverlay, RecordingDetailWithTranscription, Ajustes) consultan exclusivamente este inventario.

## Requirements

### Requirement: Catálogo versionado de modelos

El sistema MUST exponer un catálogo con los modelos `tiny`, `base`, `small`, `medium` y `large-v3`, cada uno con su tamaño de descarga y su estado actual (`no descargado` / `descargando` / `listo` / `falló`).

#### Scenario: Consultar el catálogo al iniciar

- GIVEN la aplicación acaba de iniciar
- WHEN cualquier vista solicita el catálogo de modelos
- THEN el sistema retorna los 5 modelos con tamaño y estado actualizados

### Requirement: Migración silenciosa de `large` a `large-v3`

El sistema MUST remapear automáticamente el valor persistido `whisperModel: 'large'` a `'large-v3'` al iniciar, sin pedir confirmación al usuario.
(Requisito transversal del proposal — criterio de aceptación issue #149)

#### Scenario: Settings existentes con `large`

- GIVEN un usuario existente con `settings.whisperModel = 'large'`
- WHEN la aplicación inicia tras la actualización
- THEN `settings.whisperModel` queda remapeado a `'large-v3'` sin ningún diálogo de confirmación

#### Scenario: Settings ya migrados

- GIVEN `settings.whisperModel` ya es `'large-v3'`
- WHEN la aplicación inicia
- THEN el valor no se modifica (operación idempotente)

### Requirement: Adopción de modelos ya presentes en la caché del sistema

El sistema MUST detectar, al iniciar, modelos Whisper ya descargados en la caché de Hugging Face del sistema operativo, y MUST registrarlos como `listo` en el inventario sin volver a descargarlos.

#### Scenario: Modelo válido detectado en caché del SO

- GIVEN el modelo `medium` existe completo y válido en la caché HF del sistema
- WHEN la aplicación inicia y ejecuta la detección de caché
- THEN el inventario marca `medium` como `listo` sin iniciar ninguna descarga

#### Scenario: Modelo incompleto o corrupto en caché

- GIVEN el modelo `small` existe parcialmente o con archivos corruptos en la caché HF del sistema
- WHEN la aplicación inicia y ejecuta la detección de caché
- THEN el inventario NO marca `small` como `listo`; permanece `no descargado`

### Requirement: Caché de modelos gestionada por la app

El sistema MUST almacenar toda descarga nueva en una ubicación de caché gestionada por la propia aplicación, en lugar de depender del destino por defecto del sistema operativo.

#### Scenario: Nueva descarga usa la caché de la app

- GIVEN el modelo `base` no está instalado
- WHEN se completa su descarga
- THEN el modelo queda almacenado en la ubicación de caché gestionada por la app y marcado `listo`

### Requirement: Indicador reutilizable de espacio en disco

El sistema MUST exponer un componente reutilizable que muestre el espacio libre y total del volumen de la caché de modelos, ubicado en Ajustes → Modelos y descargas por encima de la lista de modelos descargables. El componente MUST refrescar el dato de espacio cada vez que se monta (no reutilizar un valor obtenido en un montaje anterior).

#### Scenario: Mostrar espacio al entrar a Ajustes → Modelos y descargas

- GIVEN el usuario navega a Ajustes → Transcripción → Modelos y descargas
- WHEN la sección se renderiza
- THEN el indicador de espacio en disco aparece encima de la lista de modelos, mostrando espacio libre y total actualizados

#### Scenario: Revisitar la sección refresca el dato

- GIVEN el usuario salió de Ajustes → Modelos y descargas y el espacio libre cambió mientras tanto (p. ej. se liberó disco)
- WHEN el usuario vuelve a entrar a esa sección
- THEN el indicador consulta el espacio actual de nuevo y muestra el valor actualizado, no el de la visita anterior

### Requirement: Fuente única de verdad para los selectores de modelo

El sistema MUST ser la única fuente de datos consultada por los 4 selectores de modelo de la aplicación (Home, RecordingOverlay, RecordingDetailWithTranscription, Ajustes). Ningún selector MUST NOT disparar una descarga.

#### Scenario: Selector ofrece solo modelos instalados

- GIVEN el inventario tiene `small` y `medium` en estado `listo`, y `large-v3` en `no descargado`
- WHEN el usuario abre cualquiera de los 4 selectores
- THEN el selector permite elegir únicamente `small` o `medium` como opciones activas

#### Scenario: Modelo no instalado aparece atenuado

- GIVEN `large-v3` está en estado `no descargado`
- WHEN el usuario abre un selector de modelo
- THEN `large-v3` aparece listado pero atenuado (deshabilitado), con indicación de ir a Ajustes → Modelos y descargas para instalarlo

#### Scenario: Seleccionar un modelo nunca inicia una descarga

- GIVEN el usuario interactúa con cualquiera de los 4 selectores
- WHEN selecciona una opción, instalada o atenuada
- THEN el sistema NO inicia ninguna descarga como efecto de esa selección

#### Scenario: Sin ningún modelo instalado, la transcripción queda bloqueada

- GIVEN el inventario no tiene ningún modelo en estado `listo`
- WHEN el usuario intenta iniciar una transcripción
- THEN la acción de transcribir queda bloqueada con un CTA directo a Ajustes → Modelos y descargas
- AND la tarea NO se encola para fallar posteriormente
