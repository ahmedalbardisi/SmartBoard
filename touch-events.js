/**
 * Smart Whiteboard - Touch Events Functionality
 * Handles touch interactions for drawing, highlighting, erasing, and panning, and zooming.
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
    let initialPinchDistance = null; // Variable to store the distance between two fingers at the start of a pinch
    let isZooming = false; // Flag to indicate if the user is currently zooming

    const handleTouchStart = (e) => {
        // Prevent default to avoid scrolling and zooming while drawing/panning
        // e.preventDefault(); // We will handle preventing default more selectively now

        const canvas = e.target;
        const pageIndex = pages.findIndex(p => p.canvas === canvas);
        const page = pages[pageIndex];

        if (!page || !page.ctx) {
            console.error(`Page object or context not found for touchstart on canvas.`);
            return;
        }

        // Handle multi-touch for zooming
        if (e.touches.length === 2) {
            e.preventDefault(); // Prevent default zoom/scroll for two touches
            isZooming = true;
            // Calculate the distance between the two touch points
            initialPinchDistance = Math.hypot(
                e.touches[1].clientX - e.touches[0].clientX,
                e.touches[1].clientY - e.touches[0].clientY
            );
            // Stop any ongoing drawing or panning when starting to zoom
            isDrawing = false;
            isPanning = false;
            canvas.classList.remove("active"); // Remove grabbing cursor
            savedCanvasState = null; // Clear saved state
             if (currentTool === 'pen') penPoints = []; // Clear temporary points arrays
             if (currentTool === 'highlight') highlightPoints = [];
             if (page.tableInfo) delete page.tableInfo;
            return; // Don't proceed with drawing/panning logic
        }


        // Handle single touch for panning
        if (e.touches.length === 1 && currentTool === 'pan') {
            e.preventDefault(); // Prevent default scroll for single touch when panning
            isPanning = true;
            const touch = e.touches[0];
            // Calculate pan start relative to the viewport, considering current transform
            const rect = canvas.getBoundingClientRect();
            panStartX = touch.clientX - rect.left - page.translateX;
            panStartY = touch.clientY - rect.top - page.translateY;

            canvas.classList.add("active"); // grabbing cursor
            // Stop any ongoing drawing or zooming when starting to pan
            isDrawing = false;
            isZooming = false;
            savedCanvasState = null; // Clear saved state
            if (currentTool === 'pen') penPoints = []; // Clear temporary points arrays
            if (currentTool === 'highlight') highlightPoints = [];
            if (page.tableInfo) delete page.tableInfo;
            return; // Don't proceed with drawing logic
        }


        // Handle single touch for drawing/shaping tools
        if (e.touches.length === 1 && currentTool !== 'pan' && !isZooming && !isPanning) {
            e.preventDefault(); // Prevent default scroll for single touch when drawing/shaping
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
        // e.preventDefault(); // Prevent default scrolling - handled selectively now

        const canvas = e.target;
        const pageIndex = pages.findIndex(p => p.canvas === canvas);
        const page = pages[pageIndex];

         if (!page || !page.ctx || !page.canvas) {
              console.error(`Page object, context, or canvas not found for touchmove on canvas.`);
              return;
         }
         const ctx = page.ctx;

         // Handle zooming with two fingers
         if (isZooming && e.touches.length === 2 && initialPinchDistance !== null) {
             e.preventDefault(); // Prevent default zoom/scroll for two touches
             const currentPinchDistance = Math.hypot(
                 e.touches[1].clientX - e.touches[0].clientX,
                 e.touches[1].clientY - e.touches[0].clientY
             );

             const scaleFactor = currentPinchDistance / initialPinchDistance;

             // Apply the scale factor relative to the current scale
             page.scale = Math.max(0.2, Math.min(5, page.scale * scaleFactor)); // Limit zoom between 0.2x and 5x

             // Optional: Adjust translation to zoom towards the center of the pinch
             // This is more complex and requires tracking the center of the two touches
             // For simplicity, we'll just apply the scale for now.

             applyTransform(page); // Update visual scale
             initialPinchDistance = currentPinchDistance; // Update initial distance for continuous zooming
             return; // Don't proceed with drawing/panning logic
         }


        if (isPanning && e.touches.length > 0) {
             e.preventDefault(); // Prevent default scroll for single touch when panning
            const touch = e.touches[0];
            const rect = canvas.getBoundingClientRect();
             // Calculate new translate values based on touch movement relative to pan start
            page.translateX = (touch.clientX - rect.left) - panStartX;
            page.translateY = (touch.clientY - rect.top) - panStartY;

            applyTransform(page); // Update visual position
            return;
        }

        if (!isDrawing || e.touches.length === 0 || isZooming || isPanning) return; // Only draw if drawing is active and not zooming/panning


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
        // e.preventDefault(); // Prevent default behavior - handled selectively now

        const canvas = e.target;
        const pageIndex = pages.findIndex(p => p.canvas === canvas);
        const page = pages[pageIndex];

        if (!page || !page.ctx || !page.canvas) {
             console.error(`Page object, context, or canvas not found for touchend on canvas.`);
             savedCanvasState = null;
             isDrawing = false;
             isPanning = false;
             isZooming = false; // Reset zooming flag
             initialPinchDistance = null; // Reset pinch distance
             canvas.classList.remove("active");
             // Clear temporary points arrays in case of error
             if (currentTool === 'pen') penPoints = [];
             if (currentTool === 'highlight') highlightPoints = [];
             if (page && page.tableInfo) delete page.tableInfo;
             return;
        }

         // Check if any touches are still active. If touches.length is 0, all fingers are lifted.
         // If touches.length > 0, some fingers are still down (e.g., one finger lifted from a two-finger gesture).
         if (e.touches.length === 0) {
             // All fingers are lifted, end drawing, panning, or zooming
             isDrawing = false;
             isPanning = false;
             isZooming = false; // Reset zooming flag
             initialPinchDistance = null; // Reset pinch distance
             canvas.classList.remove("active"); // Remove grabbing cursor

             // If drawing was in progress, finalize it
            if (savedCanvasState) {
                ctx.putImageData(savedCanvasState, 0, 0); // Restore state before final draw
                savedCanvasState = null; // Clear saved state
            }

             // Only save to history if a drawing or shape tool was active before the touch ended
             // Panning and Zooming transforms are applied directly and don't need history states in the same way
             if (currentTool !== 'pan' && currentTool !== 'table' && (penPoints.length > 0 || highlightPoints.length > 0 || Math.abs(pos.x - drawStartX) > 2 || Math.abs(pos.y - drawStartY) > 2)) {
                  const touch = e.changedTouches[0]; // Use the touch that ended for the final position
                  const pos = getMousePos(page.canvas, touch, page.scale, page.translateX, page.translateY);

                 if (currentTool === 'pen' || currentTool === 'highlight') {
                     const points = currentTool === 'pen' ? penPoints : highlightPoints;
                     if (points.length > 0) { // Ensure there are points to draw
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
                     }
                 } else if (currentTool === 'eraser') {
                      // Eraser logic is already handled in mousemove, no need to redraw here
                 } else if (currentTool === 'rect' || currentTool === 'circle' || currentTool === 'line' || currentTool === 'arrow' || currentTool === 'table') {
                      // Shape/Table drawing is handled in mousemove/mouseup, but we should save history here if a shape was drawn
                      // Check if a shape was actually drawn (movement occurred)
                      if (Math.abs(pos.x - drawStartX) > 2 || Math.abs(pos.y - drawStartY) > 2) {
                           // Redraw the final shape/table if needed, or ensure it was drawn in mousemove
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
                                 drawTable(ctx, page.tableInfo.startX, page.tableInfo.startY, width, height, page.tableInfo.rows, page.tableInfo.cols);
                                delete page.tableInfo;
                            }
                            ctx.closePath();
                      } else {
                          // If it was just a tap for a shape/table tool, clear temporary table info if it exists
                          if (currentTool === 'table' && page.tableInfo) {
                              delete page.tableInfo;
                          }
                      }
                 }

                 saveToHistory(pageIndex); // Save state after drawing or adding shape/table
             }

             // Clear temporary points arrays and table info regardless of whether drawing occurred
             if (currentTool === 'pen') penPoints = [];
             if (currentTool === 'highlight') highlightPoints = [];
             if (page.tableInfo) delete page.tableInfo;


            // Clear redo stack for the current page whenever a new action is performed (drawing or adding shapes/tables)
            if (currentTool !== 'pan' && currentTool !== 'table') { // Don't clear redo for pan/zoom
                 page.redoStack = [];
            } else if (currentTool === 'table' && (Math.abs(pos.x - drawStartX) > 2 || Math.abs(pos.y - drawStartY) > 2)) {
                // If a table was actually drawn, clear redo stack
                 page.redoStack = [];
            }


             updateUndoRedoButtons();

         } else {
             // If some touches are still active, it might be a multi-touch gesture that is not yet finished,
             // or one finger was lifted during a multi-touch action.
             // We should not end the drawing/panning/zooming state entirely yet.
             // The logic in touchmove will handle the ongoing gesture.
             // When the last finger is lifted (touches.length becomes 0), the block above will execute.
         }


        // Reset composite operation and alpha
        ctx.globalCompositeOperation = 'source-over';
        ctx.globalAlpha = 1.0;

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
             isZooming = false; // Reset zooming flag
             initialPinchDistance = null; // Reset pinch distance
             canvas.classList.remove("active");
             // Clear temporary points arrays in case of cancel
             if (currentTool === 'pen') penPoints = [];
             if (currentTool === 'highlight') highlightPoints = [];
             if (page && page.tableInfo) delete page.tableInfo;
             return;
        }

         // If drawing or panning or zooming was in progress, cancel it
        if (isDrawing || isPanning || isZooming) {
             console.log(`Touch cancelled during ${isDrawing ? 'drawing' : (isPanning ? 'panning' : 'zooming')}. Restoring canvas.`);

            // Restore the canvas state to before the touch started (only relevant for drawing/shapes)
            if (savedCanvasState) {
               page.ctx.putImageData(savedCanvasState, 0, 0);
               savedCanvasState = null;
            }

             isDrawing = false;
             isPanning = false;
             isZooming = false; // Reset zooming flag
             initialPinchDistance = null; // Reset pinch distance
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
