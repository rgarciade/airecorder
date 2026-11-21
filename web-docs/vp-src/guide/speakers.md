---
title: Gestionar Hablantes
description: Aprende a gestionar e identificar hablantes en tus transcripciones.
---

# Gestionar Hablantes

La diarización de hablantes te permite saber **quién dijo qué** en tus grabaciones. AIRecorder utiliza tecnología de reconocimiento de voz para identificar automáticamente diferentes voces.

## Cómo Funciona

Cuando activas la diarización, AIRecorder:

1. Analiza las características acústicas de cada segmento de voz
2. Convierte cada voz en un **embedding** (vector numérico único)
3. Agrupa segmentos con voces similares
4. Asigna identificadores automáticos (Hablante 1, Hablante 2, etc.)

## Asignar Nombres a Hablantes

Puedes asignar nombres personalizados a cada hablante detectado:

1. Abre una transcripción con diarización
2. Haz clic en el identificador del hablante (ej: "Hablante 1")
3. Escribe el nombre que deseas asignar
4. Pulsa Enter para guardar

AIRecorder vinculará ese nombre con el **embedding de voz** y reconocerá automáticamente a esa persona en grabaciones futuras.

## Fusionar Hablantes

A veces la diarización puede dividir a la misma persona en varios perfiles (por ejemplo, si cambia el tono de voz). Para fusionarlos:

1. Ve a la sección **Hablantes** en la barra lateral
2. Selecciona los perfiles que deseas fusionar
3. Haz clic en **Fusionar**
4. El sistema combinará los perfiles en uno solo

::: warning
Al fusionar perfiles, mantendrás todo el historial de transcripción pero bajo un único nombre.
:::

## Ajustar la Sensibilidad

El **umbral de similitud** determina cómo se agrupan las voces:

| Valor | Comportamiento |
|-------|----------------|
| 0.75 - 0.80 | Más permisivo (puede unir voces diferentes) |
| 0.85 | Equilibrio (recomendado) |
| 0.90 - 0.95 | Más estricto (puede dividir la misma voz) |

Para ajustar, ve a **Ajustes > General > Diarización de Interlocutores**.

## Mejores Prácticas

- **Asigna nombres pronto**: Cuanto antes nombre a un hablante, mejor funcionará el reconocimiento en el futuro
- **Revisa después de cada grabación nueva**: Verifica que los nombres se hayan aplicado correctamente
- **Usa la fusión con cuidado**: Solo fusiona perfiles que pertenezcan claramente a la misma persona