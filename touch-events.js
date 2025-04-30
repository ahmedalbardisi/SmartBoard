/**
 * Smart Whiteboard - Touch Events Functionality
 * Handles touch interactions for drawing, highlighting, erasing, and panning.
 */

// Ensure this script runs after the main Script.js and can access its variables and functions.
// Variables like pages, currentPage, currentTool, currentColor, currentSize,
// isDrawing, isPanning, panStartX, panStartY, drawStartX, drawStartY,
// savedCanvasState, highlightPoints, penPoints are assumed to be globally available from Script.js.
// Functions like getMousePos, saveToHistory, updateUndoRedoButtons, applyTransform,
// drawArrow, drawTable, setActiveTool, setCanvasCursor are also assumed to be globally available.

// Add these variables near the other variable declarations at the top
let toolBeforeFourFingerEraser = "pen"; // Stores the tool active before activating the 4-finger eraser
let initialPinchDistance = 0; // Stores the distance between fingers at the start of a pinch gesture
let initialPinchScale = 1; // Stores the canvas scale at the start of a pinch gesture
let isThreeFingerPanning = false; // Flag to indicate if the 3-finger pan gesture is active
let isMultiTouchGestureActive = false; // New flag to indicate if ANY multi-touch gesture (2, 3, or 4 fingers) is active


