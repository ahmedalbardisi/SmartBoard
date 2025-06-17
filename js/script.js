/**
 * السبورة الذكية - أساسيات البرمجة
 * Smart Whiteboard - Core JavaScript Functionality 
 */

// -------------------- المتغيرات الرئيسية وتهيئة التطبيق --------------------

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

// Variables for shape drawing
let drawStartX = 0;
let drawStartY = 0;
let savedCanvasState = null; // To store canvas state before drawing shapes

// Variable for highlight drawing points
let highlightPoints = [];

// Variable for pen drawing points
let penPoints = [];



// مراجع العناصر - Add null checks here
const pagesContainer = document.getElementById("pages-container") || null;
const canvasArea = document.querySelector(".canvas-area") || null;
const horizontalToolbar = document.querySelector(".horizontal-toolbar") || null;
const sidebar = document.querySelector(".sidebar") || null;
const pageIndicator = document.getElementById("page-indicator") || null;
const zoomPercentageSpan = document.getElementById("zoom-percentage") || null; // Get the zoom percentage span
const contPags = document.querySelector(".cont_pags") || null; // Reference to the container of pages


const penBtn = document.getElementById("pen-btn") || null;
const highlightBtn = document.getElementById("highlight-btn") || null;
const eraserBtn = document.getElementById("eraser-btn") || null;
const panBtn = document.getElementById("pan-btn") || null;
// const selectBtn = document.getElementById("select-btn") || null; // Keep reference if needed later
// const textBtn = document.getElementById("text-btn") || null;   // Keep reference if needed later
const colorPicker = document.getElementById("color-picker") || null;
const sizeSlider = document.getElementById("pen-size-slider") || null;
const sizeValue = document.getElementById("size-value") || null;

const zoomInBtn = document.getElementById("zoom-in") || null;
const zoomOutBtn = document.getElementById("zoom-out") || null;
const clearBtn = document.getElementById("clear-btn") || null;
const undoBtn = document.getElementById("undo-btn") || null;
const redoBtn = document.getElementById("redo-btn") || null;
const darkModeBtn = document.getElementById("dark-mode-btn") || null;
const settingsBtn = document.getElementById("settings-btn") || null;
const settingsPanel = document.getElementById("settings-panel") || null;
const toggleSidebarBtn = document.getElementById("toggle-sidebar") || null;
const addPageBtn = document.getElementById("add-page-btn") || null;
const bgTypeSelect = document.getElementById("bg-type") || null;
const savePdfBtn = document.getElementById("save-pdf") || null; // In settings

// الأشكال والجداول (References for future implementation) - Add null checks here
const rectBtn = document.getElementById("rect-btn") || null;
const circleBtn = document.getElementById("circle-btn") || null;
const lineBtn = document.getElementById("line-btn") || null;
const arrowBtn = document.getElementById("arrow-btn") || null; // Arrow will be more complex

const tableBtn = document.getElementById("table-btn") || null;
const tableOptionsDiv = document.getElementById("table-options") || null;
const tableRowsInput = document.getElementById("table-rows") || null;
const tableColsInput = document.getElementById("table-cols") || null;

const MAX_HISTORY_LENGTH = 30;

// -------------------- دوال الإعداد والتهيئة --------------------

function initApp() {
  createNewPage(); // Create the first page
  setupEventListeners();
  // Ensure penBtn exists before setting active tool button and cursor
  if (penBtn) {
      setActiveToolButton(penBtn); // Default tool
  } else {
       console.error("Pen button not found. Cannot set default active tool button.");
  }
  setCanvasCursor(currentTool); // setCanvasCursor handles null canvas gracefully
  // Ensure bgTypeSelect exists before setting background pattern
  if (bgTypeSelect) {
      setBgPatternForAllPages(bgTypeSelect.value);
  } else {
      console.error("Background type select element not found. Cannot set initial background pattern.");
  }
  updateZoomPercentageDisplay(); // Initial zoom display - updateZoomPercentageDisplay handles null span gracefully
  updateUndoRedoButtons(); // Update undo/redo buttons on load
  console.log("تم تهيئة التطبيق بنجاح!");
}

function createNewPage() {
  const pageElement = document.createElement("div");
  pageElement.className = "page";

  const pageActions = document.createElement("div"); // Actions placeholder
  pageActions.className = "page-actions";
  pageElement.appendChild(pageActions);

  const canvas = document.createElement("canvas");
  // Set initial canvas size (A4 aspect ratio approx)
  canvas.width = 800;
  canvas.height = 1131; // Adjusted for better A4-like ratio
  pageElement.appendChild(canvas);

  // Add the page element to the DOM if contPags exists
  if (contPags) {
      contPags.appendChild(pageElement);
  } else {
       console.error("Container for pages (.cont_pags) not found. Cannot append new page element.");
       return null; // Return null if page element couldn't be added to DOM
  }


  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  // Apply current background pattern if bgTypeSelect exists
   if (bgTypeSelect) {
        setCanvasBackground(canvas, bgTypeSelect.value);
   }


  // Store page data
  const pageData = {
    canvas: canvas,
    ctx: ctx,
    history: [canvas.toDataURL()], // Initial state for undo as Data URL
    redoStack: [],
    translateX: 0, // Initial pan/zoom state for this page
    translateY: 0,
    scale: 1,
    element: pageElement // Reference to the DOM element
  };
  pages.push(pageData);

  // Add canvas event listeners for the new page
  setupCanvasEventListeners(canvas, pages.length - 1);

  addPageToSidebar(); // Update sidebar
  switchToPage(pages.length - 1); // Switch to the new page

  return pageData;
}

function setCanvasBackground(canvas, pattern) {
    if (canvas) { // Add null check for canvas
        canvas.classList.remove("bg-dots", "bg-lines", "bg-grid");
        if (pattern !== "plain") {
            canvas.classList.add(`bg-${pattern}`);
        }
    }
}


