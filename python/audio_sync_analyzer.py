#!/usr/bin/env python3
import multiprocessing
multiprocessing.freeze_support()

import os
import sys
import tempfile

# Configurar matplotlib ANTES de importarlo
os.environ['MPLCONFIGDIR'] = os.path.join(tempfile.gettempdir(), 'matplotlib_cache')
import matplotlib
matplotlib.use('Agg')  # Backend sin GUI, sin intentar abrir ventanas

# Configurar ffmpeg para pydub ANTES de importar pydub
# (se recibe por env var FFMPEG_PATH, que Electron pasa al spawn)
_ffmpeg_env = os.environ.get('FFMPEG_PATH', '')
if _ffmpeg_env and os.path.isfile(_ffmpeg_env):
    os.environ['PATH'] = os.path.dirname(_ffmpeg_env) + os.pathsep + os.environ.get('PATH', '')

# Suprimir warnings cosméticos de pydub (no encuentra ffmpeg en PATH al importar)
import warnings
warnings.filterwarnings('ignore', category=RuntimeWarning, module='pydub')

print("INIT:start", flush=True)

import numpy as np
import librosa
import matplotlib.pyplot as plt
from pydub import AudioSegment
from pydub.utils import make_chunks
import soundfile as sf
from faster_whisper import WhisperModel
import json
from datetime import timedelta
import argparse

print("INIT:imports_ok", flush=True)

BASE_DIR = "/Users/raul.garciad/Desktop/recorder/grabaciones"

# Configuración
SAMPLE_RATE = 22050  # Frecuencia de muestreo para análisis
CHUNK_SIZE_MS = 1000  # Tamaño de chunks en milisegundos
WHISPER_MODEL = "large"  # Opciones: tiny, base, small, medium, large
MIN_SIGNAL_RMS = 0.001          # Por debajo de este RMS se considera pista silenciosa
SILENT_TRACK_THRESHOLD_PCT = 95.0  # Si el % de silencio supera este valor, la pista se descarta

# ---------------------------------------------------------------------------
# Diarización con pyannote.audio
# ---------------------------------------------------------------------------
# Se intenta importar pyannote al inicio. Si no está instalado, la
# diarización se desactiva automáticamente y se usa el fallback heurístico.
# ---------------------------------------------------------------------------
_PYANNOTE_AVAILABLE = False
try:
    from pyannote.audio import Pipeline as PyannotePipeline
    _PYANNOTE_AVAILABLE = True
    print("INIT:pyannote_ok", flush=True)
except ImportError:
    print("INIT:pyannote_not_available (pip install pyannote.audio)", flush=True)


