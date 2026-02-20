#!/usr/bin/env python3
"""
teams_converter.py — Convierte transcripciones de Microsoft Teams (.docx) al formato AIRecorder.

Uso:
  python scripts/teams_converter.py <input.docx> <output_dir>

Requisitos: ninguno (solo Python stdlib — zipfile + xml.etree.ElementTree).

Salida en output_dir/:
  transcripcion_combinada.json
  transcripcion_combinada.txt

Stdout: METADATA:{"duration": X, "segments": N, "speakers": K}
Código de salida: 0 éxito, 1 error.
"""

import json
import re
import sys
import zipfile
import xml.etree.ElementTree as ET
from datetime import timedelta
from pathlib import Path

# ---------------------------------------------------------------------------
# Constantes
# ---------------------------------------------------------------------------

# Namespace del DOCX (WordprocessingML)
W = "http://schemas.openxmlformats.org/wordprocessingml/2006/main"

# Regex principal: "Nombre   0:03Texto..." — Teams une speaker+timestamp+texto en el mismo párrafo.
# Captura: (1) speaker, (2) timestamp, (3) texto inline (puede estar vacío si el texto va en párrafo aparte)
_RE_MAIN = re.compile(r"^(.+?)\s{2,}(\d{1,2}:\d{2}(?::\d{2})?)(.*)$")
# Fallback: solo speaker+timestamp al final de línea (formato con texto en párrafo separado)
_RE_ALT = re.compile(r"^(.+?)\s+(\d{1,2}:\d{2}(?::\d{2})?)\s*$")

# Líneas de sistema a ignorar
_SKIP = [
    re.compile(r"ha iniciado la transcripci", re.I),
    re.compile(r"ha abandonado", re.I),
    re.compile(r"ha entrado en la reuni", re.I),
    re.compile(r"^Transcripci[oó]n\s*$", re.I),
    re.compile(r"^\d{1,2}\s+de\s+\w+.+\d{4}", re.I),   # Fecha encabezado
]


# ---------------------------------------------------------------------------
# Utilidades
# ---------------------------------------------------------------------------

def _is_skip(line: str) -> bool:
    return any(p.search(line) for p in _SKIP)


def _parse_ts(ts: str) -> float:
    """Convierte 'M:SS' o 'H:MM:SS' a segundos."""
    parts = ts.strip().split(":")
    try:
        if len(parts) == 2:
            return int(parts[0]) * 60 + int(parts[1])
        if len(parts) == 3:
            return int(parts[0]) * 3600 + int(parts[1]) * 60 + int(parts[2])
    except ValueError:
        pass
    return 0.0


def _fmt(seconds: float) -> str:
    return str(timedelta(seconds=int(seconds)))


def _try_speaker(line: str):
    """Devuelve (speaker, start_sec, inline_text) o None."""
    m = _RE_MAIN.match(line)
    if m:
        speaker = m.group(1).strip()
        if len(speaker) >= 3 and not speaker.strip().isdigit():
            return speaker, _parse_ts(m.group(2)), m.group(3).strip()
    m = _RE_ALT.match(line)
    if m:
        speaker = m.group(1).strip()
        if len(speaker) >= 3 and not speaker.strip().isdigit():
            return speaker, _parse_ts(m.group(2)), ""
    return None


# ---------------------------------------------------------------------------
# Extracción de texto del DOCX
# ---------------------------------------------------------------------------

def extract_paragraphs(docx_path: Path) -> list:
    """Extrae párrafos de texto plano de un .docx usando solo la stdlib."""
    paragraphs = []
    with zipfile.ZipFile(docx_path) as z:
        with z.open("word/document.xml") as f:
            root = ET.fromstring(f.read())

    for para in root.iter(f"{{{W}}}p"):
        # Unir todos los nodos <w:t> del párrafo (respetando xml:space="preserve")
        parts = []
        for t in para.iter(f"{{{W}}}t"):
            parts.append(t.text or "")
        text = "".join(parts).strip()
        if text:
            paragraphs.append(text)

    return paragraphs


# ---------------------------------------------------------------------------
# Parsing del formato Teams
# ---------------------------------------------------------------------------

