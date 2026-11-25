// The Anon Army overlay's runtime, loaded ahead of structs-webapp's entry.
//
// __anon.guild is the guild this page plays through, Anon Army (guild.js),
// __anon.recovery moves a recovered player of another guild into it
// (recovery.js), __anon.pfp shows players' own pictures (pfp.js) and
// __anon.gallery lets a player pick an Anons NFT as theirs, at sign-up and
// on their profile (gallery.js). anon/patches.cjs points webapp's code at them.
// __anon.account creates the account at sign-up without showing its recovery
// key, and offers Download Player in place of Log Out (account.js).
import {guild} from './guild.js';
import {recovery} from './recovery.js';
import * as pfp from './pfp.js';
import {gallery} from './gallery.js';
import {account} from './account.js';

globalThis.__anon = Object.freeze({guild, recovery, pfp: Object.freeze({...pfp}), gallery, account});
