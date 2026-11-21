"""
Gestor de recursos (descarga/borrado/escaneo) de modelos Whisper.

Módulo aislado, sin acoplarse a la lógica de transcripción de
`audio_sync_analyzer.py` (design.md D5). Solo importa `huggingface_hub`,
`json`, `os`, `sys`, `argparse` y, defensivamente, `faster_whisper.utils`
(para reutilizar su mapa `_MODELS` y `allow_patterns` — nunca para
transcribir).

Protocolo de salida (una línea = un JSON con prefijo, extiende el patrón
`PROGRESS:` ya usado en `audio_sync_analyzer.py` / `transcriptionManager.js`):

    PROGRESS:{"id":"small","received":123456,"total":486000000}
    DONE:{"id":"small","path":"/…/snapshots/<sha>","bytes":486000000}
    ERROR:{"id":"small","code":"network","detail":"…"}

Subcomandos:
    model_resources.py scan     --cache-dir P
    model_resources.py download --model ID --cache-dir P
    model_resources.py delete   --model ID --cache-dir P
"""

import argparse
import json
import os
import sys

from huggingface_hub import scan_cache_dir, snapshot_download

try:
    # Reutiliza el mapa oficial id->repoId de faster-whisper (única fuente
    # real de verdad de qué repo de HF corresponde a cada nombre de modelo).
    from faster_whisper.utils import _MODELS as MODEL_REPO_MAP
except Exception:
    # Import defensivo: si faster_whisper cambia su API interna o no está
    # disponible en este entorno, no debe tumbar scan/download/delete.
    MODEL_REPO_MAP = {
        "tiny": "Systran/faster-whisper-tiny",
        "base": "Systran/faster-whisper-base",
        "small": "Systran/faster-whisper-small",
        "medium": "Systran/faster-whisper-medium",
        "large-v3": "Systran/faster-whisper-large-v3",
    }

# Mismos patrones que faster_whisper.utils.download_model — evita traer
# archivos de entrenamiento/tokenización adicionales que no usa CTranslate2.
ALLOW_PATTERNS = [
    "config.json",
    "preprocessor_config.json",
    "model.bin",
    "tokenizer.json",
    "vocabulary.*",
]

NETWORK_ERROR_MARKERS = (
    "ConnectionError",
    "ConnectTimeout",
    "ReadTimeout",
    "Timeout",
    "HTTPError",
    "SSLError",
    "ProxyError",
)


def _emit(prefix, payload):
    print(f"{prefix}:{json.dumps(payload)}", flush=True)


def _resolve_repo_id(model_id):
    repo_id = MODEL_REPO_MAP.get(model_id)
    if not repo_id:
        raise ValueError(f"Modelo desconocido: {model_id}")
    return repo_id


def _classify_download_error(exc):
    """Mapea excepciones de huggingface_hub/requests a los códigos que
    espera el renderer (`ResourceItem.error.code` en design.md): la mayoría
    de los fallos reales de `download` son de red; espacio insuficiente lo
    detecta Node ANTES de spawnear (D4), y cancelación la maneja Node vía
    SIGTERM/SIGKILL sobre el proceso, no vía esta línea ERROR:.
    """
    exc_name = type(exc).__name__
    if any(marker in exc_name for marker in NETWORK_ERROR_MARKERS):
        return "network"
    message = str(exc).lower()
    if "no space" in message or "espacio" in message or "disk" in message:
        return "insufficient-space"
    if "connection" in message or "network" in message or "timed out" in message or "timeout" in message:
        return "network"
    return "unknown"


def _compute_snapshot_bytes(snapshot_dir):
    """Tamaño real del snapshot descargado, deduplicando por realpath —
    mismo criterio que `hfCacheScanner.js` en el lado Node (D3)."""
    if not snapshot_dir or not os.path.isdir(snapshot_dir):
        return 0

    seen_realpaths = set()
    total = 0
    for name in os.listdir(snapshot_dir):
        file_path = os.path.join(snapshot_dir, name)
        try:
            real = os.path.realpath(file_path)
        except OSError:
            continue
        if real in seen_realpaths:
            continue
        seen_realpaths.add(real)
        try:
            total += os.path.getsize(real)
        except OSError:
            continue
    return total


