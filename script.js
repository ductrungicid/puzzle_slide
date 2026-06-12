const presets = [
  {
    id: "sunset-hills",
    name: "Sunset Hills",
    src: createSceneDataUrl({
      skyTop: "#f8b36b",
      skyBottom: "#fde1bf",
      mountain: "#4d6a6d",
      field: "#91a56d",
      accent: "#c8673c",
    }),
  },
  {
    id: "river-town",
    name: "Riverside Town",
    src: createSceneDataUrl({
      skyTop: "#97c6f1",
      skyBottom: "#f3eadf",
      mountain: "#5f7b90",
      field: "#6d9274",
      accent: "#d88d52",
    }),
  },
  {
    id: "flower-garden",
    name: "Flower Garden",
    src: createSceneDataUrl({
      skyTop: "#f7d6a2",
      skyBottom: "#fff2e4",
      mountain: "#7d8d72",
      field: "#99b078",
      accent: "#c94f5d",
    }),
  },
];

const STORAGE_KEY = "sliding-puzzle-settings";
const IMAGE_DB_NAME = "sliding-puzzle-db";
const IMAGE_STORE_NAME = "images";
const UPLOAD_IMAGE_KEY = "current-upload";

const state = {
  cols: 3,
  rows: 5,
  imageSrc: presets[0].src,
  imageLabel: presets[0].name,
  imageSourceType: "preset",
  presetId: presets[0].id,
  imageMode: "sketch",
  renderedImageSrc: presets[0].src,
  sourceImageSize: { width: 1, height: 1 },
  cropAnchor: { x: 0.5, y: 0.5 },
  uploadObjectUrl: null,
  board: [],
  blank: { row: 0, col: 0 },
  moveCount: 0,
  playing: false,
  settingsDirty: true,
};

const setupScreen = document.getElementById("setup-screen");
const gameScreen = document.getElementById("game-screen");
const settingsTab = document.getElementById("settings-tab");
const playTab = document.getElementById("play-tab");
const colsInput = document.getElementById("cols-input");
const rowsInput = document.getElementById("rows-input");
const imageSelect = document.getElementById("image-select");
const imageUpload = document.getElementById("image-upload");
const modeSketch = document.getElementById("mode-sketch");
const modeCrop = document.getElementById("mode-crop");
const previewFrame = document.getElementById("preview-frame");
const setupPreview = document.getElementById("setup-preview");
const cropHint = document.getElementById("crop-hint");
const previewLabel = document.getElementById("preview-label");
const confirmButton = document.getElementById("confirm-button");
const restartButton = document.getElementById("restart-button");
const sampleImage = document.getElementById("sample-image");
const mobileSampleImage = document.getElementById("mobile-sample-image");
const moveCounter = document.getElementById("move-counter");
const gameMessage = document.getElementById("game-message");
const boardTitle = document.getElementById("board-title");
const boardElement = document.getElementById("board");

initialize();

async function initialize() {
  fillPresetOptions();
  await restoreSettings();
  bindEvents();
  syncSettingsUi();
  await refreshRenderedImage();
}

function fillPresetOptions() {
  presets.forEach((preset) => {
    const option = document.createElement("option");
    option.value = preset.id;
    option.textContent = preset.name;
    imageSelect.appendChild(option);
  });
  imageSelect.value = presets[0].id;
}

async function restoreSettings() {
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return;
  }

  try {
    const saved = JSON.parse(raw);
    state.cols = clampGridValue(saved.cols);
    state.rows = clampGridValue(saved.rows);
    state.imageMode = saved.imageMode === "crop" ? "crop" : "sketch";
    state.imageSourceType = saved.imageSourceType === "upload" ? "upload" : "preset";
    state.presetId = saved.presetId || presets[0].id;
    state.cropAnchor = {
      x: clampUnit(saved.cropAnchorX, 0.5),
      y: clampUnit(saved.cropAnchorY, 0.5),
    };

    if (state.imageSourceType === "upload") {
      const uploadedImage = await loadUploadedImage();
      if (uploadedImage) {
        state.imageSrc = uploadedImage.src;
        state.imageLabel = uploadedImage.label;
        return;
      }
      state.imageSourceType = "preset";
      state.presetId = presets[0].id;
    }

    if (saved.imageSrc && saved.imageLabel && saved.imageSrc.startsWith("data:image/")) {
      await saveUploadedImageBlob(dataUrlToBlob(saved.imageSrc), saved.imageLabel);
      state.imageSrc = saved.imageSrc;
      state.imageLabel = saved.imageLabel;
      state.imageSourceType = "upload";
    } else if (saved.presetId) {
      const preset = presets.find((entry) => entry.id === saved.presetId);
      if (preset) {
        state.imageSrc = preset.src;
        state.imageLabel = preset.name;
        state.presetId = preset.id;
      }
    }
  } catch (_error) {
    window.localStorage.removeItem(STORAGE_KEY);
  }
}

