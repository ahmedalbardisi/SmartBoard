/**
 * السبورة الذكية - أحداث الرسم بالماوس
 * Smart Whiteboard - Mouse Canvas Drawing Events
 */

// -------------------- ربط أحداث اللوحة (Canvas Event Setup) --------------------

function setupCanvasEventListeners(canvas, pageIndex) {
    const page = pages[pageIndex];

    if (!canvas || !page || !page.ctx) {
        console.error(`Canvas, page object, or context not found for page index ${pageIndex}. Cannot setup event listeners.`);
        return;
    }

    // ---------- mousedown ----------
    canvas.addEventListener("mousedown", (e) => {
        // أداة الصورة تعمل على الطبقة الخاصة بها - لا تعالج هنا
        if (currentTool === 'image-select') return;

        if (currentTool === 'pan') {
            isPanning = true;
            panStartX = e.clientX - page.translateX;
            panStartY = e.clientY - page.translateY;
            canvas.classList.add("active");
            return;
        }

        isDrawing = true;
        const pos = getMousePos(canvas, e, page.scale, page.translateX, page.translateY);
        [lastX, lastY] = [pos.x, pos.y];
        drawStartX = pos.x;
        drawStartY = pos.y;

        savedCanvasState = page.ctx.getImageData(0, 0, canvas.width, canvas.height);

        if (currentTool === 'table') {
            const rows = parseInt(tableRowsInput.value);
            const cols = parseInt(tableColsInput.value);
            page.tableInfo = { startX: drawStartX, startY: drawStartY, rows, cols };
        }

        if (currentTool === 'pen' || currentTool === 'eraser' || currentTool === 'highlight') {
            page.ctx.beginPath();

            if (currentTool === 'highlight') {
                highlightPoints = [{ x: pos.x, y: pos.y }];
            } else if (currentTool === 'pen') {
                penPoints = [{ x: pos.x, y: pos.y }];
            }

            page.ctx.lineWidth  = currentSize;
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
    });

    // ---------- mousemove ----------
    canvas.addEventListener("mousemove", (e) => {
        if (currentTool === 'image-select') return;

        if (isPanning) {
            const pg = pages[pageIndex];
            if (pg) {
                pg.translateX = e.clientX - panStartX;
                pg.translateY = e.clientY - panStartY;
                applyTransform(pg);
            }
            return;
        }

        if (!isDrawing) return;

        const pg = pages[pageIndex];
        if (!pg || !pg.ctx || !pg.canvas) {
            console.error(`Page object, context, or canvas not found for page ${pageIndex + 1}.`);
            return;
        }
        const ctx = pg.ctx;
        const pos = getMousePos(pg.canvas, e, pg.scale, pg.translateX, pg.translateY);

        if (currentTool === 'pen' || currentTool === 'highlight') {
            const points = currentTool === 'pen' ? penPoints : highlightPoints;
            points.push({ x: pos.x, y: pos.y });

            if (savedCanvasState) ctx.putImageData(savedCanvasState, 0, 0);

            ctx.strokeStyle = currentColor;
            ctx.globalCompositeOperation = 'source-over';

            if (currentTool === 'highlight') {
                ctx.lineWidth   = currentSize * 5;
                ctx.globalAlpha = 0.5;
            } else {
                ctx.lineWidth   = currentSize;
                ctx.globalAlpha = 1.0;
            }

            if (points.length > 1) {
                ctx.beginPath();
                ctx.moveTo(points[0].x, points[0].y);
                for (let i = 1; i < points.length; i++) {
                    const p1 = points[i - 1];
                    const p2 = points[i];
                    const mid = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
                    ctx.quadraticCurveTo(p1.x, p1.y, mid.x, mid.y);
                }
                ctx.lineTo(pos.x, pos.y);
                ctx.stroke();
            }

        } else if (currentTool === 'eraser') {
            ctx.lineTo(pos.x, pos.y);
            ctx.stroke();
            [lastX, lastY] = [pos.x, pos.y];

        } else if (['rect', 'circle', 'line', 'arrow', 'table'].includes(currentTool)) {
            if (savedCanvasState) ctx.putImageData(savedCanvasState, 0, 0);

            ctx.strokeStyle = currentColor;
            ctx.lineWidth   = currentSize;
            ctx.globalAlpha = 1.0;
            ctx.globalCompositeOperation = 'source-over';

            const width  = pos.x - drawStartX;
            const height = pos.y - drawStartY;

            ctx.beginPath();
            if (currentTool === 'rect') {
                ctx.strokeRect(drawStartX, drawStartY, width, height);
            } else if (currentTool === 'circle') {
                const cx = drawStartX + width / 2, cy = drawStartY + height / 2;
                ctx.ellipse(cx, cy, Math.abs(width / 2), Math.abs(height / 2), 0, 0, Math.PI * 2);
                ctx.stroke();
            } else if (currentTool === 'line') {
                ctx.moveTo(drawStartX, drawStartY);
                ctx.lineTo(pos.x, pos.y);
                ctx.stroke();
            } else if (currentTool === 'arrow') {
                drawArrow(ctx, drawStartX, drawStartY, pos.x, pos.y);
            } else if (currentTool === 'table' && pg.tableInfo) {
                drawTable(ctx, pg.tableInfo.startX, pg.tableInfo.startY, width, height, pg.tableInfo.rows, pg.tableInfo.cols);
            }
            ctx.closePath();
        }
    });

    // ---------- mouseup ----------
    canvas.addEventListener("mouseup", (e) => {
        if (currentTool === 'image-select') return;

        if (isPanning) {
            isPanning = false;
            canvas.classList.remove("active");
            savedCanvasState = null;
            return;
        }
        if (!isDrawing) return;
        isDrawing = false;

        const pg = pages[pageIndex];
        if (!pg || !pg.ctx || !pg.canvas) {
            console.error(`Page not found for page ${pageIndex + 1}.`);
            savedCanvasState = null;
            return;
        }

        const ctx = pg.ctx;
        const pos = getMousePos(pg.canvas, e, pg.scale, pg.translateX, pg.translateY);

        _finalizeStroke(ctx, pg, pageIndex, pos);

        ctx.globalCompositeOperation = 'source-over';
        ctx.globalAlpha = 1.0;
        pg.redoStack = [];
        updateUndoRedoButtons();
    });

    // ---------- mouseleave ----------
    canvas.addEventListener("mouseleave", () => {
        if (isDrawing) {
            const pg = pages[pageIndex];
            if (pg && pg.ctx && pg.canvas) {
                const lastPos = { x: lastX, y: lastY };
                _finalizeStroke(pg.ctx, pg, pageIndex, lastPos, true);
                pg.ctx.globalCompositeOperation = 'source-over';
                pg.ctx.globalAlpha = 1.0;
                pg.redoStack = [];
                updateUndoRedoButtons();
            } else {
                console.error(`Page not found for page index ${pageIndex}.`);
                savedCanvasState = null;
            }
        }
        isDrawing = false;
        if (isPanning) {
            isPanning = false;
            canvas.classList.remove("active");
        }
    });

    // منع قائمة السياق
    canvas.addEventListener('contextmenu', e => e.preventDefault());

    // إضافة أحداث اللمس (touch)
    if (window.addTouchEventListenersToCanvas) {
        window.addTouchEventListenersToCanvas(canvas, pageIndex);
    } else {
        console.error("addTouchEventListenersToCanvas not found. touch-events.js might not be loaded.");
    }
}

// -------------------- دالة مساعدة لإنهاء الضربة (Finalize Stroke Helper) --------------------

function _finalizeStroke(ctx, page, pageIndex, pos, isLeave = false) {
    if (currentTool === 'pen' || currentTool === 'highlight') {
        if (savedCanvasState) {
            ctx.putImageData(savedCanvasState, 0, 0);
            savedCanvasState = null;
        }

        const points = currentTool === 'pen' ? penPoints : highlightPoints;

        ctx.strokeStyle = currentColor;
        ctx.globalCompositeOperation = 'source-over';

        if (currentTool === 'highlight') {
            ctx.lineWidth   = currentSize * 5;
            ctx.globalAlpha = 0.5;
        } else {
            ctx.lineWidth   = currentSize;
            ctx.globalAlpha = 1.0;
        }

        if (points.length > 1) {
            ctx.beginPath();
            ctx.moveTo(points[0].x, points[0].y);
            for (let i = 1; i < points.length; i++) {
                const p1 = points[i - 1], p2 = points[i];
                const mid = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
                ctx.quadraticCurveTo(p1.x, p1.y, mid.x, mid.y);
            }
            const last = points[points.length - 1];
            ctx.lineTo(isLeave ? last.x : pos.x, isLeave ? last.y : pos.y);
            ctx.stroke();
        } else if (points.length === 1) {
            ctx.beginPath();
            ctx.arc(points[0].x, points[0].y, ctx.lineWidth / 2, 0, Math.PI * 2);
            ctx.fillStyle = ctx.strokeStyle;
            ctx.fill();
        }

        if (currentTool === 'pen')       penPoints = [];
        if (currentTool === 'highlight') highlightPoints = [];

        saveToHistory(pageIndex);

    } else if (currentTool === 'eraser') {
        ctx.closePath();
        saveToHistory(pageIndex);
        savedCanvasState = null;

    } else if (['rect', 'circle', 'line', 'arrow', 'table'].includes(currentTool)) {
        if (isLeave) {
            // عند مغادرة اللوحة أثناء رسم شكل: استعادة الحالة السابقة فقط
            if (savedCanvasState) {
                ctx.putImageData(savedCanvasState, 0, 0);
                savedCanvasState = null;
            }
            return;
        }

        if (savedCanvasState) {
            ctx.putImageData(savedCanvasState, 0, 0);
            savedCanvasState = null;
        }

        ctx.strokeStyle = currentColor;
        ctx.lineWidth   = currentSize;
        ctx.globalAlpha = 1.0;
        ctx.globalCompositeOperation = 'source-over';

        const width  = pos.x - drawStartX;
        const height = pos.y - drawStartY;

        if (Math.abs(width) > 2 || Math.abs(height) > 2) {
            ctx.beginPath();
            if (currentTool === 'rect') {
                ctx.strokeRect(drawStartX, drawStartY, width, height);
            } else if (currentTool === 'circle') {
                const cx = drawStartX + width / 2, cy = drawStartY + height / 2;
                ctx.ellipse(cx, cy, Math.abs(width / 2), Math.abs(height / 2), 0, 0, Math.PI * 2);
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
        }
    }
}