def _make_progress_tqdm_class(model_id):
    """Genera una subclase de `tqdm` ligada a `model_id`, que emite
    `PROGRESS:` con bytes recibidos/totales reales del snapshot completo.

    `huggingface_hub.snapshot_download` instancia `tqdm_class` en DOS
    contextos distintos, ambos con la MISMA clase (verificado empíricamente
    contra huggingface_hub 1.4.1, `_snapshot_download.py`):
      1. Una barra "bytes_progress" (`unit="B", total=0`) que agrega el
         progreso real de descarga: `total` se le suma vía mutación directa
         de atributo (`bytes_progress.total += n`, NO vía `__init__`/`update`)
         desde un wrapper interno (`_AggregatedTqdm`), y `update(n)` recibe
         los bytes reales descargados por cada archivo.
      2. Una barra externa "Fetching N files" (sin `unit="B"`, `total` =
         número de archivos) para el `thread_map` que orquesta las descargas
         en paralelo — NO representa bytes.
    Si no se distinguen ambas instancias, el conteo de archivos (ej. `4`)
    contamina el campo `total` de bytes. Se distinguen por `unit == "B"` en
    los kwargs de construcción (única marca fiable — `disable=True` en modo
    no interactivo hace que tqdm NO actualice `self.n`/`self.total` vía sus
    métodos internos, así que el tracking se hace enteramente a mano) y se
    intercepta la mutación de `total` con una property, porque llega por
    asignación directa de atributo, no por argumento de método.
    """
    from tqdm.auto import tqdm as base_tqdm

    state = {"received": 0, "total": 0}

    def _emit_progress():
        _emit("PROGRESS", {"id": model_id, "received": state["received"], "total": state["total"]})

    class _ProgressTqdm(base_tqdm):
        def __init__(self, *args, **kwargs):
            self._is_bytes_bar = kwargs.get("unit") == "B"
            super().__init__(*args, **kwargs)

        @property
        def total(self):
            return self.__dict__.get("_total_value", 0)

        @total.setter
        def total(self, value):
            self.__dict__["_total_value"] = value
            if getattr(self, "_is_bytes_bar", False) and value:
                state["total"] = value
                _emit_progress()

        def update(self, n=1):
            result = super().update(n)
            if getattr(self, "_is_bytes_bar", False) and n:
                state["received"] += n
                _emit_progress()
            return result

    return _ProgressTqdm


def cmd_scan(args):
    """Escaneo autoritativo vía huggingface_hub (capa de respaldo/depuración
    — el escaneo rápido para UI vive en Node `hfCacheScanner.js`, D3)."""
    try:
        cache_info = scan_cache_dir(args.cache_dir)
    except FileNotFoundError:
        _emit("DONE", {"cacheDir": args.cache_dir, "repos": []})
        return 0
    except Exception as exc:
        _emit("ERROR", {"code": "unknown", "detail": str(exc)})
        return 1

    repos = [
        {
            "repoId": repo.repo_id,
            "sizeOnDisk": repo.size_on_disk,
            "path": str(repo.repo_path),
        }
        for repo in cache_info.repos
    ]
    _emit("DONE", {"cacheDir": args.cache_dir, "repos": repos})
    return 0


def cmd_download(args):
    model_id = args.model
    try:
        repo_id = _resolve_repo_id(model_id)
    except ValueError as exc:
        _emit("ERROR", {"id": model_id, "code": "unknown", "detail": str(exc)})
        return 1

    progress_cls = _make_progress_tqdm_class(model_id)

    try:
        snapshot_path = snapshot_download(
            repo_id,
            cache_dir=args.cache_dir,
            allow_patterns=ALLOW_PATTERNS,
            tqdm_class=progress_cls,
        )
    except Exception as exc:
        code = _classify_download_error(exc)
        _emit("ERROR", {"id": model_id, "code": code, "detail": str(exc)})
        return 1

    total_bytes = _compute_snapshot_bytes(snapshot_path)
    _emit("DONE", {"id": model_id, "path": snapshot_path, "bytes": total_bytes})
    return 0


def cmd_delete(args):
    """Borra un modelo usando la API oficial de gestión de caché de HF
    (`scan_cache_dir().delete_revisions().execute()`), que maneja
    blobs/refs/snapshots correctamente. Un `rm -rf` desde Node dejaría blobs
    huérfanos compartidos con otros revisions (design.md, contrato IPC)."""
    model_id = args.model
    try:
        repo_id = _resolve_repo_id(model_id)
    except ValueError as exc:
        _emit("ERROR", {"id": model_id, "code": "unknown", "detail": str(exc)})
        return 1

    try:
        cache_info = scan_cache_dir(args.cache_dir)
        target_repo = next((repo for repo in cache_info.repos if repo.repo_id == repo_id), None)
        if target_repo is None:
            # Ya no está instalado — operación idempotente.
            _emit("DONE", {"id": model_id, "path": None, "bytes": 0})
            return 0

        revision_hashes = [revision.commit_hash for revision in target_repo.revisions]
        freed_bytes = target_repo.size_on_disk
        repo_path = str(target_repo.repo_path)

        strategy = cache_info.delete_revisions(*revision_hashes)
        strategy.execute()

        _emit("DONE", {"id": model_id, "path": repo_path, "bytes": freed_bytes})
        return 0
    except Exception as exc:
        _emit("ERROR", {"id": model_id, "code": "unknown", "detail": str(exc)})
        return 1


def build_parser():
    parser = argparse.ArgumentParser(prog="model_resources", description="Gestión de descargas de modelos Whisper")
    subparsers = parser.add_subparsers(dest="command", required=True)

    scan_parser = subparsers.add_parser("scan")
    scan_parser.add_argument("--cache-dir", dest="cache_dir", required=True)

    download_parser = subparsers.add_parser("download")
    download_parser.add_argument("--model", required=True)
    download_parser.add_argument("--cache-dir", dest="cache_dir", required=True)

    delete_parser = subparsers.add_parser("delete")
    delete_parser.add_argument("--model", required=True)
    delete_parser.add_argument("--cache-dir", dest="cache_dir", required=True)

    return parser


def main(argv=None):
    parser = build_parser()
    args = parser.parse_args(argv)

    os.makedirs(args.cache_dir, exist_ok=True)

    if args.command == "scan":
        return cmd_scan(args)
    if args.command == "download":
        return cmd_download(args)
    if args.command == "delete":
        return cmd_delete(args)

    parser.error(f"Comando desconocido: {args.command}")
    return 2


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
