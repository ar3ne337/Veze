/**
 * Veze – Main Application Script
 * Handles navigation, audio, gallery, blog, pins, chronicle, and theming.
 * All original functionality preserved with updated asset paths.
 */

// ==============================
// UTILITY HELPERS
// ==============================
function reveal(element) {
  element.classList.remove('vz-hidden');
}
function conceal(element) {
  element.classList.add('vz-hidden');
}
function fetchJSON(url) {
  return fetch(url)
    .then(r => {
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.json();
    })
    .catch(err => {
      console.error(`Failed to load ${url}:`, err);
      return [];
    });
}
function pushHash(hash) {
  window.location.hash = hash;
}

// Simple 2D vector class
class Vec2 {
  constructor(x = 0, y = 0) { this.x = x; this.y = y; }
  set(x, y) { this.x = x; this.y = y; }
  add(v) { this.x += v.x; this.y += v.y; }
}

// SFX stub (replace with actual audio library calls)
const SFX = {
  main: {
    play: (snd) => console.log('SFX:', snd),
    volume: () => {},
    mute: () => {}
  },
  enterSnd: { play: () => console.log('Enter sound'), volume: () => {} },
  ambience: { play: () => console.log('Ambience'), volume: () => {} }
};

// ==============================
// DOM ELEMENT REFERENCES
// ==============================
const BODY = document.querySelector('body');
const NAV = document.querySelector('nav');
const LANDING = document.getElementById('vz-landing');
const WRAPPER = document.getElementById('vz-wrapper');
const CONTEXT = document.getElementById('vz-context');
const ENTER_BUTTON = document.getElementById('vz-enter-button');
const DISPLAY_UNFIT = document.getElementById('vz-display-unfit');

// All page containers
const PAGES = {};
const PAGE_BUTTONS = document.getElementsByClassName('vz-nav-btn');
const PAGE_TITLE = document.getElementById('vz-page-title');

// Control panel inputs
const INPUT_VOL = document.getElementById('vz-volume-slider');
const INPUT_MUS = document.getElementById('vz-music-toggle');
const INPUT_CRT = document.getElementById('vz-crt-toggle');
const INPUT_THEME = document.getElementById('vz-theme-toggle');

// Pins elements
const PINS_TOP_ROW = document.getElementById('vz-pins-top-row');
const PINS_BOTTOM_SCROLLER = document.getElementById('vz-pins-bottom-scroller');

// Gallery elements
const GALLERY_CONTAINER = document.getElementById('vz-gallery-masonry');
const GALLERY_COLUMNS = document.getElementsByClassName('vz-gallery-column');
const GALLERY_ITEM_TEMPLATE = document.getElementById('vz-gallery-item-template');

// Art viewers
const GALLERY_VIEWER = document.getElementById('vz-gallery-viewer');
const GALLERY_IMAGE = GALLERY_VIEWER.querySelector('.vz-art-viewer-image');
const GALLERY_TITLE = GALLERY_VIEWER.querySelector('.vz-art-viewer-title');

const PINS_VIEWER = document.getElementById('vz-pins-viewer');
const PINS_IMAGE = PINS_VIEWER.querySelector('.vz-art-viewer-image');
const PINS_TITLE = PINS_VIEWER.querySelector('.vz-art-viewer-title');

// Links
const LINKS = document.getElementsByClassName('vz-link');

// Blog
const BLOG_CONTAINER = document.getElementById('vz-blog-list');
const BLOG_ENTRY_TEMPLATE = document.getElementById('vz-blog-entry-template');

// Chronicle
const CHRONICLE_BUTTONS = document.getElementsByClassName('vz-chronicle-btn');
const CHRONICLE_IFRAME = document.getElementById('vz-chronicle-iframe');

// CRT scan effect
const CRT_SCAN_FX = document.getElementById('vz-crt-scan-fx');

// ==============================
// CONSTANTS & STATE
// ==============================
const WINDOW_MAX = new Vec2(window.innerWidth, window.innerHeight);
const FILE_FORMATS = ['png', 'gif', 'mp4'];

// Supported themes
const THEMES = ['vz-theme-white', 'vz-theme-red', 'vz-theme-blue', 'vz-theme-yellow', 'vz-theme-green', 'vz-theme-purple'];
const THEME_NAMES = ['white', 'red', 'blue', 'yellow', 'green', 'purple'];

