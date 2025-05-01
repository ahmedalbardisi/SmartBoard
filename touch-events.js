document.addEventListener('DOMContentLoaded', () => {
    // Touch event handlers
    const handleTouchStart = (e) => {
        e.preventDefault();

        const canvas = e.target;
        const pageIndex = pages.findIndex(p => p.canvas === canvas);
        const page = pages[pageIndex];

        if (!page || !page.ctx) {
            console.error(`Page object or context not found for touchstart on canvas.`);
            return;
        }

        // Handle multi-touch for panning (two fingers or more)
        if (e.touches.length > 1) {
            if (currentTool === 'pan') {
                isPanning = true;
                const touch = e.touches[0];
                const rect = canvas.getBoundingClientRect();
                panStartX = touch.clientX - rect.left - page.translateX;
                panStartY = touch.clientY - rect.top - page.translateY;

                canvas.classList.add("active"); // grabbing cursor
                return; // Don't draw when panning
            } else {
                // Automatically switch to pan tool if two fingers are detected
                currentTool = 'pan';
                isPanning = true;
                const touch = e.touches[0];
                const rect = canvas.getBoundingClientRect();
                panStartX = touch.clientX - rect.left - page.translateX;
                panStartY = touch.clientY - rect.top - page.translateY;
                canvas.classList.add("active");
                return; // Don't draw while panning
            }
        }

        // Handle single touch for drawing or shaping tools
        if (e.touches.length === 1 && currentTool !== 'pan') {
            isDrawing = true;
            const touch = e.touches[0];
            const pos = getMousePos(canvas, touch, page.scale, page.translateX, page.translateY); // Use the adapted getMousePos

            [lastX, lastY] = [pos.x, pos.y];
            drawStartX = pos.x;
            drawStartY = pos.y;

            // Save the canvas state before starting any drawing action
            savedCanvasState = page.ctx.getImageData(0, 0, canvas.width, canvas.height);

            // Handle tools such as pen, eraser, and highlight
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
                    page.ctx.globalAlpha = 0.5;
                    page.ctx.lineWidth = currentSize * 5;
                } else if (currentTool === 'pen') {
                    page.ctx.globalCompositeOperation = 'source-over';
                    page.ctx.globalAlpha = 1.0;
                    page.ctx.lineWidth = currentSize;
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

        // Handle panning with two or more fingers
        if (isPanning && e.touches.length > 1) {
            const touch = e.touches[0];
            const rect = canvas.getBoundingClientRect();
            page.translateX = (touch.clientX - rect.left) - panStartX;
            page.translateY = (touch.clientY - rect.top) - panStartY;

            applyTransform(page); // Update visual position
            return;
        }

        // Handle drawing or highlighting with one finger
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
            ctx.lineTo(pos.x, pos.y);
            ctx.stroke();
            [lastX, lastY] = [pos.x, pos.y];
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

        if (isPanning && e.changedTouches.length === 1) { // Assuming single touch pan
            isPanning = false;
            canvas.classList.remove("active");
            savedCanvasState = null; // Clear any saved state from potential pan start
            return;
        }

        if (!isDrawing || e.changedTouches.length === 0) return;

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
            }
            saveToHistory(pageIndex); // Save state after drawing
        }
    };

    const handleTouchCancel = (e) => {
        e.preventDefault(); // Prevent default behavior

        const canvas = e.target;
        const pageIndex = pages.findIndex(p => p.canvas === canvas);
        const page = pages[pageIndex];

        if (!page || !page.ctx || !page.canvas) {
            console.error(`Page object, context, or canvas not found for touchcancel on canvas.`);
            savedCanvasState = null;
            return;
        }

        isDrawing = false;
        isPanning = false;
        savedCanvasState = null;
        canvas.classList.remove("active");
    };

    // Attach touch event listeners
    canvas.addEventListener('touchstart', handleTouchStart);
    canvas.addEventListener('touchmove', handleTouchMove);
    canvas.addEventListener('touchend', handleTouchEnd);
    canvas.addEventListener('touchcancel', handleTouchCancel);
});