function syncSettingsUi() {
  colsInput.value = state.cols;
  rowsInput.value = state.rows;
  modeSketch.classList.toggle("active", state.imageMode === "sketch");
  modeCrop.classList.toggle("active", state.imageMode === "crop");

  imageSelect.value = state.imageSourceType === "preset" && state.presetId ? state.presetId : "";
}

function bindEvents() {
  colsInput.addEventListener("input", () => {
    state.cols = clampGridValue(colsInput.value);
    colsInput.value = state.cols;
    state.settingsDirty = true;
    refreshRenderedImage();
  });

  rowsInput.addEventListener("input", () => {
    state.rows = clampGridValue(rowsInput.value);
    rowsInput.value = state.rows;
    state.settingsDirty = true;
    refreshRenderedImage();
  });

  imageSelect.addEventListener("change", () => {
    const selected = presets.find((preset) => preset.id === imageSelect.value);
    if (!selected) {
      return;
    }
    void clearUploadedImage();
    state.imageSrc = selected.src;
    state.imageLabel = selected.name;
    state.imageSourceType = "preset";
    state.presetId = selected.id;
    state.cropAnchor = { x: 0.5, y: 0.5 };
    state.settingsDirty = true;
    refreshRenderedImage();
  });

  imageUpload.addEventListener("change", async (event) => {
    const [file] = event.target.files || [];
    if (!file) {
      return;
    }

    const savedUpload = await saveUploadedImage(file);
    state.imageSrc = savedUpload.src;
    state.imageLabel = savedUpload.label;
    state.imageSourceType = "upload";
    state.presetId = null;
    state.cropAnchor = { x: 0.5, y: 0.5 };
    state.settingsDirty = true;
    await refreshRenderedImage();
    imageSelect.value = "";
  });

  settingsTab.addEventListener("click", () => showScreen("settings"));
  playTab.addEventListener("click", () => {
    if (state.settingsDirty || (!state.playing && state.moveCount === 0)) {
      startGame();
      return;
    }
    showScreen("play");
  });
  confirmButton.addEventListener("click", startGame);
  modeSketch.addEventListener("click", () => setImageMode("sketch"));
  modeCrop.addEventListener("click", () => setImageMode("crop"));
  restartButton.addEventListener("click", startGame);
  previewFrame.addEventListener("pointerdown", handleCropPointerDown);
  previewFrame.addEventListener("pointermove", handleCropPointerMove);
  previewFrame.addEventListener("pointerup", handleCropPointerUp);
  previewFrame.addEventListener("pointercancel", handleCropPointerUp);
  previewFrame.addEventListener("lostpointercapture", handleCropPointerUp);
  previewFrame.addEventListener("dragstart", preventNativeDrag);
}

function clampGridValue(value) {
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed)) {
    return 2;
  }
  return Math.min(10, Math.max(2, parsed));
}

function updatePreview(src, label) {
  sampleImage.src = src;
  mobileSampleImage.src = src;
  previewLabel.textContent = label;
}

function showScreen(target) {
  const showSettings = target === "settings";
  setupScreen.classList.toggle("active", showSettings);
  gameScreen.classList.toggle("active", !showSettings);
  settingsTab.classList.toggle("active", showSettings);
  playTab.classList.toggle("active", !showSettings);
}

function setImageMode(mode) {
  state.imageMode = mode;
  state.settingsDirty = true;
  modeSketch.classList.toggle("active", mode === "sketch");
  modeCrop.classList.toggle("active", mode === "crop");
  refreshRenderedImage();
}

