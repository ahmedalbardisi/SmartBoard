/**
 * Smart Whiteboard - Touch Events Functionality
 * Handles touch interactions for drawing, highlighting, erasing, and panning.
 * Includes improved multi-touch gesture recognition with delays and differentiation.
 */

// Ensure this script runs after the main Script.js and can access its variables and functions.
// Variables like pages, currentPage, currentTool, currentColor, currentSize,
// isDrawing, isPanning, panStartX, panStartY, drawStartX, drawStartY,
// savedCanvasState, highlightPoints, penPoints are assumed to be globally available from Script.js.
// Functions like getMousePos, saveToHistory, updateUndoRedoButtons, applyTransform,
// drawArrow, drawTable, setActiveTool, setCanvasCursor are also assumed to be globally available.

// --- State Variables ---
let toolBeforeFourFingerEraser = "pen"; // Stores the tool active before activating the 4-finger eraser
let initialPinchDistance = 0; // Stores the distance between fingers at the start of a pinch gesture
let initialPinchScale = 1; // Stores the canvas scale at the start of a pinch gesture
let isThreeFingerPanning = false; // Flag to indicate if the 3-finger pan gesture is active
let isMultiTouchGestureActive = false; // Flag to indicate if ANY multi-touch gesture (2, 3, or 4 fingers) is active

// --- Variables for delayed touch recognition ---
let singleTouchTimer = null; // Timer for delayed single-touch actions
let twoFingerGestureTimer = null; // Timer for determining 2-finger gesture (zoom or erase)
const gestureDetectionDelay = 200; // Milliseconds to wait before confirming a single-touch or 2-finger gesture
const minZoomDistanceThreshold = 20; // Minimum distance change in pixels to trigger zoom
const minEraserTapDistanceThreshold = 40; // Maximum initial distance between 2 fingers for it to be considered a potential eraser tap or quick close gesture

// Variables to store touch data during the delay for single touch
let delayedTouchStartData = null;


