// عناصر DOM
const settingsBtn = document.getElementById("settings-btn");
const settingsPanel = document.getElementById("settings-panel");
// const closeSettings = document.getElementById("close-settings"); // Removed as not in index.html
const bgTypeSelect = document.getElementById("bg-type");
const savePdfBtn = document.getElementById("save-pdf");
const darkModeBtn = document.getElementById("dark-mode-btn");
const toggleSidebarBtn = document.getElementById("toggle-sidebar");
const sidebar = document.querySelector(".sidebar");
const fileNameInput = document.getElementById("file-name");
const undoBtn = document.getElementById("undo-btn");
const redoBtn = document.getElementById("redo-btn");
const clearBtn = document.getElementById("clear-btn");
const zoomInBtn = document.getElementById("zoom-in");
const zoomOutBtn = document.getElementById("zoom-out");
const pageIndicator = document.getElementById("page-indicator");
const pagesContainer = document.getElementById("pages-container");

// أدوات الرسم
const toolBtns = document.querySelectorAll(".tool-btn");
const penBtn = document.getElementById("pen-btn");
const selectBtn = document.getElementById("select-btn");
const hlBtn = document.getElementById("highlight-btn");
const eraserBtn = document.getElementById("eraser-btn");
const textBtn = document.getElementById("text-btn");
const rectBtn = document.getElementById("rect-btn");
const circleBtn = document.getElementById("circle-btn");
const lineBtn = document.getElementById("line-btn");
const arrowBtn = document.getElementById("arrow-btn");
const tableBtn = document.getElementById("table-btn");
const tableOptions = document.getElementById("table-options");
const addTableBtn = document.getElementById("add-table");
const colorCircles = document.querySelectorAll(".color-circle");
const sizeDots = document.querySelectorAll(".size-dot");

// حالة التطبيق
let tool = "pen";
let color = "#000000";
let size = 2;
let isDrawing = false;
let zoomLevel = 1;
let darkMode = false;
let sidebarVisible = true;
let startX, startY, lastX, lastY;
let currentShape = null;
let undoStack = [];
let redoStack = [];
let shapes = []; // سيتم تخزين جميع الأشكال والخطوط هنا
let selectedShape = null;
let isDragging = false;
let currentCanvas = null;
let activePageIndex = 0; // صفحة نشطة حالياً
// استبدال المصفوفات الحالية بنظام أكثر كفاءة
let currentStateIndex = -1;
const MAX_STACK_SIZE = 100; // زيادة حجم المكدس للسماح بمزيد من التراجعات

// تحسين الأداء: استخدام WeakMap لتخزين بيانات الكانفاس خارج DOM
const canvasData = new WeakMap();
const textElements = new Map(); // Store text DOM elements by shape reference

// تحقق من دعم passive events
let supportsPassive = false;
try {
  const opts = Object.defineProperty({}, "passive", {
    get: function () {
      supportsPassive = true;
    },
  });
  window.addEventListener("test", null, opts);
} catch (e) {}

// تهيئة التطبيق
document.addEventListener("DOMContentLoaded", () => {
  // تحسين عرض النص العربي
  improveArabicTextRendering();

  // تعيين الخلفية الافتراضية
  bgTypeSelect.value = "dots";
  document.querySelector(".page").classList.add("bg-dots");

  // تهيئة الكانفاس الأول
  const firstCanvas = document.querySelector(".page canvas");
  setupCanvas(firstCanvas);

  // تعيين الحدث لإضافة صفحات جديدة
  setupPageScroll();

  // تعيين أحداث الأدوات
  setupToolEvents();

  // تعيين أحداث التحكم بالصفحة
  setupPageControls();

  // تعيين أحداث الوضع الليلي والشريط الجانبي
  setupAppControls();

  // تحميل الحفظ التلقائي إذا وجد
  loadAutosave();

  // تهيئة الأدوات الافتراضية
  initDefaultTools();

  // تحسين إدارة الذاكرة (Debounced scroll handler)
  optimizeCanvasMemory();

  // إضافة زر إضافة صفحة (Add button once after loading pages)
  addNewPageButton();

  // حفظ الحالة الأولية
  saveState();
  updateUndoRedoButtons(); // تحديث حالة أزرار التراجع/الإعادة عند التحميل

  // إضافة حدث للكليكات خارج لوحة الإعدادات لإخفائها
  document.addEventListener("click", (event) => {
    if (
      !settingsPanel.contains(event.target) &&
      !settingsBtn.contains(event.target)
    ) {
      settingsPanel.classList.add("hidden");
    }
  });
});

// تحسين عرض النص العربي
function improveArabicTextRendering() {
  const style = document.createElement("style");
  style.textContent = `
    canvas {
      font-feature-settings: 'calt' off;
      font-kerning: none;
    }
  `;
  document.head.appendChild(style);
}

// تهيئة الأدوات الافتراضية
function initDefaultTools() {
  setTool("pen");
  document.querySelector(".color-circle").click();
  document.querySelector(".size-dot").click();
}

// إضافة زر إضافة صفحة جديدة
function addNewPageButton() {
  // Remove existing button if any to avoid duplicates on load/redraw
  const existingButton = pagesContainer.querySelector(".add-page-button");
  if (existingButton) {
    existingButton.remove();
  }

  const addButton = document.createElement("div");
  addButton.className = "add-page-button";
  addButton.innerHTML = '<i class="fas fa-plus"></i> إضافة صفحة';
  addButton.addEventListener("click", addPage);
  pagesContainer.appendChild(addButton);
}

// إعداد أحداث الأدوات
function setupToolEvents() {
  // اختيار الأدوات
  penBtn.addEventListener("click", () => setTool("pen"));
  selectBtn.addEventListener("click", () => setTool("select"));
  hlBtn.addEventListener("click", () => setTool("highlight"));
  eraserBtn.addEventListener("click", () => setTool("eraser"));
  textBtn.addEventListener("click", () => setTool("text"));
  rectBtn.addEventListener("click", () => setTool("rect"));
  circleBtn.addEventListener("click", () => setTool("circle"));
  lineBtn.addEventListener("click", () => setTool("line"));
  arrowBtn.addEventListener("click", () => setTool("arrow"));

  // جدول
  tableBtn.addEventListener("click", (e) => {
    e.stopPropagation(); // Prevent click from closing settings
    tableOptions.classList.toggle("hidden");
  });

  addTableBtn.addEventListener("click", addTable);

  // الألوان
  colorCircles.forEach((c) => {
    c.addEventListener("click", () => {
      colorCircles.forEach((x) => x.classList.remove("selected"));
      c.classList.add("selected");
      color = c.dataset.color;
      // Update text color input if text tool is active
      if (tool === "text" && selectedShape && selectedShape.type === "text") {
        updateTextElementStyle(selectedShape);
      }
    });
  });

  // الأحجام
  sizeDots.forEach((d) => {
    d.addEventListener("click", () => {
      sizeDots.forEach((x) => x.classList.remove("selected"));
      d.classList.add("selected");
      size = +d.dataset.size;
      // Update text size input if text tool is active
      if (tool === "text" && selectedShape && selectedShape.type === "text") {
        updateTextElementStyle(selectedShape);
      }
    });
  });

  // Custom size input
  const customSizeInput = document.getElementById("custom-size");
  if (customSizeInput) {
    customSizeInput.addEventListener("input", (e) => {
      size = +e.target.value;
      // Deselect predefined size dots
      sizeDots.forEach((dot) => dot.classList.remove("selected"));
      // Update text size if text tool is active
      if (tool === "text" && selectedShape && selectedShape.type === "text") {
        updateTextElementStyle(selectedShape);
      }
    });
  }
}

// إعداد أحداث التحكم بالصفحة
function setupPageControls() {
  // تكبير وتصغير
  zoomInBtn.addEventListener("click", zoomIn);
  zoomOutBtn.addEventListener("click", zoomOut);

  // التراجع والتقدم
  undoBtn.addEventListener("click", undo);
  redoBtn.addEventListener("click", redo);

  // حذف الكل
  clearBtn.addEventListener("click", clearPage);

  // حفظ PDF
  savePdfBtn.addEventListener("click", saveAsPdf);

  // تغيير نوع الخلفية
  bgTypeSelect.addEventListener("change", changeBackground);

  // File name input
  fileNameInput.addEventListener("input", autoSave);
}

// إعداد أحداث التحكم بالتطبيق
function setupAppControls() {
  // الوضع الليلي
  darkModeBtn.addEventListener("click", toggleDarkMode);

  // إظهار/إخفاء الشريط الجانبي
  toggleSidebarBtn.addEventListener("click", toggleSidebar);

  // إعدادات
  settingsBtn.addEventListener("click", (e) => {
    e.stopPropagation(); // Prevent click from closing settings
    settingsPanel.classList.toggle("hidden");
  });

  // اختصارات لوحة المفاتيح
  document.addEventListener("keydown", handleKeyShortcuts);
}

// تعيين الأداة الحالية
function setTool(newTool) {
  tool = newTool;

  // تحديث الأزرار النشطة
  toolBtns.forEach((btn) => btn.classList.remove("active"));

  switch (tool) {
    case "pen":
      penBtn.classList.add("active");
      break;
    case "select":
      selectBtn.classList.add("active");
      break;
    case "highlight":
      hlBtn.classList.add("active");
      break;
    case "eraser":
      eraserBtn.classList.add("active");
      break;
    case "text":
      textBtn.classList.add("active");
      break;
    case "rect":
      rectBtn.classList.add("active");
      break;
    case "circle":
      circleBtn.classList.add("active");
      break;
    case "line":
      lineBtn.classList.add("active");
      break;
    case "arrow":
      arrowBtn.classList.add("active");
      break;
  }

  // إخفاء خيارات الجدول عند تغيير الأداة إذا لم تكن أداة الجدول
  if (tool !== "table") {
    tableOptions.classList.add("hidden");
  }

  // Deselect shape when changing tools (unless going to select tool)
  if (tool !== "select" && selectedShape) {
    deselectShape();
  }

  // تغيير شكل المؤشر
  updateCursorStyle();
}

// تحديث شكل المؤشر حسب الأداة
function updateCursorStyle() {
  const canvases = document.querySelectorAll("canvas");
  canvases.forEach((canvas) => {
    if (tool === "select") {
      canvas.style.cursor = "pointer";
    } else if (tool === "text") {
      canvas.style.cursor = "text";
    } else if (tool === "eraser") {
      canvas.style.cursor =
        'url(\'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="white" stroke="black" stroke-width="2"/></svg>\') 12 12, auto';
    } else {
      canvas.style.cursor = "crosshair";
    }
  });
}

