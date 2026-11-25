// Choosing an Anons NFT as the profile picture.
//
// The gallery holds every picture of every Anon collection this site hosts
// (anon/pfp/collections.json): Anon Army and OG Anons, one tab each.
// Each collection is one endless scroll, edge to edge: more are added as the
// player nears the end, and images load only as they come into view. Numbers
// without a picture (Anon Army's unrevealed) are skipped. A player who knows
// their picture's number finds it: the gallery scrolls to it and outlines it.
// Clicking a picture chooses it, and its URL,
// https://anons.structs.zone/anon/pfp/<collection>/<id>.webp, becomes the
// player's picture (pfp.js). No wallet is asked for: the picture is the
// player's choice.
//
// It opens from two places:
// - sign-up, "Choose Anon" beside the generated picture, like webapp's own
//   refresh button. The choice goes into the sign-up request's render
//   attributes, and the player's key sets it on chain once they play (pfp.js);
// - the player's own profile, the edit button on their portrait, where their
//   key sets the new picture on chain at once (MsgPlayerUpdatePfp).
//
// Its controls are webapp's own SUI components: the screen nav's tabs, screen
// buttons, the text input and the close link.
import {collections, collection, exists, pictureUrl, anonPicture, showOwn} from './pfp.js';
import {PfpViewerComponent} from '../../structs-webapp/src/js/view_models/components/PfpViewerComponent.js';

const BATCH = 120;
const ID_PATTERN = /^\d{1,4}$/;
const title = (c, id) => `${c.name} #${id}`;

/**
 * Opens a gallery over `host`, replacing any that is open there.
 *
 * @param {HTMLElement} host positioned element the gallery covers
 * @param {object} options
 * @param {HTMLElement} [options.viewport] the scrolling element `host` is in,
 *   when `host` may be taller than it: the gallery then ends where it does
 * @param {string|null} options.current the player's picture URL now
 * @param {function(string): void} options.say shows the gallery's messages
 * @param {function(string, object, number): void} options.choose called with the chosen URL
 * @return {function(): void} closes it
 */
