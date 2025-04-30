/**
 * Smart Whiteboard - Touch Events Functionality
 * Handles touch interactions for drawing, highlighting, erasing, and panning.
 */

// Ensure this script runs after the main Script.js and can access its variables and functions.
// Variables like pages, currentPage, currentTool, currentColor, currentSize,
// isDrawing, isPanning, panStartX, panStartY, drawStartX, drawStartY,
// savedCanvasState, highlightPoints, penPoints are assumed to be globally available from Script.js.
// Functions like getMousePos, saveToHistory, updateUndoRedoButtons, applyTransform,
// drawArrow, drawTable, setActiveTool are also assumed to be globally available.

// Add these variables near the other variable declarations at the top
let toolBeforeFourFingerEraser = "pen"; // Stores the tool active before activating the 4-finger eraser
let initialPinchDistance = 0; // Stores the distance between fingers at the start of a pinch gesture
let initialPinchScale = 1; // Stores the canvas scale at the start of a pinch gesture
let isThreeFingerPanning = false; // Flag to indicate if the 3-finger pan gesture is active

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

        // Reset flags if starting a new gesture
        isDrawing = false;
        isPanning = false; // Reset default pan flag
        isThreeFingerPanning = false; // Reset 3-finger pan flag
        initialPinchDistance = 0; // Reset zoom variables
        initialPinchScale = 1;
        // Note: toolBeforeFourFingerEraser is managed when the 4-finger gesture ends.


        // --- Prioritize Multi-finger Gestures ---

        // --- Four-Finger Eraser Start ---
        if (e.touches.length === 4) {
             e.preventDefault(); // Prevent default browser behavior for this gesture
             // Only activate if no other gesture is currently considered active
             if (!isDrawing && !isPanning && initialPinchDistance === 0 && !isThreeFingerPanning) {
                 toolBeforeFourFingerEraser = currentTool; // Save the current tool
                 setActiveTool("eraser"); // Switch to the eraser tool
                 console.log("Four-finger eraser activated.");
                 // Prepare for erasing on touchstart
                 isDrawing = true; // Use isDrawing flag for the temporary erase action
                 const touch = e.touches[0];
                 const pos = getMousePos(canvas, touch, page.scale, page.translateX, page.translateY);
                 [lastX, lastY] = [pos.x, pos.y];
                 page.ctx.beginPath();
                 page.ctx.lineWidth = currentSize * 1.5; // Use eraser size
                 page.ctx.globalCompositeOperation = 'destination-out'; // Erasing mode
                 page.ctx.moveTo(lastX, lastY);
             }
             return; // Consume the touchstart event if 4 fingers are detected
        }
        // --- End Four-Finger Eraser Start ---

        // --- Three-Finger Pan Start ---
        if (e.touches.length === 3) {
            e.preventDefault(); // Prevent default browser scroll/zoom for this gesture
             // Only activate if no other gesture is currently considered active
             if (!isDrawing && !isPanning && initialPinchDistance === 0 && currentTool !== 'eraser') { // Don't interfere with 4-finger erase
                isThreeFingerPanning = true; // Activate 3-finger pan flag
                const touch = e.touches[0]; // Use the first touch for calculating movement
                const rect = canvas.getBoundingClientRect();
                // Store the starting position relative to the canvas's viewport position
                panStartX = touch.clientX - rect.left - page.translateX;
                panStartY = touch.clientY - rect.top - page.translateY;
                canvas.classList.add("active"); // grabbing cursor
                console.log("Three-finger pan started.");
             }
            return; // Consume the touchstart event if 3 fingers are detected
        }
        // --- End Three-Finger Pan Start ---

        // --- Two-Finger Zoom Start ---
        if (e.touches.length === 2) {
            e.preventDefault(); // Prevent default browser zoom
             // Only activate if no other gesture is currently considered active
             if (!isDrawing && !isPanning && !isThreeFingerPanning && currentTool !== 'eraser') { // Don't interfere with other gestures
                initialPinchDistance = getDistanceBetweenTouches(e.touches[0], e.touches[1]);
                initialPinchScale = page.scale; // Store the current scale
                console.log("Two-finger pinch/zoom started.");
             }
            return; // Consume the touchstart event if 2 fingers are detected
        }
        // --- End Two-Finger Zoom Start ---


        // --- Handle Single Touch (Default Drawing/Shaping or Button Pan) ---
        // This will only run if the number of touches is not 2, 3, or 4.
        if (e.touches.length === 1) {
             // Prevent default only if we are starting a drawing/shaping action
             // Allow default if it's a potential click on UI elements not covered by canvas
             if (currentTool !== 'pan') { // Prevent default for drawing/shaping tools
                 e.preventDefault();
             }
             // If currentTool is 'pan', allow default for potential scrolling of the canvas area itself
             // or handle button-activated pan explicitly here if needed.

            if (currentTool === 'pan') {
                 isPanning = true; // Activate the default pan flag (for the button-activated tool)
                 const touch = e.touches[0];
                 const rect = canvas.getBoundingClientRect();
                 panStartX = touch.clientX - rect.left - page.translateX;
                 panStartY = touch.clientY - rect.top - page.translateY;
                 canvas.classList.add("active"); // grabbing cursor
                 console.log("Single-touch button pan started.");
                 return; // Consume the touchstart event for single-touch pan
            }


            // Proceed with drawing/shaping start if it's not a pan tool
            if (currentTool !== 'pan' && currentTool !== 'eraser') { // Eraser handled by 4-finger gesture or single touch below
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

                 if (currentTool === 'pen' || currentTool === 'highlight') {
                      page.ctx.beginPath();
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
            }
            // Handle single-touch eraser if the eraser tool is active (not via 4-finger gesture)
            else if (currentTool === 'eraser') {
                 e.preventDefault(); // Prevent default for erasing action
                 isDrawing = true; // Use isDrawing flag for erasing
                 const touch = e.touches[0];
                 const pos = getMousePos(canvas, touch, page.scale, page.translateX, page.translateY);
                 [lastX, lastY] = [pos.x, pos.y];
                 page.ctx.beginPath();
                 page.ctx.lineWidth = currentSize * 1.5; // Use eraser size
                 page.ctx.globalCompositeOperation = 'destination-out'; // Erasing mode
                 page.ctx.moveTo(lastX, lastY);
            }
        }
    };

    const handleTouchMove = (e) => {
        // Only prevent default if a specific, handled gesture is active.
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
        // Check if isDrawing is true AND the current tool is eraser AND there are still 4 fingers
        // (or if it was the 4-finger gesture that started the eraser and the count dropped, handle transition in touchend)
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
        // Check if the 3-finger pan flag is active AND there are still 3 fingers
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
        // Check if initial pinch distance was set (meaning a zoom gesture started) AND there are exactly 2 fingers
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
        // This will only run if none of the multi-touch gestures are active OR the number of touches is 1.
         if (isDrawing && e.touches.length === 1) { // Check if drawing (or single-touch erase) is active with 1 finger
             e.preventDefault(); // Prevent default for drawing/erasing action
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
         } else if (isPanning && e.touches.length === 1 && currentTool === 'pan') {
             // This is the button-activated single-touch pan move
             e.preventDefault(); // Prevent default browser behavior for panning
             const touch = e.touches[0];
             const rect = canvas.getBoundingClientRect();
             page.translateX = (touch.clientX - rect.left) - panStartX;
             page.translateY = (touch.clientY - rect.top) - panStartY;
             applyTransform(page);
         }
        // --- End Single Touch Drawing/Shaping or Button Pan Move ---
    };

    const handleTouchEnd = (e) => {
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
             canvas.classList.remove("active");
             if (currentTool === 'pen') penPoints = [];
             if (currentTool === 'highlight') highlightPoints = [];
             if (page && page.tableInfo) delete page.tableInfo;
             initialPinchDistance = 0;
             initialPinchScale = 1;
             return;
        }

        const ctx = page.ctx;
        const touch = e.changedTouches[0]; // Get the touch that ended
        const pos = getMousePos(page.canvas, touch, page.scale, page.translateX, page.translateY);

        // --- Handle Ending Gestures ---

        // --- Four-Finger Eraser End ---
        // Check if the current tool is eraser AND the number of active touches has dropped below 4.
        // This indicates the four-finger gesture has ended.
        if (currentTool === 'eraser' && e.touches.length < 4) {
             e.preventDefault(); // Prevent default browser behavior when fingers lift
             console.log(`Four-finger eraser gesture ended. Remaining touches: ${e.touches.length}`);

             // If drawing was active during the 4-finger gesture, finalize and save.
             // This check helps differentiate from a tap that just happens to have 4 fingers down.
             if (isDrawing) { // Check if erasing action was actually happening
                page.ctx.closePath(); // Close the eraser path
                // Save the canvas state after erasing, but only if something was actually drawn/erased
                // A simple way is to check if savedCanvasState was set (meaning drawing started)
                 if (savedCanvasState) {
                      saveToHistory(pageIndex); // Save the canvas state after erasing
                      savedCanvasState = null; // Clear saved state
                 }
             } else {
                 // If isDrawing was not true, it might have been just a quick tap with 4 fingers
                 // with no significant movement. Clear saved state if it exists.
                 savedCanvasState = null;
             }


             // Revert to the tool that was active before the four-finger gesture
             // Only revert if the eraser was activated *by* the 4-finger gesture
             if (toolBeforeFourFingerEraser !== 'eraser') {
                 setActiveTool(toolBeforeFourFingerEraser);
                 console.log(`Four-finger eraser deactivated. Reverted to ${currentTool}.`);
             } else {
                  // If the eraser tool was already active before the 4-finger gesture,
                  // just ensure isDrawing is false and the cursor is correct.
                  setCanvasCursor(currentTool); // Ensure cursor is correct for current (eraser) tool
             }


             isDrawing = false; // Ensure drawing is off after lifting fingers for this gesture
             // Do NOT return here immediately. Lifting fingers might transition to another gesture (e.g., 2 fingers for zoom).
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


        // --- Handle Single Touch Drawing/Shaping or Button Pan End ---
        // This block runs if a single-touch action (drawing, shaping, or button pan) was active
        // AND the number of touches drops to 0 (meaning the last finger was lifted).
         if ((isDrawing || isPanning) && e.touches.length === 0) {
             e.preventDefault(); // Prevent default for finalizing the action

             if (isPanning && currentTool === 'pan') {
                  // Finalize button-activated single-touch pan
                  isPanning = false;
                  canvas.classList.remove("active");
                   savedCanvasState = null;
                   console.log("Button-activated pan ended.");
                   // History is not saved for pan.
             } else if (isDrawing) { // Finalize drawing or shaping action
                 const pos = getMousePos(page.canvas, touch, page.scale, page.translateX, page.translateY); // Use the last known touch position

                 // --- Existing drawing/shaping touchend logic ---
                 if (currentTool === 'pen' || currentTool === 'highlight') {
                      if (savedCanvasState) {
                        ctx.putImageData(savedCanvasState, 0, 0);
                        savedCanvasState = null;
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
                         ctx.lineTo(pos.x, pos.y);
                          ctx.stroke();
                      } else if (points.length === 1) {
                          ctx.beginPath();
                          ctx.arc(points[0].x, points[0].y, ctx.lineWidth / 2, 0, Math.PI * 2);
                          ctx.fillStyle = ctx.strokeStyle;
                          ctx.fill();
                      }

                     if (currentTool === 'pen') penPoints = [];
                     if (currentTool === 'highlight') highlightPoints = [];

                     saveToHistory(pageIndex);

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
                          if (currentTool === 'table' && page.tableInfo) {
                              delete page.tableInfo;
                          }
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
             if (currentTool !== 'pan') {
                 page.redoStack = [];
                 updateUndoRedoButtons(); // Update button states
             }
         }

        // If touches remain, but none of the active gesture conditions were met, it means
        // fingers were lifted during a multi-touch gesture, and we should check if
        // a *new* gesture can start based on the remaining fingers. This is handled
        // by the initial checks in handleTouchStart when a touch is *added*,
        // and by the conditions in handleTouchEnd checking remaining touches.

        // We should also reset flags for gestures that didn't end explicitly above
        // but whose touch count no longer matches.
        if (e.touches.length < 3 && isThreeFingerPanning) {
             isThreeFingerPanning = false;
             canvas.classList.remove("active");
             savedCanvasState = null;
             console.log("Three-finger pan implicitly ended.");
        }
        if (e.touches.length < 2 && initialPinchDistance > 0) {
             initialPinchDistance = 0;
             initialPinchScale = 1;
             console.log("Two-finger zoom implicitly ended.");
        }
         // If the eraser tool is active but not via the 4-finger gesture (toolBeforeFourFingerEraser === 'eraser'),
         // and touches drop to 0, the single-touch eraser logic in the isDrawing block above handles it.
         // If touches drop below 4 and the tool was set by the 4-finger gesture, the 4-finger end block handles it.
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

        // Restore the canvas state to before the touch started if saved
        if (savedCanvasState) {
           if (page && page.ctx) { // Add null checks
               page.ctx.putImageData(savedCanvasState, 0, 0);
           }
           savedCanvasState = null; // Clear saved state
        }

         // Reset all gesture flags and temporary data
         isDrawing = false;
         isPanning = false;
         isThreeFingerPanning = false;
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

         updateUndoRedoButtons(); // Update button states as history might have been affected by restore
     };


    // Helper function to calculate the distance between two touch points
    function getDistanceBetweenTouches(touch1, touch2) {
        const dx = touch2.clientX - touch1.clientX;
        const dy = touch2.clientY - touch1.clientY;
        return Math.sqrt(dx * dx + dy * dy);
    }


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
    document.querySelectorAll('.page canvas').forEach((canvas, index) => {
         // Ensure the pages array and the specific page data exist before attempting to add listeners.
         // This script might load before `initApp` in Script.js has fully populated the `pages` array.
         // The ideal place to call `addTouchEventListenersToCanvas` is within `createNewPage` in Script.js.
         // This loop serves as a potential initial setup if Script.js is structured to allow it.
         // A more reliable integration involves modifying Script.js's page creation logic.
         if (pages && pages[index]) { // Check for pages array and page object existence
              window.addTouchEventListenersToCanvas(canvas, index);
         } else {
             // console.warn(`Page data not fully initialized for canvas at index ${index} during initial touch listener attachment. Ensure createNewPage calls addTouchEventListenersToCanvas.`);
             // Log a warning, but the main integration should happen in createNewPage.
         }
    });

});