// إعداد أحداث السحب لإنشاء صفحات جديدة
function setupPageScroll() {
  const container = document.getElementById("pages-container");
  let isScrolling = false;

  container.addEventListener(
    "scroll",
    () => {
      if (isScrolling) return;
      isScrolling = true;

      requestAnimationFrame(() => {
        updateActivePage();
        isScrolling = false;
      });
    },
    { passive: true }
  );
}

function updateActivePage() {
  const container = document.getElementById("pages-container");
  const pages = document.querySelectorAll(".page");
  const containerRect = container.getBoundingClientRect();
  const containerCenter = containerRect.top + containerRect.height / 2;

  let closestPage = null;
  let minDistance = Infinity;

  pages.forEach((page, index) => {
    const rect = page.getBoundingClientRect();
    const pageCenter = rect.top + rect.height / 2;
    const distance = Math.abs(pageCenter - containerCenter);

    if (distance < minDistance) {
      minDistance = distance;
      closestPage = index;
    }
  });

  if (closestPage !== null && activePageIndex !== closestPage) {
    activePageIndex = closestPage;
    updatePageIndicator();
    deselectShape();
  }
}

// إضافة صفحة جديدة
function addPage() {
  const div = document.createElement("div");
  div.className = "page bg-" + bgTypeSelect.value;

  const actions = document.createElement("div");
  actions.className = "page-actions";
  actions.innerHTML = `<button class="delete-page-btn" title="حذف الصفحة"> <i class="fas fa-trash"></i></button>`;
  div.appendChild(actions);

  const cnv = document.createElement("canvas");
  cnv.width = 800;
  cnv.height = 1100;
  div.appendChild(cnv);

  // Find the current active page's div
  const activePageDiv = document.querySelector(
    `.page:nth-child(${activePageIndex + 1})`
  );
  if (activePageDiv) {
    // Insert the new page after the active page
    activePageDiv.parentNode.insertBefore(div, activePageDiv.nextSibling);
  } else {
    // If no active page (shouldn't happen after initial load), append before the add button
    const addButton = document.querySelector(".add-page-button");
    if (addButton) {
      pagesContainer.insertBefore(div, addButton);
    } else {
      // Fallback: just append if no add button found
      pagesContainer.appendChild(div);
    }
  }

  actions.querySelector(".delete-page-btn").addEventListener("click", (e) => {
    e.stopPropagation();
    const pages = document.querySelectorAll(".page");
    if (pages.length > 1) {
      if (!confirm("هل أنت متأكد من حذف هذه الصفحة؟")) return;
      
      const pageIndexToDelete = Array.from(pages).indexOf(div);
      
      // تأثير مرئي للحذف
      div.style.transition = "opacity 0.3s";
      div.style.opacity = "0";
      
      setTimeout(() => {
        // حذف الأشكال المرتبطة بالصفحة
        shapes = shapes.filter(shape => shape.canvasIndex !== pageIndexToDelete);
        
        // حذف عناصر النص المرتبطة بالصفحة
        textElements.forEach((element, shape) => {
          if (shape.canvasIndex === pageIndexToDelete) {
            element.remove();
            textElements.delete(shape);
          }
        });
  
        // تحديث مؤشرات الصفحات للأشكال المتبقية
        shapes.forEach(shape => {
          if (shape.canvasIndex > pageIndexToDelete) {
            shape.canvasIndex--;
          }
        });
  
        div.remove();
        
        // تحديث الصفحة النشطة
        if (activePageIndex === pageIndexToDelete) {
          activePageIndex = Math.max(0, pageIndexToDelete - 1);
        } else if (activePageIndex > pageIndexToDelete) {
          activePageIndex--;
        }
        
        updatePageIndicator();
        redrawAllCanvases();
        saveState();
        
        // إعادة تنظيم الصفحات المتبقية
        reorganizePagesAfterDeletion();
      }, 300);
    } else {
      alert("لا يمكن حذف الصفحة الوحيدة المتبقية");
    }
  });

  // تهيئة الكانفاس
  setupCanvas(cnv);
  updatePageIndicator();

  // التمرير إلى الصفحة الجديدة وتحديث الصفحة النشطة
  // Use requestAnimationFrame for smooth scroll and then update active page
  requestAnimationFrame(() => {
    div.scrollIntoView({ behavior: "smooth" });
    // Update activePageIndex after scroll animation might be better handled by scroll listener
    // or a timeout if scrollIntoView doesn't immediately trigger scroll
    setTimeout(() => {
      const pages = document.querySelectorAll(".page");
      activePageIndex = Array.from(pages).indexOf(div);
      div.scrollIntoView({ behavior: "smooth", block: "center" });
      applyZoom(); // تطبيق التكبير على الصفحة الجديدة
      updatePageIndicator();
      saveState(); // Save state after adding page
    }, 500); // Adjust timeout as needed
  });
}

// تهيئة الكانفاس
function setupCanvas(canvas) {
  const ctx = canvas.getContext("2d");
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  // Use event delegation on the pagesContainer for canvas events
  // This is more efficient than adding listeners to each canvas
}

// بدء الرسم
function startDrawing(e) {
  const canvas = e.target.closest("canvas"); // Get the canvas element if click was inside
  if (!canvas) return; // Exit if the click was not on a canvas

  const ctx = canvas.getContext("2d");
  const rect = canvas.getBoundingClientRect();
  // startX = e.clientX - rect.left;
  // startY = e.clientY - rect.top;

  startX = (e.clientX - rect.left) / zoomLevel;
  startY = (e.clientY - rect.top) / zoomLevel;

  currentCanvas = canvas;
  isDrawing = true;

  // تحديث الصفحة النشطة بناءً على الكانفاس الذي تم النقر عليه
  const pages = document.querySelectorAll(".page");
  activePageIndex = Array.from(pages).indexOf(canvas.parentNode);
  updatePageIndicator();

  if (tool === "select") {
    // البحث عن الأشكال تحت النقطة المضغوطة
    selectedShape = findShapeAt(canvas, startX, startY);
    if (selectedShape) {
      isDragging = true;
      // TODO: Show selection box and handles (Requires significant DOM manipulation/rendering)
      console.log("Selected Shape:", selectedShape); // For debugging
    } else {
      // Deselect if clicked outside
      deselectShape();
    }
  } else if (tool === "pen" || tool === "highlight") {
    ctx.beginPath();
    ctx.moveTo(startX, startY);
    // Highlighter color with transparency
    ctx.strokeStyle = tool === "highlight" ? `${color}80` : color; // Added 80 for alpha (approx 50%)
    ctx.lineWidth = size;
    ctx.globalAlpha = 1; // Alpha is handled in strokeStyle for highlight
    ctx.globalCompositeOperation = "source-over"; // Reset composite mode
    lastX = startX;
    lastY = startY;

    // إنشاء مسار جديد
    currentShape = {
      type: tool,
      color: tool === "highlight" ? `${color}80` : color,
      size: size,
      points: [{ x: startX, y: startY }],
      canvasIndex: activePageIndex,
    };
    // Start high-performance drawing loop for pen/highlight
    startHighPerformanceDrawing(canvas, ctx);
  } else if (tool === "eraser") {
    ctx.beginPath();
    ctx.globalCompositeOperation = "destination-out"; // This clears pixels
    ctx.moveTo(startX, startY);
    ctx.lineWidth = size * 5; // ممحاة أكبر
    ctx.strokeStyle = "rgba(0,0,0,1)"; // Color doesn't matter with destination-out
    ctx.globalAlpha = 1;
    lastX = startX;
    lastY = startY;

    // إنشاء مسار ممحاة
    currentShape = {
      type: "eraser",
      size: size * 5,
      points: [{ x: startX, y: startY }],
      canvasIndex: activePageIndex,
    };
    // Start high-performance drawing loop for eraser
    startHighPerformanceDrawing(canvas, ctx);
  } else if (tool === "text") {
    // Add text box immediately on click
    addText(canvas, startX, startY);
  } else {
    // أشكال أخرى
    currentShape = {
      type: tool,
      startX: startX,
      startY: startY,
      endX: startX,
      endY: startY,
      color: color,
      size: size,
      canvasIndex: activePageIndex,
    };
  }
  // Ensure redraw happens immediately for non-drawing tools to show preview
  if (tool !== "pen" && tool !== "highlight" && tool !== "eraser") {
    redrawCanvas(canvas);
  }
}

// الرسم
function draw(e) {
  if (!isDrawing) return;

  const canvas = e.target.closest("canvas"); // Get the canvas element
  if (!canvas) return; // Exit if not on a canvas

  const ctx = canvas.getContext("2d");
  const rect = canvas.getBoundingClientRect();

  const x = (e.clientX - rect.left) / zoomLevel;
  const y = (e.clientY - rect.top) / zoomLevel;

  if (tool === "select" && selectedShape && isDragging) {
    // تحريك الشكل المحدد
    moveShape(selectedShape, x - startX, y - startY);
    startX = x;
    startY = y;
    redrawCanvas(canvas); // Redraw the specific canvas
    // TODO: Update selection box and handles position
  } else if (
    currentShape &&
    (tool === "rect" ||
      tool === "circle" ||
      tool === "line" ||
      tool === "arrow")
  ) {
    // تحديث الشكل أثناء الرسم (للمعاينة) for non-drawing tools
    currentShape.endX = x;
    currentShape.endY = y;

    // مسح الكانفاس وإعادة رسم جميع الأشكال بالإضافة إلى الشكل الحالي
    redrawCanvas(canvas);
    drawShape(ctx, currentShape); // Draw current shape for preview
  }
  // Drawing for pen/highlight/eraser is handled in the high-performance loop
}

// إيقاف الرسم
function stopDrawing(e) {
  if (!isDrawing) return;

  isDrawing = false;

  // Stop the high-performance drawing loop
  stopHighPerformanceDrawing();

  // Ensure currentShape is added for lines, shapes, etc.
  if (
    currentShape &&
    (tool === "rect" ||
      tool === "circle" ||
      tool === "line" ||
      tool === "arrow")
  ) {
    // Add the shape to the shapes array if it's a finished shape
    shapes.push({ ...currentShape, canvasIndex: activePageIndex });
  } else if (
    currentShape &&
    (tool === "pen" || tool === "highlight" || tool === "eraser")
  ) {
    // For continuous tools, the points array is already being updated
    // Add the finished path as a shape
    shapes.push({ ...currentShape, canvasIndex: activePageIndex });
  }

  // Reset composite mode after drawing/erasing
  if (currentCanvas) {
    const ctx = currentCanvas.getContext("2d");
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = 1;
    redrawCanvas(currentCanvas); // Final redraw to ensure clarity
  }

  currentShape = null;
  isDragging = false;

  // حفظ الحالة بعد الرسم
  saveState();
}

