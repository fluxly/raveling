
export const RavelMusic = {

    notes : [
        "C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"
    ],

    prefixes : [
        "m", "dim", "aug", "7", "maj7", "m7", "m7b5", "sus2", "sus4"
    ],  

    chords : {
        "C": ["C", "E", "G"],
        "Cm": ["C", "Eb", "G"],
        "Cdim": ["C", "Eb", "Gb"],
        "Caug": ["C", "E", "G#"],
        "C7": ["C", "E", "G", "Bb"],
        "Cmaj7": ["C", "E", "G", "B"],
        "Cm7": ["C", "Eb", "G", "Bb"],
        "Cm7b5": ["C", "Eb", "Gb", "Bb"],

        "C#": ["C#", "F", "G#"],
        "C#m": ["C#", "E", "G#"],
        "C#dim": ["C#", "E", "G"],
        "C#aug": ["C#", "F", "A"],
        "C#7": ["C#", "F", "G#", "B"],
        "C#maj7": ["C#", "F", "G#", "C"],
        "C#m7": ["C#", "E", "G#", "B"],
        "C#m7b5": ["C#", "E", "G", "B"],

        "Db": ["Db", "F", "Ab"],
        "Dbm": ["Db", "E", "Ab"],
        "Dbdim": ["Db", "E", "G"],
        "Dbaug": ["Db", "F", "A"],
        "Db7": ["Db", "F", "Ab", "Cb"],
        "Dbmaj7": ["Db", "F", "Ab", "C"],
        "Dbm7": ["Db", "E", "Ab", "Cb"],
        "Dbm7b5": ["Db", "E", "G", "Cb"],

        "D": ["D", "F#", "A"],
        "Dm": ["D", "F", "A"],
        "Ddim": ["D", "F", "Ab"],
        "Daug": ["D", "F#", "A#"],
        "D7": ["D", "F#", "A", "C"],
        "Dmaj7": ["D", "F#", "A", "C#"],
        "Dm7": ["D", "F", "A", "C"],
        "Dm7b5": ["D", "F", "Ab", "C"],

        "Eb": ["Eb", "G", "Bb"],
        "Ebm": ["Eb", "Gb", "Bb"],
        "Ebdim": ["Eb", "Gb", "A"],
        "Ebaug": ["Eb", "G", "B"],
        "Eb7": ["Eb", "G", "Bb", "Db"],
        "Ebmaj7": ["Eb", "G", "Bb", "D"],
        "Ebm7": ["Eb", "Gb", "Bb", "Db"],
        "Ebm7b5": ["Eb", "Gb", "A", "Db"],

        "E": ["E", "G#", "B"],
        "Em": ["E", "G", "B"],
        "Edim": ["E", "G", "Bb"],
        "Eaug": ["E", "G#", "C"],
        "E7": ["E", "G#", "B", "D"],
        "Emaj7": ["E", "G#", "B", "D#"],
        "Em7": ["E", "G", "B", "D"],
        "Em7b5": ["E", "G", "Bb", "D"],

        "F": ["F", "A", "C"],
        "Fm": ["F", "Ab", "C"],
        "Fdim": ["F", "Ab", "B"],
        "Faug": ["F", "A", "C#"],
        "F7": ["F", "A", "C", "Eb"],
        "Fmaj7": ["F", "A", "C", "E"],
        "Fm7": ["F", "Ab", "C", "Eb"],
        "Fm7b5": ["F", "Ab", "B", "Eb"],

        "F#": ["F#", "A#", "C#"],
        "F#m": ["F#", "A", "C#"],
        "F#dim": ["F#", "A", "C"],
        "F#aug": ["F#", "A#", "D"],
        "F#7": ["F#", "A#", "C#", "E"],
        "F#maj7": ["F#", "A#", "C#", "F"],
        "F#m7": ["F#", "A", "C#", "E"],
        "F#m7b5": ["F#", "A", "C", "E"],

        "Gb": ["Gb", "Bb", "Db"],
        "Gbm": ["Gb", "A", "Db"],
        "Gbdim": ["Gb", "A", "C"],
        "Gbaug": ["Gb", "Bb", "D"],
        "Gb7": ["Gb", "Bb", "Db", "E"],
        "Gbmaj7": ["Gb", "Bb", "Db", "F"],
        "Gbm7": ["Gb", "A", "Db", "E"],
        "Gbm7b5": ["Gb", "A", "C", "E"],

        "G": ["G", "B", "D"],
        "Gm": ["G", "Bb", "D"],
        "Gdim": ["G", "Bb", "Db"],
        "Gaug": ["G", "B", "D#"],
        "G7": ["G", "B", "D", "F"],
        "Gmaj7": ["G", "B", "D", "F#"],
        "Gm7": ["G", "Bb", "D", "F"],
        "Gm7b5": ["G", "Bb", "Db", "F"],

        "Ab": ["Ab", "C", "Eb"],
        "Abm": ["Ab", "B", "Eb"],
        "Abdim": ["Ab", "B", "D"],
        "Abaug": ["Ab", "C", "E"],
        "Ab7": ["Ab", "C", "Eb", "Gb"],
        "Abmaj7": ["Ab", "C", "Eb", "G"],
        "Abm7": ["Ab", "B", "Eb", "Gb"],
        "Abm7b5": ["Ab", "B", "D", "Gb"],

        "A": ["A", "C#", "E"],
        "Am": ["A", "C", "E"],
        "Adim": ["A", "C", "Eb"],
        "Aaug": ["A", "C#", "F"],
        "A7": ["A", "C#", "E", "G"],
        "Amaj7": ["A", "C#", "E", "G#"],
        "Am7": ["A", "C", "E", "G"],
        "Am7b5": ["A", "C", "Eb", "G"],

        "Bb": ["Bb", "D", "F"],
        "Bbm": ["Bb", "Db", "F"],
        "Bbdim": ["Bb", "Db", "E"],
        "Bbaug": ["Bb", "D", "F#"],
        "Bb7": ["Bb", "D", "F", "Ab"],
        "Bbmaj7": ["Bb", "D", "F", "A"],
        "Bbm7": ["Bb", "Db", "F", "Ab"],
        "Bbm7b5": ["Bb", "Db", "E", "Ab"],

        "B": ["B", "D#", "F#"],
        "Bm": ["B", "D", "F#"],
        "Bdim": ["B", "D", "F"],
        "Baug": ["B", "D#", "G"],
        "B7": ["B", "D#", "F#", "A"],
        "Bmaj7": ["B", "D#", "F#", "A#"],
        "Bm7": ["B", "D", "F#", "A"],
        "Bm7b5": ["B", "D", "F", "A"],

        // Suspended
        "Csus2": ["C", "D", "G"],
        "Csus4": ["C", "F", "G"],
        "C7sus4": ["C", "F", "G", "Bb"],

        "C#sus2": ["C#", "D#", "G#"],
        "C#sus4": ["C#", "F#", "G#"],
        "C#7sus4": ["C#", "F#", "G#", "B"],

        "Dbsus2": ["Db", "Eb", "Ab"],
        "Dbsus4": ["Db", "Gb", "Ab"],
        "Db7sus4": ["Db", "Gb", "Ab", "Cb"],

        "Dsus2": ["D", "E", "A"],
        "Dsus4": ["D", "G", "A"],
        "D7sus4": ["D", "G", "A", "C"],

        "Ebsus2": ["Eb", "F", "Bb"],
        "Ebsus4": ["Eb", "Ab", "Bb"],
        "Eb7sus4": ["Eb", "Ab", "Bb", "Db"],

        "Esus2": ["E", "F#", "B"],
        "Esus4": ["E", "A", "B"],
        "E7sus4": ["E", "A", "B", "D"],

        "Fsus2": ["F", "G", "C"],
        "Fsus4": ["F", "Bb", "C"],
        "F7sus4": ["F", "Bb", "C", "Eb"],

        "F#sus2": ["F#", "G#", "C#"],
        "F#sus4": ["F#", "B", "C#"],
        "F#7sus4": ["F#", "B", "C#", "E"],

        "Gbsus2": ["Gb", "Ab", "Db"],
        "Gbsus4": ["Gb", "Cb", "Db"],
        "Gb7sus4": ["Gb", "Cb", "Db", "E"],

        "Gsus2": ["G", "A", "D"],
        "Gsus4": ["G", "C", "D"],
        "G7sus4": ["G", "C", "D", "F"],

        "Absus2": ["Ab", "Bb", "Eb"],
        "Absus4": ["Ab", "Db", "Eb"],
        "Ab7sus4": ["Ab", "Db", "Eb", "Gb"],

        "Asus2": ["A", "B", "E"],
        "Asus4": ["A", "D", "E"],
        "A7sus4": ["A", "D", "E", "G"],

        "Bbsus2": ["Bb", "C", "F"],
        "Bbsus4": ["Bb", "Eb", "F"],
        "Bb7sus4": ["Bb", "Eb", "F", "Ab"],

        "Bsus2": ["B", "C#", "F#"],
        "Bsus4": ["B", "E", "F#"],
        "B7sus4": ["B", "E", "F#", "A"],

        // Inversions
        "C/E": ["E", "G", "C"],
        "C/G": ["G", "C", "E"],
        "Cm/Eb": ["Eb", "G", "C"],
        "Cm/G": ["G", "C", "Eb"],

        "C#/F": ["F", "G#", "C#"],
        "C#/G#": ["G#", "C#", "F"],
        "C#m/E": ["E", "G#", "C#"],
        "C#m/G#": ["G#", "C#", "E"],

        "Db/F": ["F", "Ab", "Db"],
        "Db/Ab": ["Ab", "Db", "F"],
        "Dbm/E": ["E", "Ab", "Db"],
        "Dbm/Ab": ["Ab", "Db", "E"],

        "D/F#": ["F#", "A", "D"],
        "D/A": ["A", "D", "F#"],
        "Dm/F": ["F", "A", "D"],
        "Dm/A": ["A", "D", "F"],

        "Eb/G": ["G", "Bb", "Eb"],
        "Eb/Bb": ["Bb", "Eb", "G"],
        "Ebm/Gb": ["Gb", "Bb", "Eb"],
        "Ebm/Bb": ["Bb", "Eb", "Gb"],

        "E/G#": ["G#", "B", "E"],
        "E/B": ["B", "E", "G#"],
        "Em/G": ["G", "B", "E"],
        "Em/B": ["B", "E", "G"],

        "F/A": ["A", "C", "F"],
        "F/C": ["C", "F", "A"],
        "Fm/Ab": ["Ab", "C", "F"],
        "Fm/C": ["C", "F", "Ab"],

        "F#/A#": ["A#", "C#", "F#"],
        "F#/C#": ["C#", "F#", "A#"],
        "F#m/A": ["A", "C#", "F#"],
        "F#m/C#": ["C#", "F#", "A"],

        "Gb/Bb": ["Bb", "Db", "Gb"],
        "Gb/Db": ["Db", "Gb", "Bb"],
        "Gbm/A": ["A", "Db", "Gb"],
        "Gbm/Db": ["Db", "Gb", "A"],

        "G/B": ["B", "D", "G"],
        "G/D": ["D", "G", "B"],
        "Gm/Bb": ["Bb", "D", "G"],
        "Gm/D": ["D", "G", "Bb"],

        "Ab/C": ["C", "Eb", "Ab"],
        "Ab/Eb": ["Eb", "Ab", "C"],
        "Abm/B": ["B", "Eb", "Ab"],
        "Abm/Eb": ["Eb", "Ab", "B"],

        "A/C#": ["C#", "E", "A"],
        "A/E": ["E", "A", "C#"],
        "Am/C": ["C", "E", "A"],
        "Am/E": ["E", "A", "C"],

        "Bb/D": ["D", "F", "Bb"],
        "Bb/F": ["F", "Bb", "D"],
        "Bbm/Db": ["Db", "F", "Bb"],
        "Bbm/F": ["F", "Bb", "Db"],

        "B/D#": ["D#", "F#", "B"],
        "B/F#": ["F#", "B", "D#"],
        "Bm/D": ["D", "F#", "B"],
        "Bm/F#": ["F#", "B", "D"]
    },

    "drums" : {

    },

    "harmony" : {
        "Cmaj": {
            "scale": ["C", "D", "E", "F", "G", "A", "B"],
            "triads": ["C", "Dm", "Em", "F", "G", "Am", "Bdim"],
            "sevenths": ["Cmaj7", "Dm7", "Em7", "Fmaj7", "G7", "Am7", "Bm7b5"],
            "noteToChord": {
            "C": ["C", "F", "Am"],
            "D": ["Dm", "G", "Bdim"],
            "E": ["C", "Em", "Am"],
            "F": ["Dm", "F", "Bdim"],
            "G": ["C", "Em", "G"],
            "A": ["Dm", "F", "Am"],
            "B": ["G", "Em", "Bdim"]
            },
            "chordTransitions": {
            "C": ["F", "G", "Am"],
            "Dm": ["G", "F", "Am"],
            "Em": ["Am", "F", "G"],
            "F": ["G", "C", "Dm"],
            "G": ["C", "Am"],
            "Am": ["Dm", "F", "G"],
            "Bdim": ["C", "G"]
            },
            "parallelThirds": {
            "C": "E", "D": "F", "E": "G", "F": "A", "G": "B", "A": "C", "B": "D"
            }
        },

        "Gmaj": {
            "scale": ["G", "A", "B", "C", "D", "E", "F#"],
            "triads": ["G", "Am", "Bm", "C", "D", "Em", "F#dim"],
            "sevenths": ["Gmaj7", "Am7", "Bm7", "Cmaj7", "D7", "Em7", "F#m7b5"],
            "noteToChord": {
            "G": ["G", "C", "Em"],
            "A": ["Am", "D", "F#dim"],
            "B": ["G", "Em", "Bm"],
            "C": ["C", "Am", "F#dim"],
            "D": ["G", "Bm", "D"],
            "E": ["C", "Em", "Am"],
            "F#": ["D", "Bm", "F#dim"]
            },
            "chordTransitions": {
            "G": ["C", "D", "Em"],
            "Am": ["D", "C", "Em"],
            "Bm": ["Em", "G", "D"],
            "C": ["D", "G", "Am"],
            "D": ["G", "Em"],
            "Em": ["Am", "C", "D"],
            "F#dim": ["G", "D"]
            },
            "parallelThirds": {
            "G": "B", "A": "C", "B": "D", "C": "E", "D": "F#", "E": "G", "F#": "A"
            }
        },

        "Dmaj": {
            "scale": ["D", "E", "F#", "G", "A", "B", "C#"],
            "triads": ["D", "Em", "F#m", "G", "A", "Bm", "C#dim"],
            "sevenths": ["Dmaj7", "Em7", "F#m7", "Gmaj7", "A7", "Bm7", "C#m7b5"],
            "noteToChord": {
            "D": ["D", "G", "Bm"],
            "E": ["Em", "A", "C#dim"],
            "F#": ["D", "Bm", "F#m"],
            "G": ["G", "Em", "C#dim"],
            "A": ["D", "F#m", "A"],
            "B": ["G", "Bm", "Em"],
            "C#": ["A", "F#m", "C#dim"]
            },
            "chordTransitions": {
            "D": ["G", "A", "Bm"],
            "Em": ["A", "G", "Bm"],
            "F#m": ["Bm", "D", "A"],
            "G": ["A", "D", "Em"],
            "A": ["D", "Bm"],
            "Bm": ["Em", "G", "A"],
            "C#dim": ["D", "A"]
            },
            "parallelThirds": {
            "D": "F#", "E": "G", "F#": "A", "G": "B", "A": "C#", "B": "D", "C#": "E"
            }
        },

        "Amaj": {
            "scale": ["A", "B", "C#", "D", "E", "F#", "G#"],
            "triads": ["A", "Bm", "C#m", "D", "E", "F#m", "G#dim"],
            "sevenths": ["Amaj7", "Bm7", "C#m7", "Dmaj7", "E7", "F#m7", "G#m7b5"],
            "noteToChord": {
            "A": ["A", "D", "F#m"],
            "B": ["Bm", "E", "G#dim"],
            "C#": ["A", "F#m", "C#m"],
            "D": ["D", "Bm", "G#dim"],
            "E": ["A", "C#m", "E"],
            "F#": ["D", "F#m", "Bm"],
            "G#": ["E", "C#m", "G#dim"]
            },
            "chordTransitions": {
            "A": ["D", "E", "F#m"],
            "Bm": ["E", "D", "F#m"],
            "C#m": ["F#m", "A", "E"],
            "D": ["E", "A", "Bm"],
            "E": ["A", "F#m"],
            "F#m": ["Bm", "D", "E"],
            "G#dim": ["A", "E"]
            },
            "parallelThirds": {
            "A": "C#", "B": "D", "C#": "E", "D": "F#", "E": "G#", "F#": "A", "G#": "B"
            }
        },

        "Emaj": {
            "scale": ["E", "F#", "G#", "A", "B", "C#", "D#"],
            "triads": ["E", "F#m", "G#m", "A", "B", "C#m", "D#dim"],
            "sevenths": ["Emaj7", "F#m7", "G#m7", "Amaj7", "B7", "C#m7", "D#m7b5"],
            "noteToChord": {
            "E": ["E", "A", "C#m"],
            "F#": ["F#m", "B", "D#dim"],
            "G#": ["E", "C#m", "G#m"],
            "A": ["A", "F#m", "D#dim"],
            "B": ["E", "G#m", "B"],
            "C#": ["A", "C#m", "F#m"],
            "D#": ["B", "G#m", "D#dim"]
            },
            "chordTransitions": {
            "E": ["A", "B", "C#m"],
            "F#m": ["B", "A", "C#m"],
            "G#m": ["C#m", "E", "B"],
            "A": ["B", "E", "F#m"],
            "B": ["E", "C#m"],
            "C#m": ["F#m", "A", "B"],
            "D#dim": ["E", "B"]
            },
            "parallelThirds": {
            "E": "G#", "F#": "A", "G#": "B", "A": "C#", "B": "D#", "C#": "E", "D#": "F#"
            }
        },

        "Bmaj": {
            "scale": ["B", "C#", "D#", "E", "F#", "G#", "A#"],
            "triads": ["B", "C#m", "D#m", "E", "F#", "G#m", "A#dim"],
            "sevenths": ["Bmaj7", "C#m7", "D#m7", "Emaj7", "F#7", "G#m7", "A#m7b5"],
            "noteToChord": {
            "B": ["B", "E", "G#m"],
            "C#": ["C#m", "F#", "A#dim"],
            "D#": ["B", "G#m", "D#m"],
            "E": ["E", "C#m", "A#dim"],
            "F#": ["B", "D#m", "F#"],
            "G#": ["E", "G#m", "C#m"],
            "A#": ["F#", "D#m", "A#dim"]
            },
            "chordTransitions": {
            "B": ["E", "F#", "G#m"],
            "C#m": ["F#", "E", "G#m"],
            "D#m": ["G#m", "B", "F#"],
            "E": ["F#", "B", "C#m"],
            "F#": ["B", "G#m"],
            "G#m": ["C#m", "E", "F#"],
            "A#dim": ["B", "F#"]
            },
            "parallelThirds": {
            "B": "D#", "C#": "E", "D#": "F#", "E": "G#", "F#": "A#", "G#": "B", "A#": "C#"
            }
        },

        "Fmaj": {
            "scale": ["F", "G", "A", "Bb", "C", "D", "E"],
            "triads": ["F", "Gm", "Am", "Bb", "C", "Dm", "Edim"],
            "sevenths": ["Fmaj7", "Gm7", "Am7", "Bbmaj7", "C7", "Dm7", "Em7b5"],
            "noteToChord": {
            "F": ["F", "Bb", "Dm"],
            "G": ["Gm", "C", "Edim"],
            "A": ["F", "Dm", "Am"],
            "Bb": ["Bb", "Gm", "Edim"],
            "C": ["F", "Am", "C"],
            "D": ["Bb", "Dm", "Gm"],
            "E": ["C", "Am", "Edim"]
            },
            "chordTransitions": {
            "F": ["Bb", "C", "Dm"],
            "Gm": ["C", "Bb", "Dm"],
            "Am": ["Dm", "F", "C"],
            "Bb": ["C", "F", "Gm"],
            "C": ["F", "Am"],
            "Dm": ["Gm", "Bb", "C"],
            "Edim": ["F", "C"]
            },
            "parallelThirds": {
            "F": "A", "G": "Bb", "A": "C", "Bb": "D", "C": "E", "D": "F", "E": "G"
            }
        }
    },

    // TODO:
    /*
        Modal interchange (borrow chords from parallel minor: iv, bVII, etc.)
        Secondary dominants (V/V, V/ii, etc.)
        Chromatic mediants (III, bVI, etc.)
        Jazz extensions (9, 11, 13)
    */

    /*
    function harmonize(note, key = "C major") {
        const chords = HarmonyDB[key].noteToChord[note];
        const next = chords.map(c => ({
            chord: c,
            likelyNext: HarmonyDB[key].chordTransitions[c]
        }));
        return next;
        }

        console.log(harmonize("E", "C major"));
    */

    midiToFreq: (n) => {
        const octave = Math.floor(n / 12) - 1;
        const freq = 440 * Math.pow(2, (n - 69) / 12);
        return freq.toFixed(3);
    },

    noteToFreq: (note) => {
        // Normalize input: e.g. "c#4" → "C#4"
        note = note.trim().toUpperCase();

        // Extract pitch and octave (e.g. "C#", "4")
        const match = note.match(/^([A-G]{1})(#|B)?(-?\d+)$/);
        if (!match) console.log("Invalid note format: " + note);

        let [, letter, accidental, octaveStr] = match;
        const octave = parseInt(octaveStr);

        // Map note letters to semitone offsets within an octave
        const noteOffsets = {
            C: 0,
            "C#": 1, Db: 1,
            D: 2,
            "D#": 3, Eb: 3,
            E: 4,
            F: 5,
            "F#": 6, Gb: 6,
            G: 7,
            "G#": 8, Ab: 8,
            A: 9,
            "A#": 10, Bb: 10,
            B: 11
        };

        // Construct the full note name (handles both sharps/flats)
        const key = accidental ? letter + accidental : letter;
        const semitone = noteOffsets[key];
        if (semitone === undefined) throw new Error("Invalid note: " + note);

        // MIDI number formula
        const midi = (octave + 1) * 12 + semitone;

        // Frequency (A4 = MIDI 69 = 440 Hz)
        const freq = 440 * Math.pow(2, (midi - 69) / 12);
        return +freq.toFixed(3);
    },

    freqToNote: (freq) => {
        if (freq <= 0) console.log("Frequency must be positive");

        // Compute the nearest MIDI note number
        const midi = 69 + 12 * Math.log2(freq / 440);
        const rounded = Math.round(midi);
        const cents = Math.round((midi - rounded) * 100);

        // Convert MIDI back to note name
        const noteNames = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
        const noteIndex = (rounded % 12 + 12) % 12;
        const octave = Math.floor(rounded / 12) - 1;
        const name = noteNames[noteIndex] + octave;

        return { name, midi: rounded, freq: +(440 * Math.pow(2, (rounded - 69) / 12)).toFixed(3), cents };
    }

    /*
    transposeNote(note, semitones)	Shift a single note by N semitones
    scale	transposeScale(scale, semitones)	Shift a list of notes
    chord	transposeChord(chord, semitones)	Transpose complex chord names
    key data	transposeKeyData(baseKey, semitones)
    */

}

/*
const CHROMATIC = [
  "C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"
];
Then transposing means rotating this array by n semitones.
For example, transposing C major up 2 semitones (a whole step) gives D major.

🎵 2. Transpose a single note
You can start with a helper function:

js
Copy code
function transposeNote(note, semitones) {
  const CHROMATIC = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

  // Normalize flats to sharps
  const enharmonic = { "Db": "C#", "Eb": "D#", "Gb": "F#", "Ab": "G#", "Bb": "A#" };
  const normalized = enharmonic[note] || note;

  const i = CHROMATIC.indexOf(normalized);
  if (i < 0) throw new Error("Unknown note: " + note);

  const newIndex = (i + semitones + 12) % 12;
  return CHROMATIC[newIndex];
}
✅ Examples:

js
Copy code
transposeNote("C", 2);   // "D"
transposeNote("Bb", 2);  // "C"
transposeNote("F#", -5); // "C#"
🎶 3. Transpose a scale (or any array of notes)
js
Copy code
function transposeScale(scale, semitones) {
  return scale.map(n => transposeNote(n, semitones));
}

transposeScale(["C", "D", "E", "F", "G", "A", "B"], 2);
// → ["D", "E", "F#", "G", "A", "B", "C#"]
So now you can automatically rotate C major into D major, E major, etc.

🎼 4. Transpose entire key datasets
Once you’ve built your C major harmonization object, you can generate others with a transposition function:

js
Copy code
function transposeKeyData(baseKeyData, semitones) {
  const out = JSON.parse(JSON.stringify(baseKeyData)); // clone

  out.scale = transposeScale(out.scale, semitones);

  out.triads = out.triads.map(ch => transposeChord(ch, semitones));
  out.sevenths = out.sevenths.map(ch => transposeChord(ch, semitones));

  out.noteToChord = Object.fromEntries(
    Object.entries(out.noteToChord).map(([note, chords]) => [
      transposeNote(note, semitones),
      chords.map(ch => transposeChord(ch, semitones))
    ])
  );

  out.chordTransitions = Object.fromEntries(
    Object.entries(out.chordTransitions).map(([ch, next]) => [
      transposeChord(ch, semitones),
      next.map(nc => transposeChord(nc, semitones))
    ])
  );

  out.parallelThirds = Object.fromEntries(
    Object.entries(out.parallelThirds).map(([k, v]) => [
      transposeNote(k, semitones),
      transposeNote(v, semitones)
    ])
  );

  return out;
}
🧩 5. Chord transposition helper
You’ll need a function that handles chord roots, e.g. "C#m7b5" → "Dm7b5":

js
Copy code
function transposeChord(chord, semitones) {
  const match = chord.match(/^([A-G](?:#|b)?)(.*)$/);
  if (!match) return chord;
  const [ , root, suffix ] = match;
  return transposeNote(root, semitones) + suffix;
}
✅ Examples:

js
Copy code
transposeChord("C", 2);        // "D"
transposeChord("F#m7b5", -1);  // "Fm7b5"
transposeChord("Bbmaj7", 5);   // "Ebmaj7"
🎛 6. Putting it together
You can now generate every key from your C major dataset:

js
Copy code
const HARMONY = {
  "C major": baseHarmonyC
};

const KEY_NAMES = [
  ["C major", 0],
  ["Db major", 1],
  ["D major", 2],
  ["Eb major", 3],
  ["E major", 4],
  ["F major", 5],
  ["F# major", 6],
  ["G major", 7],
  ["Ab major", 8],
  ["A major", 9],
  ["Bb major", 10],
  ["B major", 11]
];

for (const [keyName, interval] of KEY_NAMES) {
  if (keyName !== "C major") {
    HARMONY[keyName] = transposeKeyData(HARMONY["C major"], interval);
  }
}
  */