function setupEventListeners() {
  // Toolbar Tools - Add null checks
  if (penBtn) penBtn.addEventListener("click", () => setActiveTool("pen")); else console.error("Pen button not found.");
  if (highlightBtn) highlightBtn.addEventListener("click", () => setActiveTool("highlight")); else console.error("Highlight button not found.");
  if (eraserBtn) eraserBtn.addEventListener("click", () => setActiveTool("eraser")); else console.error("Eraser button not found.");
  if (panBtn) panBtn.addEventListener("click", () => setActiveTool("pan")); else console.error("Pan button not found.");
  // if (selectBtn) selectBtn.addEventListener("click", () => setActiveTool("select")); else console.error("Select button not found."); // Implement later
  // if (textBtn) textBtn.addEventListener("click", () => setActiveTool("text")); else console.error("Text button not found.");   // Implement later

    // Shape Tools - Add null checks
  if (rectBtn) rectBtn.addEventListener("click", () => setActiveTool("rect")); else console.error("Rectangle button not found.");
  if (circleBtn) circleBtn.addEventListener("click", () => setActiveTool("circle")); else console.error("Circle button not found.");
  if (lineBtn) lineBtn.addEventListener("click", () => setActiveTool("line")); else console.error("Line button not found.");
  if (arrowBtn) arrowBtn.addEventListener("click", () => setActiveTool("arrow")); else console.error("Arrow button not found."); // Implement later
  
  if (tableBtn) {
    tableBtn.addEventListener("click", () => {
        setActiveTool("table");
        // Optionally show table options when table tool is selected
        if (tableOptionsDiv) {
            tableOptionsDiv.classList.remove('hidden');
        }
    });
} else {
    console.error("Table button not found.");
}

  // Header Buttons - Add null checks
  if (clearBtn) clearBtn.addEventListener("click", clearCanvas); else console.error("Clear button not found.");
  if (undoBtn) undoBtn.addEventListener("click", undo); else console.error("Undo button not found.");
  if (redoBtn) redoBtn.addEventListener("click", redo); else console.error("Redo button not found.");
  if (darkModeBtn) darkModeBtn.addEventListener("click", toggleDarkMode); else console.error("Dark mode button not found.");
  if (settingsBtn) settingsBtn.addEventListener("click", toggleSettingsPanel); else console.error("Settings button not found.");
  if (toggleSidebarBtn) toggleSidebarBtn.addEventListener("click", toggleSidebar); else console.error("Toggle sidebar button not found.");

  // Zoom - Add null checks
  if (zoomInBtn) zoomInBtn.addEventListener("click", zoomIn); else console.error("Zoom In button not found.");
  if (zoomOutBtn) zoomOutBtn.addEventListener("click", zoomOut); else console.error("Zoom Out button not found.");

  // Page Management - Add null check
  if (addPageBtn) addPageBtn.addEventListener("click", createNewPage); else console.error("Add Page button not found.");

  // Settings Panel - Add null checks
  if (bgTypeSelect) bgTypeSelect.addEventListener("change", () => setBgPatternForAllPages(bgTypeSelect.value)); else console.error("Background type select not found.");
  if (savePdfBtn) savePdfBtn.addEventListener("click", saveAsPdf); else console.error("Save PDF button not found.");

    // Keyboard Shortcuts - Add null check for the window object itself if necessary, but generally safe
    window.addEventListener("keydown", handleKeyShortcuts);


  // Color Selection - Add null check for colorPicker
  document.querySelectorAll(".color-circle").forEach((circle) => {
    circle.addEventListener("click", function () {
      if (this.classList.contains("custom-color-btn")) {
          if (colorPicker) { // Add null check for colorPicker before clicking
             colorPicker.click();
          } else {
             console.error("Color picker element not found.");
          }
      } else {
        setCurrentColor(this.dataset.color);
        updateColorUI(this.dataset.color);
      }
    });
  });
  if (colorPicker) { // Add null check for colorPicker
      colorPicker.addEventListener("input", function () { // Use 'input' for live preview
        setCurrentColor(this.value);
        updateColorUI(this.value);
      });
  } else {
       console.error("Color picker element not found for input listener.");
  }


  // Size Selection - Add null checks for sizeSlider and size dots
  if (sizeSlider && sizeValue) { // Add null check for sizeSlider and sizeValue
      sizeSlider.addEventListener("input", function () {
        const size = parseInt(this.value);
        setCurrentSize(size);
        sizeValue.textContent = size + "px";
        updateSizeUI(size);
        // if (customSizeSlider) customSizeSlider.value = size; // تم إزالة هذا السطر أيضًا
      });
  } else {
      console.error("Size slider or size value element not found.");
  }
  document.querySelectorAll(".size-dot").forEach((dot) => {
    dot.addEventListener("click", function () {
      const size = parseInt(this.dataset.size);
      setCurrentSize(size);
      if (sizeSlider) sizeSlider.value = size; // Sync with toolbar slider if it exists
      if (sizeValue) sizeValue.textContent = size + "px"; // Update value display if it exists
      updateSizeUI(size);
    });
  });

    // Add listeners for toggling toolbar/sidebar sections if needed
    document.querySelectorAll('.toggle-section').forEach(button => {
        button.addEventListener('click', function() {
            const targetId = this.dataset.target;
            const content = document.getElementById(targetId);
            if (content) { // Add null check here as well
                content.classList.toggle('hidden');
                const icon = this.querySelector('i');
                if (icon) { // Add null check for icon
                   icon.classList.toggle('fa-chevron-down');
                   icon.classList.toggle('fa-chevron-up');
                }
            } else {
                console.error(`Target element with ID ${targetId} not found for toggle-section.`);
            }
        });
    });
     document.querySelectorAll('.toggle-sidebar-section').forEach(button => {
        button.addEventListener('click', function() {
            const targetId = this.dataset.target;
            const content = document.getElementById(targetId);
             if (content) { // Add null check here as well
                content.classList.toggle('hidden'); // Assuming 'hidden' class controls visibility
                 const icon = this.querySelector('i');
                 if (icon) { // Add null check for icon
                    icon.classList.toggle('fa-chevron-down');
                    icon.classList.toggle('fa-chevron-up');
                 }
             } else {
                 console.error(`Target element with ID ${targetId} not found for toggle-sidebar-section.`);
             }
        });
    });

    // --- Color Mixing Event Listeners (Add inside setupEventListeners) ---
    const redSlider = document.getElementById('red-slider') || null;
    const greenSlider = document.getElementById('green-slider') || null;
    const blueSlider = document.getElementById('blue-slider') || null;
    const redValue = document.getElementById('red-value') || null;
    const greenValue = document.getElementById('green-value') || null;
    const blueValue = document.getElementById('blue-value') || null;
    const colorPreviewBox = document.getElementById('color-preview-box') || null;
    const colorHexInput = document.getElementById('color-hex') || null;
    const addMixedColorBtn = document.getElementById('add-mixed-color') || null;
    const customColorsGrid = document.querySelector('.custom-colors-grid') || null;

    // Add checks for color mixing elements
    if (redSlider && greenSlider && blueSlider && redValue && greenValue && blueValue && colorPreviewBox && colorHexInput && addMixedColorBtn && customColorsGrid) {
        function updateColorPreview() {
            const r = redSlider.value;
            const g = greenSlider.value;
            const b = blueSlider.value;
            const hexColor = rgbToHex(parseInt(r), parseInt(g), parseInt(b));
            redValue.textContent = r;
            greenValue.textContent = g;
            blueValue.textContent = b;
            colorPreviewBox.style.backgroundColor = hexColor;
            colorHexInput.value = hexColor;
        }

        redSlider.addEventListener('input', updateColorPreview);
        greenSlider.addEventListener('input', updateColorPreview);
        blueSlider.addEventListener('input', updateColorPreview);
        colorHexInput.addEventListener('change', () => { // Update sliders if hex is changed manually
            const hex = colorHexInput.value;
            const rgb = hexToRgb(hex);
            if (rgb) {
                redSlider.value = rgb.r;
                greenSlider.value = rgb.g;
                blueSlider.value = rgb.b;
                updateColorPreview(); // Update UI elements based on new slider values
            }
        });

        addMixedColorBtn.addEventListener('click', () => {
            const newColor = colorHexInput.value;
            const colorExists = Array.from(customColorsGrid.querySelectorAll('.custom-color:not(.add-custom-color)')).some(
                el => el.style.backgroundColor === newColor || rgbToHexFromStyle(el.style.backgroundColor) === newColor
            );

            if (!colorExists) {
                const newColorDiv = document.createElement('div');
                newColorDiv.className = 'custom-color';
                newColorDiv.style.backgroundColor = newColor;
                newColorDiv.addEventListener('click', function() {
                     setCurrentColor(newColor);
                     updateColorUI(newColor); // Select the new color in the main toolbar
                     if (colorPicker) colorPicker.value = newColor; // Also update the hidden color picker if it exists
                });
                 // Insert before the "add" button if it exists
                 const addColorButton = customColorsGrid.querySelector('.add-custom-color');
                 if (addColorButton) {
                    customColorsGrid.insertBefore(newColorDiv, addColorButton);
                 } else {
                    customColorsGrid.appendChild(newColorDiv); // Append if add button not found
                 }

            } else {
                alert("هذا اللون موجود بالفعل في الألوان المخصصة.");
            }
        });
         // Add event listeners to initially present custom colors
         customColorsGrid.querySelectorAll('.custom-color:not(.add-custom-color)').forEach(colorDiv => {
            colorDiv.addEventListener('click', function() {
                const color = rgbToHexFromStyle(this.style.backgroundColor); // Get hex color
                setCurrentColor(color);
                updateColorUI(color); // Select the color in the main toolbar
                if (colorPicker) colorPicker.value = color; // Update the hidden color picker if it exists
            });
         });
    } else {
         console.error("One or more color mixing elements not found.");
    }


  console.log("تم تسجيل معالجات الأحداث بنجاح");
}