let loaded = false;
let entered = false;
let selected_page = null;

const config = {
  music: false,
  crt: true,
  themeIndex: 0,
  volume: 1.0
};

// Gallery state
let galleryItems = 0;
let galleryLoaded = false;
let galleryColumnTarget = 0;
const galleryColumnOffs = [0, 0, 0, 0, 0];

// Pins state
let pinsData = null;
let pinsLoaded = false;

// Art viewer state
let activeViewer = null;
let activePiece = null;
let activeTitle = null;
let artViewerMoving = false;
const artViewerPos = new Vec2();
let artViewerScale = 1;

// ==============================
// GENERAL HELPERS
// ==============================
function bindButton(button, clickSnd = 'expand', hoverSnd = 'grab_start') {
  button.addEventListener('mousedown', () => SFX.main.play(clickSnd));
  button.addEventListener('mouseenter', () => SFX.main.play(hoverSnd));
}

function applyTheme(index) {
  THEMES.forEach(cls => BODY.classList.remove(cls));
  BODY.classList.add(THEMES[index]);
}

function updateConfigStorage() {
  // No persistence (could be extended)
}

// ==============================
// PAGE NAVIGATION
// ==============================
function changePage(destination) {
  if (selected_page === PAGES[destination]) return;
  const SELECTED_PAGE = PAGES[destination];

  // Lazy load gallery/pins data
  if (destination === 'gallery' && !galleryLoaded) {
    loadGallery();
  }
  if (destination === 'pins' && !pinsLoaded) {
    loadPins();
  }

  console.log(`%cPage changing: ${destination}`, 'color: #ff0; background: #440; font-size: 24px; text-transform: uppercase;');

  // Hide all pages, show target
  Object.values(PAGES).forEach(conceal);
  reveal(SELECTED_PAGE);

  // Reset gallery scroll
  GALLERY_CONTAINER.scrollTo(0, 0);

  // Update context and title
  CONTEXT.textContent = SELECTED_PAGE.getAttribute('context');
  PAGE_TITLE.textContent = destination;
  selected_page = SELECTED_PAGE;

  if (entered) SFX.main.play(destination);
}

function bindPageButton(button) {
  const destination = button.innerHTML;
  button.addEventListener('mousedown', () => {
    changePage(destination);
    pushHash(destination);
  });
  button.addEventListener('mouseenter', () => {
    CONTEXT.textContent = PAGES[button.textContent].getAttribute('context');
  });
  bindButton(button, 'expand', 'hover');
}

// ==============================
// ART VIEWER LOGIC
// ==============================
function isRemoteImage(src) {
  return /^https?:\/\//i.test(src);
}

/**
 * Opens the art viewer with a given image.
 * @param {HTMLElement} viewer - The viewer container
 * @param {HTMLImageElement} piece - The <img> element inside the viewer
 * @param {HTMLElement} title - The title display element
 * @param {string} name - File name (without extension for local) or full URL
 * @param {string} format - File extension (png, gif, mp4)
 * @param {string} aspectRatio - CSS aspect ratio value
 * @param {string} displayTitle - Text to display as title
 */
function openArtViewer(viewer, piece, title, name, format, aspectRatio, displayTitle = 'aliased example') {
  SFX.main.play('open_art');
  activeViewer = viewer;
  activePiece = piece;
  activeTitle = title;

  if (isRemoteImage(name)) {
    piece.style.backgroundImage = format !== 'gif' ? `url(${name}.webp)` : '';
    piece.style.aspectRatio = aspectRatio;
    piece.src = name;
  } else {
    // Updated folder paths to use SOURCE/Image structure
    let folder = 'SOURCE/Image/Gallery'; // default fallback
    if (viewer.id === 'vz-gallery-viewer') {
      folder = 'SOURCE/Image/Gallery';
    } else if (viewer.id === 'vz-pins-viewer') {
      folder = 'SOURCE/Image/Pins';
    }
    piece.style.backgroundImage = format !== 'gif' ? `url(/${folder}/${name}.webp)` : '';
    piece.style.aspectRatio = aspectRatio;
    piece.src = `/${folder}/${name}.${format}`;
  }

  piece.style.transform = 'none';
  title.innerText = displayTitle;

  viewer.classList.remove('vz-hidden');
  artViewerMoving = false;
  artViewerPos.set(0, 0);
  artViewerScale = 1;
}

