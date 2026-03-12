/**
 * السبورة الذكية - أحداث الرسم بالماوس
 * Smart Whiteboard - Mouse Canvas Drawing Events
 *
 * الإصلاح الجوهري:
 * بدلاً من تمرير pageIndex كـ closure ثابت عند إنشاء الصفحة،
 * نبحث في كل حدث عن الصفحة الصحيحة عبر canvas نفسه (live lookup).
 * هذا يضمن صحة التشغيل بعد حذف أي صفحة وتغيّر الفهارس.
 */

// -------------------- دالة مساعدة: إيجاد بيانات الصفحة من canvas --------------------

/**
 * يُعيد { page, pageIndex } للـ canvas المعطى، أو null إذا لم يوجد.
 * يُستخدم بدلاً من الـ closure الثابت حتى تبقى الفهارس صحيحة
 * حتى بعد حذف الصفحات وإعادة ترتيبها.
 */
function _getPageByCanvas(canvas) {
    for (let i = 0; i < pages.length; i++) {
        if (pages[i] && pages[i].canvas === canvas) {
            return { page: pages[i], pageIndex: i };
        }
    }
    return null;
}

// -------------------- ربط أحداث اللوحة (Canvas Event Setup) --------------------

function setupCanvasEventListeners(canvas) {
    if (!canvas) {
        console.error('setupCanvasEventListeners: canvas is null');
        return;
    }

    // ---------- mousedown ----------
    canvas.addEventListener("mousedown", (e) => {
        if (currentTool === 'image-select') return;

        const found = _getPageByCanvas(canvas);
        if (!found) return;
        const { page, pageIndex } = found;

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

            page.ctx.lineWidth   = currentSize;
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
                page.ctx.lineWidth   = currentSize;
                page.ctx.globalAlpha = 1.0;
            }
        }
    });

    // ---------- mousemove ----------
    canvas.addEventListener("mousemove", (e) => {
        if (currentTool === 'image-select') return;

        const found = _getPageByCanvas(canvas);
        if (!found) return;
        const { page, pageIndex } = found;

        if (isPanning) {
            page.translateX = e.clientX - panStartX;
            page.translateY = e.clientY - panStartY;
            applyTransform(page);
            return;
        }

        if (!isDrawing) return;

        const ctx = page.ctx;
        const pos = getMousePos(canvas, e, page.scale, page.translateX, page.translateY);

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
                    const p1  = points[i - 1];
                    const p2  = points[i];
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
            } else if (currentTool === 'table' && page.tableInfo) {
                drawTable(ctx, page.tableInfo.startX, page.tableInfo.startY,
                          width, height, page.tableInfo.rows, page.tableInfo.cols);
            }
            ctx.closePath();
        }
    });

    // ---------- mouseup ----------
    canvas.addEventListener("mouseup", (e) => {
        if (currentTool === 'image-select') return;

        const found = _getPageByCanvas(canvas);
        if (!found) return;
        const { page, pageIndex } = found;

        if (isPanning) {
            isPanning = false;
            canvas.classList.remove("active");
            savedCanvasState = null;
            return;
        }
        if (!isDrawing) return;
        isDrawing = false;

        const ctx = page.ctx;
        const pos = getMousePos(canvas, e, page.scale, page.translateX, page.translateY);

        _finalizeStroke(ctx, page, pageIndex, pos);

        ctx.globalCompositeOperation = 'source-over';
        ctx.globalAlpha = 1.0;
        page.redoStack  = [];
        updateUndoRedoButtons();
    });

    // ---------- mouseleave ----------
    canvas.addEventListener("mouseleave", () => {
        if (currentTool === 'image-select') return;

        const found = _getPageByCanvas(canvas);
        if (!found) {
            isDrawing = false;
            isPanning = false;
            return;
        }
        const { page, pageIndex } = found;

        if (isDrawing) {
            const lastPos = { x: lastX, y: lastY };
            _finalizeStroke(page.ctx, page, pageIndex, lastPos, true);
            page.ctx.globalCompositeOperation = 'source-over';
            page.ctx.globalAlpha = 1.0;
            page.redoStack = [];
            updateUndoRedoButtons();
        }

        isDrawing = false;
        if (isPanning) {
            isPanning = false;
            canvas.classList.remove("active");
        }
    });

    // منع قائمة السياق
    canvas.addEventListener('contextmenu', e => e.preventDefault());

    // أحداث اللمس
    if (window.addTouchEventListenersToCanvas) {
        // نحسب الـ index الحالي وقت التسجيل فقط لتمريره للـ touch module
        // الـ touch module نفسه يستخدم pages.findIndex لذا لا مشكلة
        const initialIndex = pages.findIndex(p => p && p.canvas === canvas);
        window.addTouchEventListenersToCanvas(canvas, initialIndex >= 0 ? initialIndex : pages.length - 1);
    } else {
        console.error("addTouchEventListenersToCanvas not found.");
    }
}

// -------------------- دالة مساعدة: إنهاء ضربة الرسم --------------------

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
                const p1  = points[i - 1], p2 = points[i];
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

        if (currentTool === 'pen')       penPoints       = [];
        if (currentTool === 'highlight') highlightPoints = [];

        saveToHistory(pageIndex);

    } else if (currentTool === 'eraser') {
        ctx.closePath();
        saveToHistory(pageIndex);
        savedCanvasState = null;

    } else if (['rect', 'circle', 'line', 'arrow', 'table'].includes(currentTool)) {
        if (isLeave) {
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
                drawTable(ctx, page.tableInfo.startX, page.tableInfo.startY,
                          width, height, page.tableInfo.rows, page.tableInfo.cols);
                delete page.tableInfo;
            }
            ctx.closePath();
            saveToHistory(pageIndex);
        }
    }
}