// رسم شكل معين على الكانفاس
function drawShape(ctx, shape) {
  ctx.save();

  ctx.strokeStyle = shape.color || color;
  ctx.fillStyle = shape.color || color; // Needed for arrow fill
  ctx.lineWidth = shape.size || size;

  // Apply global alpha for highlight
  if (shape.type === "highlight") {
    ctx.globalAlpha = 0.5; // Semi-transparent for highlight
  } else {
    ctx.globalAlpha = 1; // Opaque for other tools
  }

  if (shape.type === "eraser") {
    ctx.globalCompositeOperation = "destination-out";
    ctx.lineWidth = shape.size; // Use saved size for eraser
  } else {
    ctx.globalCompositeOperation = "source-over"; // Default mode
  }

  switch (shape.type) {
    case "rect":
      ctx.strokeRect(
        Math.min(shape.startX, shape.endX),
        Math.min(shape.startY, shape.endY),
        Math.abs(shape.endX - shape.startX),
        Math.abs(shape.endY - shape.startY)
      );
      break;
    case "circle":
      const radius = Math.sqrt(
        Math.pow(shape.endX - shape.startX, 2) +
          Math.pow(shape.endY - shape.startY, 2)
      );
      ctx.beginPath();
      ctx.arc(shape.startX, shape.startY, radius, 0, Math.PI * 2);
      ctx.stroke();
      break;
    case "line":
      ctx.beginPath();
      ctx.moveTo(shape.startX, shape.startY);
      ctx.lineTo(shape.endX, shape.endY);
      ctx.stroke();
      break;
    case "arrow":
      drawArrow(ctx, shape.startX, shape.startY, shape.endX, shape.endY);
      break;
    case "pen":
    case "highlight":
    case "eraser": // Eraser also uses points
      if (shape.points && shape.points.length > 1) {
        ctx.beginPath();
        ctx.moveTo(shape.points[0].x, shape.points[0].y);

        // استخدام منحنى بيزييه للحصول على خطوط أكثر انسيابية
        for (let i = 1; i < shape.points.length; i++) {
          const p1 = shape.points[i - 1];
          const p2 = shape.points[i];
          const midPoint = {
            x: (p1.x + p2.x) / 2,
            y: (p1.y + p2.y) / 2,
          };

          ctx.quadraticCurveTo(p1.x, p1.y, midPoint.x, midPoint.y);
        }
        ctx.stroke();
      }
      break;
    case "text":
      // Redraw text on canvas - this is a basic implementation
      if (shape.lines) {
        ctx.font = shape.font;
        ctx.fillStyle = shape.color;
        ctx.textAlign = "right"; // Assuming RTL
        ctx.textBaseline = "top";
        const lineHeight = shape.lineHeight; // Use saved lineHeight
        shape.lines.forEach((line, i) => {
          ctx.fillText(line, shape.x, shape.y + i * lineHeight);
        });
      }
      break;
    case "table":
      // Redraw table outline on canvas
      const cellWidth = shape.cellWidth;
      const cellHeight = shape.cellHeight;
      const tableWidth = cellWidth * shape.cols;
      const tableHeight = cellHeight * shape.rows;
      const startX = shape.startX;
      const startY = shape.startY;

      ctx.strokeStyle = shape.color;
      ctx.lineWidth = 1;

      for (let r = 0; r <= shape.rows; r++) {
        ctx.beginPath();
        ctx.moveTo(startX, startY + r * cellHeight);
        ctx.lineTo(startX + tableWidth, startY + r * cellHeight);
        ctx.stroke();
      }

      for (let c = 0; c <= shape.cols; c++) {
        ctx.beginPath();
        ctx.moveTo(startX + c * cellWidth, startY);
        ctx.lineTo(startX + c * cellWidth, startY + tableHeight);
        ctx.stroke();
      }
      // Note: Text inside table cells is handled by DOM elements, not canvas redraw
      break;
    case "image":
      // Redraw image on canvas
      const img = new Image();
      img.onload = function () {
        ctx.drawImage(img, shape.x, shape.y, shape.width, shape.height);
      };
      img.src = shape.src;
      break;
  }

  ctx.restore();
}

// البحث عن شكل في موقع معين
function findShapeAt(canvas, x, y) {
  const tolerance = tool === "select" ? 10 : 0; // Add tolerance only for select tool
  const canvasIndex = Array.from(document.querySelectorAll(".page")).indexOf(
    canvas.parentNode
  );
  // البحث بالترتيب العكسي (آخر شكل أولاً)
  for (let i = shapes.length - 1; i >= 0; i--) {
    const shape = shapes[i];

    // تخطي الأشكال التي ليست في الصفحة الحالية
    if (shape.canvasIndex !== canvasIndex) continue;

    // Simple hit testing for shapes
    if (isPointInShape(shape, x, y, tolerance)) {
      return shape;
    }
  }
  return null;
}

// التحقق ما إذا كانت النقطة ضمن الشكل (Basic implementation for simple shapes)
function isPointInShape(shape, x, y, tolerance) {
  switch (shape.type) {
    case "rect": {
      const minX = Math.min(shape.startX, shape.endX) - tolerance;
      const maxX = Math.max(shape.startX, shape.endX) + tolerance;
      const minY = Math.min(shape.startY, shape.endY) - tolerance;
      const maxY = Math.max(shape.startY, shape.endY) + tolerance;
      return x >= minX && x <= maxX && y >= minY && y <= maxY;
    }

    case "circle": {
      const radius = Math.sqrt(
        Math.pow(shape.endX - shape.startX, 2) +
          Math.pow(shape.endY - shape.startY, 2)
      );
      const circleDistance = Math.sqrt(
        Math.pow(x - shape.startX, 2) + Math.pow(y - shape.startY, 2)
      );
      // Check if point is near the circle's circumference
      return (
        circleDistance <= radius + tolerance &&
        circleDistance >= radius - tolerance
      );
    }

    case "line":
    case "arrow": {
      // Check distance from point to the line segment
      const A = x - shape.startX;
      const B = y - shape.startY;
      const C = shape.endX - shape.startX;
      const D = shape.endY - shape.startY;

      const dot = A * C + B * D;
      const lenSq = C * C + D * D;
      const param = lenSq !== 0 ? dot / lenSq : -1;

      let xx, yy;

      if (param < 0) {
        xx = shape.startX;
        yy = shape.startY;
      } else if (param > 1) {
        xx = shape.endX;
        yy = shape.endY;
      } else {
        xx = shape.startX + param * C;
        yy = shape.startY + param * D;
      }

      const dx = x - xx;
      const dy = y - yy;
      const lineDistance = Math.sqrt(dx * dx + dy * dy);

      return lineDistance <= tolerance;
    }

    case "pen":
    case "highlight":
    case "eraser": // Hit testing for paths can be complex and performance intensive.
      // A simpler approach is to check if the point is close to any segment of the path.
      // This is a basic approximation.
      if (shape.points && shape.points.length > 1) {
        for (let i = 0; i < shape.points.length - 1; i++) {
          const p1 = shape.points[i];
          const p2 = shape.points[i + 1];
          const dist = pointToSegmentDistance(x, y, p1.x, p1.y, p2.x, p2.y);
          // Use a slightly larger tolerance for drawing tools
          if (dist <= tolerance + shape.size / 2) {
            return true;
          }
        }
      }
      return false;

    case "text": // Check if point is within the bounding box of the text element
      const textElement = textElements.get(shape);
      if (textElement) {
        const rect = textElement.getBoundingClientRect();
        // Convert click coordinates to be relative to the page container
        const pageRect = textElement.closest(".page").getBoundingClientRect();
        const clickXRelativeToPage =
          x + canvas.getBoundingClientRect().left - pageRect.left;
        const clickYRelativeToPage =
          y + canvas.getBoundingClientRect().top - pageRect.top;

        // Check if the click is within the bounds of the text element
        return (
          clickXRelativeToPage >= textElement.offsetLeft &&
          clickXRelativeToPage <=
            textElement.offsetLeft + textElement.offsetWidth &&
          clickYRelativeToPage >= textElement.offsetTop &&
          clickYRelativeToPage <=
            textElement.offsetTop + textElement.offsetHeight
        );
      }
      return false; // No text element found

    case "table": // Check if point is within the bounding box of the table outline
      const tableMinX = shape.startX - tolerance;
      const tableMaxX = shape.startX + shape.cols * shape.cellWidth + tolerance;
      const tableMinY = shape.startY - tolerance;
      const tableMaxY =
        shape.startY + shape.rows * shape.cellHeight + tolerance;
      return (
        x >= tableMinX && x <= tableMaxX && y >= tableMinY && y <= tableMaxY
      );

    case "image": // Check if point is within the bounding box of the image
      const imgMinX = shape.x - tolerance;
      const imgMaxX = shape.x + shape.width + tolerance;
      const imgMinY = shape.y - tolerance;
      const imgMaxY = shape.y + shape.height + tolerance;
      return x >= imgMinX && x <= imgMaxX && y >= imgMinY && y <= imgMaxY;

    default:
      return false;
  }
}

// Helper function to calculate distance from a point to a line segment
function pointToSegmentDistance(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  if (dx === 0 && dy === 0) {
    // It's a point, return distance to the point
    return Math.sqrt((px - x1) * (px - x1) + (py - y1) * (py - y1));
  }
  const t = ((px - x1) * dx + (py - y1) * dy) / (dx * dx + dy * dy);
  let closestX, closestY;
  if (t < 0) {
    closestX = x1;
    closestY = y1;
  } else if (t > 1) {
    closestX = x2;
    closestY = y2;
  } else {
    closestX = x1 + t * dx;
    closestY = y1 + t * dy;
  }
  return Math.sqrt(
    (px - closestX) * (px - closestX) + (py - closestY) * (py - closestY)
  );
}

// تحريك الشكل
function moveShape(shape, dx, dy) {
  if (!shape) return;

  switch (shape.type) {
    case "rect":
    case "line":
    case "arrow":
    case "circle": // Move circle by moving its center
      shape.startX += dx;
      shape.startY += dy;
      if (shape.type !== "circle") {
        // Only move end point for line, arrow, rect
        shape.endX += dx;
        shape.endY += dy;
      }
      break;
    case "pen":
    case "highlight":
    case "eraser":
      if (shape.points) {
        for (let i = 0; i < shape.points.length; i++) {
          shape.points[i].x += dx;
          shape.points[i].y += dy;
        }
      }
      break;
    case "text": // Move text box position
      shape.x += dx;
      shape.y += dy;
      // Also move the actual text DOM element
      const textElementToMove = textElements.get(shape);
      if (textElementToMove) {
        textElementToMove.style.left = `${
          parseFloat(textElementToMove.style.left) + dx
        }px`;
        textElementToMove.style.top = `${
          parseFloat(textElementToMove.style.top) + dy
        }px`;
      }
      break;
    case "table": // Move table position
      shape.startX += dx;
      shape.startY += dy;
      // TODO: Also move the actual table DOM element if it exists
      break;
    case "image": // Move image position
      shape.x += dx;
      shape.y += dy;
      break;
  }
}

