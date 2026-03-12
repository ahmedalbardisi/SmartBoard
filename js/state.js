/**
 * السبورة الذكية - المتغيرات العامة وحالة التطبيق
 * Smart Whiteboard - Global State & Variables
 */

// -------------------- حالة التطبيق (Application State) --------------------

let currentPage = 0;
let pages = [];
let currentTool = "pen";
let currentColor = "#000000";
let currentSize = 2;
let isDrawing = false;
let lastX = 0;
let lastY = 0;
let isPanning = false;
let panStartX = 0;
let panStartY = 0;

// متغيرات رسم الأشكال (Shape Drawing Variables)
let drawStartX = 0;
let drawStartY = 0;
let savedCanvasState = null; // لحفظ حالة اللوحة قبل رسم الأشكال

// نقاط التظليل والقلم (Drawing Points)
let highlightPoints = [];
let penPoints = [];

const MAX_HISTORY_LENGTH = 30;

// -------------------- مراجع عناصر DOM (DOM Element References) --------------------

const pagesContainer   = document.getElementById("pages-container")   || null;
const canvasArea       = document.querySelector(".canvas-area")        || null;
const horizontalToolbar= document.querySelector(".horizontal-toolbar") || null;
const sidebar          = document.querySelector(".sidebar")            || null;
const pageIndicator    = document.getElementById("page-indicator")     || null;
const zoomPercentageSpan = document.getElementById("zoom-percentage")  || null;
const contPags         = document.querySelector(".cont_pags")          || null;

const penBtn       = document.getElementById("pen-btn")       || null;
const highlightBtn = document.getElementById("highlight-btn") || null;
const eraserBtn    = document.getElementById("eraser-btn")    || null;
const panBtn       = document.getElementById("pan-btn")       || null;
const colorPicker  = document.getElementById("color-picker")  || null;
const sizeSlider   = document.getElementById("pen-size-slider")|| null;
const sizeValue    = document.getElementById("size-value")    || null;

const zoomInBtn       = document.getElementById("zoom-in")        || null;
const zoomOutBtn      = document.getElementById("zoom-out")       || null;
const clearBtn        = document.getElementById("clear-btn")      || null;
const undoBtn         = document.getElementById("undo-btn")       || null;
const redoBtn         = document.getElementById("redo-btn")       || null;
const darkModeBtn     = document.getElementById("dark-mode-btn")  || null;
const settingsBtn     = document.getElementById("settings-btn")   || null;
const settingsPanel   = document.getElementById("settings-panel") || null;
const toggleSidebarBtn= document.getElementById("toggle-sidebar") || null;
const addPageBtn      = document.getElementById("add-page-btn")   || null;
const bgTypeSelect    = document.getElementById("bg-type")        || null;
const savePdfBtn      = document.getElementById("save-pdf")       || null;

// أدوات الأشكال (Shape Tools)
const rectBtn   = document.getElementById("rect-btn")   || null;
const circleBtn = document.getElementById("circle-btn") || null;
const lineBtn   = document.getElementById("line-btn")   || null;
const arrowBtn  = document.getElementById("arrow-btn")  || null;

// أدوات الجداول (Table Tools)
const tableBtn        = document.getElementById("table-btn")    || null;
const tableOptionsDiv = document.getElementById("table-options")|| null;
const tableRowsInput  = document.getElementById("table-rows")   || null;
const tableColsInput  = document.getElementById("table-cols")   || null;
