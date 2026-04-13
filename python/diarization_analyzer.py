#!/usr/bin/env python3
import os
import sys
import json
import argparse
import traceback
from unittest.mock import MagicMock

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
    print("🛡️  Telemetría de pyannote interceptada y desactivada (Nuclear Patch).", flush=True)
except Exception as e:
    print(f"⚠️  No se pudo aplicar el parche nuclear de telemetría: {e}", flush=True)

# Desactivar telemetría mediante variable de entorno (respaldo adicional)
os.environ["PYANNOTE_TELEMETRY"] = "off"

import torch

def parse_args():
    parser = argparse.ArgumentParser(description="Pyannote Speaker Diarization Script")
    parser.add_argument('--audio_file', type=str, required=True, help='Ruta al archivo de audio (sistema)')
    parser.add_argument('--hf_token', type=str, required=True, help='HuggingFace Access Token')
    parser.add_argument('--output_json', type=str, required=True, help='Ruta de salida del JSON')
    parser.add_argument('--ffmpeg', type=str, default=None, help='Ruta al binario de ffmpeg')
    parser.add_argument('--ffprobe', type=str, default=None, help='Ruta al binario de ffprobe')
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
        device = torch.device("cuda" if torch.cuda.is_available() else ("mps" if torch.backends.mps.is_available() else "cpu"))
        print(f"💻 Usando dispositivo: {device}", flush=True)
        
        pipeline = Pipeline.from_pretrained(
            "pyannote/speaker-diarization-3.1",
            token=args.hf_token
        )
        
        if pipeline is None:
            raise Exception("No se pudo cargar el pipeline. Verifica tu HF Token y que hayas aceptado los términos en HuggingFace para pyannote/speaker-diarization-3.1")
            
        pipeline.to(device)
        print("✅ Pipeline cargado exitosamente", flush=True)
        print("PROGRESS:30", flush=True)
        
        print("🎙️ Procesando audio (esto puede tardar varios minutos)...", flush=True)
        print("PROGRESS:40", flush=True)
        
        # --- CARGA DE AUDIO ROBUSTA ---
        # En lugar de dejar que pyannote lea el archivo (que falla en .webm),
        # lo cargamos nosotros con pydub y le pasamos el waveform directamente.
        try:
            from pydub import AudioSegment
            import numpy as np
            
            if args.ffmpeg and os.path.isfile(args.ffmpeg):
                AudioSegment.converter = args.ffmpeg
                AudioSegment.ffmpeg = args.ffmpeg
            
            print("📏 Cargando audio en memoria...", flush=True)
            # Forzamos 16kHz y Mono que es el estándar para diarización
            audio = AudioSegment.from_file(args.audio_file).set_frame_rate(16000).set_channels(1)
            
            # Convertir a numpy y luego a tensor de torch
            samples = np.array(audio.get_array_of_samples()).astype(np.float32)
            # Normalizar a [-1, 1]
            samples = samples / (2**15) 
            
            waveform = torch.from_numpy(samples).unsqueeze(0) # Forma: (1, num_samples)
            sample_rate = 16000
            
            print(f"⏱️  Audio cargado: {len(samples)/sample_rate:.2f}s", flush=True)
            
            input_data = {
                "waveform": waveform,
                "sample_rate": sample_rate,
                "uri": "audio"
            }
        except Exception as e:
            print(f"⚠️  Error cargando waveform con pydub: {e}. Reintentando con ruta de archivo...", flush=True)
            input_data = {"uri": "audio", "audio": args.audio_file}

        # EJECUCIÓN DEL PIPELINE (Inferencia real)
        diarization = pipeline(input_data)
        
        print("✅ Diarización completada", flush=True)
        print("PROGRESS:90", flush=True)
        
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
            raise AttributeError(f"No se pudo extraer la anotación del resultado.")

        # Extraer segmentos originales
        raw_segments = []
        for turn, _, speaker in annotation.itertracks(yield_label=True):
            raw_segments.append({
                "start": turn.start,
                "end": turn.end,
                "speaker": speaker
            })

        # --- Lógica de unificación opcional (clustering threshold) ---
        # pyannote a veces separa a la misma persona si cambia el tono o hay ruido.
        # Aquí podríamos implementar un merge manual si fuera necesario, pero 
        # primero intentaremos limpiar segmentos extremadamente cortos que causan confusión.
        
        final_segments = []
        if raw_segments:
            # Eliminar segmentos de menos de 0.2s (ruido/respiraciones)
            filtered = [s for s in raw_segments if (s['end'] - s['start']) > 0.2]
            
            # Unir segmentos consecutivos del mismo hablante si el hueco es < 0.5s
            if filtered:
                current = filtered[0].copy()
                for next_seg in filtered[1:]:
                    if next_seg['speaker'] == current['speaker'] and (next_seg['start'] - current['end']) < 0.5:
                        current['end'] = next_seg['end']
                    else:
                        final_segments.append(current)
                        current = next_seg.copy()
                final_segments.append(current)
        
        # Guardar resultados
        os.makedirs(os.path.dirname(args.output_json), exist_ok=True)
        with open(args.output_json, 'w', encoding='utf-8') as f:
            json.dump(final_segments, f, indent=2)
            
        print(f"📝 Resultados guardados en: {args.output_json}", flush=True)
        print("PROGRESS:100", flush=True)
        
    except ImportError:
        sys.stderr.write("FATAL_ERROR: pyannote.audio no está instalado. Ejecuta 'pip install pyannote.audio'\n")
        sys.exit(1)
    except Exception as e:
        sys.stderr.write(f"FATAL_ERROR: {str(e)}\n")
        sys.stderr.write(traceback.format_exc())
        sys.exit(1)

if __name__ == "__main__":
    main()
