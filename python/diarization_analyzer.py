#!/usr/bin/env python3
import os
import sys
import json
import argparse
import traceback
from unittest.mock import MagicMock

# Versión del schema de salida — útil para que Node.js detecte formato nuevo
OUTPUT_VERSION = "2.0"

# --- NUCLEAR OPTION: Desactivar telemetría ANTES de cualquier import de pyannote ---
# El bug de opentelemetry en pyannote.audio 3.1+ es extremadamente persistente.
# Mockeamos el módulo completo en sys.modules para interceptar cualquier intento de importación.
try:
    # Creamos un mock del módulo de métricas
    mock_metrics_mod = MagicMock()
    # Mock de la función que causa el crash
    mock_metrics_mod.track_pipeline_apply = lambda *args, **kwargs: None
    # Inyectamos el mock en sys.modules para que 'from pyannote.audio.telemetry.metrics import ...' obtenga el mock
    sys.modules["pyannote.audio.telemetry.metrics"] = mock_metrics_mod
    print(
        "🛡️  Telemetría de pyannote interceptada y desactivada (Nuclear Patch).",
        flush=True,
    )
except Exception as e:
    print(f"⚠️  No se pudo aplicar el parche nuclear de telemetría: {e}", flush=True)

# Desactivar telemetría mediante variable de entorno (respaldo adicional)
os.environ["PYANNOTE_TELEMETRY"] = "off"

import torch


def parse_args():
    parser = argparse.ArgumentParser(description="Pyannote Speaker Diarization Script")
    parser.add_argument(
        "--audio_file",
        type=str,
        required=True,
        help="Ruta al archivo de audio (sistema)",
    )
    parser.add_argument(
        "--hf_token", type=str, required=True, help="HuggingFace Access Token"
    )
    parser.add_argument(
        "--output_json", type=str, required=True, help="Ruta de salida del JSON"
    )
    parser.add_argument(
        "--ffmpeg", type=str, default=None, help="Ruta al binario de ffmpeg"
    )
    parser.add_argument(
        "--ffprobe", type=str, default=None, help="Ruta al binario de ffprobe"
    )
    return parser.parse_args()


