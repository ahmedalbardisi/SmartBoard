/**
 * Smart Whiteboard - Touch Events Functionality
 * Handles touch interactions for drawing, highlighting, erasing, shapes,
 * one-finger panning (when pan tool active), two-finger panning (when pan tool inactive),
 * and two-finger zooming (when pan tool active).
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
    let initialPinchDistance = null; // Variable to store the distance between two fingers at the start of a pinch-to-zoom
    let isZooming = false; // Flag to indicate if the user is currently zooming (two fingers, pan tool active)

    // isPanning is already defined in Script.js and used for single-touch pan
    // We will reuse it for two-finger pan when the pan tool is inactive.
    // We might need to store the number of touches that started the panning gesture
    let panStartTouches = 0; // To know if panning started with one or two fingers

    const handleTouchStart = (e) => {
        // Prevent default scroll/zoom behavior initially, we will handle it
        e.preventDefault();

        const canvas = e.target;
        const pageIndex = pages.findIndex(p => p.canvas === canvas);
        const page = pages[pageIndex];

        if (!page || !page.ctx) {
            console.error(`Page object or context not found for touchstart on canvas.`);
            // Reset any potential active state if page data is missing
             isDrawing = false;
             isPanning = false;
             isZooming = false;
             initialPinchDistance = null;
             panStartTouches = 0;
             canvas.classList.remove("active");
             savedCanvasState = null;
             if (currentTool === 'pen') penPoints = [];
             if (currentTool === 'highlight') highlightPoints = [];
             if (page && page.tableInfo) delete page.tableInfo;
            return;
        }

        // Reset flags at the start of a new touch sequence
        isDrawing = false;
        isPanning = false;
        isZooming = false;
        initialPinchDistance = null;
        panStartTouches = 0;
        canvas.classList.remove("active");
        savedCanvasState = null; // Clear saved state from previous actions


        if (e.touches.length === 1) {
            const touch = e.touches[0];
            const pos = getMousePos(canvas, touch, page.scale, page.translateX, page.translateY);

            if (currentTool === 'pan') {
                // Single touch when pan tool is active -> Panning
                isPanning = true;
                panStartTouches = 1;
                const rect = canvas.getBoundingClientRect();
                panStartX = touch.clientX - rect.left - page.translateX;
                panStartY = touch.clientY - rect.top - page.translateY;
                canvas.classList.add("active"); // grabbing cursor for pan
            } else {
                // Single touch when drawing/shape tool is active -> Drawing/Shape
                isDrawing = true;
                drawStartX = pos.x;
                drawStartY = pos.y;
                savedCanvasState = page.ctx.getImageData(0, 0, canvas.width, canvas.height); // Save state before drawing preview

                // Prepare context for drawing (pen, eraser, highlight) or shape start
                if (currentTool === 'pen' || currentTool === 'eraser' || currentTool === 'highlight') {
                     page.ctx.beginPath();
                     if (currentTool === 'highlight') {
                         highlightPoints = [{ x: pos.x, y: pos.y }];
                     } else if (currentTool === 'pen') {
                          penPoints = [{ x: pos.x, y: pos.y }];
                     }
                     // Set styles in mousemove for preview
                } else if (currentTool === 'table') {
                     const rows = parseInt(document.getElementById('table-rows').value);
                     const cols = parseInt(document.getElementById('table-cols').value);
                     page.tableInfo = { startX: drawStartX, startY: drawStartY, rows: rows, cols: cols };
                     console.log(`Drawing table with ${rows} rows and ${cols} columns on touchstart`);
                }
            }
        } else if (e.touches.length === 2) {
            // Two touches
            if (currentTool === 'pan') {
                // Two touches when pan tool is active -> Zooming
                isZooming = true;
                initialPinchDistance = Math.hypot(
                    e.touches[1].clientX - e.touches[0].clientX,
                    e.touches[1].clientY - e.touches[0].clientY
                );
                // No cursor change needed for zoom, pan cursor is already set if pan tool is active
            } else {
                // Two touches when drawing/shape tool is active -> Panning with two fingers
                isPanning = true;
                panStartTouches = 2;
                 // Calculate pan start based on the center of the two touches
                 const centerX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
                 const centerY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
                 const rect = canvas.getBoundingClientRect();
                 panStartX = centerX - rect.left - page.translateX;
                 panStartY = centerY - rect.top - page.translateY;

                 // Optional: Change cursor for two-finger pan if needed, maybe a different icon?
                 // canvas.classList.add("active"); // Use same grabbing cursor for now
            }
             // Stop any potential drawing that might have been initiated briefly before the second touch
             isDrawing = false;
             savedCanvasState = null;
             if (currentTool === 'pen') penPoints = [];
             if (currentTool === 'highlight') highlightPoints = [];
             if (page.tableInfo) delete page.tableInfo;

        } else if (e.touches.length > 2) {
            // Ignore gestures with more than two touches for now
             isDrawing = false;
             isPanning = false;
             isZooming = false;
             initialPinchDistance = null;
             panStartTouches = 0;
             canvas.classList.remove("active");
             savedCanvasState = null;
             if (currentTool === 'pen') penPoints = [];
             if (currentTool === 'highlight') highlightPoints = [];
             if (page.tableInfo) delete page.tableInfo;
        }
    };

    const handleTouchMove = (e) => {
        e.preventDefault(); // Prevent default scrolling/zooming

        const canvas = e.target;
        const pageIndex = pages.findIndex(p => p.canvas === canvas);
        const page = pages[pageIndex];

         if (!page || !page.ctx || !page.canvas) {
              console.error(`Page object, context, or canvas not found for touchmove on canvas.`);
              return;
         }
         const ctx = page.ctx;

         // Handle zooming (two fingers, pan tool active)
         if (isZooming && e.touches.length === 2 && initialPinchDistance !== null && currentTool === 'pan') {
             const currentPinchDistance = Math.hypot(
                 e.touches[1].clientX - e.touches[0].clientX,
                 e.touches[1].clientY - e.touches[0].clientY
             );

             const scaleFactor = currentPinchDistance / initialPinchDistance;

             // Apply the scale factor relative to the current scale
             const newScale = Math.max(0.2, Math.min(5, page.scale * scaleFactor)); // Limit zoom between 0.2x and 5x

             // Optional: Adjust translation to zoom towards the center of the pinch
             // This is more complex and requires tracking the center of the two touches
             // For simplicity, we'll just apply the scale for now, keeping the existing pan translation.
             // If you need center zooming, this logic needs significant expansion.

             page.scale = newScale; // Update page scale
             applyTransform(page); // Apply the updated scale and existing translation
             initialPinchDistance = currentPinchDistance; // Update initial distance for continuous zooming
             return; // Stop here, handled zoom
         }

         // Handle panning (one finger when pan tool active, OR two fingers when pan tool inactive)
         if (isPanning && e.touches.length > 0) {
             let touch;
             if (panStartTouches === 1 && e.touches.length === 1) {
                 // Continue single-finger pan
                 touch = e.touches[0];
             } else if (panStartTouches === 2 && e.touches.length === 2) {
                  // Continue two-finger pan, use the center of the touches
                  touch = {
                      clientX: (e.touches[0].clientX + e.touches[1].clientX) / 2,
                      clientY: (e.touches[0].clientY + e.touches[1].clientY) / 2
                  };
             } else {
                 // Unexpected touch count change during panning, potentially stop panning
                 // Or just use the first touch as a fallback
                 console.warn(`Unexpected touch count change during panning (started with ${panStartTouches}, now ${e.touches.length}).`);
                 if (e.touches.length > 0) {
                     touch = e.touches[0];
                 } else {
                     // No touches left, handle in touchend
                     return;
                 }
             }


             const rect = canvas.getBoundingClientRect();
             // Calculate new translate values based on touch movement relative to pan start
             page.translateX = (touch.clientX - rect.left) - panStartX;
             page.translateY = (touch.clientY - rect.top) - panStartY;

             applyTransform(page); // Apply the updated translation and existing scale
             return; // Stop here, handled pan
         }

         // Handle drawing/shaping (one finger, not pan tool)
        if (isDrawing && e.touches.length === 1 && currentTool !== 'pan') {
            const touch = e.touches[0];
            const pos = getMousePos(page.canvas, touch, page.scale, page.translateX, page.translateY);

            if (currentTool === 'pen' || currentTool === 'highlight') {
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
        }
         // If none of the above conditions met (e.g., unexpected touch count during a specific gesture), do nothing.
    };

    const handleTouchEnd = (e) => {
        e.preventDefault(); // Prevent default behavior

        const canvas = e.target;
        const pageIndex = pages.findIndex(p => p.canvas === canvas);
        const page = pages[pageIndex];

        if (!page || !page.ctx || !page.canvas) {
             console.error(`Page object, context, or canvas not found for touchend on canvas.`);
             // Reset all flags and states on error
             isDrawing = false;
             isPanning = false;
             isZooming = false;
             initialPinchDistance = null;
             panStartTouches = 0;
             canvas.classList.remove("active");
             savedCanvasState = null;
             if (currentTool === 'pen') penPoints = [];
             if (currentTool === 'highlight') highlightPoints = [];
             if (page && page.tableInfo) delete page.tableInfo;
             return;
        }

         // Check if all fingers are lifted
         if (e.touches.length === 0) {
             // All fingers lifted, finalize the action that was in progress

             // Finalize Drawing or Shape creation if it was active
             if (isDrawing) {
                  const ctx = page.ctx;
                  const touch = e.changedTouches[0]; // Use the touch that ended for the final position
                  const pos = getMousePos(page.canvas, touch, page.scale, page.translateX, page.translateY);


                  // Restore the canvas state to before the touch started for drawing/shapes
                  if (savedCanvasState) {
                     ctx.putImageData(savedCanvasState, 0, 0);
                     savedCanvasState = null; // Clear saved state
                  }

                  // Finalize drawing stroke or shape
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
                      // Clear points after finalizing
                      if (currentTool === 'pen') penPoints = [];
                      if (currentTool === 'highlight') highlightPoints = [];

                  } else if (currentTool === 'eraser') {
                       // Eraser path is drawn directly in touchmove, just close the path
                       ctx.closePath();
                       // No points array to clear for eraser in this implementation
                   } else if (currentTool === 'rect' || currentTool === 'circle' || currentTool === 'line' || currentTool === 'arrow' || currentTool === 'table') {
                       // Draw the final shape/table if movement was significant
                        if (Math.abs(pos.x - drawStartX) > 2 || Math.abs(pos.y - drawStartY) > 2) {
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
                             }
                             ctx.closePath();
                        }
                       // Clear table info after potential drawing
                       if (page.tableInfo) delete page.tableInfo;
                   }

                 // Save state to history after any drawing or shape action
                 saveToHistory(pageIndex);
                 // Clear redo stack for the current page after a new drawing/shape action
                 page.redoStack = [];
                 updateUndoRedoButtons();

             } // End of isDrawing finalization

             // Panning and Zooming effects are applied directly in touchmove via applyTransform
             // No extra canvas drawing or history save needed here for pan/zoom.

             // Reset all touch state flags
             isDrawing = false;
             isPanning = false;
             isZooming = false;
             initialPinchDistance = null;
             panStartTouches = 0;
             canvas.classList.remove("active"); // Ensure pan cursor is reset
         } else {
             // If some touches are still active, don't reset everything.
             // The next touchmove/touchend will handle the ongoing or new gesture.
         }


        // Reset composite operation and alpha (Important after drawing/erasing)
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
             // Reset all flags and states on error
             isDrawing = false;
             isPanning = false;
             isZooming = false;
             initialPinchDistance = null;
             panStartTouches = 0;
             canvas.classList.remove("active");
             savedCanvasState = null;
             if (currentTool === 'pen') penPoints = [];
             if (currentTool === 'highlight') highlightPoints = [];
             if (page && page.tableInfo) delete page.tableInfo;
             return;
        }

         // If any action was in progress, cancel it and revert canvas if drawing
        if (isDrawing || isPanning || isZooming) {
             console.log(`Touch cancelled during ${isDrawing ? 'drawing' : (isPanning ? 'panning' : 'zooming')}. Reverting canvas state if drawing.`);

            // Restore the canvas state to before the touch started if drawing/shaping was active
            if (isDrawing && savedCanvasState) {
               page.ctx.putImageData(savedCanvasState, 0, 0);
               savedCanvasState = null;
            } else {
                 // Clear saved state if not drawing (e.g., during shape preview)
                 savedCanvasState = null;
             }

             // Reset all touch state flags
             isDrawing = false;
             isPanning = false;
             isZooming = false;
             initialPinchDistance = null;
             panStartTouches = 0;
             canvas.classList.remove("active"); // Remove grabbing cursor

             // Clear any temporary points or table info
             if (currentTool === 'pen') penPoints = [];
             if (currentTool === 'highlight') highlightPoints = [];
             if (page.tableInfo) delete page.tableInfo;

            // No history save on cancel - just revert to the previous state (if drawing)
        }

         // Reset composite operation and alpha
         page.ctx.globalCompositeOperation = 'source-over';
         page.ctx.globalAlpha = 1.0;

         updateUndoRedoButtons(); // Update button states as history might have been affected by revert
     };


    // Function to get mouse or touch position relative to canvas, considering pan and zoom
    // This function should exist in Script.js or be accessible globally
    // Make sure it's correctly defined and accessible here.
    // Assuming getMousePos is globally available from Script.js


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
         // Add a small delay to ensure pages array is populated if this runs too early
         setTimeout(() => {
             if (pages[index]) {
                  window.addTouchEventListenersToCanvas(canvas, index);
             } else {
                 console.warn(`Page data not found for canvas index ${index} during initial touch listener attachment.`);
             }
         }, 100); // Small delay
    });

});
