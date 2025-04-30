/**
 * Smart Whiteboard - Touch Events Functionality
 * Handles touch interactions for drawing, highlighting, erasing, and panning.
 */

// Ensure this script runs after the main Script.js and can access its variables and functions.
// Variables like pages, currentPage, currentTool, currentColor, currentSize,
// isDrawing, isPanning, panStartX, panStartY, drawStartX, drawStartY,
// savedCanvasState, highlightPoints, penPoints are assumed to be globally available from Script.js.
// Functions like getMousePos, saveToHistory, updateUndoRedoButtons, applyTransform,
// drawArrow, drawTable are also assumed to be globally available.

document.addEventListener('DOMContentLoaded', () => {
    // It's better to attach touch listeners after pages are created in initApp
    // We can add a function call in Script.js initApp or listen for a custom event
    // or simply wait a moment, but a cleaner way is to integrate this into the page creation process.

    // Let's define the touch event handlers first
    const handleTouchStart = (e) => {
        // Prevent default to avoid scrolling and zooming while drawing/panning
        e.preventDefault();

        const canvas = e.target;
        const pageIndex = pages.findIndex(p => p.canvas === canvas);
        const page = pages[pageIndex];

        if (!page || !page.ctx) {
            console.error(`Page object or context not found for touchstart on canvas.`);
            return;
        }

        // Handle multi-touch for panning (optional, current pan is single-touch mouse based)
        if (e.touches.length > 1 && currentTool === 'pan') {
             // Simple multi-touch pan: Use the first touch point for pan start
             // More advanced multi-touch pan/zoom would track distance/center of touches
            isPanning = true;
            const touch = e.touches[0];
            // Calculate pan start relative to the viewport, considering current transform
            const rect = canvas.getBoundingClientRect();
            panStartX = touch.clientX - rect.left - page.translateX;
            panStartY = touch.clientY - rect.top - page.translateY;

            canvas.classList.add("active"); // grabbing cursor
            return; // Don't draw when panning
        }


        // Handle single touch for drawing/shaping tools
        if (e.touches.length === 1 && currentTool !== 'pan') {
            isDrawing = true;
            const touch = e.touches[0];
            const pos = getMousePos(canvas, touch, page.scale, page.translateX, page.translateY); // Use the adapted getMousePos

            [lastX, lastY] = [pos.x, pos.y];
            drawStartX = pos.x;
            drawStartY = pos.y;

            // Save the canvas state before starting any drawing action
            savedCanvasState = page.ctx.getImageData(0, 0, canvas.width, canvas.height);

             // Add logic for 'table' tool touch start
            if (currentTool === 'table') {
                const rows = parseInt(document.getElementById('table-rows').value);
                const cols = parseInt(document.getElementById('table-cols').value);
                 page.tableInfo = { startX: drawStartX, startY: drawStartY, rows: rows, cols: cols };
                 console.log(`Drawing table with ${rows} rows and ${cols} columns on touchstart`);
            }


             // Prepare context for drawing (pen, eraser, highlight)
            if (currentTool === 'pen' || currentTool === 'eraser' || currentTool === 'highlight') {
                 page.ctx.beginPath();

                 if (currentTool === 'highlight') {
                     highlightPoints = [{ x: pos.x, y: pos.y }];
                 } else if (currentTool === 'pen') {
                      penPoints = [{ x: pos.x, y: pos.y }];
                 }

                 page.ctx.lineWidth = currentSize;
                 page.ctx.strokeStyle = currentColor;
                 page.ctx.globalAlpha = 1.0;

                if (currentTool === 'eraser') {
                    page.ctx.globalCompositeOperation = 'destination-out';
                    page.ctx.lineWidth = currentSize * 1.5;
                     page.ctx.moveTo(lastX, lastY);
                } else if (currentTool === 'highlight') {
                    page.ctx.strokeStyle = currentColor;
                    page.ctx.globalAlpha = 0.5;
                    page.ctx.globalCompositeOperation = 'source-over';
                    page.ctx.lineWidth = currentSize * 5;
                } else if (currentTool === 'pen') {
                     page.ctx.globalCompositeOperation = 'source-over';
                     page.ctx.strokeStyle = currentColor;
                     page.ctx.lineWidth = currentSize;
                     page.ctx.globalAlpha = 1.0;
                }
            }
        }
    };

    const handleTouchMove = (e) => {
        e.preventDefault(); // Prevent scrolling

        const canvas = e.target;
        const pageIndex = pages.findIndex(p => p.canvas === canvas);
        const page = pages[pageIndex];

         if (!page || !page.ctx || !page.canvas) {
              console.error(`Page object, context, or canvas not found for touchmove on canvas.`);
              return;
         }
         const ctx = page.ctx;


        if (isPanning && e.touches.length > 0) {
            const touch = e.touches[0];
            const rect = canvas.getBoundingClientRect();
             // Calculate new translate values based on touch movement relative to pan start
            page.translateX = (touch.clientX - rect.left) - panStartX;
            page.translateY = (touch.clientY - rect.top) - panStartY;

            applyTransform(page); // Update visual position
            return;
        }

        if (!isDrawing || e.touches.length === 0) return;

        const touch = e.touches[0];
        const pos = getMousePos(page.canvas, touch, page.scale, page.translateX, page.translateY);


        if (currentTool === 'pen' || currentTool === 'highlight') {
             const points = currentTool === 'pen' ? penPoints : highlightPoints;
             points.push({ x: pos.x, y: pos.y });

             if (savedCanvasState) {
                 ctx.putImageData(savedCanvasState, 0, 0);
             }

            ctx.strokeStyle = currentColor;
            ctx.globalCompositeOperation = 'source-over';

            if (currentTool === 'highlight') {
                 ctx.lineWidth = currentSize * 5;
                 ctx.globalAlpha = 0.5;
            } else if (currentTool === 'pen') {
                 ctx.lineWidth = currentSize;
                 ctx.globalAlpha = 1.0;
            }


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
                ctx.lineTo(pos.x, pos.y);
                 ctx.stroke();
             }

        } else if (currentTool === 'eraser') {
             const ctx = page.ctx;
             ctx.lineTo(pos.x, pos.y);
             ctx.stroke();
            [lastX, lastY] = [pos.x, pos.y];
        }
        else if (currentTool === 'rect' || currentTool === 'circle' || currentTool === 'line' || currentTool === 'arrow' || currentTool === 'table') {
           if (savedCanvasState) {
               ctx.putImageData(savedCanvasState, 0, 0);
           }

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
            } else if (currentTool === 'table' && page.tableInfo) {
                 // Draw table preview
                 drawTable(ctx, page.tableInfo.startX, page.tableInfo.startY, width, height, page.tableInfo.rows, page.tableInfo.cols);
            }
            ctx.closePath();
        }
    };

    const handleTouchEnd = (e) => {
        e.preventDefault(); // Prevent default behavior

        const canvas = e.target;
        const pageIndex = pages.findIndex(p => p.canvas === canvas);
        const page = pages[pageIndex];

        if (!page || !page.ctx || !page.canvas) {
             console.error(`Page object, context, or canvas not found for touchend on canvas.`);
             savedCanvasState = null;
             isDrawing = false;
             isPanning = false;
             canvas.classList.remove("active");
             // Clear temporary points arrays in case of error
             if (currentTool === 'pen') penPoints = [];
             if (currentTool === 'highlight') highlightPoints = [];
             if (page && page.tableInfo) delete page.tableInfo;
             return;
        }

         // Check if the touch that ended was the one being used for drawing/panning
         // This is important for multi-touch scenarios. For single touch, e.changedTouches[0] is the relevant touch.
         if (isPanning && e.changedTouches.length === 1) { // Assuming single touch pan
             isPanning = false;
             canvas.classList.remove("active");
              savedCanvasState = null; // Clear any saved state from potential pan start
              // No history save needed for pan transforms as they are applied directly
              return;
         }

        if (!isDrawing || e.changedTouches.length === 0) {
            // If drawing wasn't active or no touches ended, just return
            return;
        }
        isDrawing = false;

        const ctx = page.ctx;
        const touch = e.changedTouches[0]; // Get the touch that ended
        const pos = getMousePos(page.canvas, touch, page.scale, page.translateX, page.translateY);


         if (currentTool === 'pen' || currentTool === 'highlight') {
              if (savedCanvasState) {
                ctx.putImageData(savedCanvasState, 0, 0);
                savedCanvasState = null;
              }

             const points = currentTool === 'pen' ? penPoints : highlightPoints;

             ctx.strokeStyle = currentColor;
             ctx.globalCompositeOperation = 'source-over';

             if (currentTool === 'highlight') {
                 ctx.lineWidth = currentSize * 5;
                 ctx.globalAlpha = 0.5;
             } else if (currentTool === 'pen') {
                 ctx.lineWidth = currentSize;
                 ctx.globalAlpha = 1.0;
             }

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
                ctx.lineTo(pos.x, pos.y);
                 ctx.stroke();
             } else if (points.length === 1) {
                 // Draw a dot if there's only one point (tap)
                 ctx.beginPath();
                 ctx.arc(points[0].x, points[0].y, ctx.lineWidth / 2, 0, Math.PI * 2);
                 ctx.fillStyle = ctx.strokeStyle;
                 ctx.fill();
             }


            if (currentTool === 'pen') penPoints = []; // Clear pen points
            if (currentTool === 'highlight') highlightPoints = []; // Clear highlight points

            saveToHistory(pageIndex); // Save state after drawing

         } else if (currentTool === 'eraser') {
             ctx.closePath();
             saveToHistory(pageIndex);
              savedCanvasState = null;
         }
         else if (currentTool === 'rect' || currentTool === 'circle' || currentTool === 'line' || currentTool === 'arrow' || currentTool === 'table') {
             if (savedCanvasState) {
                ctx.putImageData(savedCanvasState, 0, 0);
                savedCanvasState = null;
             }

             ctx.strokeStyle = currentColor;
             ctx.lineWidth = currentSize;
             ctx.globalAlpha = 1.0;
             ctx.globalCompositeOperation = 'source-over';


             const width = pos.x - drawStartX;
             const height = pos.y - drawStartY;

             // Only draw shape/table if there was significant movement (not just a tap)
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
                 } else if (currentTool === 'table' && page.tableInfo) {
                      drawTable(ctx, page.tableInfo.startX, page.tableInfo.startY, width, height, page.tableInfo.rows, page.tableInfo.cols);
                     delete page.tableInfo;
                 }
                 ctx.closePath();

                saveToHistory(pageIndex); // Save after drawing the shape/table
             } else {
                 // If it was just a tap, clear the temporary table info if it exists
                 if (currentTool === 'table' && page.tableInfo) {
                     delete page.tableInfo;
                 }
             }
         }

        // Reset composite operation and alpha
        ctx.globalCompositeOperation = 'source-over';
        ctx.globalAlpha = 1.0;

        // Clear redo stack for the current page whenever a new action is performed
        page.redoStack = [];
        updateUndoRedoButtons();
    };

     const handleTouchCancel = (e) => {
        e.preventDefault(); // Prevent default behavior

        const canvas = e.target;
        const pageIndex = pages.findIndex(p => p.canvas === canvas);
        const page = pages[pageIndex];

        if (!page || !page.ctx) {
             console.error(`Page object or context not found for touchcancel on canvas.`);
             savedCanvasState = null;
             isDrawing = false;
             isPanning = false;
             canvas.classList.remove("active");
             // Clear temporary points arrays in case of cancel
             if (currentTool === 'pen') penPoints = [];
             if (currentTool === 'highlight') highlightPoints = [];
             if (page && page.tableInfo) delete page.tableInfo;
             return;
        }

         // If drawing or panning was in progress, cancel it
        if (isDrawing || isPanning) {
             console.log(`Touch cancelled during ${isDrawing ? 'drawing' : 'panning'}. Restoring canvas.`);

            // Restore the canvas state to before the touch started
            if (savedCanvasState) {
               page.ctx.putImageData(savedCanvasState, 0, 0);
               savedCanvasState = null;
            }

             isDrawing = false;
             isPanning = false;
             canvas.classList.remove("active"); // Remove grabbing cursor

             // Clear any temporary points or table info
             if (currentTool === 'pen') penPoints = [];
             if (currentTool === 'highlight') highlightPoints = [];
             if (page.tableInfo) delete page.tableInfo;


            // No history save on cancel - just revert to the previous state
            // The state before the touch was saved in touchstart (as savedCanvasState)
            // and we've just restored it.
        }

         // Reset composite operation and alpha
         page.ctx.globalCompositeOperation = 'source-over';
         page.ctx.globalAlpha = 1.0;

         updateUndoRedoButtons(); // Update button states as history might have been affected by restore
     };


    // Now, attach these listeners to all canvases.
    // Since pages are created dynamically, the best place to add these listeners
    // is within the `createNewPage` function in Script.js, right after creating the canvas.
    // However, to make this separate file work, we add a function here that can be called from Script.js

    window.addTouchEventListenersToCanvas = function(canvas, pageIndex) {
        if (!canvas) {
            console.error("Cannot add touch event listeners: canvas is null.");
            return;
        }
        // Check if listeners are already added to avoid duplicates
        if (canvas.dataset.touchListenersAdded) {
            return;
        }

        canvas.addEventListener("touchstart", handleTouchStart);
        canvas.addEventListener("touchmove", handleTouchMove);
        canvas.addEventListener("touchend", handleTouchEnd);
        canvas.addEventListener("touchcancel", handleTouchCancel);

        canvas.dataset.touchListenersAdded = 'true'; // Mark as added
        console.log(`Touch event listeners added to canvas for page ${pageIndex + 1}.`);
    };


    // Attach listeners to any canvases that might exist when this script loads initially
    // This is a fallback/initial attachment, but the main attachment should be in createNewPage
    document.querySelectorAll('.page canvas').forEach((canvas, index) => {
         // Ensure the page data exists before attempting to add listeners
         if (pages[index]) {
              window.addTouchEventListenersToCanvas(canvas, index);
         }
    });

});