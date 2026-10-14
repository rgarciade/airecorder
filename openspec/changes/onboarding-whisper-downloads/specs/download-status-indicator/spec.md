# Download Status Indicator Specification

## Purpose

Bocadillo global persistente que informa el estado de las descargas activas de modelos Whisper en toda la aplicación, con vista contraída y expandida, y acceso directo a la sección de Ajustes correspondiente.

## Requirements

### Requirement: Visibilidad global mientras haya descargas activas

El sistema MUST mostrar el bocadillo en cualquier vista de la aplicación mientras exista al menos una descarga activa en la cola.

#### Scenario: Descarga iniciada desde Ajustes visible en Home

- GIVEN el usuario inicia una descarga desde Ajustes → Modelos y descargas
- WHEN navega a Home
- THEN el bocadillo permanece visible mostrando el progreso de esa descarga

### Requirement: Modo contraído y expandido

El sistema MUST soportar un modo contraído, mostrando como mínimo el nombre del recurso y su porcentaje de progreso, y un modo expandido con el detalle completo de la cola y un resumen tipo "N de M descargas".

#### Scenario: Expandir el bocadillo

- GIVEN el bocadillo está contraído mostrando "small — 45%"
- WHEN el usuario hace click sobre él
- THEN se expande mostrando el detalle completo de la cola y el resumen "1 de 2 descargas"

### Requirement: Click abre Ajustes

El sistema MUST navegar a Ajustes → Transcripción → Modelos y descargas cuando el usuario hace click en el bocadillo (fuera de la acción de cerrarlo).

#### Scenario: Click navega a Ajustes

- GIVEN el bocadillo está visible en cualquier vista
- WHEN el usuario hace click sobre el bocadillo
- THEN la aplicación navega a Ajustes → Transcripción → Modelos y descargas

### Requirement: Cerrar el bocadillo no cancela descargas

El sistema MUST, al cerrar u ocultar el bocadillo, mantener todas las descargas en curso sin cancelarlas.

#### Scenario: Cerrar con una descarga en curso

- GIVEN una descarga está al 40% de progreso
- WHEN el usuario cierra el bocadillo
- THEN el bocadillo se oculta y la descarga sigue avanzando en segundo plano

### Requirement: Ocultamiento automático solo si todas las descargas terminan OK

El sistema MUST ocultar el bocadillo automáticamente solo cuando todas las descargas de la cola finalizan exitosamente. El sistema MUST mantenerlo visible con estado de error accionable si alguna descarga de la cola falla.

#### Scenario: Todas las descargas completan exitosamente

- GIVEN la cola tiene 2 descargas activas
- WHEN ambas finalizan en estado `listo`
- THEN el bocadillo se oculta automáticamente

#### Scenario: Una descarga falla entre varias

- GIVEN la cola tiene 3 descargas, 2 completan exitosamente y 1 falla
- WHEN la última finaliza en estado `falló`
- THEN el bocadillo permanece visible mostrando la descarga fallida con una acción de reintentar accionable

### Requirement: Coexistencia con RecordingOverlay

El sistema MUST mostrar el bocadillo y `RecordingOverlay` simultáneamente cuando ambos aplican, sin que ninguno oculte al otro; el bocadillo MUST posicionarse por debajo de `RecordingOverlay`.

#### Scenario: Grabación en curso con descarga activa

- GIVEN `RecordingOverlay` está visible por una grabación en curso
- WHEN existe además una descarga activa en la cola
- THEN ambos elementos se muestran simultáneamente, con el bocadillo posicionado debajo del overlay
