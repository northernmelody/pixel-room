# Real animal sound sources

The portrait page uses these redistributable field recordings instead of synthesized meow/bark oscillators:

| File | Source | License | Processing |
| --- | --- | --- | --- |
| `cat.wav` | [Meow of a Siamese cat — freemaster2](https://commons.wikimedia.org/wiki/File:Meow_of_a_Siamese_cat_-_freemaster2.wav) | CC0 1.0 | Used as provided in the open-source `sedentary-reminder` asset package; mono PCM WAV. |
| `dog.wav` | [Sound-of-dog.ogg — Kriplozoik](https://commons.wikimedia.org/wiki/File:Sound-of-dog.ogg) | CC BY-SA 3.0 | Used as provided in the open-source `sedentary-reminder` asset package; mono PCM WAV conversion. |

The source package documents the same files and licenses in its [audio asset README](https://github.com/CureJe/sedentary-reminder/blob/main/assets/audio/README.md). The synthesized fallback remains in `portrait/js/audio.js` for browsers that cannot fetch or decode the local samples.
