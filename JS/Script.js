/**
 * Veze – Main Application Script
 * Fully fixed version with:
 * - PNG/JPG/JPEG/WEBP/GIF support
 * - Robust fallback for missing images
 * - Correct path handling: ignores JSON folder, always uses SOURCE/Image/Gallery/ or SOURCE/Image/Pins/
 * - Fixed viewer loading
 * - Fixed gallery stability
 */

// ==============================
// UTILITY HELPERS
// ==============================
function reveal(element) {
  element.classList.remove("vz-hidden");
}

function conceal(element) {
  element.classList.add("vz-hidden");
}

function fetchJSON(url) {
  return fetch(url)
    .then((r) => {
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.json();
    })
    .catch((err) => {
      console.error(`Failed to load ${url}:`, err);
      return [];
    });
}

function pushHash(hash) {
  window.location.hash = hash;
}

class Vec2 {
  constructor(x = 0, y = 0) {
    this.x = x;
    this.y = y;
  }

  set(x, y) {
    this.x = x;
    this.y = y;
  }

  add(v) {
    this.x += v.x;
    this.y += v.y;
  }
}

// ==============================
// AUDIO STUB
// ==============================
const SFX = {
  main: {
    play: (snd) => console.log("SFX:", snd),
    volume: () => {},
    mute: () => {}
  },

  enterSnd: {
    play: () => console.log("Enter sound"),
    volume: () => {}
  },

  ambience: {
    play: () => console.log("Ambience"),
    volume: () => {}
  }
};

// ==============================
// DOM REFERENCES
// ==============================
const BODY = document.querySelector("body");
const NAV = document.querySelector("nav");

const LANDING = document.getElementById("vz-landing");
const WRAPPER = document.getElementById("vz-wrapper");
const CONTEXT = document.getElementById("vz-context");
const ENTER_BUTTON = document.getElementById("vz-enter-button");
const DISPLAY_UNFIT = document.getElementById("vz-display-unfit");

const PAGE_TITLE = document.getElementById("vz-page-title");
const PAGE_BUTTONS = document.getElementsByClassName("vz-nav-btn");

const INPUT_VOL = document.getElementById("vz-volume-slider");
const INPUT_MUS = document.getElementById("vz-music-toggle");
const INPUT_CRT = document.getElementById("vz-crt-toggle");
const INPUT_THEME = document.getElementById("vz-theme-toggle");

const CRT_SCAN_FX = document.getElementById("vz-crt-scan-fx");

// Gallery
const GALLERY_CONTAINER = document.getElementById("vz-gallery-masonry");
const GALLERY_COLUMNS = document.getElementsByClassName("vz-gallery-column");
const GALLERY_ITEM_TEMPLATE = document.getElementById("vz-gallery-item-template");

// Pins
const PINS_TOP_ROW = document.getElementById("vz-pins-top-row");
const PINS_BOTTOM_SCROLLER = document.getElementById("vz-pins-bottom-scroller");

// Blog
const BLOG_CONTAINER = document.getElementById("vz-blog-list");
const BLOG_ENTRY_TEMPLATE = document.getElementById("vz-blog-entry-template");

// Viewers
const GALLERY_VIEWER = document.getElementById("vz-gallery-viewer");
const GALLERY_IMAGE = GALLERY_VIEWER.querySelector(".vz-art-viewer-image");
const GALLERY_TITLE = GALLERY_VIEWER.querySelector(".vz-art-viewer-title");

const PINS_VIEWER = document.getElementById("vz-pins-viewer");
const PINS_IMAGE = PINS_VIEWER.querySelector(".vz-art-viewer-image");
const PINS_TITLE = PINS_VIEWER.querySelector(".vz-art-viewer-title");

// Chronicle
const CHRONICLE_BUTTONS = document.getElementsByClassName("vz-chronicle-btn");
const CHRONICLE_IFRAME = document.getElementById("vz-chronicle-iframe");

// Links
const LINKS = document.getElementsByClassName("vz-link");

// ==============================
// CONSTANTS
// ==============================
const PAGES = {};

const WINDOW_MAX = new Vec2(window.innerWidth, window.innerHeight);