document.addEventListener('DOMContentLoaded', () => {
    // It's best practice to attach touch listeners after pages are created and initialized.
    // The `window.addTouchEventListenersToCanvas` function is provided to be called from Script.js
    // within the `createNewPage` function after a canvas element is created and added to the DOM.

    // --- Helper Function ---
    /**
     * Calculates the distance between two touch points.
     * @param {Touch} touch1 The first touch object.
     * @param {Touch} touch2 The second touch object.
     * @returns {number} The distance in pixels.
     */
    function getDistanceBetweenTouches(touch1, touch2) {
        if (!touch1 || !touch2) return 0; // Return 0 if touches are invalid
        const dx = touch2.clientX - touch1.clientX;
        const dy = touch2.clientY - touch1.clientY;
        return Math.sqrt(dx * dx + dy * dy);
    }


    // --- Touch Event Handlers ---

    const handleTouchStart = (e) => {
        // Prevent default browser behaviors like scrolling and zooming by default.
        // Specific gestures will handle their own preventDefault based on recognition.
        e.preventDefault();

        const canvas = e.target;
        const pageIndex = pages.findIndex(p => p.canvas === canvas);
        const page = pages[pageIndex];

        if (!page || !page.ctx) {
            console.error(`Page object or context not found for touchstart on canvas.`);
            return;
        }

        // --- Always clear timers on any touchstart event ---
        // This ensures that if a new gesture starts (even by adding a finger),
        // any pending delayed actions from previous touches are cancelled.
        clearTimeout(singleTouchTimer);
        singleTouchTimer = null;
        clearTimeout(twoFingerGestureTimer);
        twoFingerGestureTimer = null;
        delayedTouchStartData = null; // Clear stored data for single touch

        // --- Reset specific multi-touch flags if the touch count is low, indicating a potential new start ---
        // This helps transition from multi-touch back to single-touch or a different multi-touch.
        if (e.touches.length <= 1) {
            isThreeFingerPanning = false;
            initialPinchDistance = 0;
            initialPinchScale = 1;
            // isMultiTouchGestureActive will be set based on the checks below
            // isDrawing and isPanning flags are managed by their respective logic branches
        }


        // --- Prioritize Multi-finger Gestures based on initial touch count ---

        // --- Four-Finger Eraser Start (Immediate Recognition) ---
        // If exactly 4 fingers are down *initially*, and no other gesture is active, assume this gesture immediately.
        if (e.touches.length === 4 && !isDrawing && !isPanning && !isThreeFingerPanning && initialPinchDistance === 0) {
             isMultiTouchGestureActive = true; // Set flag
             toolBeforeFourFingerEraser = currentTool; // Save the current tool
             setActiveTool("eraser"); // Switch to the eraser tool (updates cursor)
             console.log("Four-finger eraser activated.");
             // Prepare for erasing on touchstart - similar to single-touch eraser start
             isDrawing = true; // Use isDrawing flag for the temporary erase action
             const touch = e.touches[0]; // Use the first touch for the starting point
             const pos = getMousePos(canvas, touch, page.scale, page.translateX, page.translateY);
             [lastX, lastY] = [pos.x, pos.y];
             page.ctx.beginPath();
             page.ctx.lineWidth = currentSize * 1.5; // Use eraser size
             page.ctx.globalCompositeOperation = 'destination-out'; // Erasing mode
             page.ctx.moveTo(lastX, lastY);
             return; // Consume the touchstart event
        }
        // --- End Four-Finger Eraser Start ---

        // --- Three-Finger Pan Start (Immediate Recognition) ---
        // If exactly 3 fingers are down *initially*, and no other gesture is active, assume this gesture immediately.
        if (e.touches.length === 3 && !isDrawing && !isPanning && initialPinchDistance === 0 && currentTool !== 'eraser' && toolBeforeFourFingerEraser !== 'eraser') { // Don't interfere with 4-finger erase or if eraser was active
            isMultiTouchGestureActive = true; // Set flag
            isThreeFingerPanning = true; // Activate 3-finger pan flag
            const touch = e.touches[0]; // Use the first touch for calculating movement
            const rect = canvas.getBoundingClientRect();
            // Store the starting position relative to the canvas's viewport position
            panStartX = touch.clientX - rect.left - page.translateX;
            panStartY = touch.clientY - rect.top - page.translateY;
            canvas.classList.add("active"); // grabbing cursor
            console.log("Three-finger pan started.");
            return; // Consume the touchstart event
        }
        // --- End Three-Finger Pan Start ---

        // --- Two-Finger Gesture Start (Delayed Recognition for Zoom vs. Eraser) ---
        // If exactly 2 fingers are down *initially*, start a timer to differentiate zoom/erase based on subsequent movement or lift.
        if (e.touches.length === 2 && !isDrawing && !isPanning && !isThreeFingerPanning && currentTool !== 'eraser' && toolBeforeFourFingerEraser !== 'eraser') { // Don't interfere with other gestures
             isMultiTouchGestureActive = true; // Assume multi-touch might be active
             // Store initial positions and distance for differentiation later
             const touch1 = e.touches[0];
             const touch2 = e.touches[1];
             initialPinchDistance = getDistanceBetweenTouches(touch1, touch2);
             initialPinchScale = page.scale; // Store the current scale
             console.log("Two-finger gesture detected. Starting timer to differentiate zoom/erase.");

             // Store relevant data for the timer callback
             delayedTouchStartData = {
                  canvas: canvas,
                  page: page,
                  touch1: touch1, // Store initial touch objects for distance check later
                  touch2: touch2,
                  initialPinchDistance: initialPinchDistance,
                  initialPinchScale: initialPinchScale,
                  toolBeforeGesture: currentTool // Store tool before potential erase switch
             };


             // Set a timer to check the state after the delay
             twoFingerGestureTimer = setTimeout(() => {
                 // This function runs if 2 fingers are *still* down after the delay
                 if (e.touches.length === 2 && delayedTouchStartData) {
                     const currentPinchDistance = getDistanceBetweenTouches(e.touches[0], e.touches[1]);
                     const distanceChange = Math.abs(currentPinchDistance - delayedTouchStartData.initialPinchDistance);

                     // If distance changed significantly, it's a zoom.
                     if (distanceChange > minZoomDistanceThreshold) {
                         console.log("Two-finger gesture confirmed as Zoom (via timer).");
                         // Zoom logic will be handled in touchmove since movement occurred.
                         // No need to do anything else here, just let touchmove take over.
                         // initialPinchDistance and initialPinchScale are already set.
                     }
                     // If distance did NOT change significantly and initial distance was small, it's a potential erase tap.
                     else if (delayedTouchStartData.initialPinchDistance < minEraserTapDistanceThreshold) {
                         console.log("Two-finger gesture confirmed as Eraser Tap (via timer).");
                         // Trigger eraser tap action immediately here.
                         // Simulate a quick erase action at the center point.
                         const data = delayedTouchStartData;
                          toolBeforeFourFingerEraser = data.toolBeforeGesture; // Restore saved toolBeforeFourFingerEraser
                         setActiveTool("eraser"); // Temporarily switch to eraser

                         const touch1 = e.touches[0]; // Use current touch positions
                         const touch2 = e.touches[1];
                         const centerX = (touch1.clientX + touch2.clientX) / 2;
                         const centerY = (touch1.clientY + touch2.clientY) / 2;
                         const canvasRect = canvas.getBoundingClientRect();
                         const pos = getMousePos(canvas, { clientX: centerX - canvasRect.left, clientY: centerY - canvasRect.top }, page.scale, page.translateX, page.translateY);

                         page.ctx.globalCompositeOperation = 'destination-out';
                         page.ctx.lineWidth = currentSize * 1.5; // Use eraser size

                         page.ctx.beginPath();
                         page.ctx.arc(pos.x, pos.y, page.ctx.lineWidth / 2, 0, Math.PI * 2); // Draw a small circle to erase
                         page.ctx.fill(); // Fill the circle

                         page.ctx.globalCompositeOperation = 'source-over'; // Reset composite mode

                         saveToHistory(pageIndex); // Save the erase action
                         // Revert tool immediately after the action for a tap
                         setActiveTool(toolBeforeFourFingerEraser);
                         console.log("Two-finger eraser tap action completed.");

                          // Reset flags after the tap action
                         isMultiTouchGestureActive = false; // Gesture finished
                         initialPinchDistance = 0;
                         initialPinchScale = 1;
                         delayedTouchStartData = null; // Clear stored data

                     } else {
                          console.log("Two-finger gesture: Neither zoom nor erase tap confirmed after delay.");
                          // If it wasn't a zoom or close tap after the delay, reset flags
                          isMultiTouchGestureActive = false; // Gesture finished without recognition
                          initialPinchDistance = 0;
                          initialPinchScale = 1;
                          delayedTouchStartData = null; // Clear stored data
                     }
                 } else {
                     // If the number of touches is no longer 2, the timer is irrelevant
                      console.log("Two-finger timer expired, but touch count is no longer 2. Action cancelled.");
                      // Reset flags as the intended gesture was likely aborted
                      isMultiTouchGestureActive = false;
                      initialPinchDistance = 0;
                      initialPinchScale = 1;
                      delayedTouchStartData = null; // Clear stored data
                 }
                  twoFingerGestureTimer = null; // Timer finished
             }, gestureDetectionDelay); // Set the timeout duration

             delayedTouchStartData.initialPinchDistance = initialPinchDistance; // Ensure the initial distance is stored in the delay data
             delayedTouchStartData.initialPinchScale = initialPinchScale; // Ensure the initial scale is stored

             return; // Consume the touchstart event
        }
        // --- End Two-Finger Gesture Start ---


        // --- Handle Single Touch Start (Delayed Recognition) ---
        // If exactly 1 finger is down *initially*, start a timer before allowing drawing/shaping.
        if (e.touches.length === 1 && !isMultiTouchGestureActive) { // Ensure no multi-touch gesture is active
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
                 if (e.touches.length === 1 && delayedTouchStartData && !isMultiTouchGestureActive) { // Re-check touch count and multi-touch flag
                      console.log("Single touch confirmed. Starting drawing/shaping.");
                      const data = delayedTouchStartData;

                     // Check if the tool is pan - if so, activate button pan instead of drawing
                     if (data.tool === 'pan') {
                          isPanning = true; // Activate button pan flag
                          const touch = e.touches[0]; // Use current touch position
                          const rect = canvas.getBoundingClientRect();
                          panStartX = touch.clientX - rect.left - data.page.translateX;
                          panStartY = touch.clientY - rect.top - data.page.translateY;
                          canvas.classList.add("active"); // grabbing cursor
                          console.log("Single-touch button pan started after delay.");
                     } else {
                          isDrawing = true; // Activate drawing flag for other tools

                         const pos = getMousePos(data.canvas, data.touch, data.page.scale, data.page.translateX, data.page.translateY); // Use the initial touch position

                         // Set lastX, lastY for initial point for drawing tools
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
                     }


                         delayedTouchStartData = null; // Clear stored data after use


                     } else {
                         // If the number of touches is no longer 1 or multi-touch is now active, the single touch action is cancelled.
                          console.log("Single touch timer expired, but touch count is not 1 or multi-touch active. Action cancelled.");
                          delayedTouchStartData = null; // Clear stored data
                          // No drawing or shaping action was started by this timer.
                     }
                     singleTouchTimer = null; // Timer finished
                 }, gestureDetectionDelay); // Set the timeout duration

             return; // Consume the touchstart event
        }
        // --- End Single Touch Handling ---

        // If touches.length is 0, it's likely an end event, ignore touchstart.
        // If touches.length > 4, ignore or handle as a generic multi-touch (currently ignored).
    };

    const handleTouchMove = (e) => {
        // Prevent default ONLY if a specific, handled gesture is currently active and the touch count is relevant.
        // This allows natural scrolling for unhandled touch actions outside of the canvas.
        // Note: canvas.style.touchAction = 'none' also prevents default browser scroll/zoom on the canvas element itself.
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
        // Only continue 4-finger erase if isDrawing is true AND current tool is eraser AND exactly 4 fingers are down.
        // isDrawing is set in touchstart when the 4-finger gesture is recognized.
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
        // isThreeFingerPanning is set in touchstart when the 3-finger gesture is recognized.
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

        // --- Two-Finger Zoom Move (After Timer or Immediate Significant Movement) ---
        // Only continue 2-finger zoom if isMultiTouchGestureActive is true AND exactly 2 fingers are down.
        // We also need to check if the zoom was *confirmed* (either by the timer or by significant movement).
        // If twoFingerGestureTimer is still active, movement might *confirm* the zoom.
        if (isMultiTouchGestureActive && e.touches.length === 2) {
             const currentPinchDistance = getDistanceBetweenTouches(e.touches[0], e.touches[1]);
             const distanceChange = Math.abs(currentPinchDistance - initialPinchDistance);

             // Check if zoom should start now based on significant movement while the timer is active
             if (twoFingerGestureTimer !== null && distanceChange > minZoomDistanceThreshold) {
                  console.log("Two-finger gesture confirmed as Zoom (via movement during timer).");
                  clearTimeout(twoFingerGestureTimer);
                  twoFingerGestureTimer = null; // Timer finished, zoom confirmed

                  // Proceed with zoom logic below
             }

             // If zoom was confirmed (timer is null and initialPinchDistance > 0 indicates start)
             if (twoFingerGestureTimer === null && initialPinchDistance > 0) {
                 e.preventDefault(); // Prevent default browser zoom
                 let newScale = initialPinchScale * (currentPinchDistance / initialPinchDistance);
                 newScale = Math.max(0.2, Math.min(newScale, 5)); // Clamp scale
                 page.scale = newScale;
                 applyTransform(page); // Apply the new scale
                 // console.log("Two-finger pinch/zoom active. Scale:", newScale);
                 return; // Consume the touchmove event
             }
             // If the timer is still active and movement is not enough for zoom, do nothing yet.
             // If the timer finished as an erase tap, isMultiTouchGestureActive would be false already.
        }
        // --- End Two-Finger Zoom Move ---


        // --- Handle Single Touch Drawing/Shaping or Button Pan Move ---
        // This block runs if a single-touch action is active (isDrawing or isPanning via button)
        // AND there is exactly 1 touch AND no multi-touch gesture is active.
         if ((isDrawing || (isPanning && currentTool === 'pan')) && e.touches.length === 1 && !isMultiTouchGestureActive) {
             e.preventDefault(); // Prevent default for drawing/erasing/button-pan action
             const touch = e.touches[0];
             const pos = getMousePos(page.canvas, touch, page.scale, page.translateX, page.translateY);

             // If a single touch timer was active, significant movement might cancel it and start drawing immediately.
             // This check was primarily in touchstart's timer callback, but a move right after touchstart could also trigger it.
             // The logic in touchstart sets isDrawing=true *after* the timer for single touch,
             // so if isDrawing is true here and touches.length is 1 and no multi-touch, it's a confirmed single touch move.


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


        // --- Handle Ending Gestures ---

        // --- Handle Delayed Single Touch End (as a Tap if timer active and fingers lift to 0) ---
        // If the single touch timer is still active AND total touches drop to 0, it's a tap.
        if (singleTouchTimer !== null && e.touches.length === 0) {
             e.preventDefault(); // Prevent default tap behavior
             console.log("Single touch tap confirmed after delay.");
             clearTimeout(singleTouchTimer);
             singleTouchTimer = null;
             delayedTouchStartData = null; // Clear stored data

             // Execute a tap action based on the original tool (stored in delayedTouchStartData or currentTool if timer finished)
             const tapTool = delayedTouchStartData ? delayedTouchStartData.tool : currentTool;

             // Restore canvas state before drawing the tap if saved
             if (savedCanvasState) {
                 ctx.putImageData(savedCanvasState, 0, 0);
                 savedCanvasState = null;
             }

              // Execute tap action for Pen or Highlight (draw a dot)
             if (tapTool === 'pen' || tapTool === 'highlight') {
                 ctx.strokeStyle = currentColor; // Use current color/size for the tap
                 ctx.fillStyle = currentColor;
                 ctx.globalCompositeOperation = 'source-over';
                 ctx.globalAlpha = (tapTool === 'highlight') ? 0.5 : 1.0;
                 ctx.lineWidth = (tapTool === 'highlight') ? currentSize * 5 : currentSize;

                 ctx.beginPath();
                 // Draw a small circle at the tap position (use pos from the touch that ended)
                 ctx.arc(pos.x, pos.y, ctx.lineWidth / 2, 0, Math.PI * 2);
                 ctx.fill();

                 saveToHistory(pageIndex); // Save the dot
             } else if (tapTool === 'eraser') {
                 // For eraser tap, perform a small erase at the tap location
                 ctx.globalCompositeOperation = 'destination-out';
                 ctx.lineWidth = currentSize * 1.5; // Eraser size

                 ctx.beginPath();
                 ctx.arc(pos.x, pos.y, ctx.lineWidth / 2, 0, Math.PI * 2); // Draw a small circle to erase
                 ctx.fill();

                 ctx.globalCompositeOperation = 'source-over'; // Reset composite mode

                 saveToHistory(pageIndex); // Save the erase action

             }
             // For shapes/table tap, usually no action unless specifically implemented.


             isDrawing = false; // No continuous drawing started by this tap
              // Multi-touch flag will be reset when touches length is 0 later.
             // Redo stack cleared later if needed.
         }
         // --- End Delayed Single Touch End ---


        // --- Handle Delayed Two-Finger Gesture End (as Eraser Tap or cancelled Zoom if timer active and fingers lift to 0) ---
        // If the two-finger timer is still active AND total touches drop to 0 (meaning both fingers lifted quickly)
        if (twoFingerGestureTimer !== null && e.touches.length === 0) {
             e.preventDefault(); // Prevent default behavior
             console.log("Two-finger timer active, fingers lifted to 0.");
             clearTimeout(twoFingerGestureTimer);
             twoFingerGestureTimer = null;

             // If initial distance was small and both original touches lifted (check e.changedTouches), it's an eraser tap.
             if (e.changedTouches.length === 2 && getDistanceBetweenTouches(e.changedTouches[0], e.changedTouches[1]) < minEraserTapDistanceThreshold) {
                 console.log("Two-finger quick lift confirmed as Eraser Tap.");
                  const tapToolBefore = delayedTouchStartData ? delayedTouchStartData.toolBeforeGesture : currentTool; // Use stored tool or current
                 toolBeforeFourFingerEraser = tapToolBefore; // Set this for the potential setActiveTool call
                 setActiveTool("eraser"); // Temporarily switch to eraser

                  const touch1 = e.changedTouches[0]; // Use lifted touch positions
                  const touch2 = e.changedTouches[1];
                  const centerX = (touch1.clientX + touch2.clientX) / 2;
                  const centerY = (touch1.clientY + touch2.clientY) / 2;
                  const canvasRect = canvas.getBoundingClientRect();
                  const tapPos = getMousePos(canvas, { clientX: centerX - canvasRect.left, clientY: centerY - canvasRect.top }, page.scale, page.translateX, page.translateY);

                  page.ctx.globalCompositeOperation = 'destination-out';
                  page.ctx.lineWidth = currentSize * 1.5; // Eraser size

                  page.ctx.beginPath();
                  page.ctx.arc(tapPos.x, tapPos.y, page.ctx.lineWidth / 2, 0, Math.PI * 2); // Draw a small circle to erase
                  page.ctx.fill();

                  page.ctx.globalCompositeOperation = 'source-over'; // Reset composite mode

                  saveToHistory(pageIndex); // Save the erase action
                  // Revert tool immediately after the action
                  setActiveTool(toolBeforeFourFingerEraser);
                  console.log("Two-finger eraser tap action completed.");
                  // Reset flags after the tap action
                 isMultiTouchGestureActive = false; // Gesture finished
                 initialPinchDistance = 0;
                 initialPinchScale = 1;
                 delayedTouchStartData = null;

             } else {
                  console.log("Two-finger quick lift: Not an eraser tap or zoom. Gesture cancelled.");
                  // Reset flags if it wasn't an erase tap or confirmed zoom
                  isMultiTouchGestureActive = false; // Gesture finished without recognition
                  initialPinchDistance = 0;
                  initialPinchScale = 1;
                  delayedTouchStartData = null;
             }

             isDrawing = false; // No continuous drawing started
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
         // Also ensure the 2-finger timer is NOT active (meaning zoom was confirmed).
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
        // AND the total number of touches drops to 0.
        // Ensure no multi-touch gestures were active when fingers lifted to 0, unless they just ended above.
         if ((isDrawing || (isPanning && currentTool === 'pan')) && e.touches.length === 0) {
             // Prevent default only if drawing/pan was active and all touches are lifted.
             e.preventDefault();

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
                          // This case should be less frequent with the singleTouchTimer tap logic.
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
                      if (Math.abs(width) > 2 || Math.abs(height) > 2) { // Keep a small threshold just in case timer logic didn't catch it
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
                          // No history save needed for a tap with shape/table tool unless it was a recognized tap gesture with timer.
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
        if (isMultiTouchGestureActive && e.touches.length > 0) { // Only check implicit ends if some touches remain
             // If 3-finger pan was active, but touches drop below 3, reset its flag.
            if (isThreeFingerPanning && e.touches.length < 3) {
                 console.log("Three-finger pan implicitly ended due to finger lift.");
                 isThreeFingerPanning = false;
                 // Do NOT remove canvas 'active' class here, as another gesture might still be active.
                 savedCanvasState = null; // Clear any saved state related to pan start
            }
             // If 2-finger zoom was active, but touches drop below 2, reset its flags.
             // Ensure the 2-finger timer is NOT active (meaning zoom was confirmed).
            if (initialPinchDistance > 0 && e.touches.length < 2 && twoFingerGestureTimer === null) {
                 console.log("Two-finger zoom implicitly ended due to finger lift.");
                 initialPinchDistance = 0;
                 initialPinchScale = 1;
            }
             // The 4-finger eraser end is handled explicitly above when tool changes and touch count drops below 4.
        }


         // Finally, ensure the 'active' cursor class is removed if *no* panning (button or 3-finger) is active.
         if (!isPanning && !isThreeFingerPanning) {
             canvas.classList.remove("active");
         }

         // Ensure any pending timers are cleared if fingers were lifted and they weren't handled explicitly.
         // This helps prevent unexpected actions if touches end in complex ways.
         if (e.touches.length === 0) { // If all touches are gone, clear any remaining timers
              clearTimeout(singleTouchTimer); singleTouchTimer = null;
              clearTimeout(twoFingerGestureTimer); twoFingerGestureTimer = null;
              delayedTouchStartData = null;
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

        console.log(`Touch cancelled during gesture. Resetting state.`);

        // Clear all timers
        clearTimeout(singleTouchTimer); singleTouchTimer = null;
        clearTimeout(twoFingerGestureTimer); twoFingerGestureTimer = null;
        delayedTouchStartData = null; // Clear stored delayed data


        // Restore the canvas state to before the touch started if saved (for drawing/shaping previews)
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


    // Function to get mouse or touch position relative to canvas, considering pan and zoom
    // Keep the existing getMousePos function from Script.js, it should handle both mouse and touch.
    // Ensure the one in Script.js is available globally.
    // function getMousePos(canvas, evt, currentScale, currentTranslateX, currentTranslateY) { ... }


    // --- Function to add touch listeners to a canvas ---
    // This function should be called from Script.js whenever a new canvas page is created.
    window.addTouchEventListenersToCanvas = function(canvas, pageIndex) {
        if (!canvas) {
            console.error("Cannot add touch event listeners: canvas is null.");
            return;
        }
        // Check if listeners are already added to avoid duplicates
        if (canvas.dataset.touchListenersAdded) {
            console.warn(`Touch listeners already added to canvas for page ${pageIndex + 1}. Skipping re-attachment.`);
            return;
        }

        canvas.addEventListener("touchstart", handleTouchStart);
        canvas.addEventListener("touchmove", handleTouchMove);
        canvas.addEventListener("touchend", handleTouchEnd);
        canvas.addEventListener("touchcancel", handleTouchCancel);


        // Disable default touch actions like double-tap zoom and scroll on the canvas element itself.
        // This is crucial for custom gesture handling.
        canvas.style.touchAction = 'none'; // Modern standard
        canvas.style.msTouchAction = 'none'; // For Internet Explorer (older spec)

        canvas.dataset.touchListenersAdded = 'true'; // Mark as added
        console.log(`Touch event listeners added to canvas for page ${pageIndex + 1}.`);
    };


    // --- Initial attachment of listeners ---
    // This loop attempts to attach listeners to any canvases that might exist when this script loads initially.
    // However, the primary way listeners should be added is by calling `window.addTouchEventListenersToCanvas`
    // from the `createNewPage` function in Script.js, right after the canvas is created and added to the DOM.
    document.querySelectorAll('.page canvas').forEach((canvas, index) => {
         // Ensure the global 'pages' array and the specific page data exist before attempting to add listeners.
         // This script might load before `initApp` in Script.js has fully populated the `pages` array.
         if (window.pages && pages[index]) { // Check for pages array and page object existence
              window.addTouchEventListenersToCanvas(canvas, index);
         } else {
             // Log a warning if page data is missing during this initial loop.
             // This indicates that the integration point in Script.js is the primary method needed.
             console.warn(`Page data missing for canvas at index ${index} during initial touch listener attachment. Ensure createNewPage in Script.js calls addTouchEventListenersToCanvas.`);
         }
    });

});