function setupCanvasEventListeners(canvas, pageIndex) {
  const page = pages[pageIndex]; // Get the page object


  if (!canvas || !page || !page.ctx) { // Add null checks for canvas and context
      console.error(`Canvas, page object, or context not found for page index ${pageIndex}. Cannot setup event listeners.`);
      return;
  }

  canvas.addEventListener("mousedown", (e) => {
      if (currentTool === 'pan') {
           isPanning = true;
           // Calculate pan start relative to the viewport
           panStartX = e.clientX - page.translateX;
           panStartY = e.clientY - page.translateY;
           canvas.classList.add("active"); // grabbing cursor
           return; // Don't draw when panning
      }

      isDrawing = true;
      const pos = getMousePos(canvas, e, page.scale, page.translateX, page.translateY);
      [lastX, lastY] = [pos.x, pos.y];
      drawStartX = pos.x;
      drawStartY = pos.y;

      // Save the canvas state before starting any drawing action
      savedCanvasState = page.ctx.getImageData(0, 0, canvas.width, canvas.height);

      // Add logic for 'table' tool
      if (currentTool === 'table') {
          // Read rows and columns from input fields
          const rows = parseInt(tableRowsInput.value);
          const cols = parseInt(tableColsInput.value);
          // Store these values or use them directly in mousemove/mouseup
          page.tableInfo = { startX: drawStartX, startY: drawStartY, rows: rows, cols: cols };
          console.log(`Drawing table with ${rows} rows and ${cols} columns`);
      }

      // Prepare context for drawing (pen, eraser, highlight)
      if (currentTool === 'pen' || currentTool === 'eraser' || currentTool === 'highlight') {
           page.ctx.beginPath();

           if (currentTool === 'highlight') {
               // For highlight, start collecting points
               highlightPoints = [{ x: pos.x, y: pos.y }];
           } else if (currentTool === 'pen') { // Add logic for pen points
                penPoints = [{ x: pos.x, y: pos.y }];
           }
           // Eraser starts path directly without collecting points in an array for this method
           // else {
           //     page.ctx.moveTo(lastX, lastY); // Start path at the correct point for eraser
           // }


           page.ctx.lineWidth = currentSize;
           page.ctx.strokeStyle = currentColor;
           page.ctx.globalAlpha = 1.0; // Default opacity

          if (currentTool === 'eraser') {
              // Use destination-out to erase
              page.ctx.globalCompositeOperation = 'destination-out';
              // Eraser might need a larger effective size
              page.ctx.lineWidth = currentSize * 1.5; // Example: make eraser slightly bigger
               page.ctx.moveTo(lastX, lastY); // Start path for eraser
          } else if (currentTool === 'highlight') {
              page.ctx.strokeStyle = currentColor; // Use selected color
              // Set semi-transparency for highlighter - Applied during drawing in mousemove/mouseup
              page.ctx.globalAlpha = 0.5; // Set global alpha for the highlight tool drawing
               // Ensure it draws on top of existing content
              page.ctx.globalCompositeOperation = 'source-over';
              page.ctx.lineWidth = currentSize * 5; // Highlighter is usually thicker
          } else if (currentTool === 'pen') { // Set styles for pen
               page.ctx.globalCompositeOperation = 'source-over'; // Default drawing mode
               page.ctx.strokeStyle = currentColor;
               page.ctx.lineWidth = currentSize;
               page.ctx.globalAlpha = 1.0; // Opaque for pen
          }
      }


  });

  canvas.addEventListener("mousemove", (e) => {
       if (isPanning) {
          const page = pages[pageIndex];
          if (page) { // Add null check for page
               // Calculate new translate values based on mouse movement relative to pan start
              page.translateX = e.clientX - panStartX;
              page.translateY = e.clientY - panStartY;
              applyTransform(page); // Update visual position
          }
          return;
       }

       if (!isDrawing) return;

       const page = pages[pageIndex];
       if (!page || !page.ctx || !page.canvas) {
            console.error(`Page object, context, or canvas not found for page ${pageIndex + 1}. Cannot draw on mousemove.`);
            return;
       }
       const ctx = page.ctx;
 
       const pos = getMousePos(page.canvas, e, page.scale, page.translateX, page.translateY);
 

      if (currentTool === 'pen' || currentTool === 'highlight') { // Apply quadratic curves to both pen and highlight
           const points = currentTool === 'pen' ? penPoints : highlightPoints;
           points.push({ x: pos.x, y: pos.y });

           // Restore the canvas to the state before drawing the current stroke preview
           if (savedCanvasState) {
                ctx.putImageData(savedCanvasState, 0, 0);
           }

           // Set style for preview
          ctx.strokeStyle = currentColor;
          ctx.globalCompositeOperation = 'source-over'; // Draw on top

          if (currentTool === 'highlight') {
               ctx.lineWidth = currentSize * 5;
               ctx.globalAlpha = 0.5; // Semi-transparency for highlight
          } else if (currentTool === 'pen') { // Set styles for pen preview
               ctx.lineWidth = currentSize;
               ctx.globalAlpha = 1.0; // Opaque for pen
          }


           // Draw the path using quadratic curves
           if (points.length > 1) {
               ctx.beginPath(); // Start a new path for each preview frame
               ctx.moveTo(points[0].x, points[0].y);

               for (let i = 1; i < points.length; i++) {
                    const p1 = points[i - 1];
                    const p2 = points[i];
                    // Calculate midpoint for smoother curve control
                    const midPoint = {
                        x: (p1.x + p2.x) / 2,
                        y: (p1.y + p2.y) / 2,
                    };
                    // Draw quadratic curve from the previous point (p1) to the midpoint, with p1 as the control point
                   ctx.quadraticCurveTo(p1.x, p1.y, midPoint.x, midPoint.y);
               }
               // Draw the last segment to the actual current position for a clean end
               ctx.lineTo(pos.x, pos.y);
               ctx.stroke();
           }

      } else if (currentTool === 'eraser') { // Eraser still uses simple lineTo
           const ctx = page.ctx;
           ctx.lineTo(pos.x, pos.y);
           ctx.stroke();
          [lastX, lastY] = [pos.x, pos.y];
      }
      else if (currentTool === 'rect' || currentTool === 'circle' || currentTool === 'line' || currentTool === 'arrow' || currentTool === 'table') { // Add table here
        // Draw shape/table preview
        if (savedCanvasState) {
            ctx.putImageData(savedCanvasState, 0, 0);
        }

        // Set style for preview
       ctx.strokeStyle = currentColor;
       ctx.lineWidth = currentSize;
       ctx.globalAlpha = 1.0;
       ctx.globalCompositeOperation = 'source-over';

       const width = pos.x - drawStartX;
       const height = pos.y - drawStartY;

       ctx.beginPath();
       if (currentTool === 'rect') {
           ctx.strokeRect(drawStartX, drawStartY, width, height);
          } else if (currentTool === 'circle') {
              // Approximate circle using ellipse
              const centerX = drawStartX + width / 2;
              const centerY = drawStartY + height / 2;
              const radiusX = Math.abs(width / 2);
              const radiusY = Math.abs(height / 2);
              ctx.ellipse(centerX, centerY, radiusX, radiusY, 0, 0, Math.PI * 2);
               ctx.stroke();
          } else if (currentTool === 'line') {
              ctx.moveTo(drawStartX, drawStartY);
              ctx.lineTo(pos.x, pos.y);
               ctx.stroke();
          } else if (currentTool === 'arrow') { // Add arrow preview
               drawArrow(ctx, drawStartX, drawStartY, pos.x, pos.y);
          }else if (currentTool === 'table') { // Add table drawing preview
            if (page.tableInfo) {
                drawTable(ctx, page.tableInfo.startX, page.tableInfo.startY, width, height, page.tableInfo.rows, page.tableInfo.cols);
            }
          }
          ctx.closePath(); // Close path after drawing shape
      }
  });

  canvas.addEventListener("mouseup", (e) => {
    if (isPanning) {
        isPanning = false;
        canvas.classList.remove("active"); // Back to regular pan cursor
        savedCanvasState = null; // Clear any saved state from potential pan start
        return;
    }
   if (!isDrawing) return;
   isDrawing = false;

   const page = pages[pageIndex];
   if (!page || !page.ctx || !page.canvas) { // Add null check for page, context, and canvas
        console.error(`Page object, context, or canvas not found for page ${pageIndex + 1}. Cannot finalize drawing on mouseup.`);
        savedCanvasState = null; // Ensure saved state is cleared on error
        return;
   }

   const ctx = page.ctx;
   const pos = getMousePos(page.canvas, e, page.scale, page.translateX, page.translateY);


    if (currentTool === 'pen' || currentTool === 'highlight') { // Apply to both pen and highlight
         // Finalize drawing
        if (savedCanvasState) {
           ctx.putImageData(savedCanvasState, 0, 0); // Restore state before final draw
           savedCanvasState = null; // Clear saved state
        }

        const points = currentTool === 'pen' ? penPoints : highlightPoints;

        // Set style for final stroke
       ctx.strokeStyle = currentColor;
       ctx.globalCompositeOperation = 'source-over'; // Draw on top

        if (currentTool === 'highlight') {
            ctx.lineWidth = currentSize * 5;
            ctx.globalAlpha = 0.5; // Semi-transparency for highlight
        } else if (currentTool === 'pen') { // Set styles for final pen stroke
            ctx.lineWidth = currentSize;
            ctx.globalAlpha = 1.0; // Opaque for pen
        }


        // Draw the final path using quadratic curves
        if (points.length > 1) {
            ctx.beginPath();
            ctx.moveTo(points[0].x, points[0].y);

            for (let i = 1; i < points.length; i++) {
                 const p1 = points[i - 1];
                 const p2 = points[i];
                 const midPoint = {
                     x: (p1.x + p2.x) / 2,
                     y: (p1.y + p2.y) / 2,
                 };
                ctx.quadraticCurveTo(p1.x, p1.y, midPoint.x, midPoint.y);
            }
            // Draw the last segment to the actual current position
            ctx.lineTo(pos.x, pos.y);
            ctx.stroke();
        } else if (points.length === 1) {
            // Draw a dot if there's only one point (click without drag)
            ctx.beginPath();
            ctx.arc(points[0].x, points[0].y, ctx.lineWidth / 2, 0, Math.PI * 2);
            ctx.fillStyle = ctx.strokeStyle;
            ctx.fill();
        }


         if (currentTool === 'pen') penPoints = []; // Clear pen points
         if (currentTool === 'highlight') highlightPoints = []; // Clear highlight points

         saveToHistory(pageIndex); // Save state after drawing

    } else if (currentTool === 'eraser') { // Eraser still uses simple closePath and save
        ctx.closePath();
        saveToHistory(pageIndex);
         savedCanvasState = null; // Clear saved state after eraser stroke
    }
    else if (currentTool === 'rect' || currentTool === 'circle' || currentTool === 'line' || currentTool === 'arrow' || currentTool === 'table') { // Add table here
        // Draw the final shape/table
        if (savedCanvasState) {
           ctx.putImageData(savedCanvasState, 0, 0); // Restore state before final draw
           savedCanvasState = null; // Clear saved state
        }

        // Set style for final shape/table
        ctx.strokeStyle = currentColor;
        ctx.lineWidth = currentSize;
        ctx.globalAlpha = 1.0; // Shapes/Tables are usually not semi-transparent
        ctx.globalCompositeOperation = 'source-over';


        const width = pos.x - drawStartX;
        const height = pos.y - drawStartY;

        // Only draw shape/table if there was significant movement (not just a click)
        if (Math.abs(width) > 2 || Math.abs(height) > 2) {
            ctx.beginPath();
            if (currentTool === 'rect') {
                ctx.strokeRect(drawStartX, drawStartY, width, height);
            } else if (currentTool === 'circle') {
               const centerX = drawStartX + width / 2;
               const centerY = drawStartY + height / 2;
               const radiusX = Math.abs(width / 2);
               const radiusY = Math.abs(height / 2);
               ctx.ellipse(centerX, centerY, radiusX, radiusY, 0, 0, Math.PI * 2);
               ctx.stroke();
            } else if (currentTool === 'line') {
               ctx.moveTo(drawStartX, drawStartY);
               ctx.lineTo(pos.x, pos.y);
               ctx.stroke();
            } else if (currentTool === 'arrow') {
                drawArrow(ctx, drawStartX, drawStartY, pos.x, pos.y);
            } else if (currentTool === 'table') { // Draw the final table
                if (page.tableInfo) {
                     drawTable(ctx, page.tableInfo.startX, page.tableInfo.startY, width, height, page.tableInfo.rows, page.tableInfo.cols);
                    // Clear temporary table info after drawing
                    delete page.tableInfo;
                }
            }
            ctx.closePath();

           saveToHistory(pageIndex); // Save after drawing the shape/table
        } else {
            // If it was just a click, do nothing for shapes/tables
        }
    }

   // Reset composite operation and alpha
   ctx.globalCompositeOperation = 'source-over';
   ctx.globalAlpha = 1.0;


   // Clear redo stack for the current page whenever a new action is performed
   page.redoStack = [];
   updateUndoRedoButtons();
});

  canvas.addEventListener("mouseleave", () => {
      // Stop drawing if mouse leaves the canvas
      if(isDrawing) {
          const page = pages[pageIndex];
           if (page && page.ctx && page.canvas) {
               // Finalize drawing stroke similar to mouseup for pen/highlight/eraser
              if (currentTool === 'pen' || currentTool === 'highlight') { // Apply to both pen and highlight
                   if (savedCanvasState) {
                      page.ctx.putImageData(savedCanvasState, 0, 0);
                       savedCanvasState = null;
                  }

                  const points = currentTool === 'pen' ? penPoints : highlightPoints;

                  // Set style for final stroke on leave
                  page.ctx.strokeStyle = currentColor;
                  page.ctx.globalCompositeOperation = 'source-over';

                  if (currentTool === 'highlight') {
                      page.ctx.lineWidth = currentSize * 5;
                      page.ctx.globalAlpha = 0.5;
                  } else if (currentTool === 'pen') {
                      page.ctx.lineWidth = currentSize;
                      page.ctx.globalAlpha = 1.0;
                  }

                  // Draw the final path using quadratic curves
                  if (points.length > 1) {
                      page.ctx.beginPath();
                      page.ctx.moveTo(points[0].x, points[0].y);

                      for (let i = 1; i < points.length; i++) {
                           const p1 = points[i - 1];
                           const p2 = points[i];
                           const midPoint = {
                               x: (p1.x + p2.x) / 2,
                               y: (p1.y + p2.y) / 2,
                           };
                          page.ctx.quadraticCurveTo(p1.x, p1.y, midPoint.x, midPoint.y);
                      }
                       const lastPoint = points[points.length - 1];
                      page.ctx.lineTo(lastPoint.x, lastPoint.y);
                      page.ctx.stroke();
                  } else if (points.length === 1) {
                       // Draw a dot if drawing started but mouse left immediately
                       page.ctx.beginPath();
                       page.ctx.arc(points[0].x, points[0].y, page.ctx.lineWidth / 2, 0, Math.PI * 2);
                       page.ctx.fillStyle = page.ctx.strokeStyle;
                       page.ctx.fill();
                  }


                   if (currentTool === 'pen') penPoints = []; // Clear pen points
                   if (currentTool === 'highlight') highlightPoints = []; // Clear highlight points

                   saveToHistory(pageIndex); // Save state after drawing on leave

              } else if (currentTool === 'eraser') { // Eraser still uses simple closePath and save
                  page.ctx.closePath();
                   saveToHistory(pageIndex);
                    savedCanvasState = null; // Clear saved state after eraser stroke
              }
               else if (currentTool === 'rect' || currentTool === 'circle' || currentTool === 'line' || currentTool === 'arrow') {
                  // If drawing a shape and mouse leaves, restore the canvas to the state before the preview
                   if (savedCanvasState) {
                      page.ctx.putImageData(savedCanvasState, 0, 0);
                       savedCanvasState = null; // Clear saved state
                   }
                   // Shape history is saved on mouseup, so no extra save here unless you want partial shapes saved.
              }

              // Reset composite operation and alpha
               page.ctx.globalCompositeOperation = 'source-over';
               page.ctx.globalAlpha = 1.0;


              page.redoStack = []; // Clear redo stack on any drawing action
              updateUndoRedoButtons();
          } else {
               console.error(`Page object, context, or canvas not found for page index ${pageIndex}. Cannot finalize drawing on mouseleave.`);
               savedCanvasState = null; // Ensure saved state is cleared on error
          }
      }
      isDrawing = false;
      if (isPanning) {
           isPanning = false;
           canvas.classList.remove("active");
      }

  });

   // Prevent context menu on canvas
   canvas.addEventListener('contextmenu', function(e) {
      e.preventDefault();
   });


  
     // ======= الكود الجديد الذي ستضيفه هنا =======
     // Add touch event listeners using the function from touch-events.js
     if (window.addTouchEventListenersToCanvas) {
         window.addTouchEventListenersToCanvas(canvas, pageIndex);
     } else {
         console.error("addTouchEventListenersToCanvas function not found. touch-events.js might not be loaded correctly.");
     }
     // ===========================================

}

