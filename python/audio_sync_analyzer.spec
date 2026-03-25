# -*- mode: python ; coding: utf-8 -*-
"""
PyInstaller spec para audio_sync_analyzer.py
Genera un binario nativo macOS que incluye todas las dependencias Python.
Se usa en modo one-folder (COLLECT) para mejor compatibilidad con firma ad-hoc.
"""
import os

block_cipher = None

# Localizar site-packages del venv para incluir assets explícitamente
# En Windows: venv/Lib/site-packages (sin subcarpeta de versión)
# En Mac/Linux: venv/lib/pythonX.Y/site-packages
import sys, platform as _platform
_is_windows = _platform.system() == 'Windows'
_venv_root = os.path.join(os.path.dirname(SPECPATH), 'venv')
if _platform.system() == 'Windows':
    _venv_site = os.path.join(_venv_root, 'Lib', 'site-packages')
else:
    _venv_site = os.path.join(_venv_root, 'lib', f'python{sys.version_info.major}.{sys.version_info.minor}', 'site-packages')
_fw_assets = os.path.join(_venv_site, 'faster_whisper', 'assets')

a = Analysis(
    ['audio_sync_analyzer.py'],
    pathex=[],
    binaries=[],
    datas=[
        # Assets de faster_whisper: modelo Silero VAD (silero_vad_v6.onnx)
        # necesario para vad_filter=True en WhisperModel.transcribe()
        (_fw_assets, 'faster_whisper/assets'),
    ],
    hiddenimports=[
        # Transcripcion
        'faster_whisper',
        'ctranslate2',
        'onnxruntime',
        'av',
        'tokenizers',
        'huggingface_hub',
        # Audio
        'librosa',
        'librosa.util',
        'librosa.core',
        'librosa.core.audio',
        'soundfile',
        'pydub',
        'pydub.utils',
        # Numerico
        'numpy',
        'scipy',
        'scipy.signal',
        'sklearn',
        'sklearn.utils',
        'numba',
        'soxr',
        # Visualizacion
        'matplotlib',
        'matplotlib.backends.backend_agg',
    ],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[
        'torch',
        'torchvision',
        'torchaudio',
        'IPython',
        'jupyter',
        'notebook',
        'pytest',
        'sphinx',
        'docutils',
        'tkinter',
        'pip',
        'setuptools',
        'wheel',
        'PyInstaller',
    ],
    noarchive=False,
)

pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name='audio_sync_analyzer',
    debug=False,
    bootloader_ignore_signals=False,
    strip=not _is_windows,
    upx=False,
    console=True,
    target_arch=None,
)

coll = COLLECT(
    exe,
    a.binaries,
    a.datas,
    strip=not _is_windows,
    upx=False,
    name='audio_sync_analyzer',
)
