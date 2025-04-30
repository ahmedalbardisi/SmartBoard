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
let isMultiTouchGestureActive = false; // Flag to indicate if ANY multi-touch gesture (2, 3, or 4 fingers) is active

// --- Added for delayed touch recognition ---
let singleTouchTimer = null; // Timer for delayed single-touch actions
let twoFingerGestureTimer = null; // Timer for determining 2-finger gesture (zoom or erase)
const gestureDetectionDelay = 200; // Milliseconds to wait before confirming a single-touch or 2-finger gesture
const minZoomDistanceThreshold = 20; // Minimum distance change in pixels to trigger zoom
const minEraserTapDistanceThreshold = 30; // Maximum initial distance between 2 fingers for it to be considered a potential eraser tap

// Variables to store touch data during the delay
let delayedTouchStartData = null;


document.addEventListener('DOMContentLoaded', () => {
    // It's better to attach touch listeners after pages are created in initApp
    // We can add a function call in Script.js initApp or listen for a custom event
    // or simply wait a moment, but a cleaner way is to integrate this into the page creation process.

    // Let's define the touch event handlers first
    const handleTouchStart = (e) => {
        // Prevent default browser behaviors like scrolling and zooming for recognized gestures.
        // We'll apply preventDefault conditionally based on the number of touches and gesture state.

        const canvas = e.target;
        const pageIndex = pages.findIndex(p => p.canvas === canvas);
        const page = pages[pageIndex];

        if (!page || !page.ctx) {
            console.error(`Page object or context not found for touchstart on canvas.`);
            return;
        }

        // --- Clear existing timers and reset flags if starting a completely new interaction ---
        // If fingers are added to an *existing* multi-touch gesture, we don't reset everything.
        // Only reset if starting with 0 or 1 finger, or the number of touches changes significantly.
        if (e.touches.length <= 1) {
             clearTimeout(singleTouchTimer);
             singleTouchTimer = null;
             clearTimeout(twoFingerGestureTimer);
             twoFingerGestureTimer = null;
             delayedTouchStartData = null; // Clear stored data

             // Reset multi-touch specific flags
             isThreeFingerPanning = false;
             initialPinchDistance = 0;
             initialPinchScale = 1;
             isMultiTouchGestureActive = false; // Assume not multi-touch until confirmed
             // isDrawing and isPanning flags are managed by their respective logic branches
        } else {
            // If starting with multiple fingers, assume a multi-touch gesture might be intended.
            // Clear single-touch timer immediately.
            clearTimeout(singleTouchTimer);
            singleTouchTimer = null;
            delayedTouchStartData = null; // Clear stored data
        }


        // --- Prioritize Multi-finger Gestures based on initial touch count ---

        // --- Four-Finger Eraser Start (Immediate) ---
        // If exactly 4 fingers are down *initially*, we can assume this gesture immediately.
        if (e.touches.length === 4) {
             e.preventDefault(); // Prevent default behavior
             clearTimeout(twoFingerGestureTimer); // Clear any pending 2-finger timer
             twoFingerGestureTimer = null;

             // Only activate if no other gesture is currently considered active (prevents starting 4-finger while already 3-finger panning)
             if (!isDrawing && !isPanning && !isThreeFingerPanning && initialPinchDistance === 0) {
                 isMultiTouchGestureActive = true; // Set flag
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

        // --- Three-Finger Pan Start (Immediate) ---
        // If exactly 3 fingers are down *initially*, assume this gesture immediately.
        if (e.touches.length === 3) {
            e.preventDefault(); // Prevent default behavior
            clearTimeout(twoFingerGestureTimer); // Clear any pending 2-finger timer
             twoFingerGestureTimer = null;

             // Only activate if no other gesture is currently considered active (prevents starting 3-finger while already 4-finger erasing)
             if (!isDrawing && !isPanning && initialPinchDistance === 0 && currentTool !== 'eraser' ) { // Don't interfere with 4-finger erase
                isMultiTouchGestureActive = true; // Set flag
                isThreeFingerPanning = true; // Activate 3-finger pan flag
                const touch = e.touches[0]; // Use the first touch for calculating movement
                const rect = canvas.getBoundingClientRect();
                panStartX = touch.clientX - rect.left - page.translateX;
                panStartY = touch.clientY - rect.top - page.translateY;
                canvas.classList.add("active"); // grabbing cursor
                console.log("Three-finger pan started.");
             }
            return; // Consume the touchstart event if 3 fingers are detected
        }
        // --- End Three-Finger Pan Start ---

        // --- Two-Finger Gesture Start (Delayed) ---
        // If exactly 2 fingers are down *initially*, start a timer to differentiate zoom/erase.
        if (e.touches.length === 2) {
            e.preventDefault(); // Prevent default browser zoom immediately for 2 fingers
             // Only start the timer if no other gesture is currently considered active
             if (!isDrawing && !isPanning && !isThreeFingerPanning && currentTool !== 'eraser' ) { // Don't interfere
                 isMultiTouchGestureActive = true; // Assume multi-touch might be active
                 initialPinchDistance = getDistanceBetweenTouches(e.touches[0], e.touches[1]);
                 initialPinchScale = page.scale; // Store the current scale
                 console.log("Two-finger gesture detected. Starting timer to differentiate zoom/erase.");

                 // Set a timer to check again after the delay
                 twoFingerGestureTimer = setTimeout(() => {
                     // This function runs if 2 fingers are *still* down after the delay
                     if (e.touches.length === 2) {
                         const currentPinchDistance = getDistanceBetweenTouches(e.touches[0], e.touches[1]);
                         const distanceChange = Math.abs(currentPinchDistance - initialPinchDistance);

                         // If distance changed significantly, it's a zoom.
                         if (distanceChange > minZoomDistanceThreshold) {
                             console.log("Two-finger gesture confirmed as Zoom.");
                             // Zoom logic will be handled in touchmove since movement occurred.
                             // No need to do anything else here, just let touchmove take over.
                         }
                         // If distance did NOT change significantly and initial distance was small, it's a potential erase tap.
                         else if (initialPinchDistance < minEraserTapDistanceThreshold) {
                             console.log("Two-finger gesture confirmed as Eraser Tap.");
                             // Trigger eraser tap action immediately here.
                             // Simulate a quick erase action at the center point.
                             toolBeforeFourFingerEraser = currentTool; // Save current tool
                             setActiveTool("eraser"); // Temporarily switch to eraser
                             // Perform a small erase at the center of the initial touches
                             const touch1 = e.touches[0];
                             const touch2 = e.touches[1];
                             const centerX = (touch1.clientX + touch2.clientX) / 2;
                             const centerY = (touch1.clientY + touch2.clientY) / 2;
                             const canvasRect = canvas.getBoundingClientRect();
                             const pos = getMousePos(canvas, { clientX: centerX - canvasRect.left, clientY: centerY - canvasRect.top }, page.scale, page.translateX, page.translateY);

                             page.ctx.globalCompositeOperation = 'destination-out';
                             page.ctx.lineWidth = currentSize * 1.5; // Eraser size

                             page.ctx.beginPath();
                             page.ctx.arc(pos.x, pos.y, page.ctx.lineWidth / 2, 0, Math.PI * 2); // Draw a small circle to erase
                             page.ctx.fill(); // Fill the circle

                             page.ctx.globalCompositeOperation = 'source-over'; // Reset composite mode

                             saveToHistory(pageIndex); // Save the erase action
                             // Revert tool immediately after the action for a tap
                             setActiveTool(toolBeforeFourFingerEraser);
                             console.log("Two-finger eraser tap action completed.");
                              // Reset flags after the tap action
                             isMultiTouchGestureActive = false;
                             initialPinchDistance = 0;
                             initialPinchScale = 1;
                         } else {
                              console.log("Two-finger gesture: Neither zoom nor erase tap confirmed after delay.");
                              // If it wasn't a zoom or close tap after the delay, reset flags
                              isMultiTouchGestureActive = false;
                              initialPinchDistance = 0;
                              initialPinchScale = 1;
                         }
                     } else {
                         // If the number of touches is no longer 2, the timer is irrelevant
                          console.log("Two-finger timer expired, but touch count is no longer 2.");
                          isMultiTouchGestureActive = false; // Reset flag as the intended gesture was likely aborted
                          initialPinchDistance = 0;
                          initialPinchScale = 1;
                     }
                 }, gestureDetectionDelay); // Set the timeout duration
             }
            return; // Consume the touchstart event if 2 fingers are detected
        }
        // --- End Two-Finger Gesture Start ---


        // --- Handle Single Touch (Delayed) ---
        // If exactly 1 finger is down *initially*, start a timer before allowing drawing/shaping.
        if (e.touches.length === 1) {
            e.preventDefault(); // Prevent default behavior initially for single touch
             // Only start the timer if no multi-touch gesture is currently considered active
             if (!isMultiTouchGestureActive) {
                 console.log("Single touch detected. Starting timer to confirm.");
                 // Store necessary data to start drawing later
                 delayedTouchStartData = {
                     canvas: canvas,
                     page: page,
                     touch: e.touches[0],
                     tool: currentTool,
                     color: currentColor,
                     size: currentSize,
                     canvasState: page.ctx.getImageData(0, 0, canvas.width, canvas.height) // Save state before potential drawing
                 };

                 singleTouchTimer = setTimeout(() => {
                     // This function runs if only 1 finger is *still* down after the delay
                     if (e.touches.length === 1 && delayedTouchStartData) {
                          console.log("Single touch confirmed. Starting drawing/shaping.");
                          const data = delayedTouchStartData;

                         isDrawing = true; // Activate drawing flag

                         const pos = getMousePos(data.canvas, data.touch, data.page.scale, data.page.translateX, data.page.translateY);
                         [lastX, lastY] = [pos.x, pos.y];
                         drawStartX = pos.x;
                         drawStartY = pos.y;

                         // Restore the saved state before potentially drawing
                         if (data.canvasState) {
                              data.page.ctx.putImageData(data.canvasState, 0, 0);
                         }
                         savedCanvasState = data.canvasState; // Save it globally for touchmove/touchend

                         if (data.tool === 'table') {
                             const rows = parseInt(document.getElementById('table-rows').value);
                             const cols = parseInt(document.getElementById('table-cols').value);
                              data.page.tableInfo = { startX: drawStartX, startY: drawStartY, rows: rows, cols: cols };
                              console.log(`Drawing table with ${rows} rows and ${cols} columns after delay`);
                         }

                         if (data.tool === 'pen' || data.tool === 'eraser' || data.tool === 'highlight') {
                              data.page.ctx.beginPath(); // Start path for pen, eraser, highlight

                              if (data.tool === 'highlight') {
                                  highlightPoints = [{ x: pos.x, y: pos.y }];
                              } else if (data.tool === 'pen') {
                                   penPoints = [{ x: pos.x, y: pos.y }];
                              }

                             data.page.ctx.lineWidth = data.size;
                             data.page.ctx.strokeStyle = data.color;
                             data.page.ctx.globalAlpha = 1.0; // Default opacity

                             if (data.tool === 'eraser') {
                                 data.page.ctx.globalCompositeOperation = 'destination-out';
                                 data.page.ctx.lineWidth = data.size * 1.5; // Eraser size
                                  data.page.ctx.moveTo(lastX, lastY); // Start path for eraser
                             } else if (data.tool === 'highlight') {
                                 data.page.ctx.strokeStyle = data.color;
                                 data.page.ctx.globalAlpha = 0.5;
                                 data.page.ctx.globalCompositeOperation = 'source-over';
                                 data.page.ctx.lineWidth = data.size * 5; // Highlighter is usually thicker
                             } else if (data.tool === 'pen') {
                                  data.page.ctx.globalCompositeOperation = 'source-over';
                                  data.page.ctx.strokeStyle = data.color;
                                  data.page.ctx.lineWidth = data.size;
                                  data.page.ctx.globalAlpha = 1.0;
                             }
                         }
                         // For shapes/tables, isDrawing is enough; the actual drawing starts in touchmove/touchend.

                         delayedTouchStartData = null; // Clear stored data after use

                     } else {
                         // If the number of touches is no longer 1, the single touch action is cancelled.
                          console.log("Single touch timer expired, but touch count is no longer 1. Action cancelled.");
                          delayedTouchStartData = null; // Clear stored data
                          // No drawing or shaping action was started.
                     }
                 }, gestureDetectionDelay); // Set the timeout duration

             }
            // Do not return here immediately. Let it check for other conditions if needed,
            // although with the multi-touch checks above, this part should only run for 1 finger.
        }
        // --- End Single Touch Handling ---

        // If touches.length is 0, it's likely an end event, ignore touchstart.
        // If touches.length > 4, ignore or handle as a generic multi-touch (currently ignored).
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

        // If multi-touch gesture flag is active, check specific multi-touch gestures first.
        if (isMultiTouchGestureActive) {

            // --- Four-Finger Eraser Move ---
            // Only continue 4-finger erase if isDrawing is true AND current tool is eraser AND exactly 4 fingers are down.
            if (isDrawing && currentTool === 'eraser' && e.touches.length === 4) {
                 e.preventDefault(); // Prevent default browser behavior for erasing
                 const touch = e.touches[0]; // Use the first touch for erasing
                 const pos = getMousePos(page.canvas, touch, page.scale, page.translateX, page.translateY);
                 ctx.lineTo(pos.x, pos.y);
                 ctx.stroke();
                 [lastX, lastY] = [pos.x, pos.y];
                 return; // Consume the touchmove event
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
                 return; // Consume the touchmove event
            }
            // --- End Three-Finger Pan Move ---

            // --- Two-Finger Zoom Move ---
            // Only continue 2-finger zoom if initial pinch distance was set (meaning a zoom gesture started AFTER the timer) AND exactly 2 fingers are down.
            // Also ensure the 2-finger timer has finished or is not active, because movement during the timer is used to DIFFERENTIATE.
            if (initialPinchDistance > 0 && e.touches.length === 2 && twoFingerGestureTimer === null) {
                 e.preventDefault(); // Prevent default browser zoom
                 const currentPinchDistance = getDistanceBetweenTouches(e.touches[0], e.touches[1]);
                 const distanceChange = Math.abs(currentPinchDistance - initialPinchDistance);

                 // Only zoom if the distance change exceeds the threshold (already checked in timer, but good to reinforce)
                 if (distanceChange > minZoomDistanceThreshold) {
                      let newScale = initialPinchScale * (currentPinchDistance / initialPinchDistance);
                      newScale = Math.max(0.2, Math.min(newScale, 5)); // Clamp scale
                      page.scale = newScale;
                      applyTransform(page); // Apply the new scale
                      // console.log("Two-finger pinch/zoom active. Scale:", newScale);
                 }
                 return; // Consume the touchmove event
            }
            // --- End Two-Finger Zoom Move ---

            // If isMultiTouchGestureActive is true, but none of the specific multi-touch moves matched,
            // it might be an invalid state or transition. Do not proceed with single-touch moves.
            // The touchstart logic with timers should handle transitions better.
            // If fingers are lifted during multi-touch, touchend handles it.
            return; // Consume the event if multi-touch was active but no specific move handled.
        }


        // --- Handle Single Touch Drawing/Shaping or Button Pan Move ---
        // This block runs if a single-touch action is active (isDrawing or isPanning via button)
        // AND there is exactly 1 touch AND no multi-touch gesture is active.
         if ((isDrawing || (isPanning && currentTool === 'pan')) && e.touches.length === 1 && !isMultiTouchGestureActive) {
             e.preventDefault(); // Prevent default for drawing/erasing/button-pan action
             const touch = e.touches[0];
             const pos = getMousePos(page.canvas, touch, page.scale, page.translateX, page.translateY);

             // If a single touch timer was active, significant movement might cancel it and start drawing immediately.
             // Check if the timer is still active and if movement exceeds a small tap threshold.
             if (singleTouchTimer !== null) {
                  const startTouch = delayedTouchStartData ? delayedTouchStartData.touch : e.touches[0]; // Use the stored start touch if available
                  const currentTouch = e.touches[0];
                  const distanceMoved = getDistanceBetweenTouches(startTouch, currentTouch);

                  if (distanceMoved > 5) { // Small threshold, adjust as needed
                      console.log("Significant single-touch movement during delay. Cancelling timer and starting drawing.");
                      clearTimeout(singleTouchTimer);
                      singleTouchTimer = null;

                      // Manually start drawing/shaping since the timer is cancelled
                      if (delayedTouchStartData) {
                           const data = delayedTouchStartData;
                           isDrawing = true; // Activate drawing flag

                           const pos = getMousePos(data.canvas, data.touch, data.page.scale, data.page.translateX, data.page.translateY);
                           [lastX, lastY] = [pos.x, pos.y];
                           drawStartX = pos.x;
                           drawStartY = pos.y;

                           if (data.canvasState) {
                                data.page.ctx.putImageData(data.canvasState, 0, 0);
                           }
                           savedCanvasState = data.canvasState;

                           if (data.tool === 'table') {
                               const rows = parseInt(document.getElementById('table-rows').value);
                               const cols = parseInt(document.getElementById('table-cols').value);
                                data.page.tableInfo = { startX: drawStartX, startY: drawStartY, rows: rows, cols: cols };
                           }
                           if (data.tool === 'pen' || data.tool === 'eraser' || data.tool === 'highlight') {
                                data.page.ctx.beginPath();
                                if (data.tool === 'highlight') highlightPoints = [{ x: pos.x, y: pos.y }];
                                else if (data.tool === 'pen') penPoints = [{ x: pos.x, y: pos.y }];
                                data.page.ctx.lineWidth = data.size;
                                data.page.ctx.strokeStyle = data.color;
                                data.page.ctx.globalAlpha = 1.0;
                                if (data.tool === 'eraser') data.page.ctx.globalCompositeOperation = 'destination-out';
                                else if (data.tool === 'highlight') { data.page.ctx.globalAlpha = 0.5; data.page.ctx.lineWidth = data.size * 5; }
                                else if (data.tool === 'pen') data.page.ctx.globalAlpha = 1.0;

                                if (data.tool === 'eraser' || data.tool === 'pen' || data.tool === 'highlight') {
                                     data.page.ctx.moveTo(lastX, lastY); // Start path
                                }
                           }
                           delayedTouchStartData = null; // Clear stored data
                      }
                  }
             }


             if (isDrawing) { // This covers pen, highlight, eraser, shapes, table previews (after delay or immediate start)
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
             // Attempt to reset flags and timers even on error
             clearTimeout(singleTouchTimer); singleTouchTimer = null;
             clearTimeout(twoFingerGestureTimer); twoFingerGestureTimer = null;
             delayedTouchStartData = null;
             savedCanvasState = null;
             isDrawing = false;
             isPanning = false;
             isThreeFingerPanning = false;
             isMultiTouchGestureActive = false;
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
        const touch = e.changedTouches[0]; // Get one of the touches that ended
        const pos = getMousePos(page.canvas, touch, page.scale, page.translateX, page.translateY); // Position of one of the ending touches


        // --- Handle Ending Gestures (Check flags first, then remaining touch count) ---

        // --- Handle Delayed Single Touch End (as a Tap) ---
        // If the single touch timer is still active when touches drop to 0, it was a tap.
        if (singleTouchTimer !== null && e.touches.length === 0) {
             e.preventDefault(); // Prevent default tap behavior
             console.log("Single touch tap confirmed after delay.");
             clearTimeout(singleTouchTimer);
             singleTouchTimer = null;
             delayedTouchStartData = null; // Clear stored data

             // Execute a tap action based on the original tool
             if (savedCanvasState) { // Restore canvas state before drawing the tap
                 ctx.putImageData(savedCanvasState, 0, 0);
                 savedCanvasState = null;
             }

              // Execute tap action for Pen or Highlight (draw a dot)
             if (currentTool === 'pen' || currentTool === 'highlight') {
                 ctx.strokeStyle = currentColor;
                 ctx.fillStyle = currentColor; // Use stroke color for fill for dot
                 ctx.globalCompositeOperation = 'source-over';
                 ctx.globalAlpha = (currentTool === 'highlight') ? 0.5 : 1.0;
                 ctx.lineWidth = (currentTool === 'highlight') ? currentSize * 5 : currentSize;


                 ctx.beginPath();
                 // Draw a small circle at the tap position
                 ctx.arc(pos.x, pos.y, ctx.lineWidth / 2, 0, Math.PI * 2);
                 ctx.fill(); // Fill the circle to make a dot

                 saveToHistory(pageIndex); // Save the dot
             } else if (currentTool === 'eraser') {
                 // For eraser tap, perform a small erase at the tap location
                 ctx.globalCompositeOperation = 'destination-out';
                 ctx.lineWidth = currentSize * 1.5; // Eraser size

                 ctx.beginPath();
                 ctx.arc(pos.x, pos.y, ctx.lineWidth / 2, 0, Math.PI * 2); // Draw a small circle to erase
                 ctx.fill(); // Fill the circle

                 ctx.globalCompositeOperation = 'source-over'; // Reset composite mode

                 saveToHistory(pageIndex); // Save the erase action

             }
             // For shapes/table tap, usually no action unless specifically implemented (e.g., select).
             // The current code doesn't have tap actions for shapes/table, so do nothing for them.


             isDrawing = false; // No continuous drawing started
              // Multi-touch flag will be reset when touches length is 0 later.
             // Redo stack cleared later if needed.
         }
         // --- End Delayed Single Touch End ---


        // --- Handle Delayed Two-Finger Gesture End (as Eraser Tap if timer active and fingers lift) ---
        // If the two-finger timer is still active AND touches drop to 0 (meaning both fingers lifted quickly)
        if (twoFingerGestureTimer !== null && e.touches.length === 0) {
             e.preventDefault(); // Prevent default behavior
             console.log("Two-finger timer active, fingers lifted. Checking for eraser tap.");
             clearTimeout(twoFingerGestureTimer);
             twoFingerGestureTimer = null;

             // Check the initial distance between the fingers when touchstart occurred
             // (This requires storing initial touch positions in handleTouchStart if needed here,
             // but for now we rely on the timer logic determining erase vs zoom).
             // Based on the timer logic, if the timer finished and it wasn't a zoom, it was an erase tap attempt.
             // Here, if the timer was still active when touches dropped to 0, it means the fingers lifted
             // *before* the timer finished or right as it finished without significant movement.
             // Let's assume lifting 2 fingers quickly *while the timer is active* is intended as an erase tap.

             // Simulate a quick erase action at the center point of the two lifted fingers if initial distance was small.
             // We need the positions of the two fingers that lifted. e.changedTouches might have both if they lifted simultaneously.
             if (e.changedTouches.length === 2 && getDistanceBetweenTouches(e.changedTouches[0], e.changedTouches[1]) < minEraserTapDistanceThreshold) {
                 console.log("Two-finger quick lift confirmed as Eraser Tap.");
                  toolBeforeFourFingerEraser = currentTool; // Save current tool
                  setActiveTool("eraser"); // Temporarily switch to eraser

                  const touch1 = e.changedTouches[0];
                  const touch2 = e.changedTouches[1];
                  const centerX = (touch1.clientX + touch2.clientX) / 2;
                  const centerY = (touch1.clientY + touch2.clientY) / 2;
                  const canvasRect = canvas.getBoundingClientRect();
                  const pos = getMousePos(canvas, { clientX: centerX - canvasRect.left, clientY: centerY - canvasRect.top }, page.scale, page.translateX, page.translateY);

                  page.ctx.globalCompositeOperation = 'destination-out';
                  page.ctx.lineWidth = currentSize * 1.5; // Eraser size

                  page.ctx.beginPath();
                  page.ctx.arc(pos.x, pos.y, page.ctx.lineWidth / 2, 0, Math.PI * 2); // Draw a small circle to erase
                  page.ctx.fill(); // Fill the circle

                  page.ctx.globalCompositeOperation = 'source-over'; // Reset composite mode

                  saveToHistory(pageIndex); // Save the erase action
                  // Revert tool immediately after the action for a tap
                  setActiveTool(toolBeforeFourFingerEraser);
                  console.log("Two-finger eraser tap action completed.");
                  // Reset flags after the tap action
                 isMultiTouchGestureActive = false;
                 initialPinchDistance = 0;
                 initialPinchScale = 1;

             } else {
                  console.log("Two-finger quick lift: Not an eraser tap based on distance or number of lifted touches.");
                  // Reset flags if it wasn't an erase tap
                  isMultiTouchGestureActive = false;
                  initialPinchDistance = 0;
                  initialPinchScale = 1;
             }

             isDrawing = false; // No continuous drawing
             // Redo stack cleared later if needed.
         }
         // --- End Delayed Two-Finger Gesture End ---


        // --- Handle Ending Multi-Touch Gestures (started immediately or after timer) ---

         // --- Four-Finger Eraser End ---
         // Check if the eraser tool is active AND it was activated by the 4-finger gesture
         // AND the number of active touches has dropped below 4.
        if (currentTool === 'eraser' && toolBeforeFourFingerEraser !== 'eraser' && e.touches.length < 4) {
             e.preventDefault(); // Prevent default behavior when fingers lift
             console.log(`Four-finger eraser gesture ended. Remaining touches: ${e.touches.length}`);

             // If drawing was active during the 4-finger gesture, finalize and save.
             if (isDrawing) { // Check if erasing action was actually happening
                page.ctx.closePath(); // Close the eraser path
                // Save the canvas state after erasing, but only if something was actually drawn/erased
                 if (savedCanvasState) { // savedCanvasState is set when drawing starts (in touchstart)
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
         // Also ensure the 2-finger timer is NOT active, meaning zoom was confirmed via timer or movement.
         if (initialPinchDistance > 0 && e.touches.length < 2 && twoFingerGestureTimer === null) {
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
        // This block runs if a single-touch action is active (isDrawing or isPanning via button)
        // AND the total number of touches drops to 0 (meaning all fingers are lifted).
        // Also ensure no multi-touch gestures were active when fingers lifted to 0.
         if ((isDrawing || (isPanning && currentTool === 'pan')) && e.touches.length === 0 && !isMultiTouchGestureActive) {
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
                          // Draw a dot if the timer didn't already handle it as a tap
                           // This case might be less frequent with the timer, but keep for robustness.
                          ctx.beginPath();
                          ctx.arc(pos.x, pos.y, ctx.lineWidth / 2, 0, Math.PI * 2); // Draw dot at final pos
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
                      // The tap case should be handled by the singleTouchTimer logic now.
                      if (Math.abs(width) > 2 || Math.abs(height) > 2) { // Keep a small threshold just in case
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

        // --- Handle Implicit Ends of Multi-Touch Gestures (fingers lifted, but not all) ---
        // If a multi-touch gesture flag is active, but the number of touches drops below the required count,
        // implicitly end that specific multi-touch gesture.
        if (isMultiTouchGestureActive) {
             // If 3-finger pan was active, but touches drop below 3 (and it didn't fully end yet), reset its flag.
            if (isThreeFingerPanning && e.touches.length < 3) {
                 console.log("Three-finger pan implicitly ended due to finger lift.");
                 isThreeFingerPanning = false;
                 // Do NOT remove canvas 'active' class here, as another gesture might still be active.
                 savedCanvasState = null; // Clear any saved state related to pan start
            }
             // If 2-finger zoom was active, but touches drop below 2 (and it didn't fully end yet), reset its flags.
             // Also ensure the 2-finger timer is NOT active, meaning zoom was confirmed via timer or movement.
            if (initialPinchDistance > 0 && e.touches.length < 2 && twoFingerGestureTimer === null) {
                 console.log("Two-finger zoom implicitly ended due to finger lift.");
                 initialPinchDistance = 0;
                 initialPinchScale = 1;
            }
             // The 4-finger eraser end is handled explicitly above when tool changes and touch count drops below 4.

            // After checking implicit ends, if no multi-touch gesture is *still* active,
            // AND the total touches are not 0 (meaning some fingers are still down),
            // we might need to reset the main multi-touch flag if the user is transitioning to fewer fingers.
            // However, the touchstart logic on adding fingers should handle starting a *new* gesture.
            // Let's only reset isMultiTouchGestureActive when total touches hit 0 for simplicity and to allow transitions.
        }


         // Finally, ensure the 'active' cursor class is removed if *no* panning (button or 3-finger) is active.
         if (!isPanning && !isThreeFingerPanning) {
             canvas.classList.remove("active");
         }

         // Ensure all timers are cleared on touch end if they are still running for any reason.
         // This might be redundant but adds safety.
         clearTimeout(singleTouchTimer); singleTouchTimer = null;
         clearTimeout(twoFingerGestureTimer); twoFingerGestureTimer = null;
         delayedTouchStartData = null;

    };

     const handleTouchCancel = (e) => {
        e.preventDefault(); // Prevent default behavior

        const canvas = e.target;
        const pageIndex = pages.findIndex(p => p.canvas === canvas);
        const page = pages[pageIndex];

        if (!page || !page.ctx) {
             console.error(`Page object or context not found for touchcancel on canvas.`);
        }

        console.log(`Touch cancelled during gesture. Resetting state.`);

        // Clear all timers
        clearTimeout(singleTouchTimer); singleTouchTimer = null;
        clearTimeout(twoFingerGestureTimer); twoFingerGestureTimer = null;
        delayedTouchStartData = null; // Clear stored delayed data


        // Restore the canvas state to before the touch started if saved (for drawing/shaping)
        if (savedCanvasState) {
           if (page && page.ctx) { // Add null checks
               page.ctx.putImageData(savedCanvasState, 0, 0);
           }
           savedCanvasState = null; // Clear saved state
        }

         // Reset all gesture flags and temporary data
         isDrawing = false; // Stop any drawing in progress
         isPanning = false; // Stop any button pan in progress
         isThreeFingerPanning = false; // Stop any 3-finger pan in progress
         isMultiTouchGestureActive = false; // Reset multi-touch flag
         canvas.classList.remove("active"); // Remove grabbing cursor

         if (currentTool === 'pen') penPoints = []; // Clear temporary points
         if (currentTool === 'highlight') highlightPoints = [];
         if (page && page.tableInfo) delete page.tableInfo; // Clear temporary table info

         initialPinchDistance = 0; // Reset zoom variables
         initialPinchScale = 1;


        // If the 4-finger eraser was active due to the gesture, revert the tool on cancel
        if (currentTool === 'eraser' && toolBeforeFourFingerEraser !== 'eraser') {
             setActiveTool(toolBeforeFourFingerEraser);
             console.log("Four-finger eraser cancelled. Reverted to previous tool.");
        }
        // If the eraser was active via button, just ensure cursor is correct (handled by setActiveTool if called, or manually if not).


         // Reset composite operation and alpha
         if (page && page.ctx) { // Add null checks
             page.ctx.globalCompositeOperation = 'source-over';
             page.ctx.globalAlpha = 1.0;
         }

         // History is typically not saved on cancel, we just reverted to the previous state.
         // Redo stack is not cleared on cancel.
         updateUndoRedoButtons(); // Update button states
     };


    // Helper function to calculate the distance between two touch points
    function getDistanceBetweenTouches(touch1, touch2) {
        if (!touch1 || !touch2) return 0; // Return 0 if touches are invalid
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