// Function to get mouse position relative to canvas, considering pan and zoom
// Function to get mouse or touch position relative to canvas, considering pan and zoom
function getMousePos(canvas, evt, currentScale, currentTranslateX, currentTranslateY) {
    if (!canvas) { // Add null check for canvas
         console.error("Cannot get mouse position: canvas element is null.");
         return { x: 0, y: 0 }; // Return default if canvas is null
    }
    const rect = canvas.getBoundingClientRect();

    // Determine if it's a mouse event or a touch object
    // Touch events have a 'touches' list, single touch uses touches[0]
    // We check if clientX exists directly on the event or on the first touch
    const clientX = (evt.clientX !== undefined) ? evt.clientX : (evt.touches && evt.touches[0] ? evt.touches[0].clientX : (evt.changedTouches && evt.changedTouches[0] ? evt.changedTouches[0].clientX : 0));
    const clientY = (evt.clientY !== undefined) ? evt.clientY : (evt.touches && evt.touches[0] ? evt.touches[0].clientY : (evt.changedTouches && evt.changedTouches[0] ? evt.changedTouches[0].clientY : 0));


    // Calculate mouse/touch position relative to the canvas's top-left corner in the viewport
    const mouseX = clientX - rect.left;
    const mouseY = clientY - rect.top;

    // Divide by the current scale to get the position in the unscaled canvas coordinates
    const canvasX = mouseX / currentScale;
    const canvasY = mouseY / currentScale;

    // Return the coordinates in the canvas's intrinsic coordinate system
    return {
        x: canvasX,
        y: canvasY
    };
}