function closeArtViewer(event) {
  if (!activeViewer) return;
  if (event.target !== activeViewer) return;

  activeViewer.classList.add('vz-hidden');
  activePiece.src = '';
  activePiece.style.transform = 'none';
  artViewerMoving = false;
  artViewerPos.set(0, 0);
  artViewerScale = 1;
  SFX.main.play('close_art');

  activeViewer = null;
  activePiece = null;
  activeTitle = null;
}

function updateArtViewerTransform() {
  if (!activePiece) return;
  activePiece.style.transform = `
    scale(${artViewerScale})
    translate(${artViewerPos.x}px, ${artViewerPos.y}px)
  `;
}

function onArtViewerMove(mouse) {
  if (!artViewerMoving || !activePiece) return;
  artViewerPos.add({
    x: mouse.movementX / artViewerScale,
    y: mouse.movementY / artViewerScale
  });
  updateArtViewerTransform();
}

function onArtViewerZoom(mouse) {
  if (!activePiece) return;
  artViewerScale -= mouse.deltaY * artViewerScale * 0.001;
  artViewerScale = Math.max(1, Math.min(10, artViewerScale));
  updateArtViewerTransform();
  SFX.main.play(mouse.deltaY > 0 ? 'zoom_in' : 'zoom_out');
}

// ==============================
// GALLERY BUILDER
// ==============================
function createGalleryItem(pieceData) {
  const wrapper = GALLERY_ITEM_TEMPLATE.cloneNode(true);
  const item = wrapper.childNodes[1];
  const thumbnail = item.childNodes[1];
  const title = item.childNodes[3];

  wrapper.removeAttribute('id');
  wrapper.classList.remove('vz-hidden');

  item.style.animationDelay = `${galleryItems * 0.05}s`;
  // Updated path for gallery thumbnails
  thumbnail.style.backgroundImage = `url("/SOURCE/Image/Gallery/${pieceData[1]}.webp")`;
  thumbnail.style.aspectRatio = pieceData[3];
  title.innerText = pieceData[0];

  wrapper.addEventListener('mouseenter', () => SFX.main.play('grab_start'));
  wrapper.addEventListener('mouseup', () => {
    openArtViewer(
      GALLERY_VIEWER,
      GALLERY_IMAGE,
      GALLERY_TITLE,
      pieceData[1],
      FILE_FORMATS[pieceData[2]],
      pieceData[3],
      pieceData[0]
    );
  });

  // Waterfall masonry placement
  let shortest = Infinity;
  for (let i = 0; i < galleryColumnOffs.length; i++) {
    if (galleryColumnOffs[i] < shortest) {
      shortest = galleryColumnOffs[i];
      galleryColumnTarget = i;
    }
  }
  GALLERY_COLUMNS[galleryColumnTarget].appendChild(wrapper);
  galleryColumnOffs[galleryColumnTarget] += 1 / pieceData[3];
  galleryItems++;
}

function loadGallery() {
  fetchJSON(`JSON/Gallery.json?t=${Date.now()}`)
    .then(data => data.forEach(createGalleryItem))
    .catch(err => console.error('Gallery load failed:', err));
  galleryLoaded = true;
}

// ==============================
// BLOG BUILDER
// ==============================
function createBlogEntry(entry) {
  const wrapper = BLOG_ENTRY_TEMPLATE.cloneNode(true);
  const header = wrapper.childNodes[1];
  const title = header.childNodes[1];
  const date = header.childNodes[3];
  const body = wrapper.childNodes[3];
  const time = new Date(entry.time);

  wrapper.removeAttribute('id');
  wrapper.classList.remove('vz-hidden');

  title.innerText = entry.title;
  date.innerText = time.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' });
  body.innerHTML = entry.body;

  BLOG_CONTAINER.appendChild(wrapper);
}

function loadBlog() {
  fetchJSON(`JSON/Blog.json?t=${Date.now()}`)
    .then(data => data.forEach(createBlogEntry))
    .catch(err => console.error('Blog load failed:', err));
}

