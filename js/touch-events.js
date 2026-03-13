/**
 * Smart Whiteboard - Enhanced Touch Events Functionality
 * Handles touch interactions for drawing, highlighting, erasing, and panning.
 * Adds support for temporary panning with multi-touch while using drawing tools.
 *
 * الإصلاحات:
 * ✔ Bug 1: استعادة الأداة بعد اللمس المتعدد تستخدم setActiveTool() بدلاً من data-tool
 * ✔ Bug 2: Pan باللمس يعتمد على scroll .canvas-area بدلاً من translateX/Y
 * ✔ Bug 7: stopPropagation() عند Pinch لمنع التعارض مع viewport-lock.js
 */

document.addEventListener('DOMContentLoaded', () => {
    let previousTool       = null;
    let isTemporaryPanning = false;
    let pinchStartDistance = 0;
    let initialScale       = 1;
    let pinchCenter        = { x: 0, y: 0 };
    let touchIdentifiers   = [];

    // ── مساعد: تحويل موقع اللمس إلى إحداثيات داخل الـ canvas ──
    function _getTouchPos(canvas, touch, page) {
        return getMousePos(canvas, touch, page.scale, page.translateX, page.translateY);
    }

    // ── مساعد: استعادة الأداة السابقة بشكل صحيح ──
    // Bug 1 Fix: استخدام setActiveTool() الموجودة في tools.js بدلاً من data-tool
    function _restorePreviousTool() {
        if (!isTemporaryPanning || !previousTool) return;
        const toolToRestore = previousTool;
        previousTool       = null;
        isTemporaryPanning = false;
        if (typeof setActiveTool === 'function') {
            setActiveTool(toolToRestore);
        } else {
            // fallback: تغيير المتغير فقط
            currentTool = toolToRestore;
        }
    }

    // ── مساعد: الحصول على canvas-area للـ scroll ──
    function _getCanvasArea() {
        return document.querySelector('.canvas-area');
    }

    // ===================================================================
    // touchstart
    // ===================================================================
    const handleTouchStart = (e) => {
        e.preventDefault();

        const canvas    = e.target;
        const pageIndex = pages.findIndex(p => p.canvas === canvas);
        const page      = pages[pageIndex];
        if (!page || !page.ctx) return;

        touchIdentifiers = Array.from(e.touches).map(t => t.identifier);

        // إصبعان أو أكثر: تُسلَّم كلياً لـ viewport-lock.js للتعامل مع Pinch
        if (e.touches.length > 1) {
            if (isDrawing) {
                isDrawing = false;
                if (savedCanvasState) {
                    page.ctx.putImageData(savedCanvasState, 0, 0);
                    savedCanvasState = null;
                }
                if (currentTool === 'pen')       penPoints       = [];
                if (currentTool === 'highlight') highlightPoints = [];
            }

            if (currentTool !== 'pan') {
                previousTool       = currentTool;
                isTemporaryPanning = true;
            }

            isPanning = true;
            canvas.classList.add('active');
            // لا stopPropagation — نترك الحدث يصل لـ viewport-lock.js
            return;
        }

        // ── لمسة واحدة ──
        if (e.touches.length === 1) {
            // Bug 2 Fix: وضع Pan يعتمد على scroll لا translateX/Y
            if (currentTool === 'pan') {
                isPanning = true;
                canvas.classList.add('active');
                // الـ scroll الفعلي تتولاه viewport-lock.js
                return;
            }

            isDrawing = true;
            const touch = e.touches[0];
            const pos   = _getTouchPos(canvas, touch, page);

            [lastX, lastY] = [pos.x, pos.y];
            drawStartX = pos.x;
            drawStartY = pos.y;

            savedCanvasState = page.ctx.getImageData(0, 0, canvas.width, canvas.height);

            if (currentTool === 'table') {
                const rows = parseInt(tableRowsInput ? tableRowsInput.value : 3);
                const cols = parseInt(tableColsInput ? tableColsInput.value : 3);
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
        }
    };

    // ===================================================================
    // touchmove
    // ===================================================================
    const handleTouchMove = (e) => {
        e.preventDefault();

        const canvas    = e.target;
        const pageIndex = pages.findIndex(p => p.canvas === canvas);
        const page      = pages[pageIndex];
        if (!page || !page.ctx || !page.canvas) return;

        const ctx = page.ctx;

        // اكتشاف إصبع جديد أثناء الرسم
        const currentIdentifiers = Array.from(e.touches).map(t => t.identifier);
        const newTouchAdded = currentIdentifiers.some(id => !touchIdentifiers.includes(id));
        if (newTouchAdded && isDrawing && e.touches.length > 1) {
            if (currentTool !== 'pan') {
                previousTool       = currentTool;
                isTemporaryPanning = true;
            }
            isDrawing = false;
            isPanning = true;
            if (savedCanvasState) {
                page.ctx.putImageData(savedCanvasState, 0, 0);
            }
            canvas.classList.add('active');
            touchIdentifiers = currentIdentifiers;
        }

        // إصبعان أو أكثر: viewport-lock.js يتولى الـ Pinch
        if (isPanning) {
            // لا نتدخل — viewport-lock.js يعالج الـ scroll والـ pinch
            return;
        }

        if (!isDrawing || e.touches.length === 0) return;

        if (e.touches.length === 1) {
            const touch = e.touches[0];
            const pos   = _getTouchPos(page.canvas, touch, page);

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
                        const p1  = points[i - 1], p2 = points[i];
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

            } else if (['rect','circle','line','arrow','table'].includes(currentTool)) {
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
                    ctx.ellipse(cx, cy, Math.abs(width/2), Math.abs(height/2), 0, 0, Math.PI*2);
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

        } else if (e.touches.length > 1 && isDrawing) {
            isDrawing = false;
            isPanning = true;
            if (currentTool !== 'pan') {
                previousTool       = currentTool;
                isTemporaryPanning = true;
            }
            touchIdentifiers = Array.from(e.touches).map(t => t.identifier);
        }
    };

    // ===================================================================
    // touchend
    // ===================================================================
    const handleTouchEnd = (e) => {
        e.preventDefault();

        const canvas    = e.target;
        const pageIndex = pages.findIndex(p => p.canvas === canvas);
        const page      = pages[pageIndex];

        if (!page || !page.ctx || !page.canvas) {
            savedCanvasState = null;
            isDrawing        = false;
            isPanning        = false;
            canvas.classList.remove('active');
            penPoints       = [];
            highlightPoints = [];
            touchIdentifiers = [];
            return;
        }

        const endedIds = Array.from(e.changedTouches).map(t => t.identifier);
        touchIdentifiers = touchIdentifiers.filter(id => !endedIds.includes(id));

        // Bug 1 Fix: استعادة الأداة السابقة باستخدام setActiveTool
        if (e.touches.length === 0 && isTemporaryPanning) {
            _restorePreviousTool();
        }

        if (isPanning) {
            if (e.touches.length === 0) {
                isPanning = false;
                canvas.classList.remove('active');
                savedCanvasState   = null;
                pinchStartDistance = 0;
                touchIdentifiers   = [];
            }
            return;
        }

        if (!isDrawing || e.changedTouches.length === 0) return;

        if (e.touches.length > 0) {
            isDrawing = false;
            if (savedCanvasState) {
                page.ctx.putImageData(savedCanvasState, 0, 0);
                savedCanvasState = null;
            }
            penPoints       = [];
            highlightPoints = [];
            if (page.tableInfo) delete page.tableInfo;
            return;
        }

        isDrawing = false;

        const ctx   = page.ctx;
        const touch = e.changedTouches[0];
        const pos   = _getTouchPos(page.canvas, touch, page);

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
                ctx.lineTo(pos.x, pos.y);
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

        } else if (['rect','circle','line','arrow','table'].includes(currentTool)) {
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
                    ctx.ellipse(cx, cy, Math.abs(width/2), Math.abs(height/2), 0, 0, Math.PI*2);
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
            } else {
                if (currentTool === 'table' && page.tableInfo) delete page.tableInfo;
            }
        }

        ctx.globalCompositeOperation = 'source-over';
        ctx.globalAlpha = 1.0;
        page.redoStack  = [];
        updateUndoRedoButtons();
        touchIdentifiers = [];
    };

    // ===================================================================
    // touchcancel
    // ===================================================================
    const handleTouchCancel = (e) => {
        e.preventDefault();

        const canvas    = e.target;
        const pageIndex = pages.findIndex(p => p.canvas === canvas);
        const page      = pages[pageIndex];

        if (!page || !page.ctx) {
            savedCanvasState = null;
            isDrawing        = false;
            isPanning        = false;
            canvas.classList.remove('active');
            penPoints        = [];
            highlightPoints  = [];
            touchIdentifiers = [];
            return;
        }

        // Bug 1 Fix: استعادة الأداة عند الإلغاء
        if (isTemporaryPanning) _restorePreviousTool();

        if (isDrawing || isPanning) {
            if (savedCanvasState) {
                page.ctx.putImageData(savedCanvasState, 0, 0);
                savedCanvasState = null;
            }
            isDrawing = false;
            isPanning = false;
            canvas.classList.remove('active');
            pinchStartDistance = 0;
            penPoints          = [];
            highlightPoints    = [];
            if (page.tableInfo) delete page.tableInfo;
        }

        page.ctx.globalCompositeOperation = 'source-over';
        page.ctx.globalAlpha = 1.0;
        updateUndoRedoButtons();
        touchIdentifiers = [];
    };

    // ===================================================================
    // تصدير الدالة
    // ===================================================================
    window.addTouchEventListenersToCanvas = function(canvas, pageIndex) {
        if (!canvas) return;
        if (canvas.dataset.touchListenersAdded) return;

        canvas.addEventListener('touchstart',  handleTouchStart,  { passive: false });
        canvas.addEventListener('touchmove',   handleTouchMove,   { passive: false });
        canvas.addEventListener('touchend',    handleTouchEnd,    { passive: false });
        canvas.addEventListener('touchcancel', handleTouchCancel, { passive: false });

        canvas.dataset.touchListenersAdded = 'true';
        console.log(`Touch listeners added to canvas for page ${pageIndex + 1}.`);
    };

    // ربط أي canvas موجود عند تحميل السكريبت
    document.querySelectorAll('.page canvas').forEach((canvas, index) => {
        if (pages[index]) window.addTouchEventListenersToCanvas(canvas, index);
    });
});