class AudioSyncAnalyzer:
    def __init__(self, mic_file, system_file, output_dir, hf_token=None):
        self.mic_file = mic_file
        self.system_file = system_file
        self.output_dir = output_dir
        self.mic_audio = None
        self.system_audio = None
        self.mic_data = None
        self.system_data = None
        self.whisper_model = None
        # --- pyannote ---
        self.hf_token = hf_token
        self.diarization_pipeline = None
        
    # ------------------------------------------------------------------
    # Pyannote: verificar si el modelo está en cache local
    # ------------------------------------------------------------------
    @staticmethod
    def _check_pyannote_cache():
        """Verificar si el modelo pyannote ya está descargado en cache local.
        Si está en cache, se puede cargar sin token de HuggingFace."""
        import pathlib
        home = pathlib.Path.home()
        candidates = [
            home / '.cache' / 'huggingface' / 'hub' / 'models--pyannote--speaker-diarization-3.1',
            home / '.cache' / 'torch' / 'pyannote' / 'speaker-diarization-3.1',
        ]
        return any(p.exists() for p in candidates)

    # ------------------------------------------------------------------
    # Pyannote: carga del pipeline de diarización
    # ------------------------------------------------------------------
    def load_diarization_pipeline(self):
        """Cargar el pipeline de pyannote para speaker diarization.
        Si el modelo ya está en cache local, no necesita token de HuggingFace."""
        if not _PYANNOTE_AVAILABLE:
            print("⚠️  pyannote.audio no instalado – se usará fallback heurístico", flush=True)
            return False

        model_cached = self._check_pyannote_cache()

        if not self.hf_token and not model_cached:
            print("⚠️  Sin --hf_token y modelo no en cache – diarización desactivada", flush=True)
            return False

        if model_cached and not self.hf_token:
            print("✅ Modelo pyannote encontrado en cache local – cargando sin token", flush=True)
        else:
            print("🗣️  Cargando pipeline de diarización (pyannote)...", flush=True)

        try:
            kwargs = {"pretrained_model_name_or_path": "pyannote/speaker-diarization-3.1"}
            if self.hf_token:
                kwargs["use_auth_token"] = self.hf_token
            self.diarization_pipeline = PyannotePipeline.from_pretrained(**kwargs)
            print("✅ Pipeline de diarización cargado correctamente", flush=True)
            return True
        except Exception as e:
            print(f"⚠️  Error cargando pipeline pyannote: {e}", flush=True)
            print("    Se usará fallback heurístico", flush=True)
            return False

    # ------------------------------------------------------------------
    # Pyannote: ejecutar diarización sobre un archivo WAV
    # ------------------------------------------------------------------
    def run_diarization(self, wav_path, min_speakers=1, max_speakers=6):
        """Ejecutar diarización y devolver lista de (start, end, speaker)"""
        if self.diarization_pipeline is None:
            return None

        print(f"🗣️  Ejecutando diarización sobre: {os.path.basename(wav_path)}", flush=True)
        try:
            diarization = self.diarization_pipeline(
                wav_path,
                min_speakers=min_speakers,
                max_speakers=max_speakers,
            )
            segments = []
            for turn, _, speaker in diarization.itertracks(yield_label=True):
                segments.append({
                    'start': turn.start,
                    'end': turn.end,
                    'speaker': speaker,
                })
            speakers_found = set(s['speaker'] for s in segments)
            print(f"✅ Diarización completada: {len(segments)} segmentos, "
                  f"{len(speakers_found)} hablantes detectados ({', '.join(sorted(speakers_found))})",
                  flush=True)
            return segments
        except Exception as e:
            print(f"⚠️  Error en diarización: {e}", flush=True)
            return None

    # ------------------------------------------------------------------
    # Asignar speaker de pyannote a segmentos de Whisper
    # ------------------------------------------------------------------
    @staticmethod
    def assign_speakers_to_whisper(whisper_segments, diarization_segments):
        """Para cada segmento de Whisper, encontrar el speaker de pyannote con
        mayor solapamiento temporal."""
        if not diarization_segments:
            return whisper_segments

        for seg in whisper_segments:
            best_speaker = None
            best_overlap = 0.0
            for d in diarization_segments:
                overlap_start = max(seg['start'], d['start'])
                overlap_end = min(seg['end'], d['end'])
                overlap = max(0.0, overlap_end - overlap_start)
                if overlap > best_overlap:
                    best_overlap = overlap
                    best_speaker = d['speaker']
            seg['speaker'] = best_speaker or 'UNKNOWN'
        return whisper_segments

    def load_whisper_model(self):
        """Cargar el modelo Whisper para transcripción"""
        print(f"🤖 Cargando modelo Whisper '{WHISPER_MODEL}' con {CPU_THREADS} hilos...", flush=True)
        try:
            self.whisper_model = WhisperModel(
                WHISPER_MODEL, 
                device="cpu", 
                compute_type="int8",
                cpu_threads=CPU_THREADS
            )
            print("✅ Modelo Whisper cargado correctamente", flush=True)
            return True
        except Exception as e:
            print(f"❌ Error cargando modelo Whisper: {e}")
            return False
        
    def _load_audio_track(self, filepath, label):
        """Carga un archivo de audio con pydub. Retorna AudioSegment o None si falla."""
        try:
            audio = AudioSegment.from_file(filepath)
            print(f"📁 {label}: {len(audio)/1000:.2f} segundos", flush=True)
            print(f"📊 Sample rate {label.lower()}: {audio.frame_rate} Hz", flush=True)
            return audio
        except Exception as e:
            print(f"⚠️  No se pudo cargar {label} ({filepath}): {e}", flush=True)
            return None

    def load_audio_files(self, mic_exists=True, sys_exists=True):
        """Cargar los archivos de audio usando pydub"""
        print("🎵 Cargando archivos de audio...", flush=True)
        
        try:
            if mic_exists:
                self.mic_audio = self._load_audio_track(self.mic_file, 'Micrófono')
            else:
                self.mic_audio = None
            
            if sys_exists:
                self.system_audio = self._load_audio_track(self.system_file, 'Sistema')
            else:
                self.system_audio = None

            if mic_exists and self.mic_audio is None:
                mic_exists = False

            if sys_exists and self.system_audio is None:
                sys_exists = False

            if not mic_exists and not sys_exists:
                print("❌ No hay ninguna pista de audio válida para procesar.", flush=True)
                return False
            
            return True
            
        except Exception as e:
            print(f"❌ Error cargando archivos: {e}")
            return False
    
    def convert_to_numpy(self, mic_exists=True, sys_exists=True):
        """Convertir audio a arrays numpy usando librosa para análisis avanzado"""
        print("🔄 Convirtiendo a arrays numpy...")
        
        try:
            if mic_exists and self.mic_audio is not None:
                temp_mic = os.path.join(tempfile.gettempdir(), "temp_mic.wav")
                self.mic_audio.export(temp_mic, format="wav")
                self.mic_data, _ = librosa.load(temp_mic, sr=SAMPLE_RATE)
                os.remove(temp_mic)
            else:
                self.mic_data = None
            
            if sys_exists and self.system_audio is not None:
                temp_sys = os.path.join(tempfile.gettempdir(), "temp_sys.wav")
                self.system_audio.export(temp_sys, format="wav")
                self.system_data, _ = librosa.load(temp_sys, sr=SAMPLE_RATE)
                os.remove(temp_sys)
            else:
                self.system_data = None
            
            if mic_exists and self.mic_data is not None:
                if sys_exists and self.system_data is not None:
                    print(f"✅ Arrays creados - Mic: {len(self.mic_data)} samples, Sistema: {len(self.system_data)} samples")
                else:
                    print(f"✅ Array creado - Solo micrófono: {len(self.mic_data)} samples")
            elif sys_exists and self.system_data is not None:
                print(f"✅ Array creado - Solo sistema: {len(self.system_data)} samples")
            
            return True
            
        except Exception as e:
            print(f"❌ Error en conversión: {e}")
            return False
    
    def analyze_audio_properties(self, mic_exists=True, sys_exists=True):
        """Analizar propiedades básicas de los audios"""
        print("\n📊 ANÁLISIS DE PROPIEDADES")
        print("=" * 50)

        self.audio_metrics = {}
        
        sys_duration = 0
        mic_duration = 0

        if sys_exists and self.system_data is not None:
            sys_duration = len(self.system_data) / SAMPLE_RATE
            sys_rms = np.sqrt(np.mean(self.system_data**2))
            sys_silence = np.sum(np.abs(self.system_data) < 0.01) / len(self.system_data) * 100
            self.audio_metrics['system'] = {
                'duration': sys_duration,
                'rms': float(sys_rms),
                'silence_pct': float(sys_silence)
            }
            print(f"⏱️  Duración sistema: {sys_duration:.2f} segundos")
            print(f"🔊 RMS sistema: {sys_rms:.4f}")
            print(f"🔇 Silencio sistema: {sys_silence:.1f}%")
            
        if mic_exists and self.mic_data is not None:
            mic_duration = len(self.mic_data) / SAMPLE_RATE
            mic_rms = np.sqrt(np.mean(self.mic_data**2))
            mic_silence = np.sum(np.abs(self.mic_data) < 0.01) / len(self.mic_data) * 100
            self.audio_metrics['mic'] = {
                'duration': mic_duration,
                'rms': float(mic_rms),
                'silence_pct': float(mic_silence)
            }
            print(f"⏱️  Duración micrófono: {mic_duration:.2f} segundos")
            print(f"🔊 RMS micrófono: {mic_rms:.4f}")
            print(f"🔇 Silencio micrófono: {mic_silence:.1f}%")

        if mic_exists and sys_exists and self.mic_data is not None and self.system_data is not None:
            print(f"⚖️  Diferencia: {abs(mic_duration - sys_duration):.2f} segundos")

    def _is_silent_track(self, track_key):
        metrics = self.audio_metrics.get(track_key)
        if not metrics:
            return False
        return metrics['rms'] <= MIN_SIGNAL_RMS or metrics['silence_pct'] >= SILENT_TRACK_THRESHOLD_PCT

    def _sanitize_lag(self, lag_seconds):
        if lag_seconds == 0:
            return 0

        durations = []
        if self.mic_audio is not None:
            durations.append(len(self.mic_audio) / 1000)
        if self.system_audio is not None:
            durations.append(len(self.system_audio) / 1000)

        if not durations:
            return 0

        shortest_duration = min(durations)
        max_reasonable_lag = min(5.0, shortest_duration * 0.5)
        if abs(lag_seconds) > max_reasonable_lag:
            print(
                f"⚠️  Lag descartado por improbable ({lag_seconds:.3f}s > {max_reasonable_lag:.3f}s). Se usará 0.",
                flush=True
            )
            return 0

        return lag_seconds
        
    
    def detect_cross_correlation(self, mic_exists=True):
        """Detectar sincronización usando correlación cruzada"""
        print("\n🔍 ANÁLISIS DE SINCRONIZACIÓN")
        print("=" * 50)
        
        if not mic_exists or self.mic_data is None or self.system_data is None:
            print("⚠️  No hay datos de micrófono, se omite correlación cruzada.")
            return 0

        if self._is_silent_track('mic') or self._is_silent_track('system'):
            print("⚠️  Una de las pistas está prácticamente en silencio, se omite correlación cruzada.", flush=True)
            return 0

        # Tomar una muestra más pequeña para análisis rápido
        sample_length = min(len(self.mic_data), len(self.system_data), SAMPLE_RATE * 30)  # 30 segundos máximo
        
        mic_sample = self.mic_data[:sample_length]
        sys_sample = self.system_data[:sample_length]
        
        # Correlación cruzada
        correlation = np.correlate(mic_sample, sys_sample, mode='full')
        lag = np.argmax(correlation) - len(sys_sample) + 1
        
        # Convertir lag a tiempo
        lag_seconds = lag / SAMPLE_RATE
        lag_seconds = self._sanitize_lag(lag_seconds)
        
        print(f"⚡ Lag detectado: {lag} samples ({lag_seconds:.3f} segundos)")
        
        if abs(lag_seconds) < 0.1:
            print("✅ Archivos bien sincronizados")
        elif abs(lag_seconds) < 1.0:
            print("⚠️  Pequeño desfase detectado")
        else:
            print("❌ Desfase significativo detectado")
        
        return lag_seconds
    
    def create_synchronized_chunks(self, lag_seconds=0, mic_exists=True, sys_exists=True):
        """Crear chunks sincronizados para análisis temporal"""
        print(f"\n⏰ CREANDO CHUNKS SINCRONIZADOS (lag: {lag_seconds:.3f}s)")
        print("=" * 50)
        
        mic_adj = None
        sys_adj = None

        if mic_exists and self.mic_audio is not None:
            if sys_exists and self.system_audio is not None:
                if lag_seconds > 0:
                    sys_adj = self.system_audio[int(lag_seconds * 1000):]
                    mic_adj = self.mic_audio
                else:
                    mic_adj = self.mic_audio[int(abs(lag_seconds) * 1000):]
                    sys_adj = self.system_audio
            else:
                mic_adj = self.mic_audio
        elif sys_exists and self.system_audio is not None:
            sys_adj = self.system_audio

        if not mic_adj and not sys_adj:
            return []
        
        # Ajustar por lag si es necesario
        if lag_seconds > 0:
            lag_ms = int(lag_seconds * 1000)
            system_adjusted = self.system_audio[lag_ms:]
            mic_adjusted = self.mic_audio
        elif lag_seconds < 0:
            lag_ms = int(abs(lag_seconds) * 1000)
            mic_adjusted = self.mic_audio[lag_ms:]
            system_adjusted = self.system_audio
        else:
            mic_adjusted = self.mic_audio
            system_adjusted = self.system_audio
        
        # Crear chunks
        duration = min(len(mic_adjusted), len(system_adjusted))
        num_chunks = duration // CHUNK_SIZE_MS
        chunks_info = []

        for i in range(num_chunks):
            start_ms = i * CHUNK_SIZE_MS
            end_ms = start_ms + CHUNK_SIZE_MS
            
            mic_chunk = mic_adjusted[start_ms:end_ms]
            sys_chunk = system_adjusted[start_ms:end_ms]
            
            mic_rms = mic_chunk.rms
            sys_rms = sys_chunk.rms
            
            mic_active = mic_rms > 100
            sys_active = sys_rms > 100
            
            chunks_info.append({
                'start_time': start_ms / 1000,
                'end_time': end_ms / 1000,
                'mic_rms': mic_rms,
                'sys_rms': sys_rms,
                'mic_active': mic_active,
                'sys_active': sys_active,
                'both_active': (mic_active and sys_active) if (mic_active is not None and sys_active is not None) else None
            })
        
        return chunks_info
    
    def _transcribe_with_fallback(self, audio_file, **kwargs):
        """Llama a whisper_model.transcribe con los kwargs dados.
        Si falla por un modelo ONNX/VAD no encontrado, reintenta sin vad_filter."""
        try:
            return self.whisper_model.transcribe(audio_file, **kwargs)
        except Exception as e:
            err_str = str(e).lower()
            if 'silero_vad' in err_str or 'onnx' in err_str or 'no_such_file' in err_str or 'no such file' in err_str:
                print(f"⚠️  VAD no disponible ({type(e).__name__}), reintentando sin filtro de voz...", flush=True)
                kwargs.pop('vad_filter', None)
                kwargs.pop('vad_parameters', None)
                return self.whisper_model.transcribe(audio_file, **kwargs)
            raise

    def transcribe_audio_files(self, lag_seconds=0, mic_exists=True, sys_exists=True):
        """Transcribir ambos archivos de audio usando Whisper con parámetros avanzados"""
        print("\n🎙️ TRANSCRIBIENDO ARCHIVOS DE AUDIO")
        print("=" * 50)
        
        os.makedirs(self.output_dir, exist_ok=True)
        
        temp_sys_wav = os.path.join(self.output_dir, "temp_sys.wav")
        temp_mic_wav = os.path.join(self.output_dir, "temp_mic.wav") if mic_exists else None
        
        try:
            if mic_exists and self.mic_audio is not None:
                if lag_seconds < 0:
                    lag_ms = int(abs(lag_seconds) * 1000)
                    mic_adjusted = self.mic_audio[lag_ms:]
                else:
                    mic_adjusted = self.mic_audio
                mic_adjusted.export(temp_mic_wav, format="wav")
            
            if sys_exists and self.system_audio is not None:
                if lag_seconds > 0:
                    lag_ms = int(lag_seconds * 1000)
                    system_adjusted = self.system_audio[lag_ms:]
                else:
                    system_adjusted = self.system_audio
                system_adjusted.export(temp_sys_wav, format="wav")
            
            dynamic_beam_size = 5 if WHISPER_MODEL in ['tiny', 'base'] else (2 if WHISPER_MODEL == 'small' else 1)

            # -------------------------------------------------------
            # Diarización con pyannote ANTES de transcribir
            # -------------------------------------------------------
            sys_diarization = None
            if self.diarization_pipeline is not None and os.path.exists(temp_sys_wav):
                sys_diarization = self.run_diarization(temp_sys_wav)

            # Transcribir micrófono
            mic_result = None
            if mic_exists and temp_mic_wav and self.whisper_model:
                print("🎤 Transcribiendo audio de micrófono...", flush=True)
                segments, info = self._transcribe_with_fallback(
                    temp_mic_wav,
                    word_timestamps=True,
                    language=TRANSCRIPTION_LANGUAGE,
                    no_speech_threshold=0.7,
                    condition_on_previous_text=False,
                    beam_size=dynamic_beam_size,
                    vad_filter=True,
                    vad_parameters=dict(min_silence_duration_ms=500)
                )

                mic_segments = []
                base_progress = 10
                progress_weight = 45 if sys_exists else 85
                
                for segment in segments:
                    mic_segments.append({'start': segment.start, 'end': segment.end, 'text': segment.text})
                    if info.duration > 0:
                        current_progress = int(base_progress + (segment.end / info.duration) * progress_weight)
                        print(f"PROGRESS:{min(95 if not sys_exists else 55, current_progress)}", flush=True)

                mic_result = {
                    'text': ' '.join(s['text'] for s in mic_segments),
                    'segments': mic_segments
                }
                print(f"🎤 Segmentos detectados en micrófono: {len(mic_segments)}", flush=True)
            
            if mic_exists:
                print(f"PROGRESS:{55 if sys_exists else 95}", flush=True)

            # Transcribir sistema
            sys_result = None
            if sys_exists and temp_sys_wav and self.whisper_model:
                print("🔊 Transcribiendo audio de sistema...", flush=True)
                segments, info = self._transcribe_with_fallback(
                    temp_sys_wav,
                    word_timestamps=True,
                    language=TRANSCRIPTION_LANGUAGE,
                    no_speech_threshold=0.7,
                    condition_on_previous_text=False,
                    beam_size=dynamic_beam_size,
                    vad_filter=True,
                    vad_parameters=dict(min_silence_duration_ms=500)
                )
                
                sys_segments = []
                base_progress = 55 if mic_exists else 10
                progress_weight = 40 if mic_exists else 85
                
                for segment in segments:
                    sys_segments.append({'start': segment.start, 'end': segment.end, 'text': segment.text})
                    if info.duration > 0:
                        current_progress = int(base_progress + (segment.end / info.duration) * progress_weight)
                        print(f"PROGRESS:{min(95, current_progress)}", flush=True)

                # -------------------------------------------------------
                # Guardar la diarización para aplicarla después de fusionar
                # -------------------------------------------------------
                sys_result = {
                    'text': ' '.join(s['text'] for s in sys_segments),
                    'segments': sys_segments,
                    'diarization': sys_diarization,  # guardar para referencia
                }
                print(f"🔊 Segmentos detectados en sistema: {len(sys_segments)}", flush=True)
            
            if sys_exists:
                print("PROGRESS:95", flush=True)
            
            # Limpiar archivos temporales
            if temp_mic_wav and os.path.exists(temp_mic_wav):
                os.remove(temp_mic_wav)
            if temp_sys_wav and os.path.exists(temp_sys_wav):
                os.remove(temp_sys_wav)
            
            print("✅ Transcripción completada")
            
            return mic_result, sys_result
            
        except Exception as e:
            import traceback
            err_msg = traceback.format_exc()
            sys.stderr.write(f"TRANSCRIPTION_ERROR: {e}\n{err_msg}\n")
            sys.stderr.flush()
            print(f"❌ Error en transcripción: {e}", flush=True)
            return None, None
    
    def merge_close_segments(self, segments, min_gap_seconds=1.2):
        """Unir segmentos que estén muy cerca temporalmente para crear bloques más grandes.
        Solo une segmentos del mismo source."""
        if not segments:
            return segments
        merged = []
        current = segments[0].copy()
        for next_seg in segments[1:]:
            gap = next_seg['start'] - current['end']
            same_source = next_seg.get('source') == current.get('source')
            if gap <= min_gap_seconds and same_source:
                current['end'] = next_seg['end']
                current['text'] += ' ' + next_seg['text'].strip()
            else:
                merged.append(current)
                current = next_seg.copy()
        merged.append(current)
        return merged

    def combine_transcriptions(self, mic_result, sys_result, mic_exists=True):
        """Combinar las transcripciones usando diarización de pyannote cuando
        esté disponible, o fallback heurístico si no."""
        print("\n📝 COMBINANDO TRANSCRIPCIONES")
        print("=" * 50)
        
        if not sys_result and not mic_result:
            print("❌ No hay resultados de transcripción para combinar")
            return

        # ¿Tenemos diarización de pyannote?
        has_diarization = sys_result.get('diarization') is not None
        if has_diarization:
            print("🗣️  Usando diarización de pyannote para identificar interlocutores")
        else:
            print("⚠️  Sin diarización – usando fallback heurístico")

        def clean_text(text):
            return text.strip().lower().replace("  ", " ") if text else ""


        def texts_similar(text1, text2, threshold=0.8):
            if not text1 or not text2:
                return False
            clean1, clean2 = clean_text(text1), clean_text(text2)
            if len(clean1) == 0 or len(clean2) == 0:
                return False
            words1, words2 = set(clean1.split()), set(clean2.split())
            if len(words1) == 0 or len(words2) == 0:
                return False
            intersection = len(words1 & words2)
            union = len(words1 | words2)
            return intersection / union > threshold if union > 0 else False

        # --- Debug ---
        debug_file = os.path.join(self.output_dir, "debug_segmentos.txt")
        with open(debug_file, 'w', encoding='utf-8') as dbg:
            dbg.write("SEGMENTOS ORIGINALES DE WHISPER\n")
            dbg.write("=" * 60 + "\n\n")
            if mic_exists and mic_result:
                dbg.write("MICRÓFONO:\n")
                for i, seg in enumerate(mic_result.get('segments', []), 1):
                    dbg.write(f"[{i}] {seg['start']:.2f}-{seg['end']:.2f}: {seg['text'].strip()}\n")
            dbg.write("\nSISTEMA:\n")
            for i, seg in enumerate(sys_result.get('segments', []), 1):
                speaker_tag = seg.get('speaker', '?')
                dbg.write(f"[{i}] {seg['start']:.2f}-{seg['end']:.2f} [{speaker_tag}]: {seg['text'].strip()}\n")
        print(f"🪪 Segmentos originales guardados en: {debug_file}")

        all_segments = []
        processed_texts = set()

        # --- Segmentos de micrófono → USUARIO ---
        if mic_exists and mic_result:
            mic_segments_raw = []
            for segment in mic_result.get('segments', []):
                text = segment['text'].strip()
                if text and len(text) > 3:
                    clean_key = clean_text(text)
                    if clean_key not in processed_texts:
                        mic_segments_raw.append({
                            'start': segment['start'],
                            'end': segment['end'],
                            'text': text,
                            'source': 'micrófono',
                            'emoji': '🎤',
                            'speaker': 'USUARIO'
                        })
                        processed_texts.add(clean_key)
            mic_segments_merged = self.merge_close_segments(mic_segments_raw, min_gap_seconds=1.2)
            all_segments.extend(mic_segments_merged)

        # --- Segmentos de sistema ---
        sys_segments_raw = []

        for segment in sys_result.get('segments', []):
            text = segment['text'].strip()
            if not text or len(text) <= 3:
                continue
            clean_key = clean_text(text)
            if clean_key in processed_texts:
                continue

            sys_segments_raw.append({
                'start': segment['start'],
                'end': segment['end'],
                'text': text,
                'source': 'sistema',
                'emoji': '🔊',
            })
            processed_texts.add(clean_key)

        # 1. Hacemos el proceso que antes funcionaba: merge por tiempo (gap < 0.5s)
        sys_segments_merged = self.merge_close_segments(sys_segments_raw, min_gap_seconds=0.5)

        # 2. Posteriormente sobre esos fragmentos sacar las huellas (asignar diarización)
        speaker_label_map = {}
        speaker_counter = 0

        if has_diarization:
            sys_diarization = sys_result['diarization']
            sys_segments_merged = self.assign_speakers_to_whisper(sys_segments_merged, sys_diarization)
            print("✅ Speakers asignados a los segmentos fusionados del sistema", flush=True)

            for segment in sys_segments_merged:
                raw_speaker = segment.get('speaker', 'UNKNOWN')
                if raw_speaker not in speaker_label_map and raw_speaker != 'UNKNOWN':
                    speaker_counter += 1
                    speaker_label_map[raw_speaker] = f"INTERLOCUTOR-{speaker_counter}"
                
                segment['speaker'] = speaker_label_map.get(raw_speaker, "SISTEMA")
        else:
            for segment in sys_segments_merged:
                segment['speaker'] = "SISTEMA"

        all_segments.extend(sys_segments_merged)

        # --- Ordenar cronológicamente ---
        all_segments.sort(key=lambda x: x['start'])

        # --- Eliminar duplicados cercanos ---
        filtered_segments = []
        for i, segment in enumerate(all_segments):
            is_duplicate = False
            for j in range(max(0, i - 2), i):
                prev_seg = filtered_segments[j] if j < len(filtered_segments) else None
                if prev_seg and abs(segment['start'] - prev_seg['start']) < 1.0:
                    if texts_similar(segment['text'], prev_seg['text'], threshold=0.7):
                        is_duplicate = True
                        break
            if not is_duplicate:
                filtered_segments.append(segment)
        
        all_segments = filtered_segments

        # --- Contar speakers únicos en sistema ---
        sys_speakers = set(s['speaker'] for s in all_segments if s['source'] == 'sistema')

        # --- Guardar TXT ---
        output_file = os.path.join(self.output_dir, "transcripcion_combinada.txt")
        with open(output_file, 'w', encoding='utf-8') as f:
            f.write("TRANSCRIPCIÓN COMBINADA DE AUDIO DUAL\n")
            f.write("=" * 60 + "\n")
            if has_diarization:
                f.write("🗣️  Diarización: pyannote speaker-diarization-3.1\n")
            else:
                f.write("⚠️  Diarización: fallback heurístico\n")
            f.write("\n")
            if mic_exists and mic_result:
                f.write(f"🎤 Usuario: {len([s for s in all_segments if s['source'] == 'micrófono'])} segmentos\n")
            f.write(f"🔊 Sistema: {len([s for s in all_segments if s['source'] == 'sistema'])} segmentos\n")
            f.write(f"👥 Interlocutores detectados: {len(sys_speakers)} en canal sistema")
            if has_diarization:
                f.write(f" ({', '.join(sorted(sys_speakers))})")
            f.write(f"\n📝 Total: {len(all_segments)} segmentos únicos\n\n")
            f.write("TIMELINE:\n")
            f.write("-" * 40 + "\n\n")
            for segment in all_segments:
                start_time = str(timedelta(seconds=int(segment['start'])))
                end_time = str(timedelta(seconds=int(segment['end'])))
                f.write(f"[{start_time} - {end_time}] {segment['emoji']} {segment['speaker']}:\n")
                f.write(f"   {segment['text']}\n\n")
        print(f"✅ Transcripción combinada guardada en: {output_file}")

        # --- Guardar JSON ---
        json_file = os.path.join(self.output_dir, "transcripcion_combinada.json")
        with open(json_file, 'w', encoding='utf-8') as f:
            json.dump({
                'metadata': {
                    'diarization_method': 'pyannote-3.1' if has_diarization else 'heuristic',
                    'total_segments': len(all_segments),
                    'microphone_segments': len([s for s in all_segments if s['source'] == 'micrófono']),
                    'system_segments': len([s for s in all_segments if s['source'] == 'sistema']),
                    'detected_speakers': sorted(list(sys_speakers)),
                    'total_duration': max([s['end'] for s in all_segments]) if all_segments else 0
                },
                'segments': all_segments
            }, f, ensure_ascii=False, indent=2)
        print(f"✅ Metadatos JSON guardados en: {json_file}")

        # --- Estadísticas ---
        mic_segments = [s for s in all_segments if s['source'] == 'micrófono'] if mic_exists and mic_result else []
        sys_segs = [s for s in all_segments if s['source'] == 'sistema']
        print(f"\n📊 ESTADÍSTICAS DE TRANSCRIPCIÓN:")
        if mic_exists and mic_result:
            print(f"   🎤 Segmentos de usuario: {len(mic_segments)}")
        print(f"   🔊 Segmentos de sistema: {len(sys_segs)}")
        print(f"   👥 Interlocutores detectados: {len(sys_speakers)}")
        if has_diarization:
            print(f"   🏷️  Speakers: {', '.join(sorted(sys_speakers))}")
        print(f"   📝 Total de segmentos únicos: {len(all_segments)}")
        if all_segments:
            total_duration = max([s['end'] for s in all_segments])
            print(f"   ⏱️  Duración total: {timedelta(seconds=int(total_duration))}")
    
    def generate_activity_report(self, chunks_info, mic_exists=True):
        """Generar un reporte de actividad de los chunks sincronizados"""
        os.makedirs(self.output_dir, exist_ok=True)
        report_file = os.path.join(self.output_dir, 'activity_report.txt')
        sys_active_chunks = sum(1 for c in chunks_info if c['sys_active'])
        total_chunks = len(chunks_info)
        with open(report_file, 'w', encoding='utf-8') as f:
            f.write(f"Total de chunks: {total_chunks}\n")
            if total_chunks > 0:
                f.write(f"Chunks con actividad de sistema: {sys_active_chunks} ({sys_active_chunks/total_chunks*100:.1f}%)\n")
                if mic_exists:
                    mic_active_chunks = sum(1 for c in chunks_info if c['mic_active'])
                    f.write(f"Chunks con actividad de micrófono: {mic_active_chunks} ({mic_active_chunks/total_chunks*100:.1f}%)\n")
            else:
                f.write("No se generaron chunks sincronizados (total_chunks=0)\n")
    
    def create_waveform_visualization(self, mic_exists=True):
        """Crear visualización de formas de onda"""
        print("\n📈 CREANDO VISUALIZACIÓN")
        print("=" * 50)
        
        os.makedirs(self.output_dir, exist_ok=True)
        
        if self.system_data is None:
            return

        available_length = len(self.system_data)
        if mic_exists and self.mic_data is not None:
            available_length = min(available_length, len(self.mic_data))
        
        sample_duration = min(60 * SAMPLE_RATE, available_length)
        
        time_axis = np.linspace(0, sample_duration / SAMPLE_RATE, sample_duration)
        sys_sample = self.system_data[:sample_duration]
        
        plt.figure(figsize=(15, 5 if not mic_exists else 8))
        
        if mic_exists and self.mic_data is not None:
            mic_sample = self.mic_data[:sample_duration]
            plt.subplot(2, 1, 1)
            plt.plot(time_axis, mic_sample, alpha=0.7, color='blue')
            plt.title('🎙️ Señal de Micrófono')
            plt.ylabel('Amplitud')
            plt.grid(True, alpha=0.3)
            
            plt.subplot(2, 1, 2)
            plt.plot(time_axis, sys_sample, alpha=0.7, color='red')
            plt.title('🔊 Señal de Sistema')
            plt.xlabel('Tiempo (segundos)')
            plt.ylabel('Amplitud')
            plt.grid(True, alpha=0.3)
        else:
            plt.plot(time_axis, sys_sample, alpha=0.7, color='red')
            plt.title('🔊 Señal de Sistema (solo)')
            plt.xlabel('Tiempo (segundos)')
            plt.ylabel('Amplitud')
            plt.grid(True, alpha=0.3)
        
        plt.tight_layout()
        
        output_file = os.path.join(self.output_dir, "waveforms.png")
        plt.savefig(output_file, dpi=300, bbox_inches='tight')
        plt.close()
        
        print(f"✅ Visualización guardada en: {output_file}")
    
    def run_full_analysis(self):
        """Ejecutar análisis completo incluyendo transcripción"""
        print("PROGRESS:0", flush=True)
        print("🚀 INICIANDO ANÁLISIS COMPLETO DE AUDIO DUAL")
        print("=" * 60)
        
        mic_exists = os.path.exists(self.mic_file)
        sys_exists = os.path.exists(self.system_file)
        
        if not mic_exists and not sys_exists:
            print(f"❌ No se encuentra ninguno de los archivos de audio: {self.mic_file} ni {self.system_file}")
            return False
            
        if not mic_exists:
            print(f"⚠️  Advertencia: No se encuentra archivo de micrófono: {self.mic_file}.")
            
        if not sys_exists:
            print(f"❌ No se encuentra archivo de sistema: {self.system_file}")
            return False

        # Cargar modelo Whisper
        if not self.load_whisper_model():
            return False

        # Cargar pipeline de diarización (si hay token)
        self.load_diarization_pipeline()

        print("PROGRESS:5", flush=True)
        
        # Ejecutar pasos del análisis
        if not self.load_audio_files(mic_exists=mic_exists, sys_exists=sys_exists):
            return False

        mic_exists = self.mic_audio is not None
        sys_exists = self.system_audio is not None

        if not mic_exists and not sys_exists:
            print("❌ No quedó ninguna pista válida tras la carga inicial.", flush=True)
            return False
            
        print("PROGRESS:10", flush=True)
        
        if not self.convert_to_numpy(mic_exists=mic_exists, sys_exists=sys_exists):
            return False
            
        self.analyze_audio_properties(mic_exists=mic_exists, sys_exists=sys_exists)

        if sys_exists and self._is_silent_track('system'):
            print("⚠️  La pista de sistema está en silencio. Se omitirá para sincronización y transcripción.", flush=True)
            sys_exists = False

        if mic_exists and self._is_silent_track('mic'):
            print("⚠️  La pista de micrófono está en silencio. Se omitirá para sincronización y transcripción.", flush=True)
            mic_exists = False

        if not mic_exists and not sys_exists:
            print("❌ Ambas pistas están en silencio o sin señal útil.", flush=True)
            return False
        
        lag_seconds = 0
        if mic_exists and sys_exists:
            lag_seconds = self.detect_cross_correlation(mic_exists=mic_exists)
        
        print("PROGRESS:15", flush=True)
        
        chunks_info = self.create_synchronized_chunks(lag_seconds, mic_exists=mic_exists, sys_exists=sys_exists)
        self.generate_activity_report(chunks_info, mic_exists=mic_exists)
        self.create_waveform_visualization(mic_exists=mic_exists)
        print("PROGRESS:20", flush=True)
        mic_result, sys_result = self.transcribe_audio_files(lag_seconds, mic_exists=mic_exists, sys_exists=sys_exists)
        if sys_result:
            self.combine_transcriptions(mic_result, sys_result, mic_exists=mic_exists)
        print(f"\n🎉 ANÁLISIS COMPLETADO")
        print(f"📁 Archivos de salida en: {self.output_dir}")
        print("PROGRESS:100", flush=True)
        return True