// ==============================
// PINS BUILDER
// ==============================
function getImageFormat(fileName) {
  const parts = fileName.split('.');
  return parts.length > 1 ? parts.pop().toLowerCase() : 'png';
}

function loadPins() {
  fetchJSON(`JSON/Pins.json?t=${Date.now()}`)
    .then(data => {
      pinsData = data;
      renderPins();
    })
    .catch(err => console.error('Pins load failed:', err));
}

function renderPins() {
  if (!pinsData) return;

  PINS_TOP_ROW.innerHTML = '';
  PINS_BOTTOM_SCROLLER.innerHTML = '';

  // Top row large images
  const bigImages = pinsData.big || [];
  bigImages.forEach((img, idx) => {
    const raw = typeof img === 'string' ? img : img.file;
    const fileName = isRemoteImage(raw) ? raw : `SOURCE/Image/Pins/${raw}`;
    const aspectRatio = typeof img === 'object' && img.ar ? img.ar : '1';
    const format = isRemoteImage(raw) ? getImageFormat(raw) : raw.split('.').pop();
    const nameWithoutExt = isRemoteImage(raw) ? raw.substring(0, raw.lastIndexOf('.')) : raw.replace(/\.[^/.]+$/, '');

    const imgEl = document.createElement('img');
    imgEl.src = fileName;
    imgEl.setAttribute('ar', aspectRatio);
    imgEl.style.animationDelay = `${idx * 0.1}s`;
    imgEl.addEventListener('mouseup', () => {
      openArtViewer(
        PINS_VIEWER,
        PINS_IMAGE,
        PINS_TITLE,
        isRemoteImage(raw) ? raw : nameWithoutExt,
        format,
        aspectRatio,
        nameWithoutExt
      );
    });
    bindButton(imgEl, 'silence');
    PINS_TOP_ROW.appendChild(imgEl);
  });

  // Bottom row small scrollable images
  const smallImages = pinsData.small || [];
  smallImages.forEach((img, idx) => {
    const raw = typeof img === 'string' ? img : img.file;
    const fileName = isRemoteImage(raw) ? raw : `SOURCE/Image/Pins/${raw}`;
    const aspectRatio = typeof img === 'object' && img.ar ? img.ar : '1';
    const format = isRemoteImage(raw) ? getImageFormat(raw) : raw.split('.').pop();
    const nameWithoutExt = isRemoteImage(raw) ? raw.substring(0, raw.lastIndexOf('.')) : raw.replace(/\.[^/.]+$/, '');

    const imgEl = document.createElement('img');
    imgEl.src = fileName;
    imgEl.setAttribute('ar', aspectRatio);
    imgEl.style.animationDelay = `${idx * 0.05}s`;
    imgEl.addEventListener('mouseup', () => {
      openArtViewer(
        PINS_VIEWER,
        PINS_IMAGE,
        PINS_TITLE,
        isRemoteImage(raw) ? raw : nameWithoutExt,
        format,
        aspectRatio,
        nameWithoutExt
      );
    });
    bindButton(imgEl, 'silence');
    PINS_BOTTOM_SCROLLER.appendChild(imgEl);
  });

  pinsLoaded = true;
}

// ==============================
// CHRONICLE
// ==============================
function initChronicleButtons() {
  Array.from(CHRONICLE_BUTTONS).forEach(btn => {
    btn.addEventListener('click', () => {
      Array.from(CHRONICLE_BUTTONS).forEach(b => b.classList.remove('vz-active'));
      btn.classList.add('vz-active');
      const url = btn.getAttribute('data-url');
      if (url) CHRONICLE_IFRAME.src = url;
      SFX.main.play('expand');
    });
  });
  if (CHRONICLE_BUTTONS.length) CHRONICLE_BUTTONS[0].click();
}

// ==============================
// CONTROL PANEL HANDLERS
// ==============================
function setVolume() {
  config.volume = INPUT_VOL.value;
  SFX.main.volume(config.volume);
  SFX.enterSnd.volume(config.volume * 0.6);
  SFX.ambience.volume(config.volume * config.music * 0.4);
  updateConfigStorage();
}

function updateMusicMuted() {
  config.music = INPUT_MUS.checked;
  setVolume();
  if (loaded) SFX.main.play(`music_${config.music ? 'on' : 'off'}`);
}