async function refreshRenderedImage() {
  const sourceImage = await loadImage(state.imageSrc);
  state.sourceImageSize = {
    width: sourceImage.naturalWidth || sourceImage.width,
    height: sourceImage.naturalHeight || sourceImage.height,
  };

  state.renderedImageSrc = await renderPuzzleImage(
    sourceImage,
    state.cols,
    state.rows,
    state.imageMode,
    state.cropAnchor
  );
  updatePreview(state.renderedImageSrc, `${state.imageLabel} - ${capitalize(state.imageMode)}`);
  updateCropEditor();
  persistSettings();
  if (gameScreen.classList.contains("active")) {
    renderBoard();
  }
}

async function startGame() {
  state.cols = clampGridValue(colsInput.value);
  state.rows = clampGridValue(rowsInput.value);
  colsInput.value = state.cols;
  rowsInput.value = state.rows;
  await refreshRenderedImage();
  state.moveCount = 0;
  state.playing = false;
  state.settingsDirty = false;
  moveCounter.textContent = "Moves: 0";
  boardTitle.textContent = `${state.cols} columns x ${state.rows} rows`;
  gameMessage.textContent = "Slide the tiles to rebuild the full picture.";

  showScreen("play");
  createSolvedBoard();
  shuffleBoard(Math.max(60, state.cols * state.rows * 18));
  state.playing = true;
  renderBoard();
}

function createSolvedBoard() {
  const totalRows = state.rows + 1;
  state.board = Array.from({ length: totalRows }, () => Array(state.cols).fill(null));
  let tileId = 0;

  for (let row = 1; row <= state.rows; row += 1) {
    for (let col = 0; col < state.cols; col += 1) {
      state.board[row][col] = {
        id: tileId,
        correctRow: row,
        correctCol: col,
      };
      tileId += 1;
    }
  }

  state.blank = { row: 0, col: state.cols - 1 };
}

function renderBoard() {
  boardElement.innerHTML = "";
  const tileSize = computeTileSize();
  const boardPanel = boardElement.parentElement;
  const boardHeader = boardElement.previousElementSibling;

  boardElement.style.gridTemplateColumns = `repeat(${state.cols}, ${tileSize}px)`;
  boardElement.style.gridTemplateRows = `repeat(${state.rows}, ${tileSize}px)`;
  boardElement.style.setProperty("--tile-cols", state.cols);
  boardElement.style.setProperty("--tile-rows", state.rows);
  boardPanel.style.setProperty("--mobile-preview-size", `${tileSize}px`);
  boardPanel.style.setProperty("--mobile-preview-top", `${boardHeader.offsetHeight}px`);
  boardElement.style.marginTop = `${tileSize + 8}px`;

  renderAuxiliarySlot(tileSize);

  for (let row = 1; row <= state.rows; row += 1) {
    for (let col = 0; col < state.cols; col += 1) {
      const tile = state.board[row][col];

      if (!tile) {
        const empty = document.createElement("div");
        empty.className = "empty-slot";
        empty.setAttribute("aria-label", "Empty slot");
        boardElement.appendChild(empty);
        continue;
      }

      const button = document.createElement("button");
      button.type = "button";
      button.className = "tile";
      button.dataset.tileId = String(tile.id);
      button.setAttribute("aria-label", `Tile ${tile.correctCol + 1}-${tile.correctRow}`);
      const face = createTileFace(tile.correctCol, tile.correctRow - 1);
      button.appendChild(face);
      button.addEventListener("pointerdown", (event) => handleTilePress(event, row, col));
      boardElement.appendChild(button);
    }
  }

}

function renderAuxiliarySlot(tileSize) {
  const auxContainer = document.createElement("div");
  auxContainer.className = "aux-slot";
  auxContainer.style.left = `${(state.cols - 1) * tileSize + 12}px`;
  auxContainer.style.top = `${-tileSize - 8}px`;
  auxContainer.style.width = `${tileSize}px`;
  auxContainer.style.height = `${tileSize}px`;

  const auxTile = state.board[0][state.cols - 1];
  if (!auxTile) {
    const empty = document.createElement("div");
    empty.className = "empty-slot";
    empty.setAttribute("aria-label", "Empty slot");
    empty.style.width = "100%";
    empty.style.height = "100%";
    auxContainer.appendChild(empty);
  } else {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "tile";
    button.dataset.tileId = String(auxTile.id);
    button.setAttribute("aria-label", `Tile ${auxTile.correctCol + 1}-${auxTile.correctRow}`);
    button.style.width = "100%";
    button.style.height = "100%";
    const face = createTileFace(auxTile.correctCol, auxTile.correctRow - 1);
    button.appendChild(face);
    button.addEventListener("pointerdown", (event) => handleTilePress(event, 0, state.cols - 1));
    auxContainer.appendChild(button);
  }

  boardElement.appendChild(auxContainer);
}