// رسم جميع الأشكال على الكانفاس المحدد
function redrawCanvas(canvas) {
  const ctx = canvas.getContext("2d");
  const canvasIndex = Array.from(document.querySelectorAll(".page")).indexOf(
    canvas.parentNode
  );

  // مسح الكانفاس
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // رسم جميع الأشكال المناسبة لهذا الكانفاس بترتيبها في المصفوفة
  shapes.forEach((shape) => {
    if (shape.canvasIndex === canvasIndex) {
      drawShape(ctx, shape);
    }
  });

  // TODO: Draw selection box and handles if a shape is selected on this canvas
}

// إلغاء تحديد الشكل الحالي
function deselectShape() {
  if (selectedShape) {
    // TODO: Hide selection box and handles
    selectedShape = null;
    // Redraw canvas to remove selection indicator
    redrawAllCanvases(); // Need to redraw all canvases in case selection spans pages
  }
}

// رسم سهم بشكل أكثر انسيابية
function drawArrow(ctx, fromX, fromY, toX, toY) {
  const headLength = 15;
  const angle = Math.atan2(toY - fromY, toX - fromX);

  // رسم الخط الرئيسي
  ctx.beginPath();
  ctx.moveTo(fromX, fromY);
  ctx.lineTo(toX, toY);
  ctx.stroke();

  // رسم رأس السهم
  ctx.beginPath();
  ctx.moveTo(toX, toY);
  ctx.lineTo(
    toX - headLength * Math.cos(angle - Math.PI / 6),
    toY - headLength * Math.sin(angle - Math.PI / 6)
  );
  ctx.moveTo(toX, toY);
  ctx.lineTo(
    toX - headLength * Math.cos(angle + Math.PI / 6),
    toY - headLength * Math.sin(angle + Math.PI / 6)
  );
  ctx.stroke();
}

// معالجة أحداث اللمس (Use event delegation on pagesContainer)
pagesContainer.addEventListener(
  "touchstart",
  handleTouchStart,
  supportsPassive ? { passive: false } : false
);
pagesContainer.addEventListener(
  "touchmove",
  handleTouchMove,
  supportsPassive ? { passive: false } : false
);
pagesContainer.addEventListener("touchend", handleTouchEnd);

function handleTouchStart(e) {
  // Check if the touch started on a canvas
  const canvas = e.target.closest("canvas");
  if (!canvas) return;

  e.preventDefault();
  if (e.touches.length === 1) {
    const touch = e.touches[0];
    // Simulate mouse event on the canvas
    const mouseEvent = new MouseEvent("mousedown", {
      clientX: touch.clientX,
      clientY: touch.clientY,
      bubbles: true,
      cancelable: true,
      view: window,
    });
    canvas.dispatchEvent(mouseEvent); // Dispatch event on the specific canvas
  }
}

function handleTouchMove(e) {
  // Check if the touch is on a canvas
  const canvas = e.target.closest("canvas");
  if (!canvas) return;

  e.preventDefault();
  if (e.touches.length === 1) {
    const touch = e.touches[0];
    // Simulate mouse event on the canvas
    const mouseEvent = new MouseEvent("mousemove", {
      clientX: touch.clientX,
      clientY: touch.clientY,
      bubbles: true,
      cancelable: true,
      view: window,
    });
    canvas.dispatchEvent(mouseEvent); // Dispatch event on the specific canvas
  }
}

function handleTouchEnd(e) {
  // Check if the touch ended on a canvas
  const canvas = e.target.closest("canvas");
  if (!canvas) return;

  e.preventDefault();
  const touch = e.changedTouches[0]; // Use changedTouches for touchend
  // Simulate mouse event on the canvas
  const mouseEvent = new MouseEvent("mouseup", {
    clientX: touch.clientX, // Pass coordinates for stopDrawing
    clientY: touch.clientY,
    bubbles: true,
    cancelable: true,
    view: window,
  });
  canvas.dispatchEvent(mouseEvent); // Dispatch event on the specific canvas
}

// إضافة نص (Improved to use DOM element for input and then draw on canvas)
function addText(canvas, x, y) {
  // Deselect any currently selected shape before adding text
  deselectShape();

  const textInput = document.createElement("textarea");
  textInput.className = "canvas-text-input";
  textInput.style.position = "absolute";
  textInput.style.zIndex = 10; // Ensure text input is above other elements

  // Position the text input relative to the page container
  const pageRect = canvas.parentNode.getBoundingClientRect();
  const canvasRect = canvas.getBoundingClientRect();

  // Adjust position based on current zoom level
  const adjustedX = x * zoomLevel;
  const adjustedY = y * zoomLevel;

  textInput.style.left = `${canvasRect.left - pageRect.left + adjustedX}px`;
  textInput.style.top = `${canvasRect.top - pageRect.top + adjustedY}px`;

  textInput.style.fontFamily = "Cairo, sans-serif"; // Use default or selected font
  textInput.style.direction = "rtl"; // Set RTL direction
  textInput.style.minWidth = "150px";
  textInput.style.minHeight = "50px";
  textInput.style.padding = "5px";
  textInput.style.border = "1px dashed " + color;
  textInput.style.backgroundColor = "rgba(255, 255, 255, 0.8)"; // Semi-transparent background
  textInput.style.color = color; // Use selected color
  textInput.style.fontSize = `${size * 8}px`; // Use selected size
  textInput.style.resize = "both"; // Allow resizing
  textInput.style.overflow = "auto"; // Add scrollbars if text overflows
  textInput.style.outline = "none"; // Remove default outline
  textInput.style.boxShadow = "0 0 5px rgba(0, 0, 0, 0.2)"; // Add a subtle shadow

  canvas.parentNode.appendChild(textInput);
  textInput.focus();

  // Make the text input draggable and resizable
  setupDraggable(textInput);

  // When the text input loses focus, draw the text on the canvas and save it
  textInput.addEventListener("blur", () => {
    if (textInput.value.trim() !== "") {
      // Get the final position and size of the text input
      const finalRect = textInput.getBoundingClientRect();
      // Convert final position back to be relative to the canvas (considering zoom)
      const finalXRelativeToCanvas =
        (finalRect.left - canvasRect.left) / zoomLevel;
      const finalYRelativeToCanvas =
        (finalRect.top - canvasRect.top) / zoomLevel;

      // Calculate font size and line height based on original size and zoom
      const fontSize = size * 8;
      const lineHeight = fontSize * 1.2;

      const lines = textInput.value.split("\n");

      // Create text shape object
      const textShape = {
        type: "text",
        text: textInput.value,
        x: finalXRelativeToCanvas, // Save position relative to canvas
        y: finalYRelativeToCanvas,
        font: `${fontSize}px ${textInput.style.fontFamily}`, // Save computed font
        color: color,
        canvasIndex: activePageIndex,
        lines: lines,
        lineHeight: lineHeight,
        // Store dimensions relative to canvas for hit testing/redraw
        width: textInput.offsetWidth / zoomLevel,
        height: textInput.offsetHeight / zoomLevel,
      };

      shapes.push(textShape);
      textElements.set(textShape, textInput); // Store reference to the DOM element

      // Redraw the canvas to include the newly added text
      redrawCanvas(canvas);

      saveState();
    } else {
      // Remove the text input if it's empty
      textInput.remove();
    }
  });

  // ضغط Enter لإنهاء الإدخال (allow Shift+Enter for new line)
  textInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      textInput.blur(); // Trigger blur to save text
    }
    // Stop propagation for arrow keys within the textarea to avoid scrolling the page
    if (
      e.key === "ArrowUp" ||
      e.key === "ArrowDown" ||
      e.key === "ArrowLeft" ||
      e.key === "ArrowRight"
    ) {
      e.stopPropagation();
    }
  });

  // Add event listener for input to resize the textarea automatically
  textInput.addEventListener("input", () => {
    textInput.style.height = "auto"; // Temporarily shrink to calculate needed height
    textInput.style.height = textInput.scrollHeight + "px"; // Set height based on content
    textInput.style.width = "auto"; // Temporarily shrink width
    textInput.style.width = textInput.scrollWidth + "px"; // Set width based on content (might not be ideal for RTL)
  });

  // Function to update the style of an existing text element DOM element
  function updateTextElementStyle(textShape) {
    const element = textElements.get(textShape);
    if (element) {
      element.style.color = textShape.color || color;
      element.style.fontSize = `${textShape.size * 8}px`; // Use updated size
      // Recalculate and update font style string
      const fontSize = textShape.size * 8;
      element.style.font = `${fontSize}px ${element.style.fontFamily}`;
    }
  }

  // Make the text element selectable when the select tool is active
  if (tool === "select") {
    textInput.style.pointerEvents = "auto"; // Allow clicking/dragging
    textInput.style.cursor = "move";
    textInput.addEventListener("mousedown", (e) => {
      // Prevent default to allow dragging
      e.preventDefault();
      e.stopPropagation(); // Prevent canvas mousedown
      selectedShape = shapes.find(
        (shape) => shape.type === "text" && textElements.get(shape) === e.target
      );
      if (selectedShape) {
        isDragging = true;
        // Start dragging logic here
        startX = e.clientX;
        startY = e.clientY;
        console.log("Selected Text Shape for dragging:", selectedShape);
        // TODO: Show selection/resize handles
      }
    });
    textInput.addEventListener("mousemove", (e) => {
      if (isDragging && selectedShape && selectedShape.type === "text") {
        e.preventDefault();
        e.stopPropagation();
        // Move the text element
        const dx = e.clientX - startX;
        const dy = e.clientY - startY;
        textInput.style.left = `${textInput.offsetLeft + dx}px`;
        textInput.style.top = `${textInput.offsetTop + dy}px`;
        startX = e.clientX;
        startY = e.clientY;
        // Update the shape data immediately for saving
        const pageRectForMove = textInput
          .closest(".page")
          .getBoundingClientRect();
        const canvasRectForMove = textInput
          .closest("canvas")
          .getBoundingClientRect();
        selectedShape.x =
          (textInput.offsetLeft -
            (canvasRectForMove.left - pageRectForMove.left)) /
          zoomLevel;
        selectedShape.y =
          (textInput.offsetTop -
            (canvasRectForMove.top - pageRectForMove.top)) /
          zoomLevel;
      }
    });
    textInput.addEventListener("mouseup", (e) => {
      if (isDragging && selectedShape && selectedShape.type === "text") {
        e.preventDefault();
        e.stopPropagation();
        isDragging = false;
        saveState(); // Save state after dragging
        // Redraw canvas to ensure canvas representation is updated
        redrawCanvas(textInput.closest("canvas"));
        // TODO: Hide selection/resize handles
      }
    });
    textInput.addEventListener("click", (e) => {
      e.stopPropagation(); // Prevent canvas click event when clicking on text
      // Select the text shape on click
      selectedShape = shapes.find(
        (shape) => shape.type === "text" && textElements.get(shape) === e.target
      );
      if (selectedShape) {
        console.log("Selected Text Shape on click:", selectedShape);
        // TODO: Show selection/resize handles
      }
    });
  } else {
    textInput.style.pointerEvents = "none"; // Disable clicking/dragging when not in select tool
    textInput.style.cursor = "default";
    // Remove event listeners for dragging/resizing if not in select tool
  }
}

