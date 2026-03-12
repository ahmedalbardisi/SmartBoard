/**
 * السبورة الذكية - إدارة السجل (تراجع وإعادة)
 * Smart Whiteboard - History Management (Undo / Redo)
 */

// -------------------- حفظ في السجل (Save to History) --------------------

function saveToHistory(pageIndex) {
    if (pageIndex < 0 || pageIndex >= pages.length) {
        console.error(`Invalid page index ${pageIndex} for saving history.`);
        return;
    }
    const page = pages[pageIndex];
    if (!page || !page.canvas) {
        console.error(`Page or canvas not found for index ${pageIndex}.`);
        return;
    }

    if (page.history.length >= MAX_HISTORY_LENGTH) {
        page.history.shift(); // حذف أقدم حالة
    }

    page.history.push(page.canvas.toDataURL());
    page.redoStack = [];
    updateUndoRedoButtons();
}

// -------------------- تراجع (Undo) --------------------

function undo() {
    const page = pages[currentPage];
    if (!page) {
        console.error(`Page not found for current page ${currentPage + 1}.`);
        return;
    }
    if (page.history.length < 2) {
        console.log("لا يوجد شيء للتراجع عنه");
        return;
    }

    const currentStateDataUrl = page.history.pop();
    if (currentStateDataUrl !== undefined) {
        page.redoStack.push(currentStateDataUrl);
    } else {
        console.error("Failed to pop current state from history.");
        return;
    }

    const previousStateDataUrl = page.history[page.history.length - 1];
    if (!previousStateDataUrl) {
        console.error("Previous state not found in history after pop.");
        page.history.push(currentStateDataUrl);
        return;
    }

    restoreCanvasStateFromDataURL(page, previousStateDataUrl);
    console.log(`تراجع للصفحة ${currentPage + 1}`);
}

// -------------------- إعادة (Redo) --------------------

function redo() {
    const page = pages[currentPage];
    if (!page) {
        console.error(`Page not found for current page ${currentPage + 1}.`);
        return;
    }
    if (page.redoStack.length === 0) {
        console.log("لا يوجد شيء للإعادة");
        return;
    }

    const stateToRedoDataUrl = page.redoStack.pop();
    if (!stateToRedoDataUrl) {
        console.error("Failed to pop state from redo stack.");
        return;
    }

    restoreCanvasStateFromDataURL(page, stateToRedoDataUrl, true);
    console.log(`إعادة للصفحة ${currentPage + 1}`);
}

// -------------------- استعادة حالة اللوحة (Restore Canvas State) --------------------

function restoreCanvasStateFromDataURL(page, dataUrl, pushToHistory = false) {
    if (!page || !page.ctx || !page.canvas) {
        console.error("Page, context, or canvas not found. Cannot restore canvas state.");
        return;
    }

    const img = new Image();
    img.onload = function () {
        if (page && page.ctx && page.canvas) {
            page.ctx.clearRect(0, 0, page.canvas.width, page.canvas.height);
            page.ctx.drawImage(img, 0, 0);
            page.ctx.globalAlpha = 1.0;
            page.ctx.globalCompositeOperation = 'source-over';

            if (pushToHistory) {
                page.history.push(dataUrl);
            }
            updateUndoRedoButtons();
        }
    };
    img.onerror = function () {
        console.error("خطأ في تحميل صورة الحالة من DataURL", dataUrl);
        if (page) {
            if (pushToHistory) {
                page.history.pop();
                page.redoStack.push(dataUrl);
            } else {
                page.redoStack.pop();
                page.history.push(dataUrl);
            }
        }
        updateUndoRedoButtons();
    };
    img.src = dataUrl;
}

// -------------------- تحديث أزرار التراجع والإعادة (Update Buttons State) --------------------

function updateUndoRedoButtons() {
    const page = pages[currentPage];
    if (undoBtn && redoBtn && page) {
        undoBtn.disabled = page.history.length <= 1;
        redoBtn.disabled = page.redoStack.length === 0;
    }
}