function createTileFace(col, row) {
  const face = document.createElement("div");
  face.className = "tile-face";
  face.style.backgroundImage = `url("${state.renderedImageSrc}")`;
  face.style.backgroundPosition = backgroundPositionFor(col, row);
  return face;
}

function computeTileSize() {
  const maxWidth = Math.min(window.innerWidth * 0.72, 760);
  const maxHeight = Math.min(window.innerHeight * 0.72, 620);
  const byWidth = Math.floor(maxWidth / state.cols);
  const byHeight = Math.floor(maxHeight / (state.rows + 1));
  return Math.max(56, Math.min(120, byWidth, byHeight));
}

function backgroundPositionFor(col, row) {
  const x = state.cols === 1 ? 0 : (col / (state.cols - 1)) * 100;
  const y = state.rows === 1 ? 0 : (row / (state.rows - 1)) * 100;
  return `${x}% ${y}%`;
}

function attemptMove(row, col) {
  if (!state.playing || !isAdjacentToBlank(row, col)) {
    return;
  }

  const previousPositions = captureTilePositions();
  const movedTile = state.board[row][col];
  swapWithBlank(row, col);
  state.moveCount += 1;
  moveCounter.textContent = `Moves: ${state.moveCount}`;
  renderBoard();
  animateTileMovement(previousPositions, movedTile?.id);

  if (isSolved()) {
    state.playing = false;
    gameMessage.textContent = `Completed in ${state.moveCount} moves. Press Play again for a new shuffle.`;
  }
}

function handleTilePress(event, row, col) {
  if (event.pointerType === "mouse" && event.button !== 0) {
    return;
  }

  event.preventDefault();
  attemptMove(row, col);
}

function isAdjacentToBlank(row, col) {
  const deltaRow = Math.abs(state.blank.row - row);
  const deltaCol = Math.abs(state.blank.col - col);
  return deltaRow + deltaCol === 1;
}

function swapWithBlank(row, col) {
  state.board[state.blank.row][state.blank.col] = state.board[row][col];
  state.board[row][col] = null;
  state.blank = { row, col };
}

function shuffleBoard(steps) {
  let previousBlank = null;

  for (let step = 0; step < steps; step += 1) {
    const neighbors = getMovableNeighbors().filter((candidate) => {
      if (!previousBlank) {
        return true;
      }
      return candidate.row !== previousBlank.row || candidate.col !== previousBlank.col;
    });

    const pool = neighbors.length > 0 ? neighbors : getMovableNeighbors();
    const choice = pool[Math.floor(Math.random() * pool.length)];
    previousBlank = { ...state.blank };
    swapWithBlank(choice.row, choice.col);
  }

  if (isSolved()) {
    shuffleBoard(Math.max(10, Math.floor(steps / 3)));
  }
}

function getMovableNeighbors() {
  const neighbors = [];
  const directions = [
    { row: -1, col: 0 },
    { row: 1, col: 0 },
    { row: 0, col: -1 },
    { row: 0, col: 1 },
  ];

  directions.forEach((direction) => {
    const row = state.blank.row + direction.row;
    const col = state.blank.col + direction.col;
    const withinRows = row >= 0 && row <= state.rows;
    const withinCols = col >= 0 && col < state.cols;
    const validTopSlot = row === 0 ? col === state.cols - 1 : true;
    if (withinRows && withinCols && validTopSlot && state.board[row][col]) {
      neighbors.push({ row, col });
    }
  });

  return neighbors;
}

function isSolved() {
  for (let row = 1; row <= state.rows; row += 1) {
    for (let col = 0; col < state.cols; col += 1) {
      const tile = state.board[row][col];
      if (!tile || tile.correctRow !== row || tile.correctCol !== col) {
        return false;
      }
    }
  }

  return state.blank.row === 0 && state.blank.col === state.cols - 1;
}

