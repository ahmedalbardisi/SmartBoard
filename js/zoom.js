/**
 * السبورة الذكية - التكبير والتصغير
 * Smart Whiteboard - Zoom & Transform
 */

// -------------------- تطبيق التحويل (Apply Transform) --------------------

function applyTransform(page) {
    if (!page || !page.element) return;
    page.element.style.transform = `translate(${page.translateX}px, ${page.translateY}px) scale(${page.scale})`;
    updateZoomPercentageDisplay();
}

// -------------------- تكبير (Zoom In) --------------------

function zoomIn() {
    const page = pages[currentPage];
    if (page) {
        page.scale = Math.min(page.scale * 1.2, 5);
        applyTransform(page);
        console.log("تكبير الصفحة الحالية:", page.scale);
    } else {
        console.error(`Page ${currentPage + 1} not found for zooming in.`);
    }
}

// -------------------- تصغير (Zoom Out) --------------------

function zoomOut() {
    const page = pages[currentPage];
    if (page) {
        page.scale = Math.max(page.scale / 1.2, 0.2);
        applyTransform(page);
        console.log("تصغير الصفحة الحالية:", page.scale);
    } else {
        console.error(`Page ${currentPage + 1} not found for zooming out.`);
    }
}

// -------------------- تحديث عرض نسبة التكبير (Update Zoom Display) --------------------

function updateZoomPercentageDisplay() {
    const page = pages[currentPage];
    if (page && zoomPercentageSpan) {
        zoomPercentageSpan.textContent = `${Math.round(page.scale * 100)}%`;
    }
}