// -------------------- وظائف الرسم والأدوات --------------------

function setActiveTool(tool) {
  currentTool = tool;

  document.querySelectorAll(".tool-btn").forEach((btn) => btn.classList.remove("active"));

  let activeButton;
  // Hide table options by default
  if (tableOptionsDiv) {
      tableOptionsDiv.classList.add('hidden');
  }

  switch (tool) {
    case "pen": activeButton = penBtn; break;
    case "highlight": activeButton = highlightBtn; break;
    case "eraser": activeButton = eraserBtn; break;
    case "pan": activeButton = panBtn; break;
    case "rect": activeButton = rectBtn; break;
    case "circle": activeButton = circleBtn; break;
    case "line": activeButton = lineBtn; break;
    case "arrow": activeButton = arrowBtn; break;
    case "table":
        activeButton = tableBtn;
        // Show table options specifically for the table tool
        if (tableOptionsDiv) {
            tableOptionsDiv.classList.remove('hidden');
        }
        break;
    default: activeButton = penBtn;
  }
   if (activeButton) {
      setActiveToolButton(activeButton);
   } else {
       console.error(`Active button not found for tool: ${tool}`);
   }

  setCanvasCursor(tool);
  console.log(`تم تفعيل أداة: ${tool}`);
}

function setActiveToolButton(button) {
  // Deactivate all tool buttons first (in both toolbars and sidebar)
  document.querySelectorAll(".tool-btn").forEach((btn) => btn.classList.remove("active"));
  // Activate the clicked button if it exists
   if (button) {
      button.classList.add("active");
   }
}


function setCanvasCursor(tool) {
  pages.forEach(page => {
    if (page && page.canvas) {
        const canvas = page.canvas;
        canvas.classList.remove(
          "canvas-cursor-pen", "canvas-cursor-eraser", "canvas-cursor-highlight",
          "canvas-cursor-select", "canvas-cursor-text", "canvas-cursor-pan",
          "canvas-cursor-shape", "active"
          // Add table cursor class here if you create one, otherwise use shape cursor
          // "canvas-cursor-table"
        );

        switch (tool) {
          case "pen": canvas.classList.add("canvas-cursor-pen"); break;
          case "highlight": canvas.classList.add("canvas-cursor-highlight"); break;
          case "eraser": canvas.classList.add("canvas-cursor-eraser"); break;
          case "pan": canvas.classList.add("canvas-cursor-pan"); break;
          case "rect": case "circle": case "line": case "arrow": case "table": // Add table here
             canvas.classList.add("canvas-cursor-shape"); break; // Use shape cursor for table
           default: canvas.style.cursor = 'default';
        }
    }
  });
}


