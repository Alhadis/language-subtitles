SubRip Text stress-tests
========================

The fixtures in this directory were written by [ale5000][], who did an excellent
[write-up][] on numerous compatibility differences between programs that support
SRT files. Though the programs and versions he tested are now long outdated, the
research revealed many lesser-known aspects of SRT's syntax: `\h`/`\N` escapes,
acceptance of non-European decimal separators, error handling, and the `{\anX}`
construct (which I've been unable to test with VLC).

Visit [`ale5000.altervista.org/subtitles.htm`][write-up] for more insight on how
irredeemably fractured SRT support really is among media players.

<!-- Referenced links -->
[ale5000]:  https://ale5000.altervista.org/
[write-up]: https://ale5000.altervista.org/subtitles.htm