const THEMES = [
  "vz-theme-white",
  "vz-theme-red",
  "vz-theme-blue",
  "vz-theme-yellow",
  "vz-theme-green",
  "vz-theme-purple"
];

// Placeholder image for missing / error (simple SVG data URI)
const MISSING_IMAGE_PLACEHOLDER = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Crect width='200' height='200' fill='%23333'/%3E%3Ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' fill='%23aaa' font-size='20' font-family='sans-serif'%3EImage%20Missing%3C/text%3E%3C/svg%3E";

// ==============================
// STATE
// ==============================
let loaded = false;
let entered = false;
let selected_page = null;

// Gallery
let galleryItems = 0;
let galleryLoaded = false;
let galleryColumnTarget = 0;
const galleryColumnOffs = [0, 0, 0, 0, 0];

// Pins
let pinsData = null;
let pinsLoaded = false;

// Viewer
let activeViewer = null;
let activePiece = null;
let activeTitle = null;

let artViewerMoving = false;

const artViewerPos = new Vec2();

let artViewerScale = 1;

// Config
const config = {
  music: true,
  crt: true,
  themeIndex: 0,
  volume: 0.2
};

// ==============================
// HELPERS
// ==============================
function bindButton(button, clickSnd = "expand", hoverSnd = "grab_start") {
  button.addEventListener("mousedown", () => {
    SFX.main.play(clickSnd);
  });

  button.addEventListener("mouseenter", () => {
    SFX.main.play(hoverSnd);
  });
}

function applyTheme(index) {
  THEMES.forEach((cls) => BODY.classList.remove(cls));
  BODY.classList.add(THEMES[index]);
}

function isRemoteImage(src) {
  return /^https?:\/\//i.test(src);
}

function getImageFormat(fileName) {
  const parts = fileName.split(".");
  return parts.length > 1 ? parts.pop().toLowerCase() : "png";
}

/**
 * Strips all directory info from a path, returning only the filename.
 * Example: "img/art/Creator.webp" → "Creator.webp"
 *          "folder/sub/other.jpg" → "other.jpg"
 *          "simple.png"          → "simple.png"
 */
function extractFilename(path) {
  // Replace both / and \ with /
  const normalized = path.replace(/\\/g, "/");
  const parts = normalized.split("/");
  return parts[parts.length - 1];
}

// ==============================
// PAGE NAVIGATION
// ==============================
function changePage(destination) {
  if (selected_page === PAGES[destination]) return;

  const SELECTED_PAGE = PAGES[destination];

  if (!SELECTED_PAGE) return;

  if (destination === "gallery" && !galleryLoaded) {
    loadGallery();
  }

  if (destination === "pins" && !pinsLoaded) {
    loadPins();
  }

  Object.values(PAGES).forEach(conceal);

  reveal(SELECTED_PAGE);

  if (GALLERY_CONTAINER) {
    GALLERY_CONTAINER.scrollTo(0, 0);
  }

  CONTEXT.textContent =
    SELECTED_PAGE.getAttribute("context") || "";

  PAGE_TITLE.textContent = destination;

  selected_page = SELECTED_PAGE;

  if (entered) {
    SFX.main.play(destination);
  }
}

function bindPageButton(button) {
  const destination = button.innerHTML.toLowerCase();

  button.addEventListener("mousedown", () => {
    changePage(destination);
    pushHash(destination);
  });

  button.addEventListener("mouseenter", () => {
    if (PAGES[destination]) {
      CONTEXT.textContent =
        PAGES[destination].getAttribute("context") || "";
    }
  });

  bindButton(button);
}