// Helper function to make an element draggable
function setupDraggable(element) {
  let isDraggingElement = false;
  let currentX, currentY, initialX, initialY;

  element.addEventListener("mousedown", dragStart);
  document.addEventListener("mousemove", drag);
  document.addEventListener("mouseup", dragEnd);

  function dragStart(e) {
    // Only start dragging with the select tool
    if (tool !== "select") return;

    initialX = e.clientX;
    initialY = e.clientY;
    isDraggingElement = true;
    // Prevent text selection within the textarea while dragging
    e.preventDefault();
    e.stopPropagation(); // Stop event propagation to the canvas
  }

  function drag(e) {
    if (!isDraggingElement) return;

    currentX = e.clientX - initialX;
    currentY = e.clientY - initialY;

    // Move the element
    element.style.left = element.offsetLeft + currentX + "px";
    element.style.top = element.offsetTop + currentY + "px";

    initialX = e.clientX;
    initialY = e.clientY;

    // Update the shape data immediately for saving while dragging
    const shapeToMove = shapes.find(
      (shape) => shape.type === "text" && textElements.get(shape) === element
    );
    if (shapeToMove) {
      const pageRectForMove = element.closest(".page").getBoundingClientRect();
      const canvasRectForMove = element
        .closest("canvas")
        .getBoundingClientRect();
      shapeToMove.x =
        (element.offsetLeft - (canvasRectForMove.left - pageRectForMove.left)) /
        zoomLevel;
      shapeToMove.y =
        (element.offsetTop - (canvasRectForMove.top - pageRectForMove.top)) /
        zoomLevel;
    }
  }

  function dragEnd() {
    if (isDraggingElement) {
      isDraggingElement = false;
      initialX = currentX = null;
      initialY = currentY = null;
      saveState(); // Save state after dragging ends
      // Redraw the canvas to ensure the canvas representation is updated
      const canvas = element.closest("canvas");
      if (canvas) {
        redrawCanvas(canvas);
      }
    }
  }
}

// إضافة جدول
function addTable() {
  const rows = parseInt(document.getElementById("table-rows").value) || 3;
  const cols = parseInt(document.getElementById("table-cols").value) || 3;

  if (rows > 0 && cols > 0 && rows <= 20 && cols <= 20) {
    const canvas = document.querySelector(
      ".page:nth-child(" + (activePageIndex + 1) + ") canvas"
    );
    if (canvas) {
      const ctx = canvas.getContext("2d");
      const centerX = canvas.width / 2;
      const centerY = canvas.height / 2;

      const cellWidth = 80;
      const cellHeight = 40;
      const tableWidth = cellWidth * cols;
      const tableHeight = cellHeight * rows;

      const startX = centerX - tableWidth / 2;
      const startY = centerY - tableHeight / 2;

      ctx.save();
      ctx.strokeStyle = color;
      ctx.lineWidth = 1;

      // إنشاء هيكل الجدول للحفظ
      const tableShape = {
        type: "table",
        rows: rows,
        cols: cols,
        startX: startX,
        startY: startY,
        cellWidth: cellWidth,
        cellHeight: cellHeight,
        color: color,
        canvasIndex: activePageIndex,
        // cells: Array(rows) // Removed cells as content is not drawn on canvas
        //   .fill()
        //   .map(() => Array(cols).fill("")),
      };

      // رسم الجدول على الكانفاس
      for (let r = 0; r <= rows; r++) {
        ctx.beginPath();
        ctx.moveTo(startX, startY + r * cellHeight);
        ctx.lineTo(startX + tableWidth, startY + r * cellHeight);
        ctx.stroke();
      }

      for (let c = 0; c <= cols; c++) {
        ctx.beginPath();
        ctx.moveTo(startX + c * cellWidth, startY);
        ctx.lineTo(startX + c * cellWidth, startY + tableHeight);
        ctx.stroke();
      }

      shapes.push(tableShape);
      saveState();
      ctx.restore();

      // إخفاء خيارات الجدول
      tableOptions.classList.add("hidden");

      // TODO: For interactive table, create a DOM element table
    }
  } else {
    alert("يرجى إدخال قيم صحيحة للصفوف والأعمدة (من 1 إلى 20)");
  }
}

// إعداد السحب والإفلات للصور (Use event delegation on pagesContainer)
pagesContainer.addEventListener("dragover", (e) => {
  e.preventDefault();
  // Add dragover class to the specific page being dragged over
  const page = e.target.closest(".page");
  if (page) {
    page.classList.add("dragover");
  }
});

pagesContainer.addEventListener("dragleave", (e) => {
  // Remove dragover class from the specific page leaving
  const page = e.target.closest(".page");
  if (page) {
    page.classList.remove("dragover");
  }
});

pagesContainer.addEventListener("drop", handleImageDrop);

// معالجة إفلات الصورة
function handleImageDrop(e) {
  e.preventDefault();
  // Remove dragover class from the dropped page
  const page = e.target.closest(".page");
  if (page) {
    page.classList.remove("dragover");
  } else {
    return; // Exit if not dropped on a page
  }

  const files = e.dataTransfer.files;
  if (files.length > 0 && files[0].type.match("image.*")) {
    const canvas = page.querySelector("canvas"); // Get canvas from the dropped page
    if (canvas) {
      const ctx = canvas.getContext("2d");
      const rect = canvas.getBoundingClientRect();
      // Calculate drop position relative to the canvas, considering zoom
      const dropX = (e.clientX - rect.left) / zoomLevel;
      const dropY = (e.clientY - rect.top) / zoomLevel;

      const reader = new FileReader();
      reader.onload = function (event) {
        const img = new Image();
        img.onload = function () {
          // حساب الأبعاد المناسبة مع الحفاظ على النسبة
          const maxWidth = canvas.width / 2;
          const maxHeight = canvas.height / 2;
          let width = img.width;
          let height = img.height;

          if (width > maxWidth) {
            height = (maxWidth / width) * height;
            width = maxWidth;
          }

          if (height > maxHeight) {
            width = (maxHeight / height) * width;
            height = maxHeight;
          }

          // Calculate image position to center it on the drop point
          const imgX = dropX - width / 2;
          const imgY = dropY - height / 2;

          // رسم الصورة على الكانفاس
          ctx.drawImage(img, imgX, imgY, width, height);

          // حفظ الصورة كشكل
          const imageShape = {
            type: "image",
            src: event.target.result,
            x: imgX,
            y: imgY,
            width: width,
            height: height,
            canvasIndex: Array.from(document.querySelectorAll(".page")).indexOf(
              page
            ), // Get index of the dropped page
          };

          shapes.push(imageShape);
          saveState();
        };
        img.src = event.target.result;
      };
      reader.readAsDataURL(files[0]);
    }
  }
}

// تطبيق التكبير/التصغير

function applyZoom() {
  const pages = document.querySelectorAll(".page");
  const container = document.getElementById("pages-container");
  const contPags = document.querySelector(".cont_pags");

  const marginTopStep = 110;
  const baseMarginTop = 40;
  const zoomStep = zoomLevel > 1 ? Math.round((zoomLevel - 1) / 0.1) : 0;
  const marginTop = baseMarginTop + zoomStep * marginTopStep;

  // احفظ النسبة المئوية لموضع التمرير قبل التكبير
  const scrollRatio = container.scrollTop / container.scrollHeight;

  // تطبيق التكبير على عنصر cont_pags
  if (contPags) {
    contPags.style.width = `${800 * zoomLevel + 10}px`;
  }

  pages.forEach((page, index) => {
    page.style.width = "800px";
    page.style.setProperty("--zoom-level", zoomLevel);
    page.style.transform = `scale(${zoomLevel})`;
    page.style.transformOrigin = "top center";

    // إذا كانت الصفحة الأولى، نثبت لها margin-top الافتراضي
    if (index === 0) {
      page.style.marginTop = `${baseMarginTop}px`;
    } else {
      page.style.marginTop = `${marginTop}px`;
    }

    page.style.marginBottom = "40px";
    page.style.willChange = "transform, margin";
  });

  updatePageIndicator();
  updateFloatingElements();

  // انتظر حتى يتم تطبيق التكبير ثم أعِد التمرير بناءً على النسبة القديمة
  setTimeout(() => {
    container.scrollTop = scrollRatio * container.scrollHeight;

    // إعادة تعيين will-change لتحسين الأداء
    setTimeout(() => {
      pages.forEach((page) => {
        page.style.willChange = "auto";
      });
    }, 1000);
  }, 50);
}


function zoomIn() {
  if (zoomLevel < 2) {
    zoomLevel = Math.round((zoomLevel + 0.1) * 10) / 10;
    applyZoom();
    // تحسين تجربة المستخدم
    document.getElementById("zoom-in").blur();
  }
}

function zoomOut() {
  if (zoomLevel > 0.5) {
    zoomLevel = Math.round((zoomLevel - 0.1) * 10) / 10;
    applyZoom();
    // تحسين تجربة المستخدم
    document.getElementById("zoom-out").blur();
  }
}
// دالة مساعدة لتحديث العناصر العائمة
function updateFloatingElements() {
  const pages = document.querySelectorAll(".page");

  textElements.forEach((element, shape) => {
    const pageIndex = shape.canvasIndex;
    if (pageIndex >= 0 && pageIndex < pages.length) {
      const page = pages[pageIndex];
      const canvas = page.querySelector("canvas");
      if (canvas) {
        const pageRect = page.getBoundingClientRect();
        const canvasRect = canvas.getBoundingClientRect();

        // حساب المواقع النسبية مع التكبير
        const x = shape.x * zoomLevel + (canvasRect.left - pageRect.left);
        const y = shape.y * zoomLevel + (canvasRect.top - pageRect.top);

        element.style.transform = `translate(${x}px, ${y}px) scale(${
          1 / zoomLevel
        })`;
        element.style.width = `${shape.width * zoomLevel}px`;
        element.style.height = `${shape.height * zoomLevel}px`;
        element.style.fontSize = `${(shape.size || 2) * 8}px`;
      }
    }
  });
}

