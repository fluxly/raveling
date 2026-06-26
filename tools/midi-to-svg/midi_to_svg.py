#!/usr/bin/env python3
"""
midi_to_svg.py — convert a MIDI file to a ravel-roll-aligned piano-roll SVG.

The output SVG matches ravel-roll's exact coordinate system:
  - 87 rows, B7 (MIDI 107) at top → A0 (MIDI 21) at bottom
  - Each row is track_h px tall
  - 1 unit = 1/unit_note note (default 1/128th), displayed as unit_width px
  - Notes outside A0–B7 are skipped

Usage:
    python3 midi_to_svg.py <input.mid> [output.svg]
                           [--track-h N]     height of each pitch row in px (default 20)
                           [--unit-width N]  pixels per unit (default 2)
                           [--unit-note N]   note denominator for 1 unit (default 128)
"""

import sys
import argparse
from pathlib import Path

try:
    import mido
except ImportError:
    sys.exit("mido is required: pip install mido")

PITCH_TOP = 107   # B7  — top row in ravel-roll
PITCH_BOT = 21    # A0  — bottom row in ravel-roll
NUM_ROWS  = PITCH_TOP - PITCH_BOT + 1  # 87


# ── Palette ───────────────────────────────────────────────────────────────────

def _channel_colors(n: int) -> list[str]:
    count = max(n, 1)
    return [f"rgba(255,255,255,{0.4 + 0.6 * i / max(count - 1, 1):.2f})" for i in range(count)]


# ── MIDI parsing ──────────────────────────────────────────────────────────────

def extract_tempo(mid: mido.MidiFile) -> int:
    """Return the first tempo value in microseconds per beat (default 500 000 = 120 BPM)."""
    for track in mid.tracks:
        for msg in track:
            if msg.type == 'set_tempo':
                return msg.tempo
    return 500_000


def parse_notes(mid: mido.MidiFile) -> tuple[list[dict], int]:
    notes: list[dict] = []
    total_ticks = 0

    for track in mid.tracks:
        abs_tick = 0
        open_notes: dict[tuple[int, int], int] = {}

        for msg in track:
            abs_tick += msg.time

            if msg.type == 'note_on' and msg.velocity > 0:
                open_notes[(msg.channel, msg.note)] = abs_tick

            elif msg.type == 'note_off' or (msg.type == 'note_on' and msg.velocity == 0):
                key = (msg.channel, msg.note)
                if key in open_notes:
                    notes.append({
                        'channel': msg.channel,
                        'pitch':   msg.note,
                        'start':   open_notes.pop(key),
                        'end':     abs_tick,
                    })

        # close any notes still open at track end
        for (ch, pitch), start in open_notes.items():
            notes.append({'channel': ch, 'pitch': pitch, 'start': start, 'end': abs_tick})

        total_ticks = max(total_ticks, abs_tick)

    return notes, total_ticks


# ── SVG generation ────────────────────────────────────────────────────────────

def build_svg(
    mid:            mido.MidiFile,
    notes:          list[dict],
    total_ticks:    int,
    track_h:        int,
    unit_width:     int,
    unit_note_denom: int,
    tempo_us:       int,
) -> str:
    # 1 unit = 1/unit_note_denom note
    # ticks per whole note = PPQ * 4
    ticks_per_unit: float = mid.ticks_per_beat * 4 / unit_note_denom

    total_units = total_ticks / ticks_per_unit
    svg_w = total_units * unit_width
    svg_h = NUM_ROWS * track_h

    all_channels = sorted({n['channel'] for n in notes})
    channel_color = dict(zip(all_channels, _channel_colors(len(all_channels))))

    def u2px(ticks: float) -> float:
        return ticks / ticks_per_unit * unit_width

    parts: list[str] = []
    bpm = round(60_000_000 / tempo_us, 6)
    parts.append(
        f'<svg xmlns="http://www.w3.org/2000/svg"'
        f' width="{svg_w:.2f}" height="{svg_h}"'
        f' viewBox="0 0 {svg_w:.2f} {svg_h}"'
        f' preserveAspectRatio="none"'
        f' data-tempo="{bpm}"'
        f' data-unit-width="{unit_width}"'
        f' style="background:transparent">'
    )

    # Subtle octave lines at each C note boundary
    for pitch in range(PITCH_BOT, PITCH_TOP + 1):
        if pitch % 12 == 0:  # C notes
            row = PITCH_TOP - pitch
            y = row * track_h
            parts.append(
                f'<line x1="0" y1="{y}" x2="{svg_w:.2f}" y2="{y}"'
                f' stroke="rgba(255,255,255,0.15)" stroke-width="1"/>'
            )

    # Note rectangles
    in_range = 0
    skipped  = 0
    for note in notes:
        pitch = note['pitch']
        if pitch < PITCH_BOT or pitch > PITCH_TOP:
            skipped += 1
            continue
        in_range += 1

        row  = PITCH_TOP - pitch
        x    = u2px(note['start'])
        w    = max(u2px(note['end'] - note['start']), 2)
        y    = row * track_h + 1
        h    = track_h - 2
        color = channel_color[note['channel']]
        parts.append(
            f'<rect x="{x:.2f}" y="{y}" width="{w:.2f}" height="{h}"'
            f' fill="{color}" rx="1"/>'
        )

    parts.append('</svg>')
    return '\n'.join(parts), in_range, skipped


# ── Entry point ───────────────────────────────────────────────────────────────

def main() -> None:
    parser = argparse.ArgumentParser(description='Convert MIDI to ravel-roll-aligned SVG')
    parser.add_argument('input',            help='Input MIDI file')
    parser.add_argument('output', nargs='?', help='Output SVG (default: <input>.svg)')
    parser.add_argument('--track-h',    type=int, default=20,  metavar='N',
                        help='Track row height in px (default: 20)')
    parser.add_argument('--unit-width', type=int, default=4,  metavar='N',
                        help='Pixels per unit (default: 4 — matches ravel-roll unit-width default)')
    parser.add_argument('--unit-note',  type=int, default=128, metavar='N',
                        help='Note denominator for 1 unit, e.g. 128 = 1/128th (default: 128)')
    args = parser.parse_args()

    in_path  = Path(args.input)
    out_path = Path(args.output) if args.output else in_path.with_suffix('.svg')

    if not in_path.exists():
        sys.exit(f"File not found: {in_path}")

    mid = mido.MidiFile(str(in_path))
    notes, total_ticks = parse_notes(mid)
    tempo_us = extract_tempo(mid)

    ticks_per_unit = mid.ticks_per_beat * 4 / args.unit_note
    total_units    = total_ticks / ticks_per_unit

    svg, in_range, skipped = build_svg(
        mid, notes, total_ticks, args.track_h, args.unit_width, args.unit_note, tempo_us
    )

    out_path.write_text(svg, encoding='utf-8')

    print(f"PPQ:              {mid.ticks_per_beat}")
    print(f"Tempo:            {round(60_000_000 / tempo_us, 2)} BPM  ({tempo_us} µs/beat)")
    print(f"Ticks/unit:       {ticks_per_unit:.1f}  (1/{args.unit_note} note)")
    print(f"Total units:      {total_units:.2f}")
    print(f"Notes rendered:   {in_range}  ({skipped} outside A0–B7 skipped)")
    print(f"SVG size:         {int(total_units * args.unit_width)} × {87 * args.track_h} px")
    print(f"Written:          {out_path}")
    print()
    print(f"  Set ravel-roll length=\"{int(total_units) + 1}\" to fit this file.")


if __name__ == '__main__':
    main()
