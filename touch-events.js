document.addEventListener('DOMContentLoaded', () => {
    const handleTouchStart = (e) => {
        e.preventDefault(); // Prevent default behavior (scroll, zoom)

        const canvas = e.target;
        const pageIndex = pages.findIndex(p => p.canvas === canvas);
        const page = pages[pageIndex];

        if (!page || !page.ctx) {
            console.error(`Page object or context not found.`);
            return;
        }

        // إذا كانت الأداة هي "التنقل" وتعدد اللمسات أكبر من 1
        if (e.touches.length > 1 && currentTool === 'pan') {
            isPanning = true;
            const touch = e.touches[0];
            const rect = canvas.getBoundingClientRect();
            panStartX = touch.clientX - rect.left - page.translateX;
            panStartY = touch.clientY - rect.top - page.translateY;
            canvas.classList.add("active"); // تغيير المؤشر أثناء السحب
            return; // لا نريد الرسم عند التنقل
        }

        // إذا كانت اللمسة واحدة و الأداة ليست "تنقل"
        if (e.touches.length === 1 && currentTool !== 'pan') {
            isDrawing = true;
            const touch = e.touches[0];
            const pos = getMousePos(canvas, touch, page.scale, page.translateX, page.translateY);

            [lastX, lastY] = [pos.x, pos.y];
            drawStartX = pos.x;
            drawStartY = pos.y;

            // حفظ حالة اللوحة قبل بدء الرسم
            savedCanvasState = page.ctx.getImageData(0, 0, canvas.width, canvas.height);

            // إعداد الأدوات مثل القلم، الممحاة، التحديد
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
        e.preventDefault();

        const canvas = e.target;
        const pageIndex = pages.findIndex(p => p.canvas === canvas);
        const page = pages[pageIndex];

        if (!page || !page.ctx || !page.canvas) {
            console.error(`Page object or context not found.`);
            return;
        }

        const ctx = page.ctx;

        // إذا كانت أداة "التنقل" مفعلة
        if (isPanning && e.touches.length > 0) {
            const touch = e.touches[0];
            const rect = canvas.getBoundingClientRect();
            page.translateX = (touch.clientX - rect.left) - panStartX;
            page.translateY = (touch.clientY - rect.top) - panStartY;
            applyTransform(page); // تطبيق التغيير في الموضع
            return;
        }

        // إذا كانت أداة الرسم مفعلة
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
        e.preventDefault();

        const canvas = e.target;
        const pageIndex = pages.findIndex(p => p.canvas === canvas);
        const page = pages[pageIndex];

        if (!page || !page.ctx || !page.canvas) {
            console.error(`Page object, context, or canvas not found.`);
            savedCanvasState = null;
            isDrawing = false;
            isPanning = false;
            canvas.classList.remove("active");
            return;
        }

        if (e.touches.length === 0) {
            if (currentTool === 'highlight') {
                saveToHistory(); // حفظ في التاريخ (undo)
                updateUndoRedoButtons();
            }
            savedCanvasState = null;
            isDrawing = false;
            isPanning = false;
            canvas.classList.remove("active");
        }
    };

    // إضافة مستمعين للأحداث لجميع الألواح
    const canvases = document.querySelectorAll('.canvas-container canvas');
    canvases.forEach(canvas => {
        canvas.addEventListener('touchstart', handleTouchStart);
        canvas.addEventListener('touchmove', handleTouchMove);
        canvas.addEventListener('touchend', handleTouchEnd);
    });
});