function wait(ms) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function captureTilePositions() {
  const positions = new Map();
  boardElement.querySelectorAll(".tile").forEach((tile) => {
    positions.set(tile.dataset.tileId, tile.getBoundingClientRect());
  });
  return positions;
}

function animateTileMovement(previousPositions, movedTileId) {
  if (movedTileId === undefined || movedTileId === null) {
    return;
  }

  const tile = boardElement.querySelector(`.tile[data-tile-id="${movedTileId}"]`);
  const previousRect = previousPositions.get(String(movedTileId));
  if (!tile || !previousRect) {
    return;
  }

  const nextRect = tile.getBoundingClientRect();
  const deltaX = previousRect.left - nextRect.left;
  const deltaY = previousRect.top - nextRect.top;

  if (!deltaX && !deltaY) {
    return;
  }

  tile.animate(
    [
      {
        transform: `translate(${deltaX}px, ${deltaY}px)`,
      },
      {
        transform: "translate(0px, 0px)",
      },
    ],
    {
      duration: 90,
      easing: "cubic-bezier(0.2, 0.8, 0.2, 1)",
    }
  );
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Failed to load image"));
    image.src = src;
  });
}

function persistSettings() {
  const payload = {
    cols: state.cols,
    rows: state.rows,
    imageMode: state.imageMode,
    imageLabel: state.imageLabel,
    imageSourceType: state.imageSourceType,
    presetId: state.imageSourceType === "preset" ? state.presetId : null,
    cropAnchorX: state.cropAnchor.x,
    cropAnchorY: state.cropAnchor.y,
  };

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
}