// ==============================
// IMAGE VIEWER (FIXED)
// ==============================
function openArtViewer(
  viewer,
  piece,
  title,
  name,
  format,
  aspectRatio,
  displayTitle = ""
) {
  SFX.main.play("open_art");

  activeViewer = viewer;
  activePiece = piece;
  activeTitle = title;

  let finalPath = "";

  // RESET
  piece.style.opacity = "0";
  piece.style.transform = "none";
  piece.style.backgroundImage = "none";
  piece.onload = null;
  piece.onerror = null;

  // DETERMINE FULL PATH
  if (isRemoteImage(name)) {
    // Absolute URL – use as‑is
    finalPath = name;
  } else {
    // Local file – ignore any directory in 'name', keep only filename
    const rawFilename = extractFilename(name);
    const cleanName = rawFilename.replace(/\.[^/.]+$/, "");
    let folder = "SOURCE/Image/Gallery";

    if (viewer.id === "vz-pins-viewer") {
      folder = "SOURCE/Image/Pins";
    }

    finalPath = `${folder}/${cleanName}.${format}`;
  }

  piece.style.aspectRatio = aspectRatio;

  // SUCCESS
  piece.onload = () => {
    piece.style.opacity = "1";
  };

  // FAIL
  piece.onerror = () => {
    console.error("FAILED TO LOAD IMAGE:", finalPath);
    piece.removeAttribute("src");
    piece.style.background = "#000";
    piece.style.opacity = "1";
    title.innerText = "FAILED TO LOAD IMAGE";
  };

  piece.src = finalPath;
  title.innerText = displayTitle;

  viewer.classList.remove("vz-hidden");

  artViewerMoving = false;
  artViewerPos.set(0, 0);
  artViewerScale = 1;
}

function closeArtViewer(event) {
  if (!activeViewer) return;

  if (event.target !== activeViewer) return;

  activeViewer.classList.add("vz-hidden");

  activePiece.removeAttribute("src");

  activePiece.style.transform = "none";

  artViewerMoving = false;
  artViewerPos.set(0, 0);
  artViewerScale = 1;

  SFX.main.play("close_art");

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

  mouse.preventDefault();

  artViewerScale -= mouse.deltaY * artViewerScale * 0.001;
  artViewerScale = Math.max(1, Math.min(10, artViewerScale));

  updateArtViewerTransform();
}

// ==============================
// GALLERY
// ==============================
function createGalleryItem(pieceData) {
  const wrapper = GALLERY_ITEM_TEMPLATE.cloneNode(true);
  wrapper.removeAttribute("id");
  wrapper.classList.remove("vz-hidden");

  const item = wrapper.querySelector(".vz-gallery-item");
  const thumbnail = wrapper.querySelector(".vz-gallery-thumb");
  const title = wrapper.querySelector(".vz-gallery-title");

  item.style.animationDelay = `${galleryItems * 0.05}s`;

  // DATA from JSON
  const displayName = pieceData[0] || "Untitled";
  const aspectRatio = pieceData[3] || "1";
  const rawPath = pieceData[5];

  // Build the final image path – ignore directories, always go to SOURCE/Image/Gallery/
  let imagePath;
  if (!rawPath) {
    imagePath = MISSING_IMAGE_PLACEHOLDER;
  } else if (isRemoteImage(rawPath)) {
    imagePath = rawPath; // remote URL, keep as‑is
  } else {
    const filename = extractFilename(rawPath);
    imagePath = `SOURCE/Image/Gallery/${filename}`;
  }

  // Create thumbnail <img> element (much better than background-image)
  const img = document.createElement("img");
  img.src = imagePath;
  img.style.width = "100%";
  img.style.height = "100%";
  img.style.objectFit = "cover";
  img.style.aspectRatio = aspectRatio;
  img.alt = displayName;
  img.draggable = false;

  // Fallback if image still fails to load
  img.onerror = function () {
    if (this.src !== MISSING_IMAGE_PLACEHOLDER) {
      this.src = MISSING_IMAGE_PLACEHOLDER;
      this.onerror = null;
    }
  };

  thumbnail.innerHTML = "";
  thumbnail.appendChild(img);

  title.innerText = displayName;

  // OPEN VIEWER (using the same final path)
  wrapper.addEventListener("mouseup", () => {
    openArtViewer(
      GALLERY_VIEWER,
      GALLERY_IMAGE,
      GALLERY_TITLE,
      imagePath,            // already a full local or remote path
      getImageFormat(imagePath),
      aspectRatio,
      displayName
    );
  });

  // COLUMN PLACEMENT (masonry logic)
  let shortest = Infinity;
  for (let i = 0; i < galleryColumnOffs.length; i++) {
    if (galleryColumnOffs[i] < shortest) {
      shortest = galleryColumnOffs[i];
      galleryColumnTarget = i;
    }
  }

  GALLERY_COLUMNS[galleryColumnTarget].appendChild(wrapper);
  galleryColumnOffs[galleryColumnTarget] += 1 / parseFloat(aspectRatio);
  galleryItems++;
}