// دالة مساعدة لتحديث مواضع عناصر النص
function updateTextElementsPosition() {
  textElements.forEach((element, shape) => {
    const page = document.querySelectorAll(".page")[shape.canvasIndex];
    if (page) {
      const canvas = page.querySelector("canvas");
      if (canvas) {
        const pageRect = page.getBoundingClientRect();
        const canvasRect = canvas.getBoundingClientRect();

        element.style.left = `${
          canvasRect.left - pageRect.left + shape.x * zoomLevel
        }px`;
        element.style.top = `${
          canvasRect.top - pageRect.top + shape.y * zoomLevel
        }px`;
        element.style.width = `${shape.width * zoomLevel}px`;
        element.style.height = `${shape.height * zoomLevel}px`;
        element.style.fontSize = `${(shape.size || 2) * 8 * zoomLevel}px`;
      }
    }
  });
}

// تغيير نوع الخلفية
function changeBackground(event) {
  const bgType = event.target.value;
  const pages = document.querySelectorAll(".page");

  pages.forEach((page) => {
    // إزالة الخلفيات السابقة
    page.classList.remove("bg-dots", "bg-lines", "bg-grid", "bg-plain");

    // إضافة الخلفية الجديدة
    page.classList.add("bg-" + bgType);
  });

  saveState();
}

// تبديل الوضع الليلي
function toggleDarkMode() {
  darkMode = !darkMode;
  document.body.classList.toggle("dark");
  darkModeBtn.innerHTML = darkMode
    ? '<i class="fas fa-sun"></i>'
    : '<i class="fas fa-moon"></i>';
  saveAppState();
}

// تبديل الشريط الجانبي
function toggleSidebar() {
  sidebarVisible = !sidebarVisible;
  sidebar.classList.toggle("hidden");
}

// تحسين إدارة الذاكرة (Debounced scroll handler) - Refined
function optimizeCanvasMemory() {
  const canvases = document.querySelectorAll(".page canvas");
  const viewportHeight = window.innerHeight;
  const scrollContainer = pagesContainer; // Use the pagesContainer as the scrollable area

  canvases.forEach((canvas) => {
    const rect = canvas.getBoundingClientRect();
    // Check if canvas is within the viewport + a margin
    const isVisible = rect.bottom > -300 && rect.top < viewportHeight + 300; // Increased margin

    if (!isVisible) {
      // Save canvas state if not visible and clear it
      try {
        // Only save if not already saved or if content exists
        if (
          !canvasData.has(canvas) ||
          canvas
            .getContext("2d")
            .getImageData(0, 0, canvas.width, canvas.height)
            .data.some((channel) => channel !== 0)
        ) {
          canvasData.set(canvas, canvas.toDataURL());
          // Clear the canvas content to free up memory
          canvas.getContext("2d").clearRect(0, 0, canvas.width, canvas.height);
        }
      } catch (e) {
        console.warn("Could not save canvas data:", e);
      }
    } else if (isVisible && canvasData.has(canvas)) {
      // Restore canvas state if it becomes visible and was saved
      const img = new Image();
      img.onload = function () {
        const ctx = canvas.getContext("2d");
        ctx.clearRect(0, 0, canvas.width, canvas.height); // Clear before drawing
        ctx.drawImage(img, 0, 0);
        canvasData.delete(canvas); // Remove saved data
      };
      try {
        img.src = canvasData.get(canvas);
      } catch (e) {
        console.warn("Could not restore canvas data:", e);
      }
    }
  });
}

// إعداد الرسم عالي الأداء (Optimized drawing loop)
let drawingAnimationId = null;
let currentDrawingPoints = [];

function startHighPerformanceDrawing(canvas, ctx) {
  currentDrawingPoints = [];
  if (drawingAnimationId) {
    cancelAnimationFrame(drawingAnimationId);
  }

  const drawLoop = () => {
    if (!isDrawing || !currentShape || currentCanvas !== canvas) {
      drawingAnimationId = null;
      return;
    }

    if (currentDrawingPoints.length > 1) {
      ctx.beginPath();
      ctx.moveTo(currentDrawingPoints[0].x, currentDrawingPoints[0].y);

      for (let i = 1; i < currentDrawingPoints.length; i++) {
        ctx.lineTo(currentDrawingPoints[i].x, currentDrawingPoints[i].y);
      }

      ctx.strokeStyle = currentShape.color;
      ctx.lineWidth = currentShape.size;
      ctx.stroke();
      currentDrawingPoints = [
        currentDrawingPoints[currentDrawingPoints.length - 1],
      ];
    }

    drawingAnimationId = requestAnimationFrame(drawLoop);
  };

  drawingAnimationId = requestAnimationFrame(drawLoop);
}
function drawLoop(canvas, ctx) {
  if (
    !isDrawing ||
    !currentShape ||
    !currentCanvas ||
    currentCanvas !== canvas
  ) {
    drawingAnimationId = null; // Stop the loop if not drawing or canvas changed
    return;
  }

  if (currentDrawingPoints.length > 1) {
    ctx.beginPath();
    ctx.moveTo(currentDrawingPoints[0].x, currentDrawingPoints[0].y);

    // Draw segments
    for (let i = 1; i < currentDrawingPoints.length; i++) {
      ctx.lineTo(currentDrawingPoints[i].x, currentDrawingPoints[i].y);
    }

    // Apply styles from the currentShape
    ctx.strokeStyle = currentShape.color;
    ctx.lineWidth = currentShape.size;
    if (currentShape.type === "eraser") {
      ctx.globalCompositeOperation = "destination-out";
    } else {
      ctx.globalCompositeOperation = "source-over";
      ctx.globalAlpha = currentShape.type === "highlight" ? 0.5 : 1;
    }

    ctx.stroke();

    // Clear points buffer after drawing
    currentDrawingPoints = [
      currentDrawingPoints[currentDrawingPoints.length - 1],
    ]; // Keep the last point
  }

  drawingAnimationId = requestAnimationFrame(() => drawLoop(canvas, ctx));
}

function stopHighPerformanceDrawing() {
  if (drawingAnimationId) {
    cancelAnimationFrame(drawingAnimationId);
    drawingAnimationId = null;
  }
  currentDrawingPoints = []; // Clear points buffer
}

// Use event delegation for mouse/pen/eraser drawing on pagesContainer
pagesContainer.addEventListener("mousedown", (e) => {
  const canvas = e.target.closest("canvas");
  if (!canvas) return;

  if (tool === "pen" || tool === "highlight" || tool === "eraser") {
    const rect = canvas.getBoundingClientRect();

    const x = (e.clientX - rect.left) / zoomLevel;
    const y = (e.clientY - rect.top) / zoomLevel;

    currentDrawingPoints = [{ x, y }];
    // Create the currentShape object here for the drawing loop
    currentShape = {
      type: tool,
      color: tool === "highlight" ? `${color}80` : color,
      size: size,
      points: [{ x, y }], // Initialize with the start point
      canvasIndex: activePageIndex,
    };
    if (tool === "eraser") {
      currentShape.size = size * 5;
    }
    isDrawing = true;
    currentCanvas = canvas;
    startHighPerformanceDrawing(canvas, canvas.getContext("2d"));
    e.preventDefault(); // Prevent default actions like text selection
  } else {
    // For other tools, use the standard startDrawing
    startDrawing(e);
  }
});

pagesContainer.addEventListener("mousemove", (e) => {
  const canvas = e.target.closest("canvas");
  if (!canvas || !isDrawing || currentCanvas !== canvas) return;

  if (tool === "pen" || tool === "highlight" || tool === "eraser") {
    const rect = canvas.getBoundingClientRect();

    const x = (e.clientX - rect.left) / zoomLevel;
    const y = (e.clientY - rect.top) / zoomLevel;

    currentDrawingPoints.push({ x, y });

    // Also add points to the currentShape object for saving the complete path
    if (currentShape && currentShape.points) {
      currentShape.points.push({ x, y });
    }

    e.preventDefault(); // Prevent default actions
  } else {
    // For other tools, use the standard draw
    draw(e);
  }
});

pagesContainer.addEventListener("mouseup", (e) => {
  const canvas = e.target.closest("canvas");
  if (!canvas || !isDrawing || currentCanvas !== canvas) return;

  if (tool === "pen" || tool === "highlight" || tool === "eraser") {
    stopHighPerformanceDrawing();
    isDrawing = false;

    // Add the finished drawing path to the shapes array
    if (currentShape && currentShape.points && currentShape.points.length > 1) {
      shapes.push(currentShape);
    }
    currentShape = null; // Clear current shape after adding

    // Redraw the canvas to ensure everything is captured
    redrawCanvas(canvas);
    saveState(); // Save state after the drawing is finished

    e.preventDefault(); // Prevent default actions
  } else {
    // For other tools, use the standard stopDrawing
    stopDrawing(e);
  }
  currentCanvas = null; // Clear current canvas reference
});

pagesContainer.addEventListener("mouseout", (e) => {
  // Check if the mouse left the canvas area while drawing a continuous tool
  const canvas = e.target.closest("canvas");
  if (!canvas || !isDrawing || currentCanvas !== canvas) return;

  if (tool === "pen" || tool === "highlight" || tool === "eraser") {
    // Stop drawing if mouse leaves the canvas while drawing
    const rect = canvas.getBoundingClientRect();
    if (
      e.clientX <= rect.left ||
      e.clientX >= rect.right ||
      e.clientY <= rect.top ||
      e.clientY >= rect.bottom
    ) {
      stopHighPerformanceDrawing();
      isDrawing = false;

      // Add the finished drawing path to the shapes array
      if (
        currentShape &&
        currentShape.points &&
        currentShape.points.length > 1
      ) {
        shapes.push(currentShape);
      }
      currentShape = null; // Clear current shape after adding

      // Redraw the canvas to ensure everything is captured
      redrawCanvas(canvas);
      saveState(); // Save state

      e.preventDefault(); // Prevent default actions
    }
  }
  currentCanvas = null; // Clear current canvas reference
});

// تحديث مؤشر الصفحات
function updatePageIndicator() {
  const totalPages = document.querySelectorAll(".page").length;
  // Ensure activePageIndex is within bounds
  if (activePageIndex < 0) activePageIndex = 0;
  if (activePageIndex >= totalPages && totalPages > 0)
    activePageIndex = totalPages - 1;
  if (totalPages === 0) activePageIndex = 0; // Reset if no pages

  pageIndicator.innerHTML = `${
    activePageIndex + 1
  } / ${totalPages} <small>(${Math.round(zoomLevel * 100)}%)</small>`;
}