function setCurrentColor(color) {
  currentColor = color;
  console.log(`تم تغيير اللون إلى ${color}`);
}

function updateColorUI(color) {
  document.querySelectorAll(".color-circle").forEach((circle) => {
    circle.classList.remove("selected");
    // Check both data-color and computed style for custom colors
    if (circle.dataset.color === color || rgbToHexFromStyle(circle.style.backgroundColor) === color) {
      circle.classList.add("selected");
    }
  });
  if (colorPicker) { // Add null check for colorPicker
      colorPicker.value = color; // Sync hidden picker
  }
}

function setCurrentSize(size) {
  currentSize = size;
  console.log(`تم تغيير حجم القلم إلى ${size}px`);
}

function updateSizeUI(size) {
  document.querySelectorAll(".size-dot").forEach((dot) => {
    dot.classList.remove("selected");
    if (parseInt(dot.dataset.size) === size) {
      dot.classList.add("selected");
    }
  });
   // Update the text display for the slider if sizeValue exists
   if (sizeValue) {
       sizeValue.textContent = size + "px";
   }
}

// -------------------- وظائف الإدارة والعرض --------------------

function setBgPatternForAllPages(pattern) {
   pages.forEach(page => {
       if (page && page.canvas) { // Add null check for page and canvas
            setCanvasBackground(page.canvas, pattern);
       }
   });
   console.log(`تم تغيير نمط الخلفية لجميع الصفحات إلى: ${pattern}`);
}

function toggleDarkMode() {
  document.body.classList.toggle("dark-mode");
  const isDarkMode = document.body.classList.contains("dark-mode");
  if (darkModeBtn) { // Add null check for darkModeBtn
      darkModeBtn.innerHTML = isDarkMode ? '<i class="fas fa-sun"></i>' : '<i class="fas fa-moon"></i>';
  }
  console.log(`تم تبديل وضع الإضاءة إلى: ${isDarkMode ? "داكن" : "فاتح"}`);
}

function toggleSettingsPanel() {
  if (settingsPanel) { // Add null check for settingsPanel
      settingsPanel.classList.toggle("hidden");
  } else {
       console.error("Settings panel element not found.");
  }
}

function toggleSidebar() {
    if (sidebar) { // Add null check for sidebar
        sidebar.classList.toggle("hidden");
        // Optional: Adjust canvas area width if sidebar visibility changes
        // if (canvasArea) canvasArea.style.width = sidebar.classList.contains('hidden') ? '100%' : 'calc(100% - 220px)'; // Adjust width as needed
    } else {
        console.error("Sidebar element not found.");
    }
}

function handleKeyShortcuts(e) { // Handles keyboard shortcuts
  // ... other shortcut logic
  if (e.altKey) { // If Alt key is pressed
    // ... other cases
    switch (e.key) { // Switches based on key pressed
      // ... other cases
      case "h": // If the key is 'h'
        setActiveTool("highlight"); // Sets the tool to highlight
        break;
      // ... other cases
    }
  }
}


function applyTransform(page) {
    if (!page || !page.element) return; // Check if page and its element exist
    // Apply scale and translate transform to the page's container element
    page.element.style.transform = `translate(${page.translateX}px, ${page.translateY}px) scale(${page.scale})`;
    // Note: Applying transform to the .page div, not the canvas itself.
    // This keeps canvas resolution intact but scales/moves the container.
    updateZoomPercentageDisplay(); // Update zoom display after transform
}


function zoomIn() {
  const page = pages[currentPage];
  if (page) { // Add null check for page
      page.scale = Math.min(page.scale * 1.2, 5); // Zoom in by 20%, max 5x
      applyTransform(page);
      console.log("تكبير الصفحة الحالية:", page.scale);
  } else {
      console.error(`Page ${currentPage + 1} not found for zooming in.`);
  }
}

function zoomOut() {
   const page = pages[currentPage];
   if (page) { // Add null check for page
       page.scale = Math.max(page.scale / 1.2, 0.2); // Zoom out by 20%, min 0.2x
       applyTransform(page);
       console.log("تصغير الصفحة الحالية:", page.scale);
   } else {
       console.error(`Page ${currentPage + 1} not found for zooming out.`);
   }
}

function updateZoomPercentageDisplay() {
    const page = pages[currentPage];
    if (page && zoomPercentageSpan) { // Add null check for page and zoomPercentageSpan
        zoomPercentageSpan.textContent = `${Math.round(page.scale * 100)}%`;
    } else {
         // console.error("Current page or zoom percentage span not found."); // Optional: log if needed
    }
}


function clearCanvas() {
  const page = pages[currentPage];
  if (!page || !page.ctx || !page.canvas) { // Add null checks
      console.error(`Page object, context, or canvas not found for page ${currentPage + 1}. Cannot clear canvas.`);
      return;
  }

  saveToHistory(currentPage); // Save state before clearing

  const ctx = page.ctx;
  const canvas = page.canvas;
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Optionally redraw background if it was cleared (clearRect might remove it)
  // if (bgTypeSelect) setCanvasBackground(canvas, bgTypeSelect.value); // Or maybe not needed if bg is CSS

  console.log(`تم مسح محتوى الصفحة ${currentPage + 1}`);
}

// -------------------- وظائف التراجع والإعادة --------------------

function saveToHistory(pageIndex) {
    if (pageIndex < 0 || pageIndex >= pages.length) {
         console.error(`Invalid page index ${pageIndex} for saving history.`);
        return;
    }
    const page = pages[pageIndex];
     if (!page || !page.canvas) { // Add null checks
         console.error(`Page object or canvas not found for page index ${pageIndex}. Cannot save history.`);
         return;
     }
    const canvas = page.canvas;

    // Limit history size
    if (page.history.length >= MAX_HISTORY_LENGTH) {
        page.history.shift(); // Remove the oldest state
    }

    // Save the current canvas state as DataURL
    page.history.push(canvas.toDataURL());

    // When a new action is saved, the redo stack for that page must be cleared
    page.redoStack = [];

    updateUndoRedoButtons(); // Update button states
    // console.log(`Saved state to history for page ${pageIndex + 1}. History size: ${page.history.length}`);
}


function undo() {
    const page = pages[currentPage];
    if (!page) { // Add null check
        console.error(`Page object not found for current page ${currentPage + 1}. Cannot undo.`);
        return;
    }
    // Need at least two states to undo: the current state and the one before it
    if (page.history.length < 2) {
        console.log("لا يوجد شيء للتراجع عنه");
        return;
    }

    // Move the current state to the redo stack
    const currentStateDataUrl = page.history.pop();
     if (currentStateDataUrl !== undefined) { // Ensure a state was popped
         page.redoStack.push(currentStateDataUrl);
     } else {
         console.error("Failed to pop current state from history.");
         return;
     }


    // Get the previous state DataURL
    const previousStateDataUrl = page.history[page.history.length - 1];
     if (!previousStateDataUrl) { // Ensure previous state exists
         console.error("Previous state not found in history after pop.");
          // Optionally, push the popped state back if something went wrong
         page.history.push(currentStateDataUrl);
         return;
     }


    // Restore the previous state
    restoreCanvasStateFromDataURL(page, previousStateDataUrl);

    console.log(`تراجع للصفحة ${currentPage + 1}`);
}

