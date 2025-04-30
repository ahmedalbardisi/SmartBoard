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

document.addEventListener('DOMContentLoaded', () => {
    // It's better to attach touch listeners after pages are created in initApp
    // We can add a function call in Script.js initApp or listen for a custom event
    // or simply wait a moment, but a cleaner way is to integrate this into the page creation process.

    // Let's define the touch event handlers first
    const handleTouchStart = (e) => {
        // Prevent default to avoid unexpected browser behaviors like scrolling and zooming
        // We'll handle specific gestures ourselves.
        // e.preventDefault(); // Keep this line for now, may adjust behavior based on specific gesture count later

        const canvas = e.target;
        const pageIndex = pages.findIndex(p => p.canvas === canvas);
        const page = pages[pageIndex];

        if (!page || !page.ctx) {
            console.error(`Page object or context not found for touchstart on canvas.`);
            return;
        }

        // --- Added for Four-Finger Eraser ---
        if (e.touches.length === 4) {
             e.preventDefault(); // Prevent default browser behavior for this gesture
             // Save the current tool before switching to eraser
             toolBeforeFourFingerEraser = currentTool;
             setActiveTool("eraser"); // Switch to the eraser tool (this will also update the cursor)
             console.log("Four-finger eraser activated.");
             // Immediately start erasing if the touch happens on content
             isDrawing = true; // Set isDrawing to true to allow immediate erasing on touchstart
             const touch = e.touches[0]; // Use the first touch for the starting point
             const pos = getMousePos(canvas, touch, page.scale, page.translateX, page.translateY);
             [lastX, lastY] = [pos.x, pos.y];

             // Prepare context for erasing
             page.ctx.beginPath();
             page.ctx.lineWidth = currentSize * 1.5; // Use eraser size, potentially larger
             page.ctx.globalCompositeOperation = 'destination-out'; // This is key for erasing
             page.ctx.moveTo(lastX, lastY);

             return; // Don't proceed with other touch logic
        }
        // --- End Added for Four-Finger Eraser ---

        // --- Added for Three-Finger Pan ---
        // Check for exactly 3 touches. The `currentTool !== 'pan'` check in single-touch is still valid for the button.
        if (e.touches.length === 3) {
            e.preventDefault(); // Prevent default browser scroll/zoom for this gesture
            isPanning = true;
            const touch = e.touches[0]; // Use the first touch for calculating movement
            const rect = canvas.getBoundingClientRect();
            // Store the starting position relative to the canvas's viewport position,
            // taking into account the current pan offset.
            panStartX = touch.clientX - rect.left - page.translateX;
            panStartY = touch.clientY - rect.top - page.translateY;
            canvas.classList.add("active"); // grabbing cursor (assuming .active sets this)
            console.log("Three-finger pan started.");
            return; // Don't proceed with drawing or other logic if panning
        }
        // --- End Added for Three-Finger Pan ---

        // --- Added for Two-Finger Zoom ---
        // Check for exactly 2 touches.
        if (e.touches.length === 2) {
            e.preventDefault(); // Prevent default browser zoom
            initialPinchDistance = getDistanceBetweenTouches(e.touches[0], e.touches[1]);
            initialPinchScale = page.scale; // Store the current scale
            console.log("Two-finger pinch/zoom started.");
            // No return here, as a tap with two fingers could potentially still be interpreted by other logic
            // if not explicitly handled. However, typically 2 fingers implies zoom, so returning might be desired.
            // Let's return to ensure only zoom logic is processed for 2 fingers.
            return;
        }
        // --- End Added for Two-Finger Zoom ---


        // Handle single touch for drawing/shaping tools (Keep existing logic)
        // This part will only run if none of the multi-touch gestures were detected.
        if (e.touches.length === 1 && currentTool !== 'pan') {
            isDrawing = true;
            const touch = e.touches[0];
            const pos = getMousePos(canvas, touch, page.scale, page.translateX, page.translateY);

            [lastX, lastY] = [pos.x, pos.y];
            drawStartX = pos.x;
            drawStartY = pos.y;

            // Save the canvas state before starting any drawing or shape action
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
                     // For highlight, start collecting points
                     highlightPoints = [{ x: pos.x, y: pos.y }];
                 } else if (currentTool === 'pen') { // Add logic for pen points
                      penPoints = [{ x: pos.x, y: pos.y }];
                 }

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
        }
    };

    const handleTouchMove = (e) => {
        e.preventDefault(); // Prevent scrolling for all handled touch gestures

        const canvas = e.target;
        const pageIndex = pages.findIndex(p => p.canvas === canvas);
        const page = pages[pageIndex];

         if (!page || !page.ctx || !page.canvas) {
              console.error(`Page object, context, or canvas not found for touchmove on canvas.`);
              return;
         }
         const ctx = page.ctx;

        // --- Added for Two-Finger Zoom ---
        // Check if there are exactly two fingers and initial pinch distance was set
        if (e.touches.length === 2 && initialPinchDistance > 0) {
            e.preventDefault(); // Prevent default browser zoom
            const currentPinchDistance = getDistanceBetweenTouches(e.touches[0], e.touches[1]);
            // Calculate the new scale based on the ratio of current to initial distance
            let newScale = initialPinchScale * (currentPinchDistance / initialPinchDistance);

            // Clamp the scale to a reasonable range (e.g., 0.2x to 5x)
            newScale = Math.max(0.2, Math.min(newScale, 5));

            // Optional: Adjust pan during zoom to keep the center of the pinch/spread in view
            // This requires calculating the center point of the touches and adjusting translateX/Y
            // based on the change in scale and the center point. This is more complex and omitted
            // for this basic implementation. The current pan will be maintained.

            page.scale = newScale;
            applyTransform(page); // Apply the new scale

            console.log("Two-finger pinch/zoom active. Scale:", newScale);
            return; // Don't proceed with other touch logic
        }
        // --- End Added for Two-Finger Zoom ---

        // --- Added for Three-Finger Pan ---
        // Check if currently panning (either via button or gesture) and there are still 3 fingers for the gesture
        // Or if currentTool is 'pan' and there's one finger for the button-activated pan.
         if (isPanning) { // Check if panning flag is true
             if (e.touches.length === 3) { // If 3 fingers, continue gesture pan
                 const touch = e.touches[0]; // Use the first touch for calculating movement
                 const rect = canvas.getBoundingClientRect();
                 // Calculate new translate values based on touch movement relative to pan start
                 page.translateX = (touch.clientX - rect.left) - panStartX;
                 page.translateY = (touch.clientY - rect.top) - panStartY;

                 applyTransform(page); // Update visual position
                 return; // Don't proceed with drawing logic if panning
             } else if (e.touches.length === 1 && currentTool === 'pan') {
                 // This handles the button-activated single-touch pan move
                  const touch = e.touches[0];
                  const rect = canvas.getBoundingClientRect();
                  page.translateX = (touch.clientX - rect.left) - panStartX;
                  page.translateY = (touch.clientY - rect.top) - panStartY;
                  applyTransform(page);
                  return; // Don't proceed with drawing logic
             }
         }
         // --- End Added for Three-Finger Pan ---


        if (!isDrawing || e.touches.length === 0) return;

        const touch = e.touches[0];
        const pos = getMousePos(page.canvas, touch, page.scale, page.translateX, page.translateY);


        // --- Existing drawing/shaping touchmove logic ---
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

        } else if (currentTool === 'eraser') { // Eraser uses simple lineTo
             const ctx = page.ctx;
             ctx.lineTo(pos.x, pos.y); // Corrected typo here from pos.x, pos.x
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
        // --- End Existing drawing/shaping touchmove logic ---
    };

    const handleTouchEnd = (e) => {
        // e.preventDefault(); // Keep this line for now, adjust based on specific gesture count if needed

        const canvas = e.target;
        const pageIndex = pages.findIndex(p => p.canvas === canvas);
        const page = pages[pageIndex];

        if (!page || !page.ctx || !page.canvas) {
             console.error(`Page object, context, or canvas not found for touchend on canvas.`);
             savedCanvasState = null;
             isDrawing = false;
             isPanning = false;
             canvas.classList.remove("active");
             if (currentTool === 'pen') penPoints = [];
             if (currentTool === 'highlight') highlightPoints = [];
             if (page && page.tableInfo) delete page.tableInfo;
              // --- Added for Two-Finger Zoom ---
             initialPinchDistance = 0; // Reset zoom variables on error
             initialPinchScale = 1;
              // --- End Added ---
             return;
        }

         // --- Added for Four-Finger Eraser ---
         // Check if the current tool is eraser AND the number of active touches has dropped below 4.
         // This indicates the four-finger gesture has ended.
         if (currentTool === 'eraser' && e.touches.length < 4) {
             e.preventDefault(); // Prevent default browser behavior when fingers lift
             // Finalize the erasing stroke (if any was made during the gesture)
             // Note: The actual drawing/erasing on the canvas happens in touchmove/touchend of the eraser tool itself.
             // We just need to save the state after the temporary tool usage ends.

             // If drawing was active during the 4-finger gesture, save the state.
             if (isDrawing) {
                 page.ctx.closePath(); // Close the eraser path
                 saveToHistory(pageIndex); // Save the canvas state after erasing
             }
             savedCanvasState = null; // Clear saved state

             // Revert to the tool that was active before the four-finger gesture
             setActiveTool(toolBeforeFourFingerEraser);
             console.log(`Four-finger eraser deactivated. Reverted to ${currentTool}.`);

             isDrawing = false; // Ensure drawing is off after lifting fingers
             return; // Don't proceed with other touch logic
         }
         // --- End Added for Four-Finger Eraser ---

         // --- Added for Two-Finger Zoom ---
         // Check if initial pinch distance was set (meaning a zoom gesture started) AND the number of active touches has dropped below 2.
         if (initialPinchDistance > 0 && e.touches.length < 2) {
             e.preventDefault(); // Prevent default browser behavior when fingers lift
             initialPinchDistance = 0; // Reset pinch variables
             initialPinchScale = 1;
             console.log("Two-finger pinch/zoom ended.");
             // No history save needed for zoom transforms as they are applied directly to the element style.
             return; // Don't proceed with other touch logic
         }
         // --- End Added for Two-Finger Zoom ---

        // --- Added for Three-Finger Pan ---
        // Check if panning was active AND the number of active touches has dropped below 3 (for the gesture)
        // OR if currentTool was 'pan' AND the number of active touches has dropped to 0 (for the button-activated pan).
        if (isPanning) { // Check if panning flag is true
             if (e.touches.length < 3 && initialPinchDistance === 0) { // If 3-finger pan ended and not immediately starting 2-finger zoom
                 e.preventDefault(); // Prevent default browser behavior
                 isPanning = false;
                 canvas.classList.remove("active"); // Remove grabbing cursor
                 savedCanvasState = null; // Clear any saved state from potential pan start
                 console.log("Three-finger pan ended.");
                 // No history save needed for pan transforms.
                 return; // Don't proceed with drawing logic
             } else if (currentTool === 'pan' && e.touches.length === 0) {
                 // This handles the button-activated single-touch pan end
                  isPanning = false;
                  canvas.classList.remove("active");
                   savedCanvasState = null;
                   console.log("Button-activated pan ended.");
                  return;
             }
        }
        // --- End Added for Three-Finger Pan ---


        if (!isDrawing || e.changedTouches.length === 0) {
            // If drawing wasn't active or no touches ended, just return
            return;
        }
        isDrawing = false; // Stop drawing

        const ctx = page.ctx;
        const touch = e.changedTouches[0]; // Get the touch that ended to finalize its position
        const pos = getMousePos(page.canvas, touch, page.scale, page.translateX, page.translateY);


         // --- Existing drawing/shaping touchend logic ---
         if (currentTool === 'pen' || currentTool === 'highlight') { // Apply to both pen and highlight
              // Restore the canvas to the state before starting the current stroke preview/draw
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
                const lastPoint = points[points.length - 1];
                // Draw the last segment to the actual point where the touch ended
                ctx.lineTo(pos.x, pos.y);
                 ctx.stroke();
             } else if (points.length === 1) {
                 // Draw a dot if there's only one point (tap without drag)
                 ctx.beginPath();
                 // Draw a small circle at the single point
                 ctx.arc(points[0].x, points[0].y, ctx.lineWidth / 2, 0, Math.PI * 2);
                 ctx.fillStyle = ctx.strokeStyle; // Fill with the stroke color
                 ctx.fill();
             }


            if (currentTool === 'pen') penPoints = []; // Clear pen points
            if (currentTool === 'highlight') highlightPoints = []; // Clear highlight points

            saveToHistory(pageIndex); // Save state after drawing the stroke

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

             ctx.strokeStyle = currentColor;
             ctx.lineWidth = currentSize;
             ctx.globalAlpha = 1.0; // Shapes/Tables are usually not semi-transparent
             ctx.globalCompositeOperation = 'source-over'; // Draw on top

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
                 } else if (currentTool === 'table' && page.tableInfo) { // Draw the final table
                      drawTable(ctx, page.tableInfo.startX, page.tableInfo.startY, width, height, page.tableInfo.rows, page.tableInfo.cols);
                     // Clear temporary table info after drawing
                     delete page.tableInfo;
                 }
                 ctx.closePath(); // Close path after drawing the final shape/table

                saveToHistory(pageIndex); // Save after drawing the shape/table
             } else {
                 // If it was just a tap, clear the temporary table info if it exists for the table tool
                 if (currentTool === 'table' && page.tableInfo) {
                     delete page.tableInfo;
                 }
                 // For other tools, a tap might not result in a drawing action, so no save needed.
             }
         }
         // --- End Existing drawing/shaping touchend logic ---


        // Reset composite operation and alpha to default after any drawing/shaping action
        ctx.globalCompositeOperation = 'source-over';
        ctx.globalAlpha = 1.0;

        // Clear redo stack for the current page whenever a new action is performed (drawing or shape)
        // Pan and zoom do not clear the redo stack as they are view transforms, not content changes.
        if (currentTool !== 'pan') { // Only clear redo stack if the tool was not pan
             page.redoStack = [];
             updateUndoRedoButtons(); // Update button states
        }
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
             // Clear temporary points arrays and reset zoom variables in case of cancel
             if (currentTool === 'pen') penPoints = [];
             if (currentTool === 'highlight') highlightPoints = [];
             if (page && page.tableInfo) delete page.tableInfo;
             // --- Added for Two-Finger Zoom ---
             initialPinchDistance = 0;
             initialPinchScale = 1;
              // --- End Added ---
             return;
        }

         // If drawing or panning was in progress, cancel it
        if (isDrawing || isPanning) {
             console.log(`Touch cancelled during ${isDrawing ? 'drawing' : 'panning'}. Restoring canvas state if necessary.`);

            // Restore the canvas state to before the touch started
            if (savedCanvasState) {
               page.ctx.putImageData(savedCanvasState, 0, 0);
               savedCanvasState = null; // Clear saved state
            }

             isDrawing = false;
             isPanning = false;
             canvas.classList.remove("active"); // Remove grabbing cursor

             // Clear any temporary points or table info
             if (currentTool === 'pen') penPoints = [];
             if (currentTool === 'highlight') highlightPoints = [];
             if (page.tableInfo) delete page.tableInfo;
             // --- Added for Two-Finger Zoom ---
             initialPinchDistance = 0; // Reset pinch variables on cancel
             initialPinchScale = 1;
              // --- End Added ---

            // If the 4-finger eraser was active, revert to the previous tool on cancel
            if (currentTool === 'eraser' && toolBeforeFourFingerEraser !== 'eraser') {
                 setActiveTool(toolBeforeFourFingerEraser);
                 console.log("Four-finger eraser cancelled. Reverted to previous tool.");
            }


            // No history save on cancel - just revert to the previous state
            // The state before the touch was saved in touchstart (as savedCanvasState)
            // and we've just restored it.
        }

         // Reset composite operation and alpha
         page.ctx.globalCompositeOperation = 'source-over';
         page.ctx.globalAlpha = 1.0;

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
        // This might be redundant due to e.preventDefault() in handlers, but good practice.
        canvas.style.touchAction = 'none';
        canvas.style.msTouchAction = 'none'; // For Internet Explorer

        canvas.dataset.touchListenersAdded = 'true'; // Mark as added
        console.log(`Touch event listeners added to canvas for page ${pageIndex + 1}.`);
    };


    // Attach listeners to any canvases that might exist when this script loads initially
    // This is a fallback/initial attachment, but the main attachment should be in createNewPage
    document.querySelectorAll('.page canvas').forEach((canvas, index) => {
         // Ensure the page data exists before attempting to add listeners
         // This is important because this script might load before pages are fully initialized in Script.js
         // A more robust solution is to ensure initApp in Script.js calls addTouchEventListenersToCanvas
         // for each page *after* the page object is created and added to the pages array.
         if (pages && pages[index]) { // Add check for pages array existence
              window.addTouchEventListenersToCanvas(canvas, index);
         } else {
             console.warn(`Page data not fully initialized for canvas at index ${index} during initial touch listener attachment.`);
             // You might need to ensure `initApp` in Script.js handles calling
             // `window.addTouchEventListenersToCanvas(canvas, pages.length - 1);`
             // right after `pages.push(pageData);` in `createNewPage()`.
         }
    });

});