// تحسين نظام Zoom:
function updateElementsForZoom() {
  textElements.forEach((element, shape) => {
    const page = document.querySelectorAll(".page")[shape.canvasIndex];
    if (page) {
      const canvas = page.querySelector("canvas");
      if (canvas) {
        const pageRect = page.getBoundingClientRect();
        const canvasRect = canvas.getBoundingClientRect();

        element.style.left = `${
          canvasRect.left - pageRect.left + shape.x * zoomLevel
        }px`;
        element.style.top = `${
          canvasRect.top - pageRect.top + shape.y * zoomLevel
        }px`;
        element.style.width = `${shape.width * zoomLevel}px`;
        element.style.height = `${shape.height * zoomLevel}px`;
      }
    }
  });
}
// تراجع
function undo() {
  if (currentStateIndex > 0) {
    // حفظ الحالة الحالية في مكدس الإعادة
    redoStack.push(undoStack[currentStateIndex]);
    currentStateIndex--;

    // استعادة الحالة السابقة
    restoreState(undoStack[currentStateIndex]);

    updateUndoRedoButtons();
  }
}
// إعادة
function redo() {
  if (redoStack.length > 0) {
    currentStateIndex++;
    undoStack.push(redoStack.pop());

    // استعادة الحالة
    restoreState(undoStack[currentStateIndex]);

    updateUndoRedoButtons();
  }
}
// Helper to restore text elements based on saved shapes
function restoreTextElements(savedTextShapes) {
  // Remove existing text DOM elements
  textElements.forEach((element) => element.remove());
  textElements.clear();

  // Recreate text DOM elements for the text shapes in the current state
  savedTextShapes.forEach((shape) => {
    if (shape.type === "text") {
      const page = document.querySelectorAll(".page")[shape.canvasIndex];
      const canvas = page ? page.querySelector("canvas") : null;
      if (canvas) {
        const textInput = document.createElement("textarea");
        textInput.className = "canvas-text-input";
        textInput.style.position = "absolute";
        textInput.style.zIndex = 10;
        textInput.value = shape.text;

        // Position based on saved shape data (relative to canvas, then adjust for page and zoom)
        const pageRect = page.getBoundingClientRect();
        const canvasRect = canvas.getBoundingClientRect();
        textInput.style.left = `${
          canvasRect.left - pageRect.left + shape.x * zoomLevel
        }px`;
        textInput.style.top = `${
          canvasRect.top - pageRect.top + shape.y * zoomLevel
        }px`;

        // Apply saved styles
        textInput.style.fontFamily =
          shape.font.split(" ")[1] || "Cairo, sans-serif"; // Extract font family
        textInput.style.direction = "rtl";
        textInput.style.padding = "5px";
        textInput.style.border = "1px dashed " + shape.color;
        textInput.style.backgroundColor = "rgba(255, 255, 255, 0.8)";
        textInput.style.color = shape.color;
        textInput.style.fontSize = `${shape.lineHeight / 1.2}px`; // Derive font size from lineHeight
        textInput.style.resize = "both";
        textInput.style.overflow = "auto";
        textInput.style.outline = "none";
        textInput.style.boxShadow = "0 0 5px rgba(0, 0, 0, 0.2)";
        // Set dimensions based on saved shape data
        textInput.style.width = `${shape.width * zoomLevel}px`;
        textInput.style.height = `${shape.height * zoomLevel}px`;

        page.appendChild(textInput);
        textElements.set(shape, textInput); // Store the new element reference

        // Re-attach event listeners for dragging and resizing
        setupDraggable(textInput);
        // Add event listener for blur to save changes
        textInput.addEventListener("blur", () => {
          // Update shape data before saving
          const finalRect = textInput.getBoundingClientRect();
          const pageRectBlur = textInput
            .closest(".page")
            .getBoundingClientRect();
          const canvasRectBlur = textInput
            .closest("canvas")
            .getBoundingClientRect();
          shape.x =
            (finalRect.left - (canvasRectBlur.left - pageRectBlur.left)) /
            zoomLevel;
          shape.y =
            (finalRect.top - (canvasRectBlur.top - pageRectBlur.top)) /
            zoomLevel;
          shape.width = textInput.offsetWidth / zoomLevel;
          shape.height = textInput.offsetHeight / zoomLevel;
          shape.text = textInput.value;
          shape.lines = textInput.value.split("\n");
          // Note: Font size and color are updated via color/size selectors while text is selected
          saveState();
          redrawCanvas(canvas); // Redraw canvas to update text
        });

        // Re-attach keydown listener
        textInput.addEventListener("keydown", (e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            textInput.blur(); // Trigger blur to save text
          }
          // Stop propagation for arrow keys within the textarea
          if (
            e.key === "ArrowUp" ||
            e.key === "ArrowDown" ||
            e.key === "ArrowLeft" ||
            e.key === "ArrowRight"
          ) {
            e.stopPropagation();
          }
        });

        // Re-attach input listener for auto-resizing
        textInput.addEventListener("input", () => {
          textInput.style.height = "auto";
          textInput.style.height = textInput.scrollHeight + "px";
          textInput.style.width = "auto";
          textInput.style.width = textInput.scrollWidth + "px";
        });

        // Make the text element selectable when the select tool is active
        if (tool === "select") {
          textInput.style.pointerEvents = "auto";
          textInput.style.cursor = "move";
          textInput.addEventListener("mousedown", (e) => {
            e.preventDefault();
            e.stopPropagation();
            selectedShape = shapes.find((s) => s === shape); // Select by shape reference
            if (selectedShape) {
              isDragging = true;
              startX = e.clientX;
              startY = e.clientY;
              console.log(
                "Selected Restored Text Shape for dragging:",
                selectedShape
              );
              // TODO: Show selection/resize handles
            }
          });
          textInput.addEventListener("mousemove", (e) => {
            if (
              isDragging &&
              selectedShape &&
              selectedShape.type === "text" &&
              textElements.get(selectedShape) === textInput
            ) {
              e.preventDefault();
              e.stopPropagation();
              const dx = e.clientX - startX;
              const dy = e.clientY - startY;
              textInput.style.left = `${textInput.offsetLeft + dx}px`;
              textInput.style.top = `${textInput.offsetTop + dy}px`;
              startX = e.clientX;
              startY = e.clientY;
              // Update the shape data immediately for saving
              const pageRectForMove = textInput
                .closest(".page")
                .getBoundingClientRect();
              const canvasRectForMove = textInput
                .closest("canvas")
                .getBoundingClientRect();
              selectedShape.x =
                (textInput.offsetLeft -
                  (canvasRectForMove.left - pageRectForMove.left)) /
                zoomLevel;
              selectedShape.y =
                (textInput.offsetTop -
                  (canvasRectForMove.top - pageRectForMove.top)) /
                zoomLevel;
            }
          });
          textInput.addEventListener("mouseup", (e) => {
            if (
              isDragging &&
              selectedShape &&
              selectedShape.type === "text" &&
              textElements.get(selectedShape) === textInput
            ) {
              e.preventDefault();
              e.stopPropagation();
              isDragging = false;
              saveState();
              redrawCanvas(textInput.closest("canvas"));
              // TODO: Hide selection/resize handles
            }
          });
          textInput.addEventListener("click", (e) => {
            e.stopPropagation();
            selectedShape = shapes.find((s) => s === shape); // Select by shape reference
            if (selectedShape) {
              console.log(
                "Selected Restored Text Shape on click:",
                selectedShape
              );
              // TODO: Show selection/resize handles
            }
          });
        } else {
          textInput.style.pointerEvents = "none";
          textInput.style.cursor = "default";
        }
      }
    }
  });
}

// تحديث حالة أزرار التراجع/الإعادة
function updateUndoRedoButtons() {
  undoBtn.disabled = undoStack.length <= 1; // Disable undo if only initial state exists
  redoBtn.disabled = redoStack.length === 0;
}

// حفظ الحالة للتراجع
function saveState() {
  // إنشاء نسخة عميقة من الحالة الحالية
  const state = {
    shapes: JSON.parse(JSON.stringify(shapes)),
    textElements: Array.from(textElements).map(([shape, element]) => ({
      shape: JSON.parse(JSON.stringify(shape)),
      elementData: {
        value: element.value,
        style: {
          left: element.style.left,
          top: element.style.top,
          width: element.style.width,
          height: element.style.height,
          fontSize: element.style.fontSize,
          color: element.style.color,
        },
      },
    })),
    zoomLevel: zoomLevel, // حفظ مستوى التكبير الحالي
    activePageIndex: activePageIndex,
    fileName: fileNameInput.value,
  };

  // إذا كنا في منتصف المكدس (بعد عمل تراجع)، نمسح حالات الإعادة
  if (currentStateIndex < undoStack.length - 1) {
    undoStack = undoStack.slice(0, currentStateIndex + 1);
  }

  // إضافة الحالة الجديدة
  undoStack.push(state);
  currentStateIndex = undoStack.length - 1;

  // تقليل حجم المكدس إذا تجاوز الحد الأقصى
  if (undoStack.length > MAX_STACK_SIZE) {
    undoStack.shift();
    currentStateIndex--;
  }

  // مسح مكدس الإعادة عند أي تغيير جديد
  redoStack = [];

  updateUndoRedoButtons();
  autoSave();
}

function restoreState(state) {
  // استعادة مستوى التكبير أولاً
  zoomLevel = state.zoomLevel || 1;
  
  // استعادة الأشكال
  shapes = JSON.parse(JSON.stringify(state.shapes));
  
  // مسح عناصر النص الحالية
  textElements.forEach(element => element.remove());
  textElements.clear();
  
  // إعادة إنشاء عناصر النص مع تطبيق التكبير
  state.textElements.forEach(({shape, elementData}) => {
    const textInput = document.createElement("textarea");
    textInput.className = "canvas-text-input";
    textInput.style.position = "absolute";
    textInput.style.zIndex = "10";
    textInput.value = elementData.value;
    
    // تطبيق الأنماط مع تعديل التكبير
    Object.entries(elementData.style).forEach(([prop, value]) => {
      textInput.style[prop] = value;
    });
    
    // إضافة العنصر إلى الصفحة مع تطبيق التكبير الحالي
    const page = document.querySelectorAll(".page")[shape.canvasIndex];
    if (page) {
      page.appendChild(textInput);
      textElements.set(shape, textInput);
      
      // تحديث الموقع مع التكبير الحالي
      updateTextElementPosition(textInput, shape);
      setupDraggable(textInput);
    }
  });
  
  // تطبيق التكبير على الصفحات
  applyZoom();
  
  // إعادة الرسم
  redrawAllCanvases();
}

