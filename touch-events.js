/**
 * Smart Whiteboard - Enhanced Touch Events Functionality
 * Handles touch interactions for drawing, highlighting, erasing, and panning.
 * Adds support for temporary panning with multi-touch while using drawing tools.
 */

// Ensure this script runs after the main Script.js and can access its variables and functions.
// Variables like pages, currentPage, currentTool, currentColor, currentSize,
// isDrawing, isPanning, panStartX, panStartY, drawStartX, drawStartY,
// savedCanvasState, highlightPoints, penPoints are assumed to be globally available from Script.js.
// Functions like getMousePos, saveToHistory, updateUndoRedoButtons, applyTransform,
// drawArrow, drawTable are also assumed to be globally available.

document.addEventListener('DOMContentLoaded', () => {
    // New variables for enhanced touch functionality
    let previousTool = null;          // Store previous tool when temporarily switching to pan
    let isTemporaryPanning = false;   // Flag for temporary panning mode
    let pinchStartDistance = 0;       // For pinch-to-zoom functionality
    let initialScale = 1;             // Store initial scale for pinch zoom calculations
    let pinchCenter = { x: 0, y: 0 }; // Center point of pinch gesture
    let touchIdentifiers = [];        // Track touch identifiers to ensure we follow the same touches

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

        // Store touch identifiers at start
        touchIdentifiers = Array.from(e.touches).map(touch => touch.identifier);

        // Multi-touch handling for panning and zooming
        if (e.touches.length > 1) {
            // If already drawing, cancel it to avoid drawing while panning
            if (isDrawing) {
                isDrawing = false;
                if (savedCanvasState) {
                    page.ctx.putImageData(savedCanvasState, 0, 0);
                    savedCanvasState = null;
                }
                
                // Clear any temporary points
                if (currentTool === 'pen') penPoints = [];
                if (currentTool === 'highlight') highlightPoints = [];
            }
            
            // If currentTool is not 'pan', then switch to temporary panning mode
            if (currentTool !== 'pan') {
                previousTool = currentTool;
                isTemporaryPanning = true;
                console.log(`Temporarily switching from ${previousTool} to pan mode`);
            }
            
            // Enable panning with multi-touch
            isPanning = true;
            const touch = e.touches[0];
            const rect = canvas.getBoundingClientRect();
            panStartX = touch.clientX - rect.left - page.translateX;
            panStartY = touch.clientY - rect.top - page.translateY;

            // Set up for pinch-to-zoom if we have exactly 2 touches
            if (e.touches.length === 2) {
                const touch1 = e.touches[0];
                const touch2 = e.touches[1];
                pinchStartDistance = Math.hypot(
                    touch1.clientX - touch2.clientX,
                    touch1.clientY - touch2.clientY
                );
                initialScale = page.scale;
                
                // Store the center point of the pinch
                const rect = canvas.getBoundingClientRect();
                pinchCenter = {
                    x: (touch1.clientX + touch2.clientX) / 2 - rect.left,
                    y: (touch1.clientY + touch2.clientY) / 2 - rect.top
                };
            }

            canvas.classList.add("active"); // grabbing cursor
            return; // Don't draw when multi-touch panning
        }

        // Handle single touch based on current tool
        if (e.touches.length === 1) {
            // If in pan mode, handle the panning
            if (currentTool === 'pan') {
                isPanning = true;
                const touch = e.touches[0];
                const rect = canvas.getBoundingClientRect();
                panStartX = touch.clientX - rect.left - page.translateX;
                panStartY = touch.clientY - rect.top - page.translateY;
                canvas.classList.add("active"); // grabbing cursor
                return; // Don't draw when in pan mode
            }
            
            // For drawing tools
            isDrawing = true;
            const touch = e.touches[0];
            const pos = getMousePos(canvas, touch, page.scale, page.translateX, page.translateY);

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

        // Check if we have new touches that weren't in the original set
        // This helps detect when a new finger is added during the gesture
        const currentIdentifiers = Array.from(e.touches).map(touch => touch.identifier);
        const newTouchAdded = currentIdentifiers.some(id => !touchIdentifiers.includes(id));
        
        // If a new touch was added and we're drawing, switch to panning
        if (newTouchAdded && isDrawing && e.touches.length > 1) {
            // Cancel drawing and switch to temporary panning
            if (currentTool !== 'pan') {
                previousTool = currentTool;
                isTemporaryPanning = true;
                console.log(`New touch detected: switching from ${previousTool} to pan mode`);
            }
            
            isDrawing = false;
            isPanning = true;
            
            // Restore canvas state if we were in the middle of drawing
            if (savedCanvasState) {
                page.ctx.putImageData(savedCanvasState, 0, 0);
                // Don't clear savedCanvasState yet, in case we need to resume drawing
            }
            
            // Set up panning from current position
            const touch = e.touches[0];
            const rect = canvas.getBoundingClientRect();
            panStartX = touch.clientX - rect.left - page.translateX;
            panStartY = touch.clientY - rect.top - page.translateY;
            
            canvas.classList.add("active"); // grabbing cursor
            
            // Update touch identifiers to track the new set
            touchIdentifiers = currentIdentifiers;
        }

        // Handle panning - both regular and temporary
        if (isPanning && e.touches.length > 0) {
            const touch = e.touches[0];
            const rect = canvas.getBoundingClientRect();
            
            // Calculate new translate values based on touch movement relative to pan start
            page.translateX = (touch.clientX - rect.left) - panStartX;
            page.translateY = (touch.clientY - rect.top) - panStartY;
            
            // Handle pinch zoom with two fingers
            if (e.touches.length === 2) {
                const touch1 = e.touches[0];
                const touch2 = e.touches[1];
                const currentDistance = Math.hypot(
                    touch1.clientX - touch2.clientX,
                    touch1.clientY - touch2.clientY
                );
                
                // Calculate center point of the pinch
                const rect = canvas.getBoundingClientRect();
                const pinchCenterX = (touch1.clientX + touch2.clientX) / 2 - rect.left;
                const pinchCenterY = (touch1.clientY + touch2.clientY) / 2 - rect.top;
                
                // Calculate new scale based on the change in distance
                if (pinchStartDistance > 0) {
                    const oldScale = page.scale;
                    const scaleFactor = currentDistance / pinchStartDistance;
                    const newScale = initialScale * scaleFactor;
                    
                    // Limit the scale to prevent extreme zoom levels
                    page.scale = Math.max(0.25, Math.min(newScale, 5.0));
                    
                    // Adjust the translate values to zoom around the pinch center
                    // Convert pinch center to canvas coordinates before scale change
                    const pinchCanvasX = (pinchCenterX - page.translateX) / oldScale;
                    const pinchCanvasY = (pinchCenterY - page.translateY) / oldScale;
                    
                    // Calculate the difference in position after scale change
                    page.translateX = pinchCenterX - pinchCanvasX * page.scale;
                    page.translateY = pinchCenterY - pinchCanvasY * page.scale;
                }
            }

            applyTransform(page); // Update visual position and scale
            return;
        }

        if (!isDrawing || e.touches.length === 0) return;

        // Only continue drawing if we're in drawing mode and using a single touch
        if (e.touches.length === 1) {
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
        } else if (e.touches.length > 1 && isDrawing) {
            // If we somehow got here with multiple touches while drawing, switch to panning
            isDrawing = false;
            isPanning = true;
            if (currentTool !== 'pan') {
                previousTool = currentTool;
                isTemporaryPanning = true;
                console.log(`Multiple touches detected during drawing: switching to pan mode`);
            }
            
            // Update touch identifiers to track the current set
            touchIdentifiers = Array.from(e.touches).map(touch => touch.identifier);
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
            touchIdentifiers = [];
            return;
        }

        // Update the current touch identifiers list to remove ended touches
        const endedIdentifiers = Array.from(e.changedTouches).map(touch => touch.identifier);
        touchIdentifiers = touchIdentifiers.filter(id => !endedIdentifiers.includes(id));

        // Reset temporary panning mode if all touches are released
        if (e.touches.length === 0 && isTemporaryPanning) {
            // Switch back to the previous tool
            console.log(`Switching back from temporary pan to ${previousTool}`);
            currentTool = previousTool;
            previousTool = null;
            isTemporaryPanning = false;
            
            // Update UI to reflect the tool change (if needed)
            // This assumes there's a function or mechanism to update the UI
            // when the current tool changes, like highlighting the active tool button
            document.querySelectorAll('.tool-btn').forEach(btn => {
                btn.classList.remove('active');
                if (btn.getAttribute('data-tool') === currentTool) {
                    btn.classList.add('active');
                }
            });
        }

        // Handle end of panning
        if (isPanning) {
            // If still have touches, continue panning but update the reference point
            if (e.touches.length > 0) {
                const touch = e.touches[0];
                const rect = canvas.getBoundingClientRect();
                panStartX = touch.clientX - rect.left - page.translateX;
                panStartY = touch.clientY - rect.top - page.translateY;
            } else {
                // All touches removed, end panning
                isPanning = false;
                canvas.classList.remove("active");
                savedCanvasState = null; // Clear any saved state from potential pan start
                pinchStartDistance = 0;   // Reset pinch distance
                touchIdentifiers = [];    // Clear touch identifiers
            }
            
            // No history save needed for pan/zoom transforms as they are applied directly
            return;
        }

        if (!isDrawing || e.changedTouches.length === 0) {
            // If drawing wasn't active or no touches ended, just return
            return;
        }

        // If we still have touches but the drawing touch ended, cancel drawing
        if (e.touches.length > 0) {
            isDrawing = false;
            if (savedCanvasState) {
                page.ctx.putImageData(savedCanvasState, 0, 0);
                savedCanvasState = null;
            }
            
            // Clear any temporary points
            if (currentTool === 'pen') penPoints = [];
            if (currentTool === 'highlight') highlightPoints = [];
            if (page.tableInfo) delete page.tableInfo;
            return;
        }

        // Normal drawing touch end with no remaining touches
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
        
        // Clear touch identifiers as we're done with the gesture
        touchIdentifiers = [];
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
            touchIdentifiers = [];
            return;
        }

        // Reset temporary panning mode if touch is cancelled
        if (isTemporaryPanning) {
            currentTool = previousTool;
            previousTool = null;
            isTemporaryPanning = false;
            
            // Update UI to reflect the tool change
            document.querySelectorAll('.tool-btn').forEach(btn => {
                btn.classList.remove('active');
                if (btn.getAttribute('data-tool') === currentTool) {
                    btn.classList.add('active');
                }
            });
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

            // Reset pinch zoom variables
            pinchStartDistance = 0;

            // Clear any temporary points or table info
            if (currentTool === 'pen') penPoints = [];
            if (currentTool === 'highlight') highlightPoints = [];
            if (page.tableInfo) delete page.tableInfo;

            // No history save on cancel - just revert to the previous state
        }

        // Reset composite operation and alpha
        page.ctx.globalCompositeOperation = 'source-over';
        page.ctx.globalAlpha = 1.0;

        updateUndoRedoButtons(); // Update button states as history might have been affected by restore
        
        // Clear touch identifiers as the gesture is cancelled
        touchIdentifiers = [];
    };

    // Export function to add touch listeners to canvas
    window.addTouchEventListenersToCanvas = function(canvas, pageIndex) {
        if (!canvas) {
            console.error("Cannot add touch event listeners: canvas is null.");
            return;
        }
        // Check if listeners are already added to avoid duplicates
        if (canvas.dataset.touchListenersAdded) {
            return;
        }

        canvas.addEventListener("touchstart", handleTouchStart, { passive: false });
        canvas.addEventListener("touchmove", handleTouchMove, { passive: false });
        canvas.addEventListener("touchend", handleTouchEnd, { passive: false });
        canvas.addEventListener("touchcancel", handleTouchCancel, { passive: false });

        canvas.dataset.touchListenersAdded = 'true'; // Mark as added
        console.log(`Enhanced touch event listeners added to canvas for page ${pageIndex + 1}.`);
    };

    // Attach listeners to any canvases that might exist when this script loads initially
    document.querySelectorAll('.page canvas').forEach((canvas, index) => {
        // Ensure the page data exists before attempting to add listeners
        if (pages[index]) {
            window.addTouchEventListenersToCanvas(canvas, index);
        }
    });
});
