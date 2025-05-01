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
    // Define touch event handlers

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
            isPanning = true;
            const touch = e.touches[0];
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
        } else if (currentTool === 'rect' || currentTool === 'circle' || currentTool === 'line' || currentTool === 'arrow' || currentTool === 'table') {
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
            return;
        }

        if (e.touches.length === 0) {
            if (currentTool === 'highlight') {
                saveToHistory(); // Store state for undo
                updateUndoRedoButtons();
            }
            savedCanvasState = null;
            isDrawing = false;
            isPanning = false;
            canvas.classList.remove("active");
        }
    };

    // Add touch event listeners to all canvases
    const canvases = document.querySelectorAll('.canvas-container canvas');
    canvases.forEach(canvas => {
        canvas.addEventListener('touchstart', handleTouchStart);
        canvas.addEventListener('touchmove', handleTouchMove);
        canvas.addEventListener('touchend', handleTouchEnd);
    });
});