function updateUndoRedoButtons() {
  undoBtn.disabled = currentStateIndex <= 0;
  redoBtn.disabled = redoStack.length === 0;

  // إضافة تلميحات توضيحية
  undoBtn.title = `تراجع (Ctrl+Z)\n${undoStack.length - 1} خطوة متاحة`;
  redoBtn.title = `إعادة (Ctrl+Y)\n${redoStack.length} خطوة متاحة`;
}
// الحفظ التلقائي
function autoSave() {
  localStorage.setItem(
    "whiteboard_app_state",
    JSON.stringify({
      fileName: fileNameInput.value,
      darkMode: darkMode,
      tool: tool,
      color: color,
      size: size,
      bgType: bgTypeSelect.value,
      shapes: shapes, // Save shapes data
      zoomLevel: zoomLevel,
      activePageIndex: activePageIndex,
    })
  );
}

// حفظ حالة التطبيق (Alias for autoSave)
function saveAppState() {
  autoSave();
}

// تحميل الحفظ التلقائي
function loadAutosave() {
  const savedState = localStorage.getItem("whiteboard_app_state");
  if (savedState) {
    const state = JSON.parse(savedState);
    fileNameInput.value = state.fileName || "ملف جديد";

    if (state.darkMode) {
      // Only toggle if not already in dark mode
      if (!document.body.classList.contains("dark")) {
        toggleDarkMode();
      }
    } else {
      // Ensure dark mode is off if not saved as dark mode
      if (document.body.classList.contains("dark")) {
        toggleDarkMode();
      }
    }

    // Restore pages if saved state has more than one page worth of shapes
    const savedCanvasCount = new Set(
      state.shapes.map((shape) => shape.canvasIndex)
    ).size;
    const existingPages = document.querySelectorAll(".page").length;
    for (let i = existingPages; i < savedCanvasCount; i++) {
      addPage(); // Add pages as needed
    }

    setTool(state.tool || "pen");

    const colorCircle = document.querySelector(
      `.color-circle[data-color="${state.color || "#000000"}]`
    );
    if (colorCircle) colorCircle.click();
    else color = state.color || "#000000"; // Ensure color is set even if no matching circle

    const sizeDot = document.querySelector(
      `.size-dot[data-size="${state.size || 2}"]`
    );
    if (sizeDot) sizeDot.click();
    else size = state.size || 2; // Ensure size is set even if no matching dot

    // Set custom size input value if it was saved
    const customSizeInput = document.getElementById("custom-size");
    if (customSizeInput) {
      customSizeInput.value = size;
    }

    bgTypeSelect.value = state.bgType || "dots";
    changeBackground({ target: bgTypeSelect }); // Trigger background change with a simulated event object

    if (state.shapes) {
      shapes = state.shapes;
      // Restore text DOM elements based on loaded shapes
      restoreTextElements(shapes);
      redrawAllCanvases();
    }

    if (state.zoomLevel) {
      zoomLevel = state.zoomLevel;
      applyZoom();
    }

    // Scroll to the active page after pages are added and zoom is applied
    if (state.activePageIndex !== undefined) {
      activePageIndex = state.activePageIndex;
      const pages = document.querySelectorAll(".page");
      if (pages[activePageIndex]) {
        // Use a timeout to ensure zoom is applied before scrolling
        setTimeout(() => {
          pages[activePageIndex].scrollIntoView({
            behavior: "smooth",
            block: "center",
          }); // Scroll to center
          updatePageIndicator(); // Update indicator after potential scroll
        }, 100); // Small delay
      } else {
        updatePageIndicator();
      }
    } else {
      updatePageIndicator(); // Update indicator even if no active page saved
    }

    // Load initial state into undo stack
    saveState(); // This will add the loaded state to the undo stack
    undoStack = [
      JSON.stringify({
        shapes: shapes,
        textElements: Array.from(textElements.keys()),
      }),
    ]; // Ensure initial state is the first in undo
    redoStack = []; // Clear redo stack on load
    updateUndoRedoButtons(); // Update button states
  } else {
    // If no saved state, save the initial state
    saveState();
  }
}

// إعادة رسم جميع الكانفاس
function redrawAllCanvases() {
  document.querySelectorAll(".page canvas").forEach((canvas) => {
    redrawCanvas(canvas);
  });
}

// مسح الصفحة الحالية
function clearPage() {
  if (confirm("هل أنت متأكد من مسح الصفحة الحالية؟")) {
    // Filter out shapes only for the active page
    shapes = shapes.filter((shape) => shape.canvasIndex !== activePageIndex);

    const canvas = document.querySelector(
      `.page:nth-child(${activePageIndex + 1}) canvas`
    );
    if (canvas) {
      canvas.getContext("2d").clearRect(0, 0, canvas.width, canvas.height);
      // Remove text DOM elements on this page
      textElements.forEach((element, shape) => {
        if (shape.canvasIndex === activePageIndex) {
          element.remove();
          textElements.delete(shape);
        }
      });
    }
    saveState(); // Save state after clearing
  }
}

// حفظ كملف PDF
function saveAsPdf() {
  // Ensure html2canvas and jsPDF are loaded
  if (!window.html2canvas || !window.jspdf) {
    const scriptHtml2canvas = document.createElement("script");
    scriptHtml2canvas.src =
      "https://html2canvas.hertzen.com/dist/html2canvas.min.js";
    scriptHtml2canvas.onload = () => {
      const scriptJspdf = document.createElement("script");
      scriptJspdf.src =
        "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js";
      scriptJspdf.onload = () => {
        generatePdf();
      };
      scriptJspdf.onerror = () =>
        alert("فشل في تحميل مكتبة PDF. تأكد من اتصالك بالإنترنت.");
      document.head.appendChild(scriptJspdf);
    };
    scriptHtml2canvas.onerror = () =>
      alert("فشل في تحميل مكتبة html2canvas. تأكد من اتصالك بالإنترنت.");
    document.head.appendChild(scriptHtml2canvas);
  } else {
    generatePdf();
  }

  async function generatePdf() {
    try {
      const { jsPDF } = window.jspdf;
      const pdf = new jsPDF("p", "mm", "a4");
      const pages = document.querySelectorAll(".page");

      // Temporarily hide the add page button for PDF generation
      const addButton = document.querySelector(".add-page-button");
      if (addButton) addButton.style.display = "none";

      // Temporarily hide page action buttons for PDF generation
      document
        .querySelectorAll(".page-actions")
        .forEach((actions) => (actions.style.display = "none"));

      for (let i = 0; i < pages.length; i++) {
        const page = pages[i];
        if (i > 0) pdf.addPage();

        // Use html2canvas to render the entire page div
        const canvas = await html2canvas(page, {
          scale: 2, // Increase scale for better resolution
          logging: false, // Disable logging
          useCORS: true, // Important for handling images from data URLs
        });

        const imgData = canvas.toDataURL("image/jpeg", 1.0);
        const imgWidth = 210; // A4 width in mm
        const pageHeight = 297; // A4 height in mm
        const imgHeight = (canvas.height * imgWidth) / canvas.width;

        // Add image to PDF
        pdf.addImage(imgData, "JPEG", 0, 0, imgWidth, imgHeight);
      }

      // Restore the add page button and page action buttons
      if (addButton) addButton.style.display = "block";
      document
        .querySelectorAll(".page-actions")
        .forEach((actions) => (actions.style.display = "block"));

      pdf.save((fileNameInput.value || "notebook") + ".pdf");
    } catch (e) {
      console.error("PDF generation error:", e);
      alert("حدث خطأ أثناء إنشاء ملف PDF");
    }
  }
}

// معالجة اختصارات لوحة المفاتيح
function handleKeyShortcuts(e) {
  // Check if the target is not a text input area
  if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") {
    return; // Do not trigger shortcuts when typing in inputs
  }

  // Ctrl/Cmd + Z للتراجع
  if ((e.ctrlKey || e.metaKey) && e.key === "z" && !e.shiftKey) {
    e.preventDefault();
    undo();
  }

  // Ctrl/Cmd + Shift + Z أو Ctrl/Cmd + Y للإعادة
  if (
    ((e.ctrlKey || e.metaKey) && e.key === "z" && e.shiftKey) ||
    ((e.ctrlKey || e.metaKey) && e.key === "y")
  ) {
    e.preventDefault();
    redo();
  }

  // Ctrl/Cmd + S للحفظ
  if ((e.ctrlKey || e.metaKey) && e.key === "s") {
    e.preventDefault();
    saveAsPdf();
  }

  // Delete لحذف العنصر المحدد
  if (e.key === "Delete" && selectedShape) {
    e.preventDefault();
    // Remove the selected shape from the shapes array
    shapes = shapes.filter((shape) => shape !== selectedShape);

    // If the selected shape was a text element, remove its DOM element as well
    if (selectedShape.type === "text") {
      const textElementToRemove = textElements.get(selectedShape);
      if (textElementToRemove) {
        textElementToRemove.remove();
        textElements.delete(selectedShape);
      }
    }

    deselectShape(); // Deselect after deleting
    redrawAllCanvases(); // Redraw all canvases to remove the shape
    saveState(); // Save state after deletion
  }

  // اختصارات الأدوات (Kept existing shortcuts)
  if (e.altKey) {
    // Prevent default browser actions for Alt key combinations
    e.preventDefault();
    switch (e.key) {
      case "p":
        setTool("pen");
        break;
      case "s":
        setTool("select");
        break;
      case "h":
        setTool("highlight");
        break;
      case "e":
        setTool("eraser");
        break;
      case "t":
        setTool("text");
        break;
      case "r":
        setTool("rect");
        break;
      case "c":
        setTool("circle");
        break;
      case "l":
        setTool("line");
        break;
      case "a":
        setTool("arrow");
        break;
      case "g": // Alt + G for Grid background
        bgTypeSelect.value = "grid";
        changeBackground({ target: bgTypeSelect });
        break;
      case "o": // Alt + O for Dots background
        bgTypeSelect.value = "dots";
        changeBackground({ target: bgTypeSelect });
        break;
      case "i": // Alt + I for Lines background
        bgTypeSelect.value = "lines";
        changeBackground({ target: bgTypeSelect });
        break;
      case "n": // Alt + N for Plain background
        bgTypeSelect.value = "plain";
        changeBackground({ target: bgTypeSelect });
        break;
    }
  }
}

// دالة مساعدة للحد من استدعاء الوظائف المتكررة
function debounce(func, wait) {
  let timeout;
  return function (...args) {
    // Use rest parameters
    const context = this;
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(context, args), wait); // Apply args
  };
}
// تهيئة نهائية
window.addEventListener("beforeunload", (e) => {
  // Check if there are unsaved changes by comparing current state with the last saved state
  const currentState = JSON.stringify({
    shapes: shapes,
    textElements: Array.from(textElements.keys()),
  });
  const lastSavedState =
    undoStack.length > 0 ? undoStack[undoStack.length - 1] : null;

  if (currentState !== lastSavedState) {
    e.preventDefault();
    e.returnValue = "لديك تغييرات غير محفوظة. هل تريد المغادرة حقًا؟";
    return e.returnValue;
  }
});
