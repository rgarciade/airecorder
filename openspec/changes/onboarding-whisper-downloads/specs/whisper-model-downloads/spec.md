# Whisper Model Downloads Specification

## Purpose

Gestión explícita de descargas de recursos del inventario de modelos Whisper: cola con progreso, validación preventiva de espacio en disco, cancelación, reintento tras fallo y borrado seguro de modelos instalados.

## Requirements

### Requirement: Validación preventiva de espacio antes de descargar

El sistema MUST mostrar, antes de iniciar cualquier descarga, la finalidad del recurso, su tamaño de descarga, el espacio libre del volumen destino y el espacio estimado restante tras la descarga. El sistema MUST bloquear el inicio de la descarga si el espacio libre estimado resultante es insuficiente.

#### Scenario: Espacio suficiente habilita la descarga

- GIVEN el modelo `medium` pesa 1.5 GB y el volumen destino tiene 10 GB libres
- WHEN el usuario abre la confirmación de descarga
- THEN el sistema muestra finalidad, tamaño, espacio libre actual y espacio estimado restante, y permite confirmar

#### Scenario: Espacio insuficiente bloquea el inicio

- GIVEN el modelo `large-v3` pesa 3 GB y el volumen destino tiene 1 GB libre
- WHEN el usuario intenta confirmar la descarga
- THEN el sistema bloquea el inicio, explica que el espacio es insuficiente y no encola la descarga

### Requirement: Cola de descargas con progreso individual y global

El sistema MUST encolar las descargas solicitadas y MUST reportar el progreso individual de cada descarga activa y un progreso/resumen global mientras existan descargas en curso.

#### Scenario: Iniciar una descarga la agrega a la cola

- GIVEN el usuario confirma la descarga del modelo `small`
- WHEN la descarga se inicia
- THEN `small` aparece en la cola con progreso 0% y estado `descargando`

#### Scenario: El progreso avanza hasta completar

- GIVEN una descarga en curso al 40%
- WHEN la descarga sigue avanzando
- THEN el progreso individual se actualiza incrementalmente hasta llegar a 100% y el estado cambia a `listo`

### Requirement: Cancelar una descarga

El sistema MUST permitir cancelar una descarga en curso o un ítem en cola no iniciado.

#### Scenario: Cancelar una descarga a mitad de camino

- GIVEN una descarga del modelo `medium` está al 55%
- WHEN el usuario cancela la descarga
- THEN la descarga se detiene, los archivos parciales se descartan y el estado del modelo vuelve a `no descargado`

#### Scenario: Cancelar un ítem aún en cola

- GIVEN el modelo `large-v3` está en cola pero su descarga no inició
- WHEN el usuario lo cancela
- THEN el ítem se retira de la cola sin ninguna escritura en disco

### Requirement: Reintentar una descarga fallida

El sistema MUST ofrecer una acción de reintentar para toda descarga que falle por conectividad, permisos o espacio insuficiente sobrevenido durante la transferencia.

#### Scenario: Fallo de conectividad durante la descarga

- GIVEN una descarga del modelo `small` está en curso
- WHEN se pierde la conexión de red
- THEN la descarga queda marcada como `falló` con el motivo de red y una acción "Reintentar" visible

#### Scenario: Reintentar relanza la descarga

- GIVEN una descarga marcada como `falló`
- WHEN el usuario selecciona "Reintentar"
- THEN la descarga se relanza desde un estado limpio, sin arrastrar archivos parciales corruptos

### Requirement: Borrado de un modelo instalado con confirmación y guardia

El sistema MUST solicitar confirmación antes de borrar un modelo instalado, mostrando el espacio que se liberará. El sistema MUST bloquear el borrado si el modelo es el `whisperModel` default configurado en Ajustes, o si tiene tareas en estado `pending` o `processing` en la cola de transcripción; cualquiera de las dos condiciones MUST ser suficiente para bloquear.

#### Scenario: Borrar un modelo elegible

- GIVEN el modelo `tiny` está instalado, no es el default y no tiene tareas pendientes ni en proceso
- WHEN el usuario confirma su borrado
- THEN el sistema muestra el espacio a liberar, borra el modelo y su estado vuelve a `no descargado`

#### Scenario: Bloqueo por ser el modelo default

- GIVEN el modelo `medium` es el `whisperModel` default actual en Ajustes
- WHEN el usuario intenta borrarlo
- THEN el sistema bloquea el borrado y explica que es el modelo por defecto

#### Scenario: Bloqueo por tareas en cola

- GIVEN el modelo `small` tiene una tarea en estado `processing` en la cola de transcripción
- WHEN el usuario intenta borrarlo
- THEN el sistema bloquea el borrado y explica que hay tareas en curso que lo requieren
