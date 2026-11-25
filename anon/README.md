# The Anon Army overlay

Everything in this directory is applied to the `structs-webapp` submodule as it
is built. Nothing in the submodule is edited. The client stays in English;
there is no translation layer.

| Path | What it is |
|---|---|
| `patches.cjs` | `[exact upstream text, replacement]` pairs per upstream file: the guild connection, recovery, the telemetry name, players' own pictures, the Anon gallery, and Anon Army in place of SN Corp in sign-up and the tutorial |
| `runtime/` | Loaded before webapp's entry as `__anon`: `guild` (`guild.js`, the services of the guild the page plays through, Anon Army), `recovery` (`recovery.js`, moving a recovered player of another guild into it), `pfp` (`pfp.js`, every portrait showing the player's `pfp` URL over the generated one, and setting a sign-up picture as `pfp` on chain), `gallery` (`gallery.js`, the Anon NFT gallery, at sign-up and on a member's own profile) and `account` (`account.js`, creating the account at sign-up without a recovery key section, and Download Player in place of Log Out) |
| `pfp/` | The Anon Army NFTs players choose from, `<collection>/<id>.webp`, and `collections.json`; made by `make_pfps.py` from `../Anons`, served at `/anon/pfp/` |
| `public/` | Static files served over webapp's: `guild.json` (the guild's on-chain endpoint), `favicon.ico`, and `anon/` with `anon.css`, the sign-up badge, the guild logo and icons |
| `page.cjs` | Renders webapp's Twig pages (`templates/`) to `index.html` and `sector-blitz/` (the public leaderboard), adding Google Tag Manager (`GTM-58HZKHDD`), the icons and `anon.css` |
| `overlay.cjs`, `loader.cjs` | Apply `patches.cjs` to each source file webpack reads |
| `check.cjs` | `npm run check` / `npm test`: stale or orphaned patches, SN Corp left on screen, guild.json against `GUILD_ID`, pictures missing from `pfp/` |

## Writing a patch

```js
'js/view_models/signup/Orientation7ViewModel.js': [
  ['on behalf of SN.CORPORATION.`', 'on behalf of ANON ARMY.`'],
],
```

- The first string is copied exactly from the upstream file; every occurrence
  is replaced, in one pass, longest first.
- Include enough around it (quotes, tags) that it only matches what you mean,
  never an id, class, storage key or anything sent to the guild or the chain.
  CSS classes such as `snc-logo` keep webapp's names.
- One key per upstream file: a second entry for the same file replaces the
  first.

## The art

All of it is made from the Anon Army archive in `../Anons` by
`make_art.py`, from the Anons symbol, the @AnonsNFT avatar
(`logos/community-avatar.jpg`). `public/anon/img/anon-army-badge.png`
is the symbol in white, its background cleared, in the top of a 384px square, the
shape of webapp's 192px sign-up logo slot, with the motto set under it by
`anon.css`. `anon-army-logo.jpg` is the avatar as it is, for
`guild.json`; the icons are the symbol on white.

`pfp/` holds every picture of Anon Army and OG Anons as a 320px square WebP. See the main README's *Profile pictures*.