document.addEventListener('DOMContentLoaded', () => {
    // It's better to attach touch listeners after pages are created in initApp
    // We can add a function call in Script.js initApp or listen for a custom event
    // or simply wait a moment, but a cleaner way is to integrate this into the page creation process.

    // Let's define the touch event handlers first
    const handleTouchStart = (e) => {
        // Prevent default browser behaviors like scrolling and zooming for recognized gestures.
        // We'll apply preventDefault conditionally based on the number of touches.

        const canvas = e.target;
        const pageIndex = pages.findIndex(p => p.canvas === canvas);
        const page = pages[pageIndex];

        if (!page || !page.ctx) {
            console.error(`Page object or context not found for touchstart on canvas.`);
            return;
        }

        // --- Reset flags for potentially starting a new interaction ---
        // Do not reset isMultiTouchGestureActive here if multiple fingers are already down,
        // as we might be transitioning gestures (e.g., adding a finger).
        // Reset single-touch related flags if starting a new interaction type.
        if (e.touches.length <= 1) { // If starting with 0 or 1 finger, reset multi-touch flags
             isThreeFingerPanning = false;
             initialPinchDistance = 0;
             initialPinchScale = 1;
             // isMultiTouchGestureActive will be set below if a multi-touch gesture starts.
        }

        // --- Prioritize Multi-finger Gestures ---

        // --- Four-Finger Eraser Start ---
        // Check for exactly 4 touches. Only activate if no drawing/shaping is currently in progress.
        if (e.touches.length === 4 && !isDrawing && !isPanning && !isThreeFingerPanning && initialPinchDistance === 0) {
             e.preventDefault(); // Prevent default browser behavior for this gesture
             isMultiTouchGestureActive = true; // Set flag
             toolBeforeFourFingerEraser = currentTool; // Save the current tool
             setActiveTool("eraser"); // Switch to the eraser tool (this will also update the cursor)
             console.log("Four-finger eraser activated.");
             // Prepare for erasing on touchstart
             isDrawing = true; // Use isDrawing flag for the temporary erase action
             const touch = e.touches[0]; // Use the first touch for the starting point
             const pos = getMousePos(canvas, touch, page.scale, page.translateX, page.translateY);
             [lastX, lastY] = [pos.x, pos.y];
             page.ctx.beginPath();
             page.ctx.lineWidth = currentSize * 1.5; // Use eraser size
             page.ctx.globalCompositeOperation = 'destination-out'; // Erasing mode
             page.ctx.moveTo(lastX, lastY);
             return; // Consume the touchstart event if 4 fingers are detected
        }
        // --- End Four-Finger Eraser Start ---

        // --- Three-Finger Pan Start ---
        // Check for exactly 3 touches. Only activate if no drawing/shaping/other multi-touch is active.
        if (e.touches.length === 3 && !isDrawing && !isPanning && initialPinchDistance === 0 && currentTool !== 'eraser') { // Don't interfere with 4-finger erase
            e.preventDefault(); // Prevent default browser scroll/zoom for this gesture
             isMultiTouchGestureActive = true; // Set flag
            isThreeFingerPanning = true; // Activate 3-finger pan flag
            const touch = e.touches[0]; // Use the first touch for calculating movement
            const rect = canvas.getBoundingClientRect();
            // Store the starting position relative to the canvas's viewport position
            panStartX = touch.clientX - rect.left - page.translateX;
            panStartY = touch.clientY - rect.top - page.translateY;
            canvas.classList.add("active"); // grabbing cursor
            console.log("Three-finger pan started.");
            return; // Consume the touchstart event if 3 fingers are detected
        }
        // --- End Three-Finger Pan Start ---

        // --- Two-Finger Zoom Start ---
        // Check for exactly 2 touches. Only activate if no drawing/shaping/other multi-touch is active.
        if (e.touches.length === 2 && !isDrawing && !isPanning && !isThreeFingerPanning && currentTool !== 'eraser') { // Don't interfere with other gestures
            e.preventDefault(); // Prevent default browser zoom
             isMultiTouchGestureActive = true; // Set flag
            initialPinchDistance = getDistanceBetweenTouches(e.touches[0], e.touches[1]);
            initialPinchScale = page.scale; // Store the current scale
            console.log("Two-finger pinch/zoom started.");
            return; // Consume the touchstart event if 2 fingers are detected
        }
        // --- End Two-Finger Zoom Start ---


        // --- Handle Single Touch (Default Drawing/Shaping or Button Pan) ---
        // This will only run if the number of touches is 1 AND NO multi-touch gesture is active.
        if (e.touches.length === 1 && !isMultiTouchGestureActive) {
             // Prevent default only if we are starting a drawing/shaping action
             // Allow default if it's a potential click on UI elements not covered by canvas (unlikely on canvas itself with touch-action: none)
             if (currentTool !== 'pan') { // Prevent default for drawing/shaping tools
                 e.preventDefault();
             }
             // If currentTool is 'pan', allow default for potential scrolling of the canvas area itself (less relevant with touch-action: none)
             // or handle button-activated pan explicitly here.

            if (currentTool === 'pan') {
                 isPanning = true; // Activate the default pan flag (for the button-activated tool)
                 const touch = e.touches[0];
                 const rect = canvas.getBoundingClientRect();
                 panStartX = touch.clientX - rect.left - page.translateX;
                 panStartY = touch.clientY - rect.top - page.translateY;
                 canvas.classList.add("active"); // grabbing cursor
                 console.log("Single-touch button pan started.");
                 // No return here, let it proceed to the drawing/shaping block if needed (though it shouldn't with currentTool === 'pan')
            }


            // Proceed with drawing/shaping start if it's not a pan tool
            if (currentTool !== 'pan') { // This includes pen, highlight, eraser (if eraser button is active), shapes, table
                 isDrawing = true;
                 const touch = e.touches[0];
                 const pos = getMousePos(canvas, touch, page.scale, page.translateX, page.translateY);

                 [lastX, lastY] = [pos.x, pos.y];
                 drawStartX = pos.x;
                 drawStartY = pos.y;

                 savedCanvasState = page.ctx.getImageData(0, 0, canvas.width, canvas.height);

                 if (currentTool === 'table') {
                     const rows = parseInt(document.getElementById('table-rows').value);
                     const cols = parseInt(document.getElementById('table-cols').value);
                     page.tableInfo = { startX: drawStartX, startY: drawStartY, rows: rows, cols: cols };
                     console.log(`Drawing table with ${rows} rows and ${cols} columns on touchstart`);
                 }

                 // Prepare context for drawing (pen, eraser, highlight, shapes, table)
                 page.ctx.beginPath(); // Start path for pen, eraser, highlight, or shape outline

                 if (currentTool === 'pen' || currentTool === 'highlight') {
                      if (currentTool === 'highlight') {
                          highlightPoints = [{ x: pos.x, y: pos.y }];
                      } else if (currentTool === 'pen') {
                           penPoints = [{ x: pos.x, y: pos.y }];
                      }
                      page.ctx.lineWidth = currentSize;
                      page.ctx.strokeStyle = currentColor;
                      page.ctx.globalAlpha = 1.0;

                     if (currentTool === 'highlight') {
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
                 // Handle single-touch eraser if the eraser tool is active (not via 4-finger gesture)
                 else if (currentTool === 'eraser') {
                     page.ctx.globalCompositeOperation = 'destination-out';
                     page.ctx.lineWidth = currentSize * 1.5; // Use eraser size
                     page.ctx.moveTo(lastX, lastY); // Start path for eraser
                 }
                 // Shapes and Tables don't necessarily need beginPath/moveTo here,
                 // as their drawing is handled in mousemove/mouseup relative to drawStartX/Y.
                 // The beginPath above is okay, but might be redundant for shapes/tables start.
                 // Keep it consistent for now.
            }
        }
        // --- End Single Touch Handling ---
    };

    const handleTouchMove = (e) => {
        // Prevent default ONLY if a specific, handled gesture is currently active and the touch count is relevant.
        // This allows natural scrolling for unhandled touch actions.
        // e.preventDefault(); // Removed global preventDefault

        const canvas = e.target;
        const pageIndex = pages.findIndex(p => p.canvas === canvas);
        const page = pages[pageIndex];

         if (!page || !page.ctx || !page.canvas) {
              console.error(`Page object, context, or canvas not found for touchmove on canvas.`);
              return;
         }
         const ctx = page.ctx;

        // --- Handle Active Gestures ---

        // --- Four-Finger Eraser Move ---
        // Only continue 4-finger erase if isDrawing is true (set in touchstart) AND current tool is eraser AND exactly 4 fingers are down.
        if (isDrawing && currentTool === 'eraser' && e.touches.length === 4) {
             e.preventDefault(); // Prevent default browser behavior for erasing
             const touch = e.touches[0]; // Use the first touch for erasing
             const pos = getMousePos(page.canvas, touch, page.scale, page.translateX, page.translateY);
             ctx.lineTo(pos.x, pos.y);
             ctx.stroke();
             [lastX, lastY] = [pos.x, pos.y];
             return; // Consume the touchmove event if 4-finger erasing
        }
         // --- End Four-Finger Eraser Move ---


        // --- Three-Finger Pan Move ---
        // Only continue 3-finger pan if the flag is active AND exactly 3 fingers are down.
        if (isThreeFingerPanning && e.touches.length === 3) {
             e.preventDefault(); // Prevent default browser behavior for panning
             const touch = e.touches[0]; // Use the first touch for calculating movement
             const rect = canvas.getBoundingClientRect();
             page.translateX = (touch.clientX - rect.left) - panStartX;
             page.translateY = (touch.clientY - rect.top) - panStartY;
             applyTransform(page); // Update visual position
             return; // Consume the touchmove event if 3-finger panning
        }
        // --- End Three-Finger Pan Move ---

        // --- Two-Finger Zoom Move ---
        // Only continue 2-finger zoom if initial pinch distance was set (meaning a zoom gesture started) AND exactly 2 fingers are down.
        if (initialPinchDistance > 0 && e.touches.length === 2) {
            e.preventDefault(); // Prevent default browser zoom
            const currentPinchDistance = getDistanceBetweenTouches(e.touches[0], e.touches[1]);
            let newScale = initialPinchScale * (currentPinchDistance / initialPinchDistance);
            newScale = Math.max(0.2, Math.min(newScale, 5)); // Clamp scale
            page.scale = newScale;
            applyTransform(page); // Apply the new scale
            // console.log("Two-finger pinch/zoom active. Scale:", newScale); // Keep console log if helpful for debugging
            return; // Consume the touchmove event if 2-finger zooming
        }
        // --- End Two-Finger Zoom Move ---


        // --- Handle Single Touch Drawing/Shaping or Button Pan Move ---
        // This block runs if a single-touch action is active (isDrawing or isPanning via button)
        // AND there is exactly 1 touch. It should also check if a multi-touch gesture is NOT active,
        // although the logic in touchstart should prevent isDrawing/isPanning from being true
        // if a multi-touch gesture was intended.
         if ((isDrawing || (isPanning && currentTool === 'pan')) && e.touches.length === 1 && !isMultiTouchGestureActive) { // Ensure multi-touch is NOT active
             e.preventDefault(); // Prevent default for drawing/erasing/button-pan action
             const touch = e.touches[0];
             const pos = getMousePos(page.canvas, touch, page.scale, page.translateX, page.translateY);

             if (isDrawing) { // This covers pen, highlight, eraser, shapes, table previews
                 if (currentTool === 'pen' || currentTool === 'highlight') {
                      const points = currentTool === 'pen' ? penPoints : highlightPoints;
                      points.push({ x: pos.x, y: pos.y });
                      if (savedCanvasState) {
                           ctx.putImageData(savedCanvasState, 0, 0);
                      }
                     ctx.strokeStyle = currentColor;
                     ctx.globalCompositeOperation = 'source-over';
                     ctx.lineWidth = (currentTool === 'highlight') ? currentSize * 5 : currentSize;
                     ctx.globalAlpha = (currentTool === 'highlight') ? 0.5 : 1.0;

                      if (points.length > 1) {
                          ctx.beginPath();
                          ctx.moveTo(points[0].x, points[0].y);
                          for (let i = 1; i < points.length; i++) {
                               const p1 = points[i - 1];
                               const p2 = points[i];
                               const midPoint = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
                              ctx.quadraticCurveTo(p1.x, p1.y, midPoint.x, midPoint.y);
                          }
                         ctx.lineTo(pos.x, pos.y);
                          ctx.stroke();
                      }
                 } else if (currentTool === 'eraser') {
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

                    ctx.beginPath(); // Redraw shape preview
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
             } else if (isPanning && currentTool === 'pan') {
                 // This is the button-activated single-touch pan move
                 const touch = e.touches[0];
                 const rect = canvas.getBoundingClientRect();
                 page.translateX = (touch.clientX - rect.left) - panStartX;
                 page.translateY = (touch.clientY - rect.top) - panStartY;
                 applyTransform(page);
             }
         }
        // --- End Single Touch Drawing/Shaping or Button Pan Move ---
    };

    const handleTouchEnd = (e) => {
        // Prevent default ONLY if a specific, handled gesture is ending.
        // e.preventDefault(); // Removed global preventDefault

        const canvas = e.target;
        const pageIndex = pages.findIndex(p => p.canvas === canvas);
        const page = pages[pageIndex];

        if (!page || !page.ctx || !page.canvas) {
             console.error(`Page object, context, or canvas not found for touchend on canvas.`);
             // Attempt to reset flags even on error
             savedCanvasState = null;
             isDrawing = false;
             isPanning = false;
             isThreeFingerPanning = false;
             isMultiTouchGestureActive = false; // Reset on error
             canvas.classList.remove("active");
             if (currentTool === 'pen') penPoints = [];
             if (currentTool === 'highlight') highlightPoints = [];
             if (page && page.tableInfo) delete page.tableInfo;
             initialPinchDistance = 0;
             initialPinchScale = 1;
             return;
        }

        const ctx = page.ctx;
        // We need the position of the touch that ended for drawing finalization if needed.
        // However, for gesture recognition ending, the crucial part is the *number* of touches remaining.
        const touch = e.changedTouches[0]; // Get one of the touches that ended
        const pos = getMousePos(page.canvas, touch, page.scale, page.translateX, page.translateY); // Position of one of the ending touches


        // --- Handle Ending Gestures (Check flags first, then remaining touch count) ---

         // --- Four-Finger Eraser End ---
         // Check if the eraser tool is active AND it was activated by the 4-finger gesture
         // AND the number of active touches has dropped below 4.
        if (currentTool === 'eraser' && toolBeforeFourFingerEraser !== 'eraser' && e.touches.length < 4) {
             e.preventDefault(); // Prevent default browser behavior when fingers lift
             console.log(`Four-finger eraser gesture ended. Remaining touches: ${e.touches.length}`);

             // If drawing was active during the 4-finger gesture, finalize and save.
             if (isDrawing) { // Check if erasing action was actually happening
                page.ctx.closePath(); // Close the eraser path
                // Save the canvas state after erasing, but only if something was actually drawn/erased
                 if (savedCanvasState) { // savedCanvasState is set when drawing starts
                      saveToHistory(pageIndex); // Save the canvas state after erasing
                      savedCanvasState = null; // Clear saved state
                 }
             } else {
                  // If no drawing happened (e.g., quick tap), just clear saved state if any.
                  savedCanvasState = null;
             }


             // Revert to the tool that was active before the four-finger gesture
             setActiveTool(toolBeforeFourFingerEraser);
             console.log(`Four-finger eraser deactivated. Reverted to ${currentTool}.`);

             isDrawing = false; // Ensure drawing is off after lifting fingers for this gesture
             // Do NOT return here immediately. Lifting fingers might result in 0 touches (finalize other actions).
        }
        // --- End Four-Finger Eraser End ---


         // --- Two-Finger Zoom End ---
         // Check if a zoom gesture was active (initialPinchDistance > 0) AND the number of active touches has dropped below 2.
         if (initialPinchDistance > 0 && e.touches.length < 2) {
             e.preventDefault(); // Prevent default browser behavior when fingers lift
             console.log("Two-finger pinch/zoom ended.");
             initialPinchDistance = 0; // Reset pinch variables
             initialPinchScale = 1;
             // No history save needed for zoom transforms.
             // Do NOT return here immediately. Lifting fingers might result in 0 touches (finalize other actions).
         }
         // --- End Two-Finger Zoom End ---

        // --- Three-Finger Pan End ---
        // Check if the 3-finger pan flag was active AND the number of active touches has dropped below 3.
        if (isThreeFingerPanning && e.touches.length < 3) {
            e.preventDefault(); // Prevent default browser behavior when fingers lift
             console.log(`Three-finger pan ended. Remaining touches: ${e.touches.length}`);
            isThreeFingerPanning = false; // Deactivate 3-finger pan flag
            // isPanning = false; // This flag is more for the button-activated pan, reset if needed.
            canvas.classList.remove("active"); // Remove grabbing cursor
            savedCanvasState = null; // Clear any saved state from potential pan start
            // No history save needed for pan transforms.
            // Do NOT return here immediately. Lifting fingers might result in 0 touches.
        }
        // --- End Three-Finger Pan End ---


        // --- Handle Single Touch Drawing/Shaping or Button Pan End (when total touches is 0) ---
        // This block runs if a single-touch action (drawing, shaping, or button pan) was active
        // AND the total number of touches drops to 0 (meaning all fingers are lifted).
         if ((isDrawing || (isPanning && currentTool === 'pan')) && e.touches.length === 0) {
             e.preventDefault(); // Prevent default for finalizing the action

             if (isPanning && currentTool === 'pan') {
                  // Finalize button-activated single-touch pan
                  isPanning = false;
                  canvas.classList.remove("active");
                   savedCanvasState = null;
                   console.log("Button-activated pan ended.");
                   // History is not saved for pan.
             } else if (isDrawing) { // Finalize drawing or shaping action
                 // Use the position of the touch that ended to finalize the drawing/shaping if needed
                 // For continuous drawing (pen/eraser/highlight), the path was built in touchmove.
                 // For shapes/tables, we draw the final item using the start point and the end point.

                 // --- Existing drawing/shaping touchend logic ---
                 if (currentTool === 'pen' || currentTool === 'highlight') {
                      // Restore the canvas to the state before starting the current stroke preview/draw
                      if (savedCanvasState) {
                        ctx.putImageData(savedCanvasState, 0, 0); // Restore state before final draw
                        savedCanvasState = null; // Clear saved state
                      }

                      const points = currentTool === 'pen' ? penPoints : highlightPoints;

                      ctx.strokeStyle = currentColor;
                      ctx.globalCompositeOperation = 'source-over';
                      ctx.lineWidth = (currentTool === 'highlight') ? currentSize * 5 : currentSize;
                      ctx.globalAlpha = (currentTool === 'highlight') ? 0.5 : 1.0;


                      if (points.length > 1) {
                          ctx.beginPath();
                          ctx.moveTo(points[0].x, points[0].y);
                          for (let i = 1; i < points.length; i++) {
                               const p1 = points[i - 1];
                               const p2 = points[i];
                               const midPoint = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
                              ctx.quadraticCurveTo(p1.x, p1.y, midPoint.x, midPoint.y);
                          }
                         ctx.lineTo(pos.x, pos.y); // Use the position of the touch that ended
                          ctx.stroke();
                      } else if (points.length === 1) {
                          // Draw a dot if there's only one point (tap without drag)
                          ctx.beginPath();
                          ctx.arc(points[0].x, points[0].y, ctx.lineWidth / 2, 0, Math.PI * 2);
                          ctx.fillStyle = ctx.strokeStyle;
                          ctx.fill();
                      }

                     if (currentTool === 'pen') penPoints = [];
                     if (currentTool === 'highlight') highlightPoints = [];

                     saveToHistory(pageIndex);

                  } else if (currentTool === 'eraser') {
                       // The path was drawn in touchmove. Finalize and save.
                      ctx.closePath();
                      saveToHistory(pageIndex);
                       savedCanvasState = null;
                  }
                  else if (currentTool === 'rect' || currentTool === 'circle' || currentTool === 'line' || currentTool === 'arrow' || currentTool === 'table') {
                      // Draw the final shape/table using the start point and the end point (pos)
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

                         saveToHistory(pageIndex);
                      } else {
                          // If it was just a tap for a shape/table tool, clear temporary info
                          if (currentTool === 'table' && page.tableInfo) {
                              delete page.tableInfo;
                          }
                          // No history save needed for a tap with shape/table tool.
                      }
                  }
                  // --- End Existing drawing/shaping touchend logic ---

                 isDrawing = false; // Deactivate drawing flag
             }

             // Reset composite operation and alpha to default after any action
             ctx.globalCompositeOperation = 'source-over';
             ctx.globalAlpha = 1.0;

             // Clear redo stack for the current page whenever a new drawing or shaping action is performed
              // Pan and zoom do not clear the redo stack as they are view transforms.
             if (currentTool !== 'pan') { // Only clear if the tool was not pan (gesture or button)
                 page.redoStack = [];
                 updateUndoRedoButtons(); // Update button states
             }

              // After all touches are lifted and actions are finalized, reset the multi-touch flag
             isMultiTouchGestureActive = false;
             console.log("All touches lifted. Multi-touch gesture flag reset.");
         }

        // If touches remain (e.touches.length > 0), but none of the explicit gesture end conditions were met,
        // it means fingers were lifted *during* a multi-touch gesture, potentially transitioning to another.
        // The checks in handleTouchStart and handleTouchMove should handle starting the new gesture
        // based on the remaining number of touches.
        // We also need to reset flags for gestures that might have ended implicitly by losing a finger.

        // If 3-finger pan was active, but touches drop below 3 (and it didn't fully end yet), reset its flag.
        if (e.touches.length < 3 && isThreeFingerPanning) {
             isThreeFingerPanning = false;
             // Do NOT remove canvas 'active' class here, as another gesture might still be active.
             // canvas.classList.remove("active"); // Moved to when isPanning is fully false
             savedCanvasState = null; // Clear any saved state related to pan start
             console.log("Three-finger pan implicitly ended.");
        }
         // If 2-finger zoom was active, but touches drop below 2 (and it didn't fully end yet), reset its flags.
        if (e.touches.length < 2 && initialPinchDistance > 0) {
             initialPinchDistance = 0;
             initialPinchScale = 1;
             console.log("Two-finger zoom implicitly ended.");
        }
         // If the eraser tool is active via the 4-finger gesture, but touches drop below 4,
         // the 4-finger end block handles the tool switch and flag reset.
         // If the eraser tool is active via button and touches drop to 0, the single-touch end block handles it.

         // Finally, ensure the 'active' cursor class is removed if *no* panning (button or 3-finger) is active.
         if (!isPanning && !isThreeFingerPanning) {
             canvas.classList.remove("active");
         }
    };

     const handleTouchCancel = (e) => {
        e.preventDefault(); // Prevent default behavior

        const canvas = e.target;
        const pageIndex = pages.findIndex(p => p.canvas === canvas);
        const page = pages[pageIndex];

        if (!page || !page.ctx) {
             console.error(`Page object or context not found for touchcancel on canvas.`);
        }

        console.log(`Touch cancelled during gesture. Restoring canvas state if necessary.`);

        // Restore the canvas state to before the touch started if saved (for drawing/shaping)
        if (savedCanvasState) {
           if (page && page.ctx) { // Add null checks
               page.ctx.putImageData(savedCanvasState, 0, 0);
           }
           savedCanvasState = null; // Clear saved state
        }

         // Reset all gesture flags and temporary data
         isDrawing = false;
         isPanning = false; // Reset button pan flag
         isThreeFingerPanning = false; // Reset 3-finger pan flag
         isMultiTouchGestureActive = false; // Reset multi-touch flag
         canvas.classList.remove("active"); // Remove grabbing cursor

         if (currentTool === 'pen') penPoints = [];
         if (currentTool === 'highlight') highlightPoints = [];
         if (page && page.tableInfo) delete page.tableInfo;

         initialPinchDistance = 0;
         initialPinchScale = 1;


        // If the 4-finger eraser was active due to the gesture, revert the tool on cancel
        if (currentTool === 'eraser' && toolBeforeFourFingerEraser !== 'eraser') {
             setActiveTool(toolBeforeFourFingerEraser);
             console.log("Four-finger eraser cancelled. Reverted to previous tool.");
        }

         // Reset composite operation and alpha
         if (page && page.ctx) { // Add null checks
             page.ctx.globalCompositeOperation = 'source-over';
             page.ctx.globalAlpha = 1.0;
         }

         // History is typically not saved on cancel, we just reverted to the previous state.
         updateUndoRedoButtons(); // Update button states
     };


    // Helper function to calculate the distance between two touch points
    function getDistanceBetweenTouches(touch1, touch2) {
        const dx = touch2.clientX - touch1.clientX;
        const dy = touch2.clientY - touch1.clientY;
        return Math.sqrt(dx * dx + dy * dy);
    }

    // Function to get mouse or touch position relative to canvas, considering pan and zoom
    // Keep the existing getMousePos function from Script.js, it should handle both mouse and touch.
    // Ensure the one in Script.js is available globally.
    // function getMousePos(canvas, evt, currentScale, currentTranslateX, currentTranslateY) { ... }


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


        // Disable default touch actions like double-tap zoom on the canvas itself
        // This is important to prevent interference with custom gestures.
        canvas.style.touchAction = 'none'; // Modern standard
        canvas.style.msTouchAction = 'none'; // For Internet Explorer (older spec)

        canvas.dataset.touchListenersAdded = 'true'; // Mark as added
        console.log(`Touch event listeners added to canvas for page ${pageIndex + 1}.`);
    };


    // Initial attachment: Attach listeners to any canvases that might exist when this script loads.
    // This is a fallback and might not be sufficient if pages are added dynamically *after* this script runs.
    // Ensure `initApp` in Script.js explicitly calls `window.addTouchEventListenersToCanvas` for each page
    // after it is created.
    // This loop assumes `pages` array is accessible and potentially pre-populated by Script.js
    // before this DOMContentLoaded listener runs. A more reliable integration requires
    // calling `addTouchEventListenersToCanvas` from `Script.js` after page creation.
     if (window.pages) { // Check if the global 'pages' array exists
        document.querySelectorAll('.page canvas').forEach((canvas, index) => {
             // Ensure the specific page data exists before attempting to add listeners.
             if (pages[index]) { // Check for page object existence
                  window.addTouchEventListenersToCanvas(canvas, index);
             } else {
                 // Log a warning if page data is missing during this initial loop.
                 console.warn(`Page data missing for canvas at index ${index} during initial touch listener attachment. Ensure createNewPage calls addTouchEventListenersToCanvas.`);
             }
        });
     } else {
         console.warn("Global 'pages' array not found. Initial touch listener attachment skipped. Ensure Script.js loads and initializes pages.");
     }


});
