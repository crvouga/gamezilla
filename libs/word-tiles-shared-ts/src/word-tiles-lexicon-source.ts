/**
 * Where the production word list comes from, and why the game may ship it.
 *
 * ENABLE (Enhanced North American Benchmark LExicon, "ENABLE2K" revision,
 * by Alan Beale and M. Cooper, 2000) was released by its authors into the
 * public domain: its distribution states that the list "is in the public
 * domain" and may be used for any purpose. That dedication covers the
 * words themselves, so commercial use, redistribution, offline storage and
 * derived indexes need no further permission. The copy fetched is the
 * widely mirrored `enable1.txt`; its checksum is pinned below, so a
 * changed upstream file is refused rather than silently adopted.
 */
export const ENABLE_SOURCE = {
  name: 'ENABLE (enable1.txt, ENABLE2K revision)',
  url: 'https://raw.githubusercontent.com/dolph/dictionary/master/enable1.txt',
  sha256: '3f16130220645692ed49c7134e24a18504c2ca55b3c012f7290e3e77c63b1a89',
  lines: 172_823,
  permission:
    'Public domain: the ENABLE authors dedicated the list to the public domain.',
  notice:
    'Word list: ENABLE (Alan Beale, M. Cooper), public domain. Words of 2 to 15 letters only.',
} as const;
