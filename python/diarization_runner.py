"""
diarization_runner.py — Script standalone de diarización con pyannote.

Se ejecuta con el Python del entorno de diarización dedicado:
  diarization-env/bin/python diarization_runner.py --wav <path> [--hf_token <token>] --output <json_path>

Argumentos:
  --wav           Ruta al archivo de audio a diarizar
  --hf_token      Token de HuggingFace (necesario la primera vez para descargar el modelo)
  --output        Ruta donde escribir el JSON de resultado
  --download_only Solo descarga el modelo sin diarizar

Output JSON:
  { "segments": [{ "start": 0.0, "end": 2.3, "speaker": "SPEAKER_00" }] }
  { "error": "mensaje de error" }

IMPORTANTE: pyannote/speaker-diarization-3.1 requiere aceptar DOS licencias en HuggingFace:
  1. https://huggingface.co/pyannote/speaker-diarization-3.1
  2. https://huggingface.co/pyannote/segmentation-3.0
"""

import argparse
import json
import os
import sys
import pathlib
import subprocess
import tempfile


def ensure_wav(audio_path):
    """
    Convierte el archivo a WAV mono 16kHz si no es WAV.
    Devuelve (wav_path, is_temp) — si is_temp=True, el llamador debe borrar el archivo.
    """
    if audio_path.lower().endswith('.wav'):
        return audio_path, False

    tmp = tempfile.NamedTemporaryFile(suffix='.wav', delete=False)
    tmp.close()
    tmp_path = tmp.name
    try:
        subprocess.run(
            ['ffmpeg', '-y', '-i', audio_path,
             '-ar', '16000', '-ac', '1', '-f', 'wav', tmp_path],
            stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=True
        )
        return tmp_path, True
    except Exception as e:
        os.unlink(tmp_path)
        raise RuntimeError(f'Error convirtiendo a WAV: {e}')


def check_model_cached():
    """Comprueba si el modelo principal está en caché local."""
    home = pathlib.Path.home()
    candidates = [
        home / '.cache' / 'huggingface' / 'hub' / 'models--pyannote--speaker-diarization-3.1',
        home / '.cache' / 'torch' / 'pyannote' / 'speaker-diarization-3.1',
    ]
    return any(p.exists() for p in candidates)


def check_all_models_cached():
    """
    Comprueba que TODOS los modelos necesarios estén en caché.
    Cuando todos están presentes podemos usar modo offline y evitar
    la comprobación online de licencias de repos protegidos.
    """
    home = pathlib.Path.home()
    hf_hub = home / '.cache' / 'huggingface' / 'hub'
    required = [
        hf_hub / 'models--pyannote--speaker-diarization-3.1',
        hf_hub / 'models--pyannote--segmentation-3.0',
        hf_hub / 'models--pyannote--speaker-diarization-community-1',
    ]
    return all(p.exists() for p in required)


def hf_login(hf_token):
    """Autentica con HuggingFace Hub via login()."""
    if not hf_token:
        return
    try:
        from huggingface_hub import login
        login(token=hf_token, add_to_git_credential=False)
    except Exception as e:
        print(f'Advertencia al autenticar con HuggingFace: {e}', file=sys.stderr, flush=True)


def load_pipeline(hf_token):
    """
    Carga el pipeline. Si todos los modelos están cacheados, usa modo offline
    para evitar comprobaciones online de licencias. Si falta algo, usa el token.
    """
    from pyannote.audio import Pipeline

    if check_all_models_cached():
        # Modo offline: evita la comprobación online de repos con licencia
        orig = os.environ.get('HF_HUB_OFFLINE')
        os.environ['HF_HUB_OFFLINE'] = '1'
        try:
            print('INFO:offline_mode', flush=True)
            return Pipeline.from_pretrained('pyannote/speaker-diarization-3.1')
        except Exception as e:
            print(f'Advertencia offline: {e} — reintentando online...', file=sys.stderr, flush=True)
        finally:
            if orig is None:
                os.environ.pop('HF_HUB_OFFLINE', None)
            else:
                os.environ['HF_HUB_OFFLINE'] = orig

    # Modo online con token
    hf_login(hf_token)
    return Pipeline.from_pretrained('pyannote/speaker-diarization-3.1')


