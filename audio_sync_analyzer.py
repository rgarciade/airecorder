#!/usr/bin/env python3
print("🚀 Inicializando entorno Python...", flush=True)
"""
Audio Sync Analyzer - Herramienta para analizar y sincronizar dos archivos de audio grabados simultáneamente
Diseñado para trabajar con archivos generados por la aplicación de grabación dual.

Requisitos:
pip install pydub librosa soundfile numpy matplotlib openai-whisper

Uso:
python audio_sync_analyzer.py --basename prueba1
"""

import os
import numpy as np
import librosa
import matplotlib.pyplot as plt
from pydub import AudioSegment
from pydub.utils import make_chunks
import soundfile as sf
import whisper
import json
from datetime import timedelta
import argparse

BASE_DIR = "/Users/raul.garciad/Desktop/recorder/grabaciones"

# Configuración
SAMPLE_RATE = 22050  # Frecuencia de muestreo para análisis
CHUNK_SIZE_MS = 1000  # Tamaño de chunks en milisegundos
WHISPER_MODEL = "large"  # Opciones: tiny, base, small, medium, large

class AudioSyncAnalyzer:
    def __init__(self, mic_file, system_file, output_dir):
        self.mic_file = mic_file
        self.system_file = system_file
        self.output_dir = output_dir
        self.mic_audio = None
        self.system_audio = None
        self.mic_data = None
        self.system_data = None
        self.whisper_model = None
        
    def load_whisper_model(self):
        """Cargar el modelo Whisper para transcripción"""
        print(f"🤖 Cargando modelo Whisper '{WHISPER_MODEL}'...", flush=True)
        try:
            self.whisper_model = whisper.load_model(WHISPER_MODEL)
            print("✅ Modelo Whisper cargado correctamente", flush=True)
            return True
        except Exception as e:
            print(f"❌ Error cargando modelo Whisper: {e}")
            return False
        
    def load_audio_files(self, mic_exists=True):
        """Cargar los archivos de audio usando pydub"""
        print("🎵 Cargando archivos de audio...", flush=True)
        
        try:
            if mic_exists:
                self.mic_audio = AudioSegment.from_file(self.mic_file)
                print(f"📁 Micrófono: {len(self.mic_audio)/1000:.2f} segundos")
                print(f"📊 Sample rate micrófono: {self.mic_audio.frame_rate} Hz")
            else:
                self.mic_audio = None
            self.system_audio = AudioSegment.from_file(self.system_file)
            print(f"📁 Sistema: {len(self.system_audio)/1000:.2f} segundos")
            print(f"📊 Sample rate sistema: {self.system_audio.frame_rate} Hz")
            
            return True
            
        except Exception as e:
            print(f"❌ Error cargando archivos: {e}")
            return False
    
    def convert_to_numpy(self, mic_exists=True):
        """Convertir audio a arrays numpy usando librosa para análisis avanzado"""
        print("🔄 Convirtiendo a arrays numpy...")
        
        try:
            temp_sys = "/tmp/temp_sys.wav"
            if mic_exists:
                temp_mic = "/tmp/temp_mic.wav"
                self.mic_audio.export(temp_mic, format="wav")
                self.mic_data, _ = librosa.load(temp_mic, sr=SAMPLE_RATE)
                os.remove(temp_mic)
            else:
                self.mic_data = None
            self.system_audio.export(temp_sys, format="wav")
            self.system_data, _ = librosa.load(temp_sys, sr=SAMPLE_RATE)
            os.remove(temp_sys)
            if mic_exists:
                print(f"✅ Arrays creados - Mic: {len(self.mic_data)} samples, Sistema: {len(self.system_data)} samples")
            else:
                print(f"✅ Array creado - Solo sistema: {len(self.system_data)} samples")
            return True
            
        except Exception as e:
            print(f"❌ Error en conversión: {e}")
            return False
    
    def analyze_audio_properties(self, mic_exists=True):
        """Analizar propiedades básicas de los audios"""
        print("\n📊 ANÁLISIS DE PROPIEDADES")
        print("=" * 50)
        
        sys_duration = len(self.system_data) / SAMPLE_RATE
        print(f"⏱️  Duración sistema: {sys_duration:.2f} segundos")
        if mic_exists and self.mic_data is not None:
            mic_duration = len(self.mic_data) / SAMPLE_RATE
            print(f"⏱️  Duración micrófono: {mic_duration:.2f} segundos")
            print(f"⚖️  Diferencia: {abs(mic_duration - sys_duration):.2f} segundos")
            mic_rms = np.sqrt(np.mean(self.mic_data**2))
            print(f"🔊 RMS micrófono: {mic_rms:.4f}")
            mic_silence = np.sum(np.abs(self.mic_data) < 0.01) / len(self.mic_data) * 100
            print(f"🔇 Silencio micrófono: {mic_silence:.1f}%")
        sys_rms = np.sqrt(np.mean(self.system_data**2))
        print(f"🔊 RMS sistema: {sys_rms:.4f}")
        sys_silence = np.sum(np.abs(self.system_data) < 0.01) / len(self.system_data) * 100
        print(f"🔇 Silencio sistema: {sys_silence:.1f}%")
    
    def detect_cross_correlation(self, mic_exists=True):
        """Detectar sincronización usando correlación cruzada"""
        print("\n🔍 ANÁLISIS DE SINCRONIZACIÓN")
        print("=" * 50)
        
        if not mic_exists or self.mic_data is None:
            print("⚠️  No hay datos de micrófono, se omite correlación cruzada.")
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
        
        print(f"⚡ Lag detectado: {lag} samples ({lag_seconds:.3f} segundos)")
        
        if abs(lag_seconds) < 0.1:
            print("✅ Archivos bien sincronizados")
        elif abs(lag_seconds) < 1.0:
            print("⚠️  Pequeño desfase detectado")
        else:
            print("❌ Desfase significativo detectado")
        
        return lag_seconds
    
    def create_synchronized_chunks(self, lag_seconds=0, mic_exists=True):
        """Crear chunks sincronizados para análisis temporal"""
        print(f"\n⏰ CREANDO CHUNKS SINCRONIZADOS (lag: {lag_seconds:.3f}s)")
        print("=" * 50)
        
        if not mic_exists or self.mic_audio is None:
            print("⚠️  Solo se procesará el sistema.")
            system_adjusted = self.system_audio
            duration = len(system_adjusted)
            num_chunks = duration // CHUNK_SIZE_MS
            print(f"📦 Creando {num_chunks} chunks de {CHUNK_SIZE_MS}ms cada uno (solo sistema)")
            chunks_info = []
            for i in range(num_chunks):
                start_ms = i * CHUNK_SIZE_MS
                end_ms = start_ms + CHUNK_SIZE_MS
                sys_chunk = system_adjusted[start_ms:end_ms]
                sys_rms = sys_chunk.rms
                sys_active = sys_rms > 100
                chunk_info = {
                    'start_time': start_ms / 1000,
                    'end_time': end_ms / 1000,
                    'mic_rms': None,
                    'sys_rms': sys_rms,
                    'mic_active': None,
                    'sys_active': sys_active,
                    'both_active': None
                }
                chunks_info.append(chunk_info)
            return chunks_info
        
        # Ajustar por lag si es necesario
        if lag_seconds > 0:
            # Sistema adelantado, recortar inicio del sistema
            lag_ms = int(lag_seconds * 1000)
            system_adjusted = self.system_audio[lag_ms:]
            mic_adjusted = self.mic_audio
        elif lag_seconds < 0:
            # Micrófono adelantado, recortar inicio del micrófono
            lag_ms = int(abs(lag_seconds) * 1000)
            mic_adjusted = self.mic_audio[lag_ms:]
            system_adjusted = self.system_audio
        else:
            # Sin ajuste necesario
            mic_adjusted = self.mic_audio
            system_adjusted = self.system_audio
        
        # Crear chunks
        duration = min(len(mic_adjusted), len(system_adjusted))
        num_chunks = duration // CHUNK_SIZE_MS
        
        print(f"📦 Creando {num_chunks} chunks de {CHUNK_SIZE_MS}ms cada uno")
        
        chunks_info = []
        
        for i in range(num_chunks):
            start_ms = i * CHUNK_SIZE_MS
            end_ms = start_ms + CHUNK_SIZE_MS
            
            mic_chunk = mic_adjusted[start_ms:end_ms]
            sys_chunk = system_adjusted[start_ms:end_ms]
            
            # Calcular RMS de cada chunk
            mic_rms = mic_chunk.rms
            sys_rms = sys_chunk.rms
            
            # Detectar actividad (no silencio)
            mic_active = mic_rms > 100  # Umbral ajustable
            sys_active = sys_rms > 100
            
            chunk_info = {
                'start_time': start_ms / 1000,
                'end_time': end_ms / 1000,
                'mic_rms': mic_rms,
                'sys_rms': sys_rms,
                'mic_active': mic_active,
                'sys_active': sys_active,
                'both_active': mic_active and sys_active
            }
            
            chunks_info.append(chunk_info)
        
        return chunks_info
    
    def transcribe_audio_files(self, lag_seconds=0, mic_exists=True):
        """Transcribir ambos archivos de audio usando Whisper con parámetros avanzados para evitar repeticiones y falsos positivos por música"""
        print("\n🎙️ TRANSCRIBIENDO ARCHIVOS DE AUDIO")
        print("=" * 50)
        
        # Crear el directorio de salida
        os.makedirs(self.output_dir, exist_ok=True)
        
        # Preparar archivos temporales WAV para Whisper
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
            else:
                temp_mic_wav = None
            if lag_seconds > 0:
                lag_ms = int(lag_seconds * 1000)
                system_adjusted = self.system_audio[lag_ms:]
            else:
                system_adjusted = self.system_audio
            system_adjusted.export(temp_sys_wav, format="wav")
            
            # Transcribir micrófono
            mic_result = None
            if mic_exists and temp_mic_wav:
                print("🎤 Transcribiendo audio de micrófono...", flush=True)
                mic_result = self.whisper_model.transcribe(
                    temp_mic_wav,
                    word_timestamps=True,
                    language="es",
                    no_speech_threshold=0.7,  # Más estricto para ignorar música
                    logprob_threshold=-0.5,   # Más estricto para ignorar baja confianza
                    condition_on_previous_text=False,  # Evita repeticiones
                    suppress_tokens="-1",  # Suprime tokens no hablados (como música)
                    verbose=False
                )
            
            # Transcribir sistema
            print("🔊 Transcribiendo audio de sistema...", flush=True)
            sys_result = self.whisper_model.transcribe(
                temp_sys_wav,
                word_timestamps=True,
                language="es",
                no_speech_threshold=0.7,
                logprob_threshold=-0.5,
                condition_on_previous_text=False,
                suppress_tokens="-1",
                verbose=False
            )
            
            # Limpiar archivos temporales
            if temp_mic_wav and os.path.exists(temp_mic_wav):
                os.remove(temp_mic_wav)
            if os.path.exists(temp_sys_wav):
                os.remove(temp_sys_wav)
            
            print("✅ Transcripción completada")
            
            return mic_result, sys_result
            
        except Exception as e:
            print(f"❌ Error en transcripción: {e}")
            return None, None
    
    def merge_close_segments(self, segments, min_gap_seconds=1.2):
        """Unir segmentos que estén muy cerca temporalmente para crear bloques más grandes"""
        if not segments:
            return segments
        merged = []
        current = segments[0].copy()
        for next_seg in segments[1:]:
            gap = next_seg['start'] - current['end']
            if gap <= min_gap_seconds and next_seg['source'] == current['source']:
                current['end'] = next_seg['end']
                current['text'] += ' ' + next_seg['text'].strip()
            else:
                merged.append(current)
                current = next_seg.copy()
        merged.append(current)
        return merged

    def combine_transcriptions(self, mic_result, sys_result, mic_exists=True):
        """Combinar las transcripciones eliminando duplicados y mejorando la detección de interlocutores"""
        print("\n📝 COMBINANDO TRANSCRIPCIONES")
        print("=" * 50)
        if not sys_result:
            print("❌ No hay transcripción de sistema para combinar")
            return
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
        debug_file = os.path.join(self.output_dir, "debug_segmentos.txt")
        with open(debug_file, 'w', encoding='utf-8') as dbg:
            dbg.write("SEGMENTOS ORIGINALES DE WHISPER\n")
            dbg.write("="*60 + "\n\n")
            if mic_exists and mic_result:
                dbg.write("MICRÓFONO:\n")
                for i, seg in enumerate(mic_result.get('segments', []), 1):
                    dbg.write(f"[{i}] {seg['start']:.2f}-{seg['end']:.2f}: {seg['text'].strip()}\n")
            dbg.write("\nSISTEMA:\n")
            for i, seg in enumerate(sys_result.get('segments', []), 1):
                dbg.write(f"[{i}] {seg['start']:.2f}-{seg['end']:.2f}: {seg['text'].strip()}\n")
        print(f"🪪 Segmentos originales guardados en: {debug_file}")
        all_segments = []
        processed_texts = set()
        if mic_exists and mic_result:
            mic_segments_raw = []
            for segment in mic_result.get('segments', []):
                text = segment['text'].strip()
                if text and len(text) > 3:
                    clean_text_key = clean_text(text)
                    if clean_text_key not in processed_texts:
                        mic_segments_raw.append({
                            'start': segment['start'],
                            'end': segment['end'],
                            'text': text,
                            'source': 'micrófono',
                            'emoji': '🎤',
                            'speaker': 'USUARIO'
                        })
                        processed_texts.add(clean_text_key)
            mic_segments_merged = self.merge_close_segments(mic_segments_raw, min_gap_seconds=1.2)
            all_segments.extend(mic_segments_merged)
        sys_segments_raw = []
        for segment in sys_result.get('segments', []):
            text = segment['text'].strip()
            if not text or len(text) <= 3:
                continue
            clean_text_key = clean_text(text)
            if clean_text_key in processed_texts:
                continue
            sys_segments_raw.append({
                'start': segment['start'],
                'end': segment['end'],
                'text': text,
                'source': 'sistema',
                'emoji': '🔊',
                'speaker': 'SISTEMA'
            })
            processed_texts.add(clean_text_key)
        sys_segments_merged = self.merge_close_segments(sys_segments_raw, min_gap_seconds=0.5)
        current_speaker_id = 1
        last_text = ""
        speaker_texts = {}
        for segment in sys_segments_merged:
            text = segment['text'].strip()
            if texts_similar(text, last_text):
                continue
            is_new_speaker = False
            if len(speaker_texts) > 0:
                best_match_speaker = None
                best_similarity = 0
                for speaker_id, speaker_text_list in speaker_texts.items():
                    for prev_text in speaker_text_list[-3:]:
                        if texts_similar(text, prev_text, threshold=0.6):
                            if texts_similar(text, prev_text, threshold=0.6) > best_similarity:
                                best_match_speaker = speaker_id
                                best_similarity = texts_similar(text, prev_text, threshold=0.6)
                if best_match_speaker:
                    current_speaker_id = best_match_speaker
                else:
                    current_speaker_id = len(speaker_texts) + 1
                    is_new_speaker = True
            else:
                speaker_texts[current_speaker_id] = []
            if current_speaker_id not in speaker_texts:
                speaker_texts[current_speaker_id] = []
            speaker_texts[current_speaker_id].append(text)
            speaker_label = f"INTERLOCUTOR-{current_speaker_id}"
            if is_new_speaker:
                speaker_label += " (NUEVO)"
            segment['speaker'] = speaker_label
            all_segments.append(segment)
            last_text = text
        all_segments.sort(key=lambda x: x['start'])
        filtered_segments = []
        for i, segment in enumerate(all_segments):
            is_duplicate = False
            for j in range(max(0, i-2), i):
                prev_seg = filtered_segments[j] if j < len(filtered_segments) else None
                if prev_seg and abs(segment['start'] - prev_seg['start']) < 1.0:
                    if texts_similar(segment['text'], prev_seg['text'], threshold=0.7):
                        is_duplicate = True
                        break
            if not is_duplicate:
                filtered_segments.append(segment)
        all_segments = filtered_segments
        output_file = os.path.join(self.output_dir, "transcripcion_combinada.txt")
        with open(output_file, 'w', encoding='utf-8') as f:
            f.write("TRANSCRIPCIÓN COMBINADA DE AUDIO DUAL\n")
            f.write("=" * 60 + "\n\n")
            if mic_exists and mic_result:
                f.write(f"🎤 Usuario: {len([s for s in all_segments if s['source'] == 'micrófono'])} segmentos\n")
            f.write(f"🔊 Sistema: {len([s for s in all_segments if s['source'] == 'sistema'])} segmentos\n")
            f.write(f"👥 Interlocutores detectados: {len(speaker_texts)} en canal sistema\n")
            f.write(f"📝 Total: {len(all_segments)} segmentos únicos\n\n")
            f.write("TIMELINE:\n")
            f.write("-" * 40 + "\n\n")
            for segment in all_segments:
                start_time = str(timedelta(seconds=int(segment['start'])))
                end_time = str(timedelta(seconds=int(segment['end'])))
                f.write(f"[{start_time} - {end_time}] {segment['emoji']} {segment['speaker']}:\n")
                f.write(f"   {segment['text']}\n\n")
        print(f"✅ Transcripción combinada guardada en: {output_file}")
        json_file = os.path.join(self.output_dir, "transcripcion_combinada.json")
        with open(json_file, 'w', encoding='utf-8') as f:
            json.dump({
                'metadata': {
                    'total_segments': len(all_segments),
                    'microphone_segments': len([s for s in all_segments if s['source'] == 'micrófono']) if mic_exists and mic_result else 0,
                    'system_segments': len([s for s in all_segments if s['source'] == 'sistema']),
                    'detected_speakers': len(speaker_texts),
                    'total_duration': max([s['end'] for s in all_segments]) if all_segments else 0
                },
                'segments': all_segments
            }, f, ensure_ascii=False, indent=2)
        print(f"✅ Metadatos JSON guardados en: {json_file}")
        mic_segments = [s for s in all_segments if s['source'] == 'micrófono'] if mic_exists and mic_result else []
        sys_segments = [s for s in all_segments if s['source'] == 'sistema']
        print(f"\n📊 ESTADÍSTICAS DE TRANSCRIPCIÓN:")
        if mic_exists and mic_result:
            print(f"   🎤 Segmentos de usuario: {len(mic_segments)}")
        print(f"   🔊 Segmentos de sistema: {len(sys_segments)}")
        print(f"   👥 Interlocutores detectados: {len(speaker_texts)}")
        print(f"   📝 Total de segmentos únicos: {len(all_segments)}")
        if all_segments:
            total_duration = max([s['end'] for s in all_segments])
            print(f"   ⏱️  Duración total: {timedelta(seconds=int(total_duration))}")
    
    def generate_activity_report(self, chunks_info, mic_exists=True):
        """Generar un reporte de actividad de los chunks sincronizados"""
        import os
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
        
        # Crear el directorio de salida
        os.makedirs(self.output_dir, exist_ok=True)
        
        # Tomar muestra para visualización (primeros 60 segundos)
        available_length = len(self.system_data)
        if mic_exists and self.mic_data is not None:
            available_length = min(available_length, len(self.mic_data))
        
        sample_duration = min(60 * SAMPLE_RATE, available_length)
        
        time_axis = np.linspace(0, sample_duration / SAMPLE_RATE, sample_duration)
        sys_sample = self.system_data[:sample_duration]
        
        # Crear la figura
        plt.figure(figsize=(15, 5 if not mic_exists else 8))
        
        if mic_exists and self.mic_data is not None:
            mic_sample = self.mic_data[:sample_duration]
            # Subplot micrófono
            plt.subplot(2, 1, 1)
            plt.plot(time_axis, mic_sample, alpha=0.7, color='blue')
            plt.title('🎙️ Señal de Micrófono')
            plt.ylabel('Amplitud')
            plt.grid(True, alpha=0.3)
            
            # Subplot sistema
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
        
        # Guardar
        output_file = os.path.join(self.output_dir, "waveforms.png")
        plt.savefig(output_file, dpi=300, bbox_inches='tight')
        plt.close()
        
        print(f"✅ Visualización guardada en: {output_file}")
    
    def run_full_analysis(self):
        """Ejecutar análisis completo incluyendo transcripción"""
        print("🚀 INICIANDO ANÁLISIS COMPLETO DE AUDIO DUAL")
        print("=" * 60)
        mic_exists = os.path.exists(self.mic_file)
        sys_exists = os.path.exists(self.system_file)
        if not mic_exists and not sys_exists:
            print(f"❌ No se encuentra ninguno de los archivos de audio: {self.mic_file} ni {self.system_file}")
            return False
        if not mic_exists:
            print(f"⚠️  Advertencia: No se encuentra archivo de micrófono: {self.mic_file}. Solo se analizará el sistema.")
        if not sys_exists:
            print(f"❌ No se encuentra archivo de sistema: {self.system_file}")
            return False
        # Cargar modelo Whisper
        if not self.load_whisper_model():
            return False
        # Ejecutar pasos del análisis
        if not self.load_audio_files(mic_exists=mic_exists):
            return False
        if not self.convert_to_numpy(mic_exists=mic_exists):
            return False
        self.analyze_audio_properties(mic_exists=mic_exists)
        lag_seconds = self.detect_cross_correlation(mic_exists=mic_exists)
        chunks_info = self.create_synchronized_chunks(lag_seconds, mic_exists=mic_exists)
        self.generate_activity_report(chunks_info, mic_exists=mic_exists)
        self.create_waveform_visualization(mic_exists=mic_exists)
        # NUEVA FUNCIONALIDAD: Transcripción y combinación
        mic_result, sys_result = self.transcribe_audio_files(lag_seconds, mic_exists=mic_exists)
        if sys_result:  # Solo combinar si hay sistema
            self.combine_transcriptions(mic_result, sys_result, mic_exists=mic_exists)
        print(f"\n🎉 ANÁLISIS COMPLETADO")
        print(f"📁 Archivos de salida en: {self.output_dir}")
        print(f"📝 Transcripción combinada: transcripcion_combinada.txt")
        return True

def parse_args():
    parser = argparse.ArgumentParser(description="Audio Sync Analyzer")
    parser.add_argument('--basename', type=str, required=True, help='Nombre base de la grabación (ej: prueba1)')
    return parser.parse_args()

def main():
    """Función principal"""
    print("🎵 AUDIO SYNC ANALYZER & TRANSCRIBER")
    print("Analizador y transcriptor para archivos de audio dual")
    print("=" * 60)

    args = parse_args()
    basename = args.basename
    mic_file = f"{BASE_DIR}/{basename}/{basename}-microphone.webm"
    system_file = f"{BASE_DIR}/{basename}/{basename}-system.webm"
    output_dir = f"{BASE_DIR}/{basename}/analysis"

    analyzer = AudioSyncAnalyzer(mic_file, system_file, output_dir)
    success = analyzer.run_full_analysis()

    if success:
        print("\n✅ Análisis y transcripción completados exitosamente")
        print(f"📋 Revisa los archivos en: {output_dir}")
        print("📝 Archivo principal: transcripcion_combinada.txt")
    else:
        print("\n❌ Error durante el análisis")

if __name__ == "__main__":
    main() 