function redo() {
    const page = pages[currentPage];
    if (!page) { // Add null check
        console.error(`Page object not found for current page ${currentPage + 1}. Cannot redo.`);
        return;
    }
    if (page.redoStack.length === 0) {
        console.log("لا يوجد شيء للإعادة");
        return;
    }

    const stateToRedoDataUrl = page.redoStack.pop();
     if (!stateToRedoDataUrl) { // Ensure a state was popped
         console.error("Failed to pop state from redo stack.");
         return;
     }


    // Restore the redone state
    restoreCanvasStateFromDataURL(page, stateToRedoDataUrl, true); // Pass true to push to history

    console.log(`إعادة للصفحة ${currentPage + 1}`);
}

function restoreCanvasStateFromDataURL(page, dataUrl, pushToHistory = false) {
    if (!page || !page.ctx || !page.canvas) { // Add null checks
        console.error("Page object, context, or canvas not found. Cannot restore canvas state.");
        return;
    }

    const img = new Image();
    img.onload = function() {
        if (page && page.ctx && page.canvas) { // Add null checks inside onload
            page.ctx.clearRect(0, 0, page.canvas.width, page.canvas.height); // Clear canvas first
            page.ctx.drawImage(img, 0, 0); // Draw the state image

            // Explicitly reset drawing properties after restoring the image
            page.ctx.globalAlpha = 1.0;
            page.ctx.globalCompositeOperation = 'source-over';

            if (pushToHistory) {
                 // Add the state back to history when redoing
                 page.history.push(dataUrl);
            }

            updateUndoRedoButtons();
        }
    };
    img.onerror = function() {
        console.error("خطأ في تحميل صورة الحالة من DataURL", dataUrl);
         // If loading fails, try to revert the history/redo stack changes
         if (page) { // Add null check for page
             if (pushToHistory) {
                 // If it was a redo attempt, move the state back to redo stack
                 page.history.pop(); // Remove the incomplete state from history
                 page.redoStack.push(dataUrl); // Put it back on the redo stack
             } else {
                  // If it was an undo attempt, move the state back to history stack
                  page.redoStack.pop(); // Remove incomplete state from redo
                  page.history.push(dataUrl); // Put it back on history
             }
         }
        updateUndoRedoButtons();
    };
    img.src = dataUrl;
}


function updateUndoRedoButtons() {
    const page = pages[currentPage];
     if (undoBtn && redoBtn && page) { // Add null checks for buttons and page
        // Need at least two states to undo: the current state and the one before it (initial blank + one action)
        undoBtn.disabled = page.history.length <= 1;
        redoBtn.disabled = page.redoStack.length === 0;
     } else {
         // console.error("Undo/Redo buttons or current page not found."); // Optional: log if needed
     }
}


// -------------------- إدارة الصفحات --------------------

function addPageToSidebar() {
  const pagesList = document.querySelector(".pages-list");
   if (!pagesList) { // Add null check for pagesList
       console.error("Pages list element (.pages-list) not found. Cannot add page to sidebar.");
       return;
   }
  // Remove the existing "Add Page" button temporarily
  const addPageButton = pagesList.querySelector(".add-page-button");
  if (addPageButton) {
      pagesList.removeChild(addPageButton);
  }


  const pageIndex = pages.length;

  const pageItem = document.createElement("div");
  pageItem.className = "page-item";
  pageItem.textContent = `صفحة ${pageIndex}`;
  pageItem.dataset.index = pageIndex - 1;

  pageItem.addEventListener("click", function () {
    switchToPage(parseInt(this.dataset.index));
  });

   // Add delete button to page item
   const deleteBtn = document.createElement('button');
   deleteBtn.innerHTML = '<i class="fas fa-trash"></i>';
   deleteBtn.className = 'page-action-btn delete-page-btn'; // Add specific class
   deleteBtn.title = 'حذف الصفحة';
    deleteBtn.addEventListener('click', (e) => {
        e.stopPropagation(); // Prevent clicking the page item
        deletePage(parseInt(pageItem.dataset.index));
    });
    pageItem.appendChild(deleteBtn);


  pagesList.appendChild(pageItem); // Add the new page item


  // Re-add the "Add Page" button at the end if it was found
  if (addPageButton) {
      pagesList.appendChild(addPageButton);
  }

  console.log(`تمت إضافة الصفحة ${pageIndex} إلى الشريط الجانبي`);
}

function deletePage(pageIndex) {
    if (pages.length <= 1) {
        alert("لا يمكن حذف الصفحة الوحيدة.");
        return;
    }
    if (pageIndex < 0 || pageIndex >= pages.length) {
         console.error(`Invalid page index ${pageIndex} for deletion.`);
         return;
    }

    if (confirm(`هل أنت متأكد أنك تريد حذف الصفحة ${pageIndex + 1}؟`)) {
        // Remove the page element from the DOM if it exists
        if (pages[pageIndex] && pages[pageIndex].element) {
             pages[pageIndex].element.remove();
        } else {
             console.error(`Page element not found for page index ${pageIndex}. Cannot remove from DOM.`);
        }


        // Remove the page data from the array
        pages.splice(pageIndex, 1);

        // Remove the page item from the sidebar if it exists
        const pageItems = document.querySelectorAll(".page-item");
        if (pageIndex < pageItems.length) {
             pageItems[pageIndex].remove();
        } else {
             console.error(`Page item not found in sidebar for index ${pageIndex}.`);
        }


        // Adjust data-index for subsequent pages in sidebar
        for (let i = pageIndex; i < pages.length; i++) {
             const item = document.querySelector(`.page-item[data-index="${i + 1}"]`); // Select based on old index
             if (item) {
                 item.dataset.index = i;
                 item.textContent = `صفحة ${i + 1}`; // Update text
                  // Re-add delete button as it might be removed by textContent update
                 let deleteBtn = item.querySelector('.delete-page-btn');
                 if (!deleteBtn) {
                      deleteBtn = document.createElement('button');
                     deleteBtn.innerHTML = '<i class="fas fa-trash"></i>';
                     deleteBtn.className = 'page-action-btn delete-page-btn';
                     deleteBtn.title = 'حذف الصفحة';
                     deleteBtn.addEventListener('click', (e) => {
                         e.stopPropagation();
                         deletePage(parseInt(item.dataset.index));
                     });
                     item.appendChild(deleteBtn);
                 } else {
                      // Update event listener for existing delete button
                     // Remove old listener first to avoid duplicates
                     const oldListener = e => { e.stopPropagation(); deletePage(parseInt(item.dataset.index)); };
                      // This approach to removing listeners added anonymously is tricky.
                      // A better approach would be to store listeners or use event delegation.
                      // For simplicity here, we'll just add the new listener, which might lead to multiple listeners if not careful.
                      // A robust solution needs a different event handling strategy for dynamically added/updated elements.

                     deleteBtn.addEventListener('click', (e) => {
                         e.stopPropagation();
                         deletePage(parseInt(item.dataset.index));
                     });
                 }
             }
        }


        // Switch to an adjacent page if the deleted page was the current one
        if (currentPage === pageIndex) {
            switchToPage(Math.max(0, pageIndex - 1));
        } else if (currentPage > pageIndex) {
            // If a page before the current one was deleted, adjust the current page index
            currentPage--;
             updatePageIndicator(); // Update indicator immediately
        } else {
             updatePageIndicator(); // Update indicator if a page after the current one was deleted
        }


        updateUndoRedoButtons(); // Update button states
        console.log(`تم حذف الصفحة ${pageIndex + 1}`);
    }
}