function updateCRTVisible() {
  config.crt = INPUT_CRT.checked;
  CRT_SCAN_FX.classList.toggle('vz-hidden', !config.crt);
  BODY.classList.toggle('crt', config.crt);
  if (loaded) SFX.main.play(`crt_${config.crt ? 'on' : 'off'}`);
  updateConfigStorage();
}

function updateTheme() {
  config.themeIndex = (config.themeIndex + 1) % THEMES.length;
  applyTheme(config.themeIndex);
  if (loaded) SFX.main.play(`theme_${THEME_NAMES[config.themeIndex]}`);
}

// ==============================
// EVENT HANDLERS & INIT
// ==============================
function onLoad() {
  loadConfig();
  loadBlog();
  onHashChange();
  onResize();
  initChronicleButtons();
  loaded = true;
}

function onEnter() {
  LANDING.classList.add('vz-hidden');
  WRAPPER.classList.remove('vz-hidden');
  SFX.enterSnd.play();
  SFX.ambience.play();
  SFX.main.mute(false);
  entered = true;
}

function onHashChange() {
  const location = window.location.hash.substring(1) || 'about';
  changePage(location);
}

function onResize() {
  WINDOW_MAX.set(window.innerWidth, window.innerHeight);
  const tooNarrow = (WINDOW_MAX.x / WINDOW_MAX.y) < 4 / 3.02;
  WRAPPER.classList.toggle('vz-hidden', tooNarrow);
  DISPLAY_UNFIT.classList.toggle('vz-hidden', !tooNarrow);
  if (!tooNarrow && entered) WRAPPER.classList.remove('vz-hidden');
}

function loadConfig() {
  config.volume = 0.2;
  config.music = true;
  config.crt = true;
  config.themeIndex = 0;

  INPUT_CRT.checked = config.crt;
  INPUT_MUS.checked = config.music;
  INPUT_VOL.value = config.volume;

  updateMusicMuted();
  updateCRTVisible();
  applyTheme(config.themeIndex);
  console.log('%cConfiguration loaded & applied (defaults).', 'color: #0f0; background: #040; font-size: 24px; text-transform: uppercase;');
}

// ==============================
// BOOTSTRAP
// ==============================
function bootstrap() {
  // Collect all page containers by id (removing 'vz-page-' prefix)
  document.querySelectorAll('.vz-page').forEach(page => { PAGES[page.id.replace('vz-page-', '')] = page; });

  // Bind navigation
  Array.from(PAGE_BUTTONS).forEach(bindPageButton);
  Array.from(LINKS).forEach(link => bindButton(link));

  // Custom scroll for pins bottom row
  PINS_BOTTOM_SCROLLER.addEventListener('wheel', e => {
    e.preventDefault();
    PINS_BOTTOM_SCROLLER.scrollLeft += e.deltaY * 4;
  });

  // Control panel inputs
  INPUT_VOL.addEventListener('input', setVolume);
  INPUT_MUS.addEventListener('input', updateMusicMuted);
  INPUT_CRT.addEventListener('input', updateCRTVisible);
  INPUT_THEME.addEventListener('change', updateTheme);

  // Restore context on nav leave
  NAV.addEventListener('mouseleave', () => {
    if (selected_page) CONTEXT.textContent = selected_page.getAttribute('context');
  });

  // Art viewer events (both viewers)
  [GALLERY_VIEWER, PINS_VIEWER].forEach(viewer => {
    const piece = viewer.querySelector('.vz-art-viewer-image');
    piece.addEventListener('mousemove', onArtViewerMove);
    piece.addEventListener('wheel', onArtViewerZoom);
    piece.addEventListener('mousedown', () => {
      artViewerMoving = true;
      SFX.main.play('grab_start');
    });
    piece.addEventListener('mouseup', () => {
      artViewerMoving = false;
      SFX.main.play('grab_end');
    });
    viewer.addEventListener('mouseup', closeArtViewer);
  });

  // Entry point
  ENTER_BUTTON.addEventListener('mouseup', onEnter);

  // Global events
  window.addEventListener('hashchange', onHashChange);
  window.addEventListener('resize', onResize);
  window.addEventListener('load', onLoad);
}

bootstrap();