def parse_paragraphs(paragraphs: list) -> list:
    """Convierte la lista de párrafos en segmentos AIRecorder.

    Soporta dos formatos de Teams:
    - Inline: "Speaker   M:SS<texto>" — todo en un párrafo (formato actual de Teams).
    - Separado: "Speaker   M:SS" seguido de párrafos de texto (formato anterior).
    """
    segments = []
    current_speaker = None
    current_start = 0.0
    pending = []

    def flush():
        nonlocal current_speaker, current_start, pending
        if current_speaker and pending:
            text = " ".join(t for t in pending if t)
            if text:
                segments.append({
                    "speaker": current_speaker,
                    "start": current_start,
                    "text": text,
                    "source": "sistema",
                    "emoji": "🔊",
                })
        current_speaker = None
        current_start = 0.0
        pending = []

    for line in paragraphs:
        if _is_skip(line):
            continue
        match = _try_speaker(line)
        if match:
            flush()
            current_speaker, current_start, inline_text = match
            if inline_text:
                # Formato inline: texto va pegado al timestamp en el mismo párrafo
                segments.append({
                    "speaker": current_speaker,
                    "start": current_start,
                    "text": inline_text,
                    "source": "sistema",
                    "emoji": "🔊",
                })
                current_speaker = None
                current_start = 0.0
                pending = []
            else:
                # Formato separado: texto vendrá en párrafos siguientes
                pending = []
        elif current_speaker is not None:
            pending.append(line)

    flush()

    # Calcular timestamps 'end'
    for i, seg in enumerate(segments):
        if i + 1 < len(segments):
            seg["end"] = segments[i + 1]["start"]
        else:
            words = len(seg["text"].split())
            seg["end"] = seg["start"] + max(int(words / 2.5), 2)

    return segments


# ---------------------------------------------------------------------------
# Construcción del output
# ---------------------------------------------------------------------------

def build_json(segments: list) -> dict:
    speakers = list(dict.fromkeys(s["speaker"] for s in segments))
    total_duration = max((s["end"] for s in segments), default=0)
    return {
        "metadata": {
            "total_segments": len(segments),
            "microphone_segments": 0,
            "system_segments": len(segments),
            "detected_speakers": len(speakers),
            "total_duration": total_duration,
        },
        "segments": segments,
    }


def build_txt(segments: list) -> str:
    speakers = list(dict.fromkeys(s["speaker"] for s in segments))
    lines = [
        "TRANSCRIPCIÓN COMBINADA DE AUDIO DUAL",
        "=" * 60,
        "",
        f"🔊 Sistema: {len(segments)} segmentos",
        f"👥 Interlocutores detectados: {len(speakers)} en canal sistema",
        f"📝 Total: {len(segments)} segmentos únicos",
        "",
        "TIMELINE:",
        "-" * 40,
        "",
    ]
    for seg in segments:
        lines.append(f"[{_fmt(seg['start'])} - {_fmt(seg['end'])}] {seg['emoji']} {seg['speaker']}:")
        lines.append(f"   {seg['text']}")
        lines.append("")
    return "\n".join(lines)


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    if len(sys.argv) < 3:
        print("Uso: python teams_converter.py <input.docx> <output_dir>", file=sys.stderr)
        sys.exit(1)

    input_path = Path(sys.argv[1])
    output_dir = Path(sys.argv[2])

    if not input_path.exists():
        print(f"Error: archivo no encontrado: {input_path}", file=sys.stderr)
        sys.exit(1)

    if input_path.suffix.lower() != ".docx":
        print(f"Error: solo se admite formato .docx (recibido: {input_path.suffix})", file=sys.stderr)
        sys.exit(1)

    output_dir.mkdir(parents=True, exist_ok=True)

    try:
        paragraphs = extract_paragraphs(input_path)
    except (zipfile.BadZipFile, KeyError) as e:
        print(f"Error leyendo el DOCX: {e}", file=sys.stderr)
        sys.exit(1)

    segments = parse_paragraphs(paragraphs)

    if not segments:
        print(
            "No se encontraron segmentos. Verifica que el archivo sea una transcripción de Teams.",
            file=sys.stderr,
        )
        sys.exit(1)

    json_data = build_json(segments)
    txt_data = build_txt(segments)

    (output_dir / "transcripcion_combinada.json").write_text(
        json.dumps(json_data, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    (output_dir / "transcripcion_combinada.txt").write_text(txt_data, encoding="utf-8")

    speakers = list(dict.fromkeys(s["speaker"] for s in segments))
    metadata = {
        "duration": json_data["metadata"]["total_duration"],
        "segments": len(segments),
        "speakers": len(speakers),
    }
    print(f"METADATA:{json.dumps(metadata)}")


if __name__ == "__main__":
    main()