function open(host, {viewport = null, current, say, choose}) {
  host.querySelector('.anon-gallery')?.remove();
  host.classList.add('anon-gallery-host');

  const panel = document.createElement('div');
  panel.className = 'anon-gallery';
  panel.innerHTML = `
    <div class="anon-gallery-layout">
      <div class="anon-gallery-header">
        <span class="sui-text-header">Anon Army</span>
        <a class="sui-screen-nav-close anon-gallery-close" href="javascript: void(0)" aria-label="Close">
          <i class="sui-icon-sm icon-close"></i>
        </a>
      </div>
      <nav class="sui-screen-nav-items anon-gallery-tabs" role="tablist">
        ${collections.map(c => `<a class="sui-screen-nav-item" href="javascript: void(0)" role="tab" data-collection="${c.slug}" title="${c.name}">${c.label}</a>`).join('')}
      </nav>
      <div class="common-inline-text-input-group-container">
        <div class="common-inline-text-input-controls-container">
          <label class="sui-input-text" for="anon-gallery-id">
            <span>Find by Number</span>
            <input type="text" inputmode="numeric" autocomplete="off" name="anon-gallery-id" id="anon-gallery-id">
          </label>
          <button class="sui-screen-btn sui-mod-disabled anon-gallery-find" type="button" disabled>Find</button>
        </div>
      </div>
      <div class="anon-gallery-scroll">
        <div class="anon-gallery-grid"></div>
      </div>
    </div>`;
  host.append(panel);

  const scroller = panel.querySelector('.anon-gallery-scroll');
  const grid = panel.querySelector('.anon-gallery-grid');
  const idInput = panel.querySelector('#anon-gallery-id');
  const idButton = panel.querySelector('.anon-gallery-find');
  const chosen = anonPicture(current);

  // The grid holds the pictures from `start` up to `next`, a window of the
  // collection (Anon Army runs to 1,740): it grows as the player scrolls
  // either way, and finding a picture far away moves it there. It starts and
  // grows by whole rows, so no picture moves sideways as rows are added above.
  let shown = null; // the collection in the grid
  let ids = []; // the numbers it has pictures for; those without one are skipped
  let start = 0; // where in `ids` the grid starts
  let next = 0; // and the first place after it
  const tile = id => grid.querySelector(`[data-id="${id}"]`);
  const columns = () => Math.max(1, getComputedStyle(grid).gridTemplateColumns.split(' ').length);
  const rows = count => Math.ceil(count / columns()) * columns();

  const tilesHTML = (from, to) => ids.slice(from, to).map(n => {
    const active = chosen?.collection === shown && chosen.id === n ? ' sui-mod-active' : '';
    return `<button type="button" class="anon-gallery-tile${active}" data-id="${n}" title="${title(shown, n)}" aria-label="${title(shown, n)}"><img src="/anon/pfp/${shown.slug}/${n}.webp" alt="" loading="lazy"></button>`;
  }).join('');

  /** Adds a batch of rows after the grid. */
  const append = () => {
    if (next >= ids.length) return;
    const end = Math.min(ids.length, next + rows(BATCH));
    grid.insertAdjacentHTML('beforeend', tilesHTML(next, end));
    next = end;
  };

  /** Adds a batch of rows before the grid, keeping what's in view in place. */
  const prepend = () => {
    if (start <= 0) return;
    const from = Math.max(0, start - rows(BATCH));
    const height = scroller.scrollHeight;
    grid.insertAdjacentHTML('afterbegin', tilesHTML(from, start));
    start = from;
    scroller.scrollTop += scroller.scrollHeight - height;
  };

  /** Starts the grid on the row holding the picture at `place`. */
  const moveTo = place => {
    start = next = Math.floor(place / columns()) * columns();
    grid.innerHTML = '';
    append();
  };

  /** Puts the picture at `place` in the grid, growing it when close and moving it when not. */
  const include = place => {
    if (place >= start && place < next) return true;
    if (place >= next && place < next + 2 * BATCH) {
      // A batch past it too, so it can be scrolled to the middle of the view.
      while (next <= Math.min(place + BATCH, ids.length - 1)) append();
      return true;
    }
    moveTo(place);
    return false;
  };

  // The endless scroll: nearing either end of the grid adds rows there.
  const fill = () => {
    if (scroller.clientHeight === 0) return;
    while (next < ids.length && scroller.scrollTop + scroller.clientHeight > scroller.scrollHeight - 600) {
      append();
    }
    while (start > 0 && scroller.scrollTop < 600) {
      prepend();
    }
  };
  scroller.addEventListener('scroll', fill, {passive: true});

  /** Brings a picture into view, outlined. */
  const reveal = (id, {mark = true, smooth = true} = {}) => {
    const near = include(ids.indexOf(id));
    if (!near) fill(); // rows above it, to scroll back to
    const target = tile(id);
    if (!target) return;
    // Far away, the grid moved: there is nothing between to scroll through.
    smooth = smooth && near;
    if (mark) {
      grid.querySelectorAll('.anon-mod-found').forEach(found => found.classList.remove('anon-mod-found'));
      // Restarted, so finding the same picture again plays the highlight again.
      void target.offsetWidth;
      target.classList.add('anon-mod-found');
    }
    target.scrollIntoView({block: 'center', behavior: smooth ? 'smooth' : 'auto'});
  };

  /** Shows one collection's pictures. */
  const show = c => {
    if (shown === c) return;
    shown = c;
    ids = [];
    for (let n = c.first; n <= c.last; n++) if (exists(c, n)) ids.push(n);
    moveTo(0);
    scroller.scrollTop = 0;
    panel.querySelectorAll('.anon-gallery-tabs .sui-screen-nav-item').forEach(tab => {
      const active = tab.dataset.collection === c.slug;
      tab.classList.toggle('sui-mod-active', active);
      tab.setAttribute('aria-selected', String(active));
      if (active) tab.scrollIntoView({block: 'nearest', inline: 'nearest'});
    });
    idInput.value = '';
    idInput.placeholder = `${c.first} to ${c.last}`;
    idInput.dispatchEvent(new Event('input'));
    if (chosen?.collection === c) {
      reveal(chosen.id, {mark: false, smooth: false});
    }
    fill();
  };

  /** The number in the field, if this collection has that picture. */
  const wanted = () => {
    const value = idInput.value.trim().replace(/^#/, '');
    const id = ID_PATTERN.test(value) ? Number(value) : null;
    return exists(shown, id) ? id : null;
  };

  const find = () => {
    const id = wanted();
    if (id === null) return;
    reveal(id);
    fill();
    say(`There's ${title(shown, id)}. Click it to make it yours.`);
  };

  // Within a taller page, the gallery covers what is in view, top to bottom.
  let observer = null;
  if (viewport) {
    viewport.scrollTop = 0;
    const fit = () => {
      if (!panel.isConnected) return observer?.disconnect();
      panel.style.bottom = 'auto';
      panel.style.height = `${Math.max(0, viewport.getBoundingClientRect().bottom - host.getBoundingClientRect().top)}px`;
    };
    observer = new ResizeObserver(fit);
    observer.observe(viewport);
    fit();
  }

  const close = () => {
    observer?.disconnect();
    panel.remove();
    host.classList.remove('anon-gallery-host');
  };

  panel.querySelector('.anon-gallery-tabs').addEventListener('click', event => {
    const tab = event.target.closest('[data-collection]');
    if (tab) show(collection(tab.dataset.collection));
  });
  grid.addEventListener('click', event => {
    const target = event.target.closest('button.anon-gallery-tile');
    if (!target) return;
    const id = Number(target.dataset.id);
    close();
    choose(pictureUrl(shown.slug, id), shown, id);
  });
  // Find is on only while the number is one it can find.
  idInput.addEventListener('input', () => {
    const found = wanted() !== null;
    idButton.disabled = !found;
    idButton.classList.toggle('sui-mod-primary', found);
    idButton.classList.toggle('sui-mod-disabled', !found);
  });
  idInput.addEventListener('keyup', event => {
    if (event.key === 'Enter') find();
  });
  idButton.addEventListener('click', find);
  panel.querySelector('.anon-gallery-close').addEventListener('click', close);

  show(chosen?.collection ?? collections[0]);
  say('Pick your Anon, or find it by number.');
  return close;
}

// Sign-up --------------------------------------------------------------------

/**
 * Adds "Choose Anon" to the sign-up profile screen (SetUsernameViewModel,
 * patched to call this once its picture is shown).
 *
 * @param {object} viewModel SetUsernameViewModel
 * @param {object} menuPage webapp's MenuPage
 */
function mount(viewModel, menuPage) {
  const refresh = document.getElementById(viewModel.regeneratePfpBtnId);
  const body = document.querySelector('.set-username-screen-body');
  if (!refresh || !body) return;

  const button = document.createElement('button');
  button.type = 'button';
  button.id = 'anon-gallery-btn';
  button.className = 'sui-screen-btn sui-mod-secondary';
  button.textContent = 'Choose Anon';
  refresh.after(button);

  button.addEventListener('click', () => open(body, {
    current: viewModel.pfpViewerComponent?.pfp?.url ?? null,
    say: text => menuPage.setDialogueScreenContent(text, true),
    choose: (url, c, id) => {
      const component = viewModel.pfpViewerComponent;
      // The generated layers stay, under the picture, for clients that don't show URLs.
      component.pfp = {...(component.pfp ?? {}), url};
      component.render();
      viewModel.gameState.signupRequest.pfp_client_render_attributes = component.getPfpJson();
      menuPage.setDialogueScreenContent(`${title(c, id)} it is. Now, your display name.`, true);
    },
  }));
}

/** The profile is confirmed: the picture can't change any more. */
function lock() {
  document.getElementById('anon-gallery-btn')?.remove();
  document.querySelector('.set-username-screen-body .anon-gallery')?.remove();
}

// The player's own profile ---------------------------------------------------

const EDIT_ID = 'anon-profile-pfp-edit-btn';
const STATUS_ID = 'anon-profile-pfp-status';

/**
 * The edit button on the player's own portrait (AccountProfileViewModel).
 *
 * @param {object} viewModel AccountProfileViewModel
 * @return {string}
 */
function profileButtonHTML(viewModel) {
  return viewModel.isOwnProfile
    ? `<a id="${EDIT_ID}" class="anon-profile-pfp-edit" href="javascript: void(0)" title="Change picture" aria-label="Change picture">
        <i class="sui-icon icon-edit sui-text-secondary"></i>
      </a>`
    : '';
}

/**
 * Opens the gallery from the player's own profile; the picture they choose is
 * set on chain by their key at once.
 *
 * @param {object} viewModel AccountProfileViewModel
 * @param {object} menuPage webapp's MenuPage
 */
function mountProfile(viewModel, menuPage) {
  const button = document.getElementById(EDIT_ID);
  const host = document.getElementById(menuPage.pageTemplateContentId);
  if (!button || !host) return;

  const status = document.createElement('div');
  status.id = STATUS_ID;
  status.className = 'anon-profile-pfp-status sui-text-hint hidden';
  document.querySelector('.profile-header-info-container')?.append(status);
  const say = text => {
    status.textContent = text;
    status.classList.toggle('hidden', !text);
  };

  button.addEventListener('click', () => {
    if (button.classList.contains('sui-mod-disabled')) return;
    open(host, {
      viewport: document.getElementById(menuPage.screenBodyId),
      current: viewModel.player?.pfp ?? null,
      say: () => {},
      choose: async (url, c, id) => {
        const {gameState, signingClientManager} = globalThis;
        const player = gameState?.keyPlayers?.player?.player;
        if (!player?.id || player.id !== viewModel.playerId || !signingClientManager) {
          say('Your picture can only be changed while you are signed in.');
          return;
        }
        button.classList.add('sui-mod-disabled');
        say(`Setting ${title(c, id)} as your picture…`);
        try {
          const tx = await signingClientManager.queueMsgPlayerUpdatePfp(player.id, url);
          if (tx?.status !== 'succeeded') throw new Error(tx?.error ?? tx?.status ?? 'not sent');
          showOwn(player, url);
          const portrait = document.querySelector('.profile-header-image');
          if (portrait) portrait.innerHTML = new PfpViewerComponent(player.pfp_client_render_attributes).renderHTML();
          say(`${title(c, id)} is your picture.`);
        } catch (error) {
          console.warn(`[anon] pfp of ${player.id} not set: ${error?.message ?? error}`);
          say(`Your picture was not changed: ${error?.message ?? error}`);
        } finally {
          button.classList.remove('sui-mod-disabled');
        }
      },
    });
  });
}

export const gallery = Object.freeze({open, mount, lock, profileButtonHTML, mountProfile});
