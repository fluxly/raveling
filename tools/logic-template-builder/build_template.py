#!/usr/bin/env python3
"""
Logic Pro Template Builder
==========================
Reads a JSON track list and writes a Type 1 MIDI file.
Import into Logic Pro to create a pre-named track layout instantly.

  File → Import → MIDI File…  (choose "Software Instrument Tracks" in the dialog)

Each MIDI track becomes one software instrument track in Logic, named exactly
as defined in the JSON. After assigning instruments via the Library panel or
channel strip settings, save with File → Save as Template.

Usage:
    python3 build_template.py bbc_orchestra.json
    python3 build_template.py bbc_orchestra.json -o MyOrchestra.mid
    python3 build_template.py bbc_orchestra.json --open     # open in Logic after writing
    python3 build_template.py bbc_orchestra.json --dry-run  # show guide only
"""

import json
import math
import struct
import subprocess
import sys
import argparse
from pathlib import Path


# ─── MIDI primitives ──────────────────────────────────────────────────────────

def _vlq(n: int) -> bytes:
    """Encode n as a MIDI variable-length quantity."""
    parts = [n & 0x7F]
    n >>= 7
    while n:
        parts.append((n & 0x7F) | 0x80)
        n >>= 7
    return bytes(reversed(parts))


def _meta(typ: int, data: bytes) -> bytes:
    return b'\xff' + bytes([typ]) + _vlq(len(data)) + data


def _chunk(tag: bytes, body: bytes) -> bytes:
    return tag + struct.pack('>I', len(body)) + body


def _make_tempo_track(bpm: float, num: int, den: int) -> bytes:
    us = int(60_000_000 / bpm)
    events = (
        _vlq(0) + _meta(0x58, bytes([num, int(math.log2(den)), 24, 8])) +  # time sig
        _vlq(0) + _meta(0x51, struct.pack('>I', us)[1:]) +                  # tempo (3 bytes)
        _vlq(0) + _meta(0x2F, b'')                                           # end of track
    )
    return _chunk(b'MTrk', events)


def _make_instrument_track(name: str, group: str, program: int,
                            channel: int, silence_ticks: int) -> bytes:
    events = (
        _vlq(0) + _meta(0x03, name.encode('utf-8')) +               # track name
        _vlq(0) + _meta(0x04, group.encode('utf-8')) +              # instrument name (section)
        _vlq(0) + bytes([0xC0 | channel, program & 0x7F]) +         # program change
        _vlq(silence_ticks) + _meta(0x2F, b'')                      # end of track
    )
    return _chunk(b'MTrk', events)


# ─── GM program lookup ────────────────────────────────────────────────────────

_GM: dict[str, int] = {
    # Strings
    'violin': 40, 'viola': 41, 'cello': 42, 'contrabass': 43, 'double bass': 43,
    'strings': 48, 'tremolo': 44, 'pizzicato': 45,
    # Woodwinds
    'flute': 73, 'piccolo': 72, 'oboe': 68, 'cor anglais': 69, 'english horn': 69,
    'clarinet': 71, 'bassoon': 70, 'contrabassoon': 70, 'saxophone': 64,
    # Brass
    'horn': 60, 'trumpet': 56, 'trombone': 57, 'bass trombone': 57, 'tuba': 58,
    # Pitched
    'harp': 46, 'piano': 0, 'celesta': 8, 'marimba': 12,
    'xylophone': 13, 'vibraphone': 11, 'glockenspiel': 9, 'tubular': 14,
    # Percussion
    'timpani': 47,
}


def _guess_program(track: dict) -> int:
    if 'gmProgram' in track:
        return int(track['gmProgram'])
    name = track.get('name', '').lower()
    for keyword, prog in _GM.items():
        if keyword in name:
            return prog
    return 0


# ─── MIDI file builder ────────────────────────────────────────────────────────

PPQ = 480   # ticks per quarter note