function loadGallery() {
  fetchJSON(`JSON/Gallery.json?t=${Date.now()}`)
    .then((data) => {
      if (!data || data.length === 0) {
        console.warn("Gallery JSON is empty or invalid.");
        return;
      }
      data.forEach(createGalleryItem);
    })
    .catch((err) => {
      console.error("Gallery load failed:", err);
    });

  galleryLoaded = true;
}

// ==============================
// BLOG
// ==============================
function createBlogEntry(entry) {
  const wrapper = BLOG_ENTRY_TEMPLATE.cloneNode(true);
  wrapper.removeAttribute("id");
  wrapper.classList.remove("vz-hidden");

  const title = wrapper.querySelector(".vz-blog-item-title");
  const date = wrapper.querySelector(".vz-blog-item-date");
  const body = wrapper.querySelector(".vz-blog-item-body");

  const time = new Date(entry.time);
  title.innerText = entry.title;
  date.innerText = time.toLocaleDateString("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric"
  });
  body.innerHTML = entry.body;

  BLOG_CONTAINER.appendChild(wrapper);
}

function loadBlog() {
  fetchJSON(`JSON/Blog.json?t=${Date.now()}`)
    .then((data) => {
      data.forEach(createBlogEntry);
    })
    .catch((err) => {
      console.error("Blog load failed:", err);
    });
}

// ==============================
// PINS
// ==============================
function loadPins() {
  fetchJSON(`JSON/Pins.json?t=${Date.now()}`)
    .then((data) => {
      pinsData = data;
      renderPins();
    })
    .catch((err) => {
      console.error("Pins load failed:", err);
    });
}

function renderPins() {
  if (!pinsData) return;

  PINS_TOP_ROW.innerHTML = "";
  PINS_BOTTOM_SCROLLER.innerHTML = "";

  // BIG IMAGES
  const bigImages = pinsData.big || [];
  bigImages.forEach((img) => {
    const raw = typeof img === "string" ? img : img.file;
    const aspectRatio = typeof img === "object" && img.ar ? img.ar : "1";
    const format = getImageFormat(raw);
    const nameWithoutExt = raw.replace(/\.[^/.]+$/, "");

    const imgEl = document.createElement("img");
    imgEl.src = `SOURCE/Image/Pins/${raw}`;
    imgEl.setAttribute("ar", aspectRatio);
    imgEl.draggable = false;

    imgEl.onerror = function () {
      if (this.src !== MISSING_IMAGE_PLACEHOLDER) {
        this.src = MISSING_IMAGE_PLACEHOLDER;
        this.onerror = null;
      }
    };

    imgEl.addEventListener("mouseup", () => {
      openArtViewer(
        PINS_VIEWER,
        PINS_IMAGE,
        PINS_TITLE,
        nameWithoutExt,
        format,
        aspectRatio,
        nameWithoutExt
      );
    });

    PINS_TOP_ROW.appendChild(imgEl);
  });

  // SMALL IMAGES
  const smallImages = pinsData.small || [];
  smallImages.forEach((img) => {
    const raw = typeof img === "string" ? img : img.file;
    const aspectRatio = typeof img === "object" && img.ar ? img.ar : "1";
    const format = getImageFormat(raw);
    const nameWithoutExt = raw.replace(/\.[^/.]+$/, "");

    const imgEl = document.createElement("img");
    imgEl.src = `SOURCE/Image/Pins/${raw}`;
    imgEl.setAttribute("ar", aspectRatio);
    imgEl.draggable = false;

    imgEl.onerror = function () {
      if (this.src !== MISSING_IMAGE_PLACEHOLDER) {
        this.src = MISSING_IMAGE_PLACEHOLDER;
        this.onerror = null;
      }
    };

    imgEl.addEventListener("mouseup", () => {
      openArtViewer(
        PINS_VIEWER,
        PINS_IMAGE,
        PINS_TITLE,
        nameWithoutExt,
        format,
        aspectRatio,
        nameWithoutExt
      );
    });

    PINS_BOTTOM_SCROLLER.appendChild(imgEl);
  });

  pinsLoaded = true;
}