function switchToPage(pageIndex) {
  if (pageIndex < 0 || pageIndex >= pages.length || pageIndex === currentPage) {
    // console.error("فهرس الصفحة غير صالح أو هي الصفحة الحالية");
    return;
  }

  // Hide all page elements first
  pages.forEach(p => {
      if (p && p.element) { // Add null check
          p.element.style.display = 'none';
      }
  });

  // Show the target page element if it exists
  const targetPage = pages[pageIndex];
  if (targetPage && targetPage.element) { // Add null check
      targetPage.element.style.display = 'block'; // Or 'flex' or 'grid' depending on layout
  } else {
       console.error(`Target page or page element not found for index ${pageIndex}. Cannot switch page.`);
       return; // Exit if target page/element is not found
  }


  currentPage = pageIndex;
  updatePageIndicator();
  updateUndoRedoButtons(); // Update buttons for the new page's history
  updateZoomPercentageDisplay(); // Update zoom display for the new page

  // Update active state in sidebar
  document.querySelectorAll(".page-item").forEach((item) => {
    item.classList.toggle("active", parseInt(item.dataset.index) === pageIndex);
  });

  // Apply the specific pan/zoom transform for this page
  applyTransform(targetPage);

  // Ensure the correct cursor is set for the newly active canvas
  setCanvasCursor(currentTool);

  console.log(`تم الانتقال إلى الصفحة ${pageIndex + 1}`);
}


function updatePageIndicator() {
  if (pageIndicator) { // Add null check for pageIndicator
      pageIndicator.textContent = `${currentPage + 1} / ${pages.length}`;
  }
}

// -------------------- وظائف الحفظ والتصدير --------------------

async function saveAsPdf() {
    if (typeof html2canvas === 'undefined' || typeof jspdf === 'undefined') {
        alert('خطأ: مكتبات PDF غير محملة.');
        console.error('html2canvas or jspdf not loaded');
        return;
    }
    if (pages.length === 0) {
        alert('لا يوجد صفحات للحفظ.');
        return;
    }

    const { jsPDF } = jspdf;
    // Create PDF in A4 size, portrait orientation
     // Ensure the first page's canvas exists before getting dimensions
    if (!pages[0] || !pages[0].canvas) {
         console.error("First page or its canvas not found. Cannot create PDF.");
         alert('حدث خطأ: لا يمكن العثور على بيانات الصفحة لإنشاء PDF.');
         return;
    }

    const pdf = new jsPDF({
        orientation: 'p', // portrait
        unit: 'px', // use pixels
        format: [pages[0].canvas.width, pages[0].canvas.height] // Use first page's canvas dimensions
    });

    const pdfFileNameInput = document.getElementById('file-name');
    const pdfFileName = (pdfFileNameInput ? pdfFileNameInput.value : '') || 'السبورة الذكية';


     // Show loading indicator if you have one
     // document.getElementById('loading-overlay')?.classList.add('show');


    try {
        for (let i = 0; i < pages.length; i++) {
            const pageData = pages[i];
             if (!pageData || !pageData.canvas) { // Add null check
                 console.error(`Page data or canvas not found for page index ${i}. Skipping page.`);
                 continue; // Skip this page if data is missing
             }
            const canvas = pageData.canvas;

            // Ensure the canvas content is up-to-date visually if needed
             // (This might not be necessary if drawing directly)

            // Add the canvas image to the PDF
             const imgData = canvas.toDataURL('image/png'); // Get image data

            if (i > 0) {
                pdf.addPage([canvas.width, canvas.height], 'p');
            }

            // Add the image to the current PDF page
             // Position at 0,0 with dimensions matching the canvas
             pdf.addImage(imgData, 'PNG', 0, 0, canvas.width, canvas.height);
             console.log(`تمت إضافة الصفحة ${i + 1} إلى PDF`);

             // Add a small delay between pages if needed for performance
             await new Promise(resolve => setTimeout(resolve, 50));
        }

        // Save the PDF
        pdf.save(`${pdfFileName}.pdf`);
        console.log(`تم حفظ الملف ${pdfFileName}.pdf`);
        alert(`تم حفظ الملف ${pdfFileName}.pdf بنجاح!`);

    } catch (error) {
        console.error('حدث خطأ أثناء إنشاء ملف PDF:', error);
        alert('حدث خطأ أثناء حفظ الملف كـ PDF.');
    } finally {
        // Hide loading indicator
        // document.getElementById('loading-overlay')?.classList.remove('show');
    }
}


// -------------------- دوال مساعدة --------------------
// Helper function to draw a table grid
function drawTable(ctx, x, y, width, height, rows, cols) {
  if (rows <= 0 || cols <= 0) return; // Prevent drawing invalid tables

  const rowHeight = height / rows;
  const colWidth = width / cols;

  ctx.beginPath();
  ctx.strokeStyle = ctx.strokeStyle; // Use the currently selected stroke style
  ctx.lineWidth = ctx.lineWidth; // Use the currently selected line width

  // Draw horizontal lines
  for (let i = 0; i <= rows; i++) {
      ctx.moveTo(x, y + i * rowHeight);
      ctx.lineTo(x + width, y + i * rowHeight);
  }

  // Draw vertical lines
  for (let i = 0; i <= cols; i++) {
      ctx.moveTo(x + i * colWidth, y);
      ctx.lineTo(x + i * colWidth, y + height);
  }

  ctx.stroke();
}
function hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
    } : null;
}

function rgbToHex(r, g, b) {
    return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1).toUpperCase();
}
// Helper to get HEX from style like "rgb(255, 0, 0)"
function rgbToHexFromStyle(rgbString) {
    if (!rgbString || !rgbString.startsWith('rgb')) return rgbString; // Return original if not rgb
    const rgbValues = rgbString.match(/\d+/g);
    if (rgbValues && rgbValues.length === 3) {
        return rgbToHex(parseInt(rgbValues[0]), parseInt(rgbValues[1]), parseInt(rgbValues[2]));
    }
    return rgbString; // Return original if parsing fails
}

// Helper function to draw an arrow
function drawArrow(ctx, fromX, fromY, toX, toY) {
  const headLength = 15; // Length of the arrow head sides
  const angle = Math.atan2(toY - fromY, toX - fromX);

  // Draw the main line
  ctx.beginPath();
  ctx.moveTo(fromX, fromY);
  ctx.lineTo(toX, toY);
  ctx.stroke();

  // Draw the arrow head (two lines at an angle to the end of the main line)
  ctx.beginPath();
  ctx.moveTo(toX, toY);
  ctx.lineTo(
    toX - headLength * Math.cos(angle - Math.PI / 6), // Angle - 30 degrees
    toY - headLength * Math.sin(angle - Math.PI / 6)
  );
  ctx.moveTo(toX, toY);
  ctx.lineTo(
    toX - headLength * Math.cos(angle + Math.PI / 6), // Angle + 30 degrees
    toY - headLength * Math.sin(angle + Math.PI / 6)
  );
  ctx.stroke();
}

// -------------------- بدء تشغيل التطبيق --------------------

window.addEventListener("load", initApp);