def build_midi(template: dict) -> bytes:
    tracks = template.get('tracks', [])
    bpm = float(template.get('tempo', 100))
    num, den = _parse_sig(template.get('timeSignature', '4/4'))

    # 8 bars of silence at the end of each track so Logic opens cleanly
    bar_ticks = PPQ * 4 * num // den
    silence = 8 * bar_ticks

    tempo_track = _make_tempo_track(bpm, num, den)

    instrument_tracks = []
    for i, t in enumerate(tracks):
        name = t.get('name', f'Track {i + 1}')
        group = t.get('group', '')
        program = _guess_program(t)
        # Cycle channels 0-8, 10-15 (skip channel 9 = GM drums)
        ch = i % 15
        if ch >= 9:
            ch += 1
        instrument_tracks.append(
            _make_instrument_track(name, group, program, ch, silence)
        )

    n_tracks = 1 + len(instrument_tracks)
    header = _chunk(b'MThd', struct.pack('>HHH', 1, n_tracks, PPQ))
    return header + tempo_track + b''.join(instrument_tracks)


def _parse_sig(sig: str) -> tuple[int, int]:
    try:
        n, d = sig.split('/')
        return int(n), int(d)
    except Exception:
        return 4, 4


# ─── Setup guide ──────────────────────────────────────────────────────────────

def print_guide(template: dict, out_path: Path | None) -> None:
    tracks = template.get('tracks', [])
    proj_name = template.get('name', 'Template')
    bpm = template.get('tempo', 100)
    sig = template.get('timeSignature', '4/4')

    w = 64
    print(f'\n{"─" * w}')
    print(f'  {proj_name}  ·  {len(tracks)} tracks  ·  {bpm} BPM  ·  {sig}')
    print(f'{"─" * w}')

    if out_path:
        print(f'\n  Output:  {out_path}\n')
        print('  Import into Logic Pro:')
        print('    1. File → Import → MIDI File…')
        print('    2. In the dialog, select "Software Instrument Tracks"')
        print('    3. Click Add')

    print('\n  Track list  (assign instruments via Library panel or channel strip settings)\n')

    current_group = None
    for i, t in enumerate(tracks):
        group = t.get('group')
        if group and group != current_group:
            print(f'  ── {group} {"─" * max(0, 42 - len(group))}')
            current_group = group

        name = t.get('name', f'Track {i + 1}')
        color = t.get('color', 'blue').title()
        instr = t.get('instrument', {})
        au = instr.get('au', '')
        cs = instr.get('channelStrip', '')
        preset = instr.get('preset', '')

        parts = []
        if au:
            parts.append(au)
        if cs:
            parts.append(f'CS: {cs}')
        if preset:
            parts.append(f'/ {preset}')
        desc = '  '.join(parts) if parts else '(unassigned)'

        print(f'  {i + 1:>2}. [{color:<9}]  {name:<28}  {desc}')

    print()
    if out_path:
        print('  After assigning instruments:')
        print('    File → Save as Template…')
    print(f'{"─" * w}\n')


# ─── Entry point ──────────────────────────────────────────────────────────────

def main() -> None:
    ap = argparse.ArgumentParser(
        description='Build a Logic Pro track template from a JSON definition',
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    ap.add_argument('template', help='Path to template JSON file')
    ap.add_argument('-o', '--out', metavar='FILE',
                    help='Output .mid path (default: <template-name>.mid next to JSON)')
    ap.add_argument('--open', dest='open_logic', action='store_true',
                    help='Open the MIDI file in Logic Pro X after writing')
    ap.add_argument('--dry-run', action='store_true',
                    help='Print the setup guide without writing a file')
    args = ap.parse_args()

    src = Path(args.template)
    if not src.exists():
        sys.exit(f'Error: {src} not found')

    template = json.loads(src.read_text())

    if args.dry_run:
        print_guide(template, None)
        return

    proj_name = template.get('name', src.stem).replace(' ', '_')
    out_path = Path(args.out) if args.out else src.parent / f'{proj_name}.mid'

    midi_bytes = build_midi(template)
    out_path.write_bytes(midi_bytes)

    print_guide(template, out_path)

    if args.open_logic:
        subprocess.run(['open', '-a', 'Logic Pro X', str(out_path)], check=False)
        print('  Opened in Logic Pro X.\n')


if __name__ == '__main__':
    main()