def parse_args():
    parser = argparse.ArgumentParser(description="Audio Sync Analyzer")
    parser.add_argument('--basename', type=str, required=True, help='Nombre base de la grabación')
    parser.add_argument('--model', type=str, default="small", help='Modelo de Whisper (tiny, base, small, medium, large)')
    parser.add_argument('--language', type=str, default="es", help='Idioma para la transcripción (ej: es, en)')
    parser.add_argument('--base_dir', type=str, help='Directorio base de grabaciones')
    parser.add_argument('--threads', type=int, default=4, help='Hilos de CPU a utilizar')
    parser.add_argument('--ffmpeg', type=str, default=None, help='Ruta al binario de ffmpeg (para modo bundled)')
    parser.add_argument('--ffprobe', type=str, default=None, help='Ruta al binario de ffprobe (para modo bundled)')
    # --- Nuevo: token de HuggingFace para pyannote ---
    parser.add_argument('--hf_token', type=str, default=None,
                        help='Token de HuggingFace para pyannote speaker-diarization '
                             '(obtener en https://hf.co/settings/tokens)')
    return parser.parse_args()

def main():
    """Función principal"""
    args = parse_args()

    # Configurar ffmpeg y ffprobe bundled si se proporcionan las rutas
    if args.ffmpeg and os.path.isfile(args.ffmpeg):
        from pydub import AudioSegment
        AudioSegment.converter = args.ffmpeg
        AudioSegment.ffmpeg = args.ffmpeg
        os.environ['PATH'] = os.path.dirname(args.ffmpeg) + os.pathsep + os.environ.get('PATH', '')
        print(f"ffmpeg configurado: {args.ffmpeg}", flush=True)

    if args.ffprobe and os.path.isfile(args.ffprobe):
        from pydub import AudioSegment
        AudioSegment.ffprobe = args.ffprobe
        print(f"ffprobe configurado: {args.ffprobe}", flush=True)

    base_dir = args.base_dir if args.base_dir else BASE_DIR
    
    global WHISPER_MODEL
    WHISPER_MODEL = args.model
    
    global TRANSCRIPTION_LANGUAGE
    TRANSCRIPTION_LANGUAGE = args.language
    
    global CPU_THREADS
    CPU_THREADS = args.threads
    
    print(f"🎵 AUDIO SYNC ANALYZER & TRANSCRIBER")
    print(f"Modelo: {WHISPER_MODEL} | Idioma: {TRANSCRIPTION_LANGUAGE} | Hilos: {CPU_THREADS} | Directorio: {base_dir}")
    if args.hf_token:
        print(f"🗣️  Diarización: pyannote habilitado")
    else:
        print(f"⚠️  Diarización: deshabilitada (usa --hf_token para activar)")
    print("=" * 60)

    basename = args.basename
    import glob
    mic_pattern = os.path.join(base_dir, basename, f"{basename}-microphone.*")
    sys_pattern = os.path.join(base_dir, basename, f"{basename}-system.*")
    
    mic_files = [f for f in glob.glob(mic_pattern) if f.split('.')[-1].lower() in ['webm', 'wav', 'mp3', 'm4a', 'ogg', 'aac', 'flac']]
    sys_files = [f for f in glob.glob(sys_pattern) if f.split('.')[-1].lower() in ['webm', 'wav', 'mp3', 'm4a', 'ogg', 'aac', 'flac']]

    mic_file = mic_files[0] if mic_files else os.path.join(base_dir, basename, f"{basename}-microphone.webm")
    system_file = sys_files[0] if sys_files else os.path.join(base_dir, basename, f"{basename}-system.webm")
    output_dir = os.path.join(base_dir, basename, "analysis")

    analyzer = AudioSyncAnalyzer(mic_file, system_file, output_dir, hf_token=args.hf_token)
    success = analyzer.run_full_analysis()

    if success:
        print("\n✅ Análisis y transcripción completados exitosamente")
        print(f"📋 Revisa los archivos en: {output_dir}")
        print("📝 Archivo principal: transcripcion_combinada.txt")
    else:
        print("\n❌ Error durante el análisis")

if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        import traceback
        sys.stderr.write(f"FATAL_ERROR: {e}\n")
        sys.stderr.write(traceback.format_exc())
        sys.stderr.flush()
        sys.exit(1)