def friendly_error(exc):
    """Convierte excepciones comunes en mensajes entendibles para el usuario."""
    msg = str(exc)
    if '401' in msg or 'credentials' in msg.lower() or 'unauthorized' in msg.lower():
        return ('Token inválido o licencias no aceptadas. '
                'Asegúrate de haber aceptado AMBAS licencias en HuggingFace: '
                'pyannote/speaker-diarization-3.1 Y pyannote/segmentation-3.0')
    if '403' in msg or 'forbidden' in msg.lower() or 'gated' in msg.lower():
        return ('Acceso denegado. Acepta las licencias de los dos modelos en HuggingFace: '
                'pyannote/speaker-diarization-3.1 y pyannote/segmentation-3.0')
    if 'connection' in msg.lower() or 'network' in msg.lower() or 'timeout' in msg.lower():
        return 'Sin conexión a internet. Comprueba tu red e inténtalo de nuevo.'
    return msg


def run(wav_path, hf_token, output_path):
    try:
        from pyannote.audio import Pipeline  # noqa — solo para verificar import
    except ImportError as e:
        write_output(output_path, {'error': f'pyannote.audio no instalado: {e}'})
        sys.exit(1)

    if not hf_token and not check_model_cached():
        write_output(output_path, {'error': 'Sin hf_token y modelo no en caché local'})
        sys.exit(1)

    print('PHASE:loading', flush=True)
    try:
        pipeline = load_pipeline(hf_token)
    except Exception as e:
        write_output(output_path, {'error': friendly_error(e)})
        sys.exit(1)

    print('PHASE:diarizing', flush=True)
    tmp_wav = None
    try:
        actual_path, is_tmp = ensure_wav(wav_path)
        if is_tmp:
            tmp_wav = actual_path
        diarization = pipeline(actual_path, min_speakers=1, max_speakers=8)
        segments = []
        # pyannote 4.x devuelve DiarizeOutput con serialize(); 3.x devuelve Annotation directamente
        if hasattr(diarization, 'serialize'):
            raw = diarization.serialize().get('diarization', [])
            for item in raw:
                if item.get('speaker') is None:
                    continue
                segments.append({
                    'start': round(item['start'], 3),
                    'end': round(item['end'], 3),
                    'speaker': item['speaker'],
                })
        else:
            for turn, _, speaker in diarization.itertracks(yield_label=True):
                if speaker is None:
                    continue
                segments.append({
                    'start': round(turn.start, 3),
                    'end': round(turn.end, 3),
                    'speaker': speaker,
                })
        speakers = sorted(set(s['speaker'] for s in segments))
        print(f'PHASE:done:{len(segments)}:{len(speakers)}', flush=True)
        write_output(output_path, {'segments': segments, 'speakers': speakers})
    except Exception as e:
        write_output(output_path, {'error': friendly_error(e)})
    finally:
        if tmp_wav and os.path.exists(tmp_wav):
            os.unlink(tmp_wav)


def write_output(output_path, data):
    try:
        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False)
    except Exception as e:
        print(f'Error escribiendo output: {e}', file=sys.stderr, flush=True)
        sys.exit(1)


def download_model_only(hf_token):
    """Descarga el modelo sin diarizar. Útil para precachear desde Settings."""
    try:
        from pyannote.audio import Pipeline  # noqa
    except ImportError as e:
        print(f'error:pyannote.audio no instalado: {e}', flush=True)
        sys.exit(1)

    print('PHASE:loading', flush=True)
    try:
        load_pipeline(hf_token)
        print('PHASE:done:0:0', flush=True)
    except Exception as e:
        print(f'error:{friendly_error(e)}', flush=True)
        sys.exit(1)


def main():
    parser = argparse.ArgumentParser(description='Diarización con pyannote.audio')
    parser.add_argument('--wav', default=None, help='Ruta al archivo de audio')
    parser.add_argument('--hf_token', default=None, help='Token HuggingFace')
    parser.add_argument('--output', default=None, help='Ruta JSON de salida')
    parser.add_argument('--download_only', action='store_true', help='Solo descarga el modelo')
    args = parser.parse_args()

    if args.download_only:
        download_model_only(args.hf_token)
        return

    if not args.wav or not args.output:
        print('error:--wav y --output son obligatorios sin --download_only', flush=True)
        sys.exit(1)

    run(args.wav, args.hf_token, args.output)


if __name__ == '__main__':
    main()