def main():
    args = parse_args()

    print(f"🚀 Iniciando Diarización para: {args.audio_file}", flush=True)
    print("PROGRESS:5", flush=True)

    if not os.path.exists(args.audio_file):
        print(f"❌ Error: El archivo de audio no existe: {args.audio_file}", flush=True)
        sys.exit(1)

    try:
        # Importar pyannote aquí (ya con el parche aplicado en sys.modules)
        from pyannote.audio import Pipeline

        # Una capa extra de seguridad por si acaso
        try:
            import pyannote.audio.core.pipeline as p_mod

            p_mod.track_pipeline_apply = lambda *args, **kwargs: None
            print("🛡️  Parche secundario aplicado a core.pipeline.", flush=True)
        except Exception:
            pass

        print("🤖 Cargando Pipeline de pyannote.audio...", flush=True)
        print("PROGRESS:15", flush=True)

        # Determinar dispositivo (GPU si está disponible)
        device = torch.device(
            "cuda"
            if torch.cuda.is_available()
            else ("mps" if torch.backends.mps.is_available() else "cpu")
        )
        print(f"💻 Usando dispositivo: {device}", flush=True)

        pipeline = Pipeline.from_pretrained(
            "pyannote/speaker-diarization-3.1", token=args.hf_token
        )

        if pipeline is None:
            raise Exception(
                "No se pudo cargar el pipeline. Verifica tu HF Token y que hayas aceptado los términos en HuggingFace para pyannote/speaker-diarization-3.1"
            )

        pipeline.to(device)
        print("✅ Pipeline cargado exitosamente", flush=True)
        print("PROGRESS:30", flush=True)

        print("🎙️ Procesando audio (esto puede tardar varios minutos)...", flush=True)
        print("PROGRESS:40", flush=True)

        # --- CARGA DE AUDIO ROBUSTA ---
        # En lugar de dejar que pyannote lea el archivo (que falla en .webm),
        # lo cargamos nosotros con pydub y le pasamos el waveform directamente.
        # waveform/sample_rate se usan después para extraer embeddings por segmento.
        waveform = None
        sample_rate = None
        try:
            from pydub import AudioSegment
            import numpy as np

            if args.ffmpeg and os.path.isfile(args.ffmpeg):
                AudioSegment.converter = args.ffmpeg
                AudioSegment.ffmpeg = args.ffmpeg

            print("📏 Cargando audio en memoria...", flush=True)
            # Forzamos 16kHz y Mono que es el estándar para diarización
            audio = (
                AudioSegment.from_file(args.audio_file)
                .set_frame_rate(16000)
                .set_channels(1)
            )

            # Convertir a numpy y luego a tensor de torch
            samples = np.array(audio.get_array_of_samples()).astype(np.float32)
            # Normalizar a [-1, 1]
            samples = samples / (2**15)

            waveform = torch.from_numpy(samples).unsqueeze(0)  # Forma: (1, num_samples)
            sample_rate = 16000

            print(f"⏱️  Audio cargado: {len(samples) / sample_rate:.2f}s", flush=True)

            input_data = {
                "waveform": waveform,
                "sample_rate": sample_rate,
                "uri": "audio",
            }
        except Exception as e:
            print(
                f"⚠️  Error cargando waveform con pydub: {e}. Reintentando con ruta de archivo...",
                flush=True,
            )
            # En este path no tenemos waveform en memoria; los embeddings no
            # podrán extraerse directamente, pero la diarización sigue.
            input_data = {"uri": "audio", "audio": args.audio_file}

        # EJECUCIÓN DEL PIPELINE (Inferencia real)
        diarization = pipeline(input_data)

        print("✅ Diarización completada", flush=True)
        print("PROGRESS:75", flush=True)

        print("📊 Procesando y unificando resultados...", flush=True)

        annotation = None
        if hasattr(diarization, "itertracks"):
            annotation = diarization
        elif hasattr(diarization, "speaker_diarization"):
            annotation = diarization.speaker_diarization
        elif hasattr(diarization, "diarization"):
            annotation = diarization.diarization
        elif hasattr(diarization, "annotation"):
            annotation = diarization.annotation

        if annotation is None:
            raise AttributeError("No se pudo extraer la anotación del resultado.")

        # Extraer segmentos originales
        raw_segments = []
        for turn, _, speaker in annotation.itertracks(yield_label=True):
            raw_segments.append(
                {"start": turn.start, "end": turn.end, "speaker": speaker}
            )

        # --- Lógica de unificación opcional (clustering threshold) ---
        # pyannote a veces separa a la misma persona si cambia el tono o hay ruido.
        # Primero limpiamos segmentos extremadamente cortos que causan confusión.

        final_segments = []
        if raw_segments:
            # Eliminar segmentos de menos de 0.2s (ruido/respiraciones)
            filtered = [s for s in raw_segments if (s["end"] - s["start"]) > 0.2]

            # Unir segmentos consecutivos del mismo hablante si el hueco es < 0.5s
            if filtered:
                current = filtered[0].copy()
                for next_seg in filtered[1:]:
                    if (
                        next_seg["speaker"] == current["speaker"]
                        and (next_seg["start"] - current["end"]) < 0.5
                    ):
                        current["end"] = next_seg["end"]
                    else:
                        final_segments.append(current)
                        current = next_seg.copy()
                final_segments.append(current)

        print("PROGRESS:80", flush=True)

        # --- EXTRACCIÓN DE EMBEDDINGS POR HABLANTE ---
        # Para cada speaker único identificado, calculamos el embedding centroide
        # promediando los vectores de todos sus segmentos de audio.
        # Esto permite re-identificar al mismo hablante en sesiones futuras.
        # NOTA: Solo es posible si el waveform fue cargado en memoria (pydub path).
        # Si el fallback de ruta de archivo se usó, speaker_embeddings queda vacío.
        speaker_embeddings = {}
        try:
            import numpy as np

            if waveform is None or sample_rate is None:
                print(
                    "⚠️  Waveform no disponible en memoria; no se pueden extraer embeddings.",
                    flush=True,
                )
            else:
                # Obtener el modelo de embedding interno del pipeline de diarización.
                # En pyannote/speaker-diarization-3.1, el sub-pipeline de embedding
                # está expuesto como `pipeline._embedding` (modelo SpeechBrain/ECAPA-TDNN).
                embedding_model = None
                for attr in ("_embedding", "embedding_model", "embedding"):
                    if hasattr(pipeline, attr):
                        candidate = getattr(pipeline, attr)
                        # Verificamos que sea callable (un modelo Inference, no un dict)
                        if callable(candidate):
                            embedding_model = candidate
                            print(
                                f"🔍 Modelo de embedding encontrado en pipeline.{attr}",
                                flush=True,
                            )
                            break

                if embedding_model is not None:
                    # Logear el device del modelo para diagnóstico
                    if hasattr(embedding_model, "device"):
                        print(
                            f"💻 Device del modelo de embedding: {embedding_model.device}",
                            flush=True,
                        )

                    # Agrupar los segmentos (post-filtrado) por hablante para extraer
                    # el embedding de cada ventana y calcular el centroide.
                    # Recorte manual del waveform: PretrainedSpeakerEmbedding espera
                    # tensor (batch, channel, samples) — NO un dict con Segment.

                    # Diccionario: speaker -> lista de vectores numpy
                    speaker_vectors: dict[str, list] = {}
                    first_emb_logged = False
                    for seg in final_segments:
                        spk = seg["speaker"]

                        # 1.1 — Filtrar segmentos demasiado cortos (< 0.5s)
                        duration = seg["end"] - seg["start"]
                        if duration < 0.5:
                            print(
                                f"⏭️  Segmento descartado por duración corta ({duration:.3f}s): {spk} [{seg['start']:.2f}s-{seg['end']:.2f}s]",
                                flush=True,
                            )
                            continue

                        try:
                            # 1.2 — Recorte manual del waveform
                            start_sample = int(seg["start"] * sample_rate)
                            end_sample   = int(seg["end"]   * sample_rate)
                            segment = waveform[:, start_sample:end_sample]   # (1, n_seg)

                            # 3.1 — Guard de tensor vacío
                            if segment.shape[-1] == 0:
                                print(
                                    f"⚠️  Segmento vacío tras recorte; descartando: {spk} [{seg['start']:.2f}s-{seg['end']:.2f}s]",
                                    flush=True,
                                )
                                continue

                            segment = segment.unsqueeze(0)                   # (1, 1, n_seg)
                            if hasattr(embedding_model, "device"):
                                segment = segment.to(embedding_model.device)

                            emb = embedding_model(segment)

                            # 1.3 — Post-procesamiento del vector resultante
                            vec = np.squeeze(np.asarray(emb, dtype=np.float32))
                            if not first_emb_logged:
                                print(
                                    f"🔬 Shape del embedding (diagnóstico primer segmento): {np.asarray(emb, dtype=np.float32).shape}",
                                    flush=True,
                                )
                                first_emb_logged = True

                            if vec.ndim == 0 or vec.size == 0:
                                continue
                            speaker_vectors.setdefault(spk, []).append(vec)
                        except Exception as e_seg:
                            # Un segmento fallido no cancela el proceso completo
                            print(
                                f"⚠️  Error extrayendo embedding de {spk} [{seg['start']:.2f}s-{seg['end']:.2f}s]: {e_seg}",
                                flush=True,
                            )

                    # Calcular centroide (promedio normalizado) por hablante
                    for spk, vecs in speaker_vectors.items():
                        centroid = np.mean(np.stack(vecs, axis=0), axis=0)
                        # Normalizar a longitud unitaria (necesario para similitud coseno)
                        norm = np.linalg.norm(centroid)
                        if norm > 1e-8:
                            centroid = centroid / norm
                        # Convertir a lista Python de floats para serialización JSON
                        speaker_embeddings[spk] = centroid.tolist()

                    print(
                        f"✅ Embeddings extraídos para {len(speaker_embeddings)} hablante(s): {list(speaker_embeddings.keys())}",
                        flush=True,
                    )
                else:
                    # El modelo de embedding interno no está accesible en esta versión de pyannote.
                    # No se puede extraer embeddings; continuamos sin ellos.
                    print(
                        "⚠️  Modelo de embedding interno no accesible en pipeline. Continuando sin embeddings.",
                        flush=True,
                    )

        except Exception as e_emb:
            # Si la extracción de embeddings falla por cualquier razón, NO detenemos
            # el proceso — seguimos guardando los segmentos sin embeddings.
            print(
                f"⚠️  Extracción de embeddings falló: {e_emb}. Continuando sin embeddings.",
                flush=True,
            )
            speaker_embeddings = {}

        print("PROGRESS:90", flush=True)

        # --- COMPOSICIÓN DEL RESULTADO FINAL ---
        # Mantenemos retrocompatibilidad: si no hay embeddings, el nodo puede
        # seguir leyendo el JSON antiguo. La presencia de "version" y
        # "speaker_embeddings" indica el nuevo formato.
        output = {
            "version": OUTPUT_VERSION,
            "segments": final_segments,
            "speaker_embeddings": speaker_embeddings,
        }

        # Guardar resultados
        os.makedirs(os.path.dirname(args.output_json), exist_ok=True)
        with open(args.output_json, "w", encoding="utf-8") as f:
            json.dump(output, f, indent=2)

        print(f"📝 Resultados guardados en: {args.output_json}", flush=True)
        print("PROGRESS:100", flush=True)

    except ImportError:
        sys.stderr.write(
            "FATAL_ERROR: pyannote.audio no está instalado. Ejecuta 'pip install pyannote.audio'\n"
        )
        sys.exit(1)
    except Exception as e:
        sys.stderr.write(f"FATAL_ERROR: {str(e)}\n")
        sys.stderr.write(traceback.format_exc())
        sys.exit(1)


if __name__ == "__main__":
    main()
