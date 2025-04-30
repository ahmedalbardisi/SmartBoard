/**
 * Smart Whiteboard - Touch Events Functionality
 * Handles touch interactions for drawing, highlighting, erasing, and panning/zooming.
 */

// Ensure this script runs after the main Script.js and can access its variables and functions.
// Variables like pages, currentPage, currentTool, currentColor, currentSize,
// isDrawing, isPanning, panStartX, panStartY, drawStartX, drawStartY,
// savedCanvasState, highlightPoints, penPoints are assumed to be globally available from Script.js.
// Functions like getMousePos, saveToHistory, updateUndoRedoButtons, applyTransform,
// drawArrow, drawTable are also assumed to be globally available.

// New variables for multi-touch and zooming
let isZooming = false;
let initialPinchDistance = 0;
let initialPinchCenter = { x: 0, y: 0 };
let initialPanTranslateX = 0;
let initialPanTranslateY = 0;
let initialPanScale = 0;


document.addEventListener('DOMContentLoaded', () => {
    // It's better to attach touch listeners after pages are created in initApp
    // We can add a function call in Script.js initApp or listen for a custom event
    // or simply wait a moment, but a cleaner way is to integrate this into the page creation process.

    // Let's define the touch event handlers first
    const handleTouchStart = (e) => {
        // Prevent default to avoid scrolling and zooming while interacting with the canvas
        e.preventDefault();

        const canvas = e.target;
        const pageIndex = pages.findIndex(p => p.canvas === canvas);
        const page = pages[pageIndex];

        if (!page || !page.ctx) {
            console.error(`Page object or context not found for touchstart on canvas.`);
            return;
        }

        const touches = e.touches;

        if (touches.length === 2) {
            // Two fingers: Check tool for Pan vs Zoom
            const touch1 = touches[0];
            const touch2 = touches[1];

            const dist = Math.sqrt(Math.pow(touch2.clientX - touch1.clientX, 2) + Math.pow(touch2.clientY - touch1.clientY, 2));
            initialPinchDistance = dist;
            initialPinchCenter = {
                x: (touch1.clientX + touch2.clientX) / 2,
                y: (touch1.clientY + touch2.clientY) / 2
            };
            initialPanTranslateX = page.translateX;
            initialPanTranslateY = page.translateY;
            initialPanScale = page.scale;


            if (currentTool === 'pan') {
                // Pan tool active: two fingers for Zoom
                isZooming = true;
                isPanning = false; // Ensure pan flag is off
                 isDrawing = false; // Ensure drawing flag is off
                 canvas.classList.remove("active"); // Remove pan cursor
                 savedCanvasState = null; // Clear any saved state from potential drawing start

            } else {
                // Drawing/Shape tool active: two fingers for Pan
                isPanning = true;
                isZooming = false; // Ensure zoom flag is off
                isDrawing = false; // Ensure drawing flag is off
                 canvas.classList.add("active"); // Add grabbing cursor
                 savedCanvasState = null; // Clear any saved state from potential drawing start

                 // Use the average position of the two touches for initial pan start
                 const centerPos = getMousePos(canvas, { clientX: initialPinchCenter.x, clientY: initialPinchCenter.y }, page.scale, page.translateX, page.translateY);
                 panStartX = centerPos.x * page.scale - page.translateX; // Calculate pan start relative to the canvas element's current position
                 panStartY = centerPos.y * page.scale - page.translateY; // Considering the canvas element's bounding client rect offset later.

                 // A simpler approach for panStartX/Y in multi-touch pan:
                 // panStartX = initialPinchCenter.x - page.translateX;
                 // panStartY = initialPinchCenter.y - page.translateY;


            }
        } else if (touches.length === 1) {
            // One finger: Check tool for Pan vs Draw/Shape
            isZooming = false; // Ensure zoom flag is off
            isPanning = false; // Ensure pan flag is off

            if (currentTool === 'pan') {
                // Pan tool active: one finger for Pan
                isPanning = true;
                isDrawing = false; // Ensure drawing flag is off
                canvas.classList.add("active"); // Add grabbing cursor
                 savedCanvasState = null; // Clear any saved state

                const touch = touches[0];
                 const rect = canvas.getBoundingClientRect(); // Get canvas position relative to viewport
                // Calculate pan start relative to the canvas's current transformed position
                panStartX = touch.clientX - rect.left - page.translateX;
                panStartY = touch.clientY - rect.top - page.translateY;


            } else {
                // Drawing/Shape tool active: one finger for Draw/Shape
                isDrawing = true;
                isPanning = false; // Ensure pan flag is off
                 canvas.classList.remove("active"); // Remove pan cursor


                const touch = touches[0];
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
         const touches = e.touches;


         if (isZooming && touches.length === 2) {
             // Two fingers and in zoom mode (Pan tool active)
             const touch1 = touches[0];
             const touch2 = touches[1];
             const currentDist = Math.sqrt(Math.pow(touch2.clientX - touch1.clientX, 2) + Math.pow(touch2.clientY - touch1.clientY, 2));

             if (initialPinchDistance === 0) {
                 // Handle cases where touchstart might have been missed or only had one touch initially
                 initialPinchDistance = currentDist;
                 initialPinchCenter = {
                    x: (touch1.clientX + touch2.clientX) / 2,
                    y: (touch1.clientY + touch2.clientY) / 2
                };
                initialPanTranslateX = page.translateX;
                initialPanTranslateY = page.translateY;
                initialPanScale = page.scale;
                return; // Avoid zooming immediately on the first move after a potential missed start
             }

             const scaleChange = currentDist / initialPinchDistance;
             const newScale = initialPanScale * scaleChange;

             // Clamp scale to reasonable limits
             page.scale = Math.max(0.2, Math.min(5, newScale));

             // Calculate new translate to zoom towards the pinch center
             const canvasRect = canvas.getBoundingClientRect();
             const currentPinchCenter = {
                 x: (touch1.clientX + touch2.clientX) / 2,
                 y: (touch1.clientY + touch2.clientY) / 2
             };

             // Position of the pinch center relative to the canvas's top-left corner in viewport coordinates
             const centerInCanvasViewportX = currentPinchCenter.x - canvasRect.left;
             const centerInCanvasViewportY = currentPinchCenter.y - canvasRect.top;

              // Position of the pinch center in the original (unscaled, untranslated) canvas coordinates
             const centerInCanvasOriginalX = (centerInCanvasViewportX - initialPanTranslateX) / initialPanScale;
             const centerInCanvasOriginalY = (centerInCanvasViewportY - initialPanTranslateY) / initialPanScale;


             // Calculate the new translate values to keep the center point fixed relative to the canvas content
             page.translateX = currentPinchCenter.x - canvasRect.left - (centerInCanvasOriginalX * page.scale);
             page.translateY = currentPinchCenter.y - canvasRect.top - (centerInCanvasOriginalY * page.scale);


             applyTransform(page); // Apply the new scale and translate
             return;
         }


        if (isPanning && touches.length > 0) { // Handle both one and two-finger pan here
            const touch = touches[0]; // Use the first touch for pan calculation
            const rect = canvas.getBoundingClientRect();
             // Calculate new translate values based on touch movement relative to pan start
            page.translateX = (touch.clientX - rect.left) - panStartX;
            page.translateY = (touch.clientY - rect.top) - panStartY;

            applyTransform(page); // Update visual position
            return;
        }

        if (!isDrawing || touches.length === 0) return; // Only draw if in drawing mode and touches are active

        const touch = touches[0];
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
             ctx.lineTo(pos.x, pos.x); // Should be pos.x, pos.y
             ctx.lineTo(pos.x, pos.y); // Corrected line
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
             // Attempt to reset state even in case of error
             savedCanvasState = null;
             isDrawing = false;
             isPanning = false;
             isZooming = false;
             initialPinchDistance = 0;
             canvas.classList.remove("active");
             // Clear temporary points arrays in case of error
             if (currentTool === 'pen') penPoints = [];
             if (currentTool === 'highlight') highlightPoints = [];
             if (page && page.tableInfo) delete page.tableInfo;
             return;
        }

         // Check the number of active touches remaining
         const touchesRemaining = e.touches.length;

         if (isZooming && touchesRemaining < 2) {
              // Zooming ended (at least one of the two fingers was lifted)
              isZooming = false;
              initialPinchDistance = 0; // Reset pinch distance
              savedCanvasState = null; // Clear any saved state
              // Pan/Zoom transforms are applied live, no separate history save here.
              console.log(`Zooming ended on page ${pageIndex + 1}`);
              return; // Exit as zoom handling is complete
         }

        if (isPanning && touchesRemaining < ((currentTool === 'pan') ? 1 : 2) ) {
            // Panning ended:
            // If Pan tool active: one finger pan ends when touch count < 1 (i.e., 0)
            // If Draw/Shape tool active: two finger pan ends when touch count < 2 (i.e., 0 or 1)
             isPanning = false;
             canvas.classList.remove("active"); // Remove grabbing cursor
             savedCanvasState = null; // Clear any saved state
            console.log(`Panning ended on page ${pageIndex + 1}`);
             return; // Exit as pan handling is complete
        }

        // If we are still here, it might be the end of a drawing/shaping gesture (one finger, non-pan tool)
        if (!isDrawing || touchesRemaining > 0) {
             // If drawing wasn't active, or if there are still touches active (meaning it was part of a multi-touch gesture that is not fully ended yet)
            // Note: With the new logic, drawing is only active for single touches when tool is not 'pan'.
            // If a second finger is added during drawing, isDrawing is set to false in touchstart for 2 fingers.
            // So, if touchesRemaining > 0 here, it's a transition state, not the end of a drawing stroke.
             console.log("TouchEnd during multi-touch or not in drawing mode.");
            return;
        }

        // Finalize drawing/shaping
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
                 // If it was a tap with a drawing tool, save a dot if applicable (already handled above for pen/highlight)
                 // For shapes/eraser, a tap might not result in a visible mark, and that's okay.
             }
         }

        // Reset composite operation and alpha
        ctx.globalCompositeOperation = 'source-over';
        ctx.globalAlpha = 1.0;

        // Clear redo stack for the current page whenever a new action is performed
        page.redoStack = [];
        updateUndoRedoButtons();
        console.log(`Drawing/Shaping ended on page ${pageIndex + 1}`);
    };

     const handleTouchCancel = (e) => {
        e.preventDefault(); // Prevent default behavior

        const canvas = e.target;
        const pageIndex = pages.findIndex(p => p.canvas === canvas);
        const page = pages[pageIndex];

        if (!page || !page.ctx) {
             console.error(`Page object or context not found for touchcancel on canvas.`);
             // Attempt to reset state even in case of error
             savedCanvasState = null;
             isDrawing = false;
             isPanning = false;
             isZooming = false;
             initialPinchDistance = 0;
             canvas.classList.remove("active");
             // Clear temporary points arrays in case of cancel
             if (currentTool === 'pen') penPoints = [];
             if (currentTool === 'highlight') highlightPoints = [];
             if (page && page.tableInfo) delete page.tableInfo;
             return;
        }

         console.log(`Touch cancelled on page ${pageIndex + 1}. Restoring canvas.`);

        // Restore the canvas state to before the touch started for drawing/shaping
        if (isDrawing && savedCanvasState) {
           page.ctx.putImageData(savedCanvasState, 0, 0);
           savedCanvasState = null;
        }

         // Reset all touch state flags
         isDrawing = false;
         isPanning = false;
         isZooming = false;
         initialPinchDistance = 0;


         canvas.classList.remove("active"); // Remove grabbing cursor


         // Clear any temporary points or table info
         if (currentTool === 'pen') penPoints = [];
         if (currentTool === 'highlight') highlightPoints = [];
         if (page.tableInfo) delete page.tableInfo;


        // No history save on cancel - just revert to the previous state
        // The state before the touch was saved in touchstart (as savedCanvasState)
        // and we've just restored it if it was a drawing/shaping action.

         // Reset composite operation and alpha
         page.ctx.globalCompositeOperation = 'source-over';
         page.ctx.globalAlpha = 1.0;

         updateUndoRedoButtons(); // Update button states
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
