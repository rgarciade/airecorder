# Onboarding Model Selection Specification

## Purpose

Paso propio del wizard de onboarding para elegir y, opcionalmente, descargar el modelo de transcripción inicial. No bloquea la finalización del onboarding.

## Requirements

### Requirement: Paso independiente "Modelo de transcripción"

El sistema MUST incluir un paso propio del wizard de onboarding, separado de los demás pasos, dedicado a la selección del modelo de transcripción.

#### Scenario: Llegar al paso de modelo

- GIVEN el usuario avanza en el wizard de onboarding
- WHEN llega al paso "Modelo de transcripción"
- THEN ve el catálogo de modelos disponibles con sus tamaños y estados

### Requirement: Modelo recomendado preseleccionado

El sistema MUST preseleccionar el modelo `small` como recomendado al entrar al paso, y MUST permitir al usuario cambiar la selección antes de descargar.

#### Scenario: Preselección por defecto

- GIVEN el usuario entra por primera vez al paso de modelo
- WHEN el paso se renderiza
- THEN `small` aparece preseleccionado como opción recomendada

#### Scenario: Cambiar la preselección

- GIVEN `small` está preseleccionado
- WHEN el usuario elige `medium` en su lugar
- THEN la selección activa pasa a `medium` y una descarga posterior usa ese modelo

### Requirement: Paso no bloqueante

El sistema MUST permitir completar el onboarding sin haber descargado ningún modelo.

#### Scenario: Omitir la descarga y terminar el onboarding

- GIVEN el usuario está en el paso de modelo sin haber iniciado ninguna descarga
- WHEN avanza y completa el resto del wizard
- THEN el onboarding termina exitosamente sin ningún modelo instalado

#### Scenario: Terminar el onboarding con una descarga en curso

- GIVEN el usuario inició la descarga de `small` desde el paso de modelo y aún no terminó
- WHEN avanza y completa el resto del wizard
- THEN el onboarding termina exitosamente y la descarga continúa en segundo plano, visible en el bocadillo global

### Requirement: Persistir el modelo elegido como default

El sistema MUST, al completar exitosamente una descarga iniciada desde este paso, persistir el modelo descargado como `whisperModel` default en Ajustes.

#### Scenario: Descarga completada desde onboarding

- GIVEN el usuario descargó `small` desde el paso de onboarding y la descarga finaliza en `listo`
- WHEN la descarga se completa
- THEN `settings.whisperModel` queda configurado en `small`

#### Scenario: Descarga fallida o cancelada desde onboarding

- GIVEN el usuario inició la descarga de `medium` desde el paso de onboarding
- WHEN la descarga falla o se cancela
- THEN el sistema NO persiste ningún `whisperModel` default nuevo; el valor previo (o ausencia de default) se mantiene