function openImageDatabase() {
  return new Promise((resolve, reject) => {
    const request = window.indexedDB.open(IMAGE_DB_NAME, 1);

    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(IMAGE_STORE_NAME)) {
        database.createObjectStore(IMAGE_STORE_NAME, { keyPath: "id" });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function saveUploadedImage(file) {
  await saveUploadedImageBlob(file, `Uploaded image: ${file.name}`);
  return {
    src: createObjectUrl(file),
    label: `Uploaded image: ${file.name}`,
  };
}

async function saveUploadedImageBlob(blob, label) {
  const database = await openImageDatabase();

  await new Promise((resolve, reject) => {
    const transaction = database.transaction(IMAGE_STORE_NAME, "readwrite");
    const store = transaction.objectStore(IMAGE_STORE_NAME);
    store.put({
      id: UPLOAD_IMAGE_KEY,
      blob,
      label,
      updatedAt: Date.now(),
    });
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });

  database.close();
}

async function loadUploadedImage() {
  const database = await openImageDatabase();
  const record = await new Promise((resolve, reject) => {
    const transaction = database.transaction(IMAGE_STORE_NAME, "readonly");
    const store = transaction.objectStore(IMAGE_STORE_NAME);
    const request = store.get(UPLOAD_IMAGE_KEY);
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
  });
  database.close();

  if (!record?.blob) {
    return null;
  }

  return {
    src: createObjectUrl(record.blob),
    label: record.label || "Uploaded image",
  };
}

async function clearUploadedImage() {
  revokeObjectUrlIfNeeded();
  const database = await openImageDatabase();

  await new Promise((resolve, reject) => {
    const transaction = database.transaction(IMAGE_STORE_NAME, "readwrite");
    const store = transaction.objectStore(IMAGE_STORE_NAME);
    store.delete(UPLOAD_IMAGE_KEY);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });

  database.close();
}

function createObjectUrl(blob) {
  revokeObjectUrlIfNeeded();
  const objectUrl = window.URL.createObjectURL(blob);
  state.uploadObjectUrl = objectUrl;
  return objectUrl;
}

function revokeObjectUrlIfNeeded() {
  if (!state.uploadObjectUrl) {
    return;
  }

  window.URL.revokeObjectURL(state.uploadObjectUrl);
  state.uploadObjectUrl = null;
}

function dataUrlToBlob(dataUrl) {
  const [header, content] = dataUrl.split(",");
  const mimeMatch = header.match(/data:(.*?);base64/);
  const mimeType = mimeMatch ? mimeMatch[1] : "application/octet-stream";
  const binary = window.atob(content);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return new Blob([bytes], { type: mimeType });
}

function renderPuzzleImage(image, cols, rows, mode, cropAnchor) {
  const tileBase = 240;
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(cols * tileBase, 480);
  canvas.height = Math.max(rows * tileBase, 480);
  const context = canvas.getContext("2d");
  const targetRatio = canvas.width / canvas.height;
  const sourceRatio = image.width / image.height;

  context.fillStyle = "#f4efe8";
  context.fillRect(0, 0, canvas.width, canvas.height);

  let drawWidth;
  let drawHeight;
  let offsetX;
  let offsetY;

  if (mode === "crop") {
    if (sourceRatio > targetRatio) {
      drawHeight = canvas.height;
      drawWidth = drawHeight * sourceRatio;
      const overflowX = drawWidth - canvas.width;
      offsetX = -overflowX * cropAnchor.x;
      offsetY = 0;
    } else {
      drawWidth = canvas.width;
      drawHeight = drawWidth / sourceRatio;
      const overflowY = drawHeight - canvas.height;
      offsetX = 0;
      offsetY = -overflowY * cropAnchor.y;
    }
  } else {
    if (sourceRatio > targetRatio) {
      drawWidth = canvas.width;
      drawHeight = drawWidth / sourceRatio;
      offsetX = 0;
      offsetY = (canvas.height - drawHeight) / 2;
    } else {
      drawHeight = canvas.height;
      drawWidth = drawHeight * sourceRatio;
      offsetX = (canvas.width - drawWidth) / 2;
      offsetY = 0;
    }
  }

  context.drawImage(image, offsetX, offsetY, drawWidth, drawHeight);
  return canvas.toDataURL("image/png");
}

function capitalize(value) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function createSceneDataUrl(palette) {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 900">
      <defs>
        <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="${palette.skyTop}" />
          <stop offset="100%" stop-color="${palette.skyBottom}" />
        </linearGradient>
        <linearGradient id="field" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="${palette.field}" />
          <stop offset="100%" stop-color="#4d6b59" />
        </linearGradient>
      </defs>
      <rect width="1200" height="900" fill="url(#sky)" />
      <circle cx="950" cy="170" r="92" fill="${palette.accent}" opacity="0.8" />
      <path d="M0 520 L220 300 L430 500 L690 250 L980 520 L1200 360 L1200 900 L0 900 Z" fill="${palette.mountain}" />
      <path d="M0 620 C160 560, 260 720, 420 640 S720 540, 900 630 S1080 720, 1200 640 L1200 900 L0 900 Z" fill="url(#field)" />
      <path d="M260 660 C430 610, 540 700, 710 640 C860 585, 930 665, 1070 630 L1200 900 L0 900 Z" fill="#d8b274" opacity="0.58" />
      <rect x="128" y="522" width="188" height="138" rx="12" fill="#f7f1e8" />
      <polygon points="108,532 222,444 336,532" fill="${palette.accent}" />
      <rect x="192" y="586" width="48" height="74" fill="#9a5b42" />
      <path d="M580 520 C610 476, 690 472, 736 518 C788 569, 771 648, 709 685 C648 722, 583 688, 561 620 C550 584, 556 553, 580 520 Z" fill="${palette.accent}" opacity="0.85" />
      <path d="M564 520 C546 464, 522 431, 496 418" stroke="#6d5b49" stroke-width="18" stroke-linecap="round" fill="none" />
      <g fill="#fff2f2" opacity="0.88">
        <circle cx="612" cy="566" r="22" />
        <circle cx="666" cy="548" r="22" />
        <circle cx="704" cy="596" r="22" />
        <circle cx="648" cy="620" r="22" />
        <circle cx="742" cy="548" r="18" />
      </g>
      <path d="M830 666 C860 606, 920 572, 1002 562 C1060 555, 1116 570, 1170 604 L1170 900 L790 900 Z" fill="#7b9272" opacity="0.82" />
    </svg>`;

  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

function updateCropEditor() {
  const ratio = `${state.cols} / ${state.rows}`;
  previewFrame.style.aspectRatio = ratio;
  sampleImage.parentElement.style.aspectRatio = ratio;
  setupPreview.src = state.imageSrc;
  setupPreview.style.objectFit = state.imageMode === "crop" ? "fill" : "contain";
  previewFrame.classList.toggle("is-crop-mode", state.imageMode === "crop");
  previewFrame.classList.remove("is-dragging");

  if (state.imageMode !== "crop") {
    setupPreview.style.width = "100%";
    setupPreview.style.height = "100%";
    setupPreview.style.transform = "translate(0px, 0px)";
    cropHint.textContent = "Full image is preserved";
    return;
  }

  const layout = getCropLayout(previewFrame.clientWidth, previewFrame.clientHeight);
  setupPreview.style.width = `${layout.drawWidth}px`;
  setupPreview.style.height = `${layout.drawHeight}px`;
  setupPreview.style.left = "0";
  setupPreview.style.top = "0";
  setupPreview.style.transform = `translate(${layout.offsetX}px, ${layout.offsetY}px)`;
  cropHint.textContent = "Drag to reposition the crop";
}

function getCropLayout(frameWidth, frameHeight) {
  const sourceRatio = state.sourceImageSize.width / state.sourceImageSize.height;
  const targetRatio = frameWidth / frameHeight;

  if (sourceRatio > targetRatio) {
    const drawHeight = frameHeight;
    const drawWidth = drawHeight * sourceRatio;
    const overflowX = Math.max(0, drawWidth - frameWidth);
    return {
      drawWidth,
      drawHeight,
      offsetX: -overflowX * state.cropAnchor.x,
      offsetY: 0,
      overflowX,
      overflowY: 0,
    };
  }

  const drawWidth = frameWidth;
  const drawHeight = drawWidth / sourceRatio;
  const overflowY = Math.max(0, drawHeight - frameHeight);
  return {
    drawWidth,
    drawHeight,
    offsetX: 0,
    offsetY: -overflowY * state.cropAnchor.y,
    overflowX: 0,
    overflowY,
  };
}

function handleCropPointerDown(event) {
  if (state.imageMode !== "crop") {
    return;
  }

  event.preventDefault();
  const rect = previewFrame.getBoundingClientRect();
  if (!rect.width || !rect.height) {
    return;
  }

  const layout = getCropLayout(rect.width, rect.height);
  state.dragState = {
    pointerId: event.pointerId,
    startX: event.clientX,
    startY: event.clientY,
    anchorX: state.cropAnchor.x,
    anchorY: state.cropAnchor.y,
    overflowX: layout.overflowX,
    overflowY: layout.overflowY,
    lastDeltaX: 0,
    lastDeltaY: 0,
  };
  previewFrame.classList.add("is-dragging");
  previewFrame.setPointerCapture(event.pointerId);
}

function handleCropPointerMove(event) {
  if (!state.dragState || state.dragState.pointerId !== event.pointerId) {
    return;
  }

  event.preventDefault();
  if (state.dragState.overflowX > 0) {
    const deltaX = event.clientX - state.dragState.startX;
    state.dragState.lastDeltaX = deltaX;
    state.cropAnchor.x = clampUnit(state.dragState.anchorX - deltaX / state.dragState.overflowX, state.dragState.anchorX);
  }

  if (state.dragState.overflowY > 0) {
    const deltaY = event.clientY - state.dragState.startY;
    state.dragState.lastDeltaY = deltaY;
    state.cropAnchor.y = clampUnit(state.dragState.anchorY - deltaY / state.dragState.overflowY, state.dragState.anchorY);
  }

  state.settingsDirty = true;
  updateCropEditor();
}

function handleCropPointerUp(event) {
  if (!state.dragState) {
    return;
  }

  if (event.pointerId !== undefined && state.dragState.pointerId !== event.pointerId) {
    return;
  }

  previewFrame.classList.remove("is-dragging");
  if (event.pointerId !== undefined && previewFrame.hasPointerCapture(event.pointerId)) {
    previewFrame.releasePointerCapture(event.pointerId);
  }
  state.dragState = null;
  refreshRenderedImage();
}

function clampUnit(value, fallback = 0.5) {
  if (!Number.isFinite(value)) {
    return fallback;
  }
  return Math.min(1, Math.max(0, value));
}

function preventNativeDrag(event) {
  event.preventDefault();
}

window.addEventListener("resize", () => {
  updateCropEditor();
  if (gameScreen.classList.contains("active")) {
    renderBoard();
  }
});
