/**
 * السبورة الذكية - التكبير والتصغير (Global Scale)
 * Smart Whiteboard - Zoom & Transform
 *
 * التغييرات الجوهرية:
 * ✔ scale عالمي موحّد (globalScale) بدلاً من scale منفصل لكل صفحة
 * ✔ applyTransformAll() تُطبّق الـ scale على كل الصفحات دفعة واحدة
 * ✔ الصفحات الجديدة ترث الـ scale الحالي تلقائياً عند إنشائها
 * ✔ pinch ذكي على الأجهزة اللوحية (يُعالج في viewport-lock.js)
 */

// -------------------- Scale عالمي موحّد --------------------

let globalScale = 1;

const MIN_SCALE = 0.2;
const MAX_SCALE = 5;

// -------------------- تطبيق الـ transform على صفحة واحدة --------------------

function applyTransform(page) {
    if (!page || !page.element) return;

    // استخدام globalScale دائماً
    page.scale = globalScale;

    page.element.style.transformOrigin = 'top center';
    page.element.style.transform       = `scale(${globalScale})`;

    // تعويض الارتفاع: CSS transform لا يؤثر على layout
    const baseH   = page.canvas ? page.canvas.height : 1131;
    const scaledH = baseH * globalScale;
    page.element.style.marginBottom = `${Math.max(0, scaledH - baseH)}px`;

    _updateContainerPadding();
    updateZoomPercentageDisplay();
}

// -------------------- تطبيق الـ transform على جميع الصفحات --------------------

function applyTransformAll() {
    pages.forEach(page => {
        if (!page || !page.element) return;
        page.scale = globalScale;
        page.element.style.transformOrigin = 'top center';
        page.element.style.transform       = `scale(${globalScale})`;

        const baseH   = page.canvas ? page.canvas.height : 1131;
        const scaledH = baseH * globalScale;
        page.element.style.marginBottom = `${Math.max(0, scaledH - baseH)}px`;
    });

    _updateContainerPadding();
    updateZoomPercentageDisplay();
}

// -------------------- تحديث padding الحاوية --------------------

function _updateContainerPadding() {
    const area = document.querySelector('.canvas-area');
    if (!area) return;
    const contPags = area.querySelector('.cont_pags');
    if (!contPags) return;

    const baseW   = (pages[0] && pages[0].canvas) ? pages[0].canvas.width : 800;
    const scaledW = baseW * globalScale;
    const sidePad = Math.max(30, (scaledW - baseW) / 2 + 30);
    contPags.style.paddingLeft  = `${sidePad}px`;
    contPags.style.paddingRight = `${sidePad}px`;
}

// -------------------- تكبير / تصغير --------------------

function zoomIn() {
    globalScale = Math.min(globalScale * 1.2, MAX_SCALE);
    applyTransformAll();
}

function zoomOut() {
    globalScale = Math.max(globalScale / 1.2, MIN_SCALE);
    applyTransformAll();
}

function resetZoom() {
    globalScale = 1;
    applyTransformAll();

    // إعادة scroll للمنتصف
    const area = document.querySelector('.canvas-area');
    if (area) {
        area.scrollLeft = (area.scrollWidth - area.clientWidth) / 2;
        area.scrollTop  = 0;
    }
}

// -------------------- تكبير حول نقطة محددة (Zoom Around Point) --------------------
// يُستخدم من viewport-lock.js عند Ctrl+Wheel و Pinch

function zoomAroundPoint(factor, clientX, clientY) {
    const area = document.querySelector('.canvas-area');
    if (!area) return;

    const rect   = area.getBoundingClientRect();
    const mouseX = clientX - rect.left + area.scrollLeft;
    const mouseY = clientY - rect.top  + area.scrollTop;

    const oldScale = globalScale;
    globalScale    = Math.max(MIN_SCALE, Math.min(oldScale * factor, MAX_SCALE));

    applyTransformAll();

    // اضبط scroll حتى يبقى المؤشر فوق نفس النقطة
    const scaleRatio = globalScale / oldScale;
    area.scrollLeft  = mouseX * scaleRatio - (clientX - rect.left);
    area.scrollTop   = mouseY * scaleRatio - (clientY - rect.top);
}

// -------------------- تحديث عرض النسبة المئوية --------------------

function updateZoomPercentageDisplay() {
    if (zoomPercentageSpan) {
        zoomPercentageSpan.textContent = `${Math.round(globalScale * 100)}%`;
    }
}