// ==============================
// CHRONICLE
// ==============================
function initChronicleButtons() {
  Array.from(CHRONICLE_BUTTONS).forEach((btn) => {
    btn.addEventListener("click", () => {
      Array.from(CHRONICLE_BUTTONS).forEach((b) => {
        b.classList.remove("vz-active");
      });
      btn.classList.add("vz-active");

      const url = btn.getAttribute("data-url");
      if (url) {
        CHRONICLE_IFRAME.src = url;
      }

      SFX.main.play("expand");
    });
  });

  if (CHRONICLE_BUTTONS.length) {
    CHRONICLE_BUTTONS[0].click();
  }
}

// ==============================
// SETTINGS
// ==============================
function setVolume() {
  config.volume = INPUT_VOL.value;
  SFX.main.volume(config.volume);
}

function updateMusicMuted() {
  config.music = INPUT_MUS.checked;
}

function updateCRTVisible() {
  config.crt = INPUT_CRT.checked;

  CRT_SCAN_FX.classList.toggle(
    "vz-hidden",
    !config.crt
  );

  BODY.classList.toggle(
    "crt",
    config.crt
  );
}

function updateTheme() {
  config.themeIndex =
    (config.themeIndex + 1) % THEMES.length;

  applyTheme(config.themeIndex);
}

// ==============================
// EVENTS
// ==============================
function onLoad() {
  loadBlog();
  onHashChange();
  onResize();
  initChronicleButtons();
  loaded = true;
}

function onEnter() {
  LANDING.classList.add("vz-hidden");
  WRAPPER.classList.remove("vz-hidden");
  entered = true;
}

function onHashChange() {
  const location =
    window.location.hash.substring(1) || "about";
  changePage(location);
}

function onResize() {
  WINDOW_MAX.set(
    window.innerWidth,
    window.innerHeight
  );

  const tooNarrow =
    WINDOW_MAX.x / WINDOW_MAX.y < 4 / 3.02;

  WRAPPER.classList.toggle(
    "vz-hidden",
    tooNarrow
  );

  DISPLAY_UNFIT.classList.toggle(
    "vz-hidden",
    !tooNarrow
  );

  if (!tooNarrow && entered) {
    WRAPPER.classList.remove("vz-hidden");
  }
}

// ==============================
// BOOTSTRAP
// ==============================
function bootstrap() {
  document.querySelectorAll(".vz-page").forEach((page) => {
    PAGES[page.id.replace("vz-page-", "")] = page;
  });

  Array.from(PAGE_BUTTONS).forEach(bindPageButton);

  Array.from(LINKS).forEach((link) => {
    bindButton(link);
  });

  // Horizontal wheel scroll
  PINS_BOTTOM_SCROLLER.addEventListener("wheel", (e) => {
    e.preventDefault();
    PINS_BOTTOM_SCROLLER.scrollLeft += e.deltaY * 4;
  });

  // Inputs
  INPUT_VOL.addEventListener("input", setVolume);
  INPUT_MUS.addEventListener("input", updateMusicMuted);
  INPUT_CRT.addEventListener("input", updateCRTVisible);
  INPUT_THEME.addEventListener("change", updateTheme);

  // Restore context
  NAV.addEventListener("mouseleave", () => {
    if (selected_page) {
      CONTEXT.textContent =
        selected_page.getAttribute("context");
    }
  });

  // Viewer events
  [GALLERY_VIEWER, PINS_VIEWER].forEach((viewer) => {
    const piece = viewer.querySelector(".vz-art-viewer-image");

    piece.addEventListener("mousemove", onArtViewerMove);
    piece.addEventListener("wheel", onArtViewerZoom);
    piece.addEventListener("mousedown", () => {
      artViewerMoving = true;
    });
    piece.addEventListener("mouseup", () => {
      artViewerMoving = false;
    });

    viewer.addEventListener("mouseup", closeArtViewer);
  });

  // Enter
  ENTER_BUTTON.addEventListener("mouseup", onEnter);

  // Window events
  window.addEventListener("hashchange", onHashChange);
  window.addEventListener("resize", onResize);
  window.addEventListener("load", onLoad);
}

bootstrap();