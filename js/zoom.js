/**
 * السبورة الذكية - التكبير والتصغير (Global Scale - Wrapper Layout)
 * Smart Whiteboard - Zoom & Transform
 *
 * المنهج الجديد (يحل مشكلة الفراغات):
 * كل .page مُغلَّفة بـ .page-wrapper
 * الـ wrapper يأخذ الأبعاد المُقيَّسة (w*scale × h*scale)
 * الـ .page نفسها تبقى بأبعادها الأصلية وتُطبق عليها transform: scale()
 * هكذا flex-gap يعمل بشكل صحيح في جميع مستويات الـ zoom
 */

let globalScale = 1;
const MIN_SCALE = 0.2;
const MAX_SCALE = 5;

// ─── ضمان وجود wrapper لكل صفحة ───

function _ensureWrapper(page) {
    if (!page || !page.element) return null;
    if (page.wrapper) return page.wrapper;

    const el = page.element;
    if (el.parentElement && el.parentElement.classList.contains('page-wrapper')) {
        page.wrapper = el.parentElement;
        return page.wrapper;
    }

    const wrapper = document.createElement('div');
    wrapper.className = 'page-wrapper';
    el.parentElement.insertBefore(wrapper, el);
    wrapper.appendChild(el);
    page.wrapper = wrapper;
    return wrapper;
}

// ─── تطبيق transform على صفحة واحدة ───

function applyTransform(page) {
    if (!page || !page.element) return;
    page.scale = globalScale;

    const baseW = page.canvas ? page.canvas.width  : 800;
    const baseH = page.canvas ? page.canvas.height : 1131;

    const wrapper = _ensureWrapper(page);
    if (wrapper) {
        // الـ wrapper يحجز المساحة الفعلية بعد الـ scale
        wrapper.style.width  = `${baseW * globalScale}px`;
        wrapper.style.height = `${baseH * globalScale}px`;
    }

    // الصفحة نفسها: أبعادها الأصلية + scale من الزاوية العلوية اليسرى
    page.element.style.transformOrigin = 'top left';
    page.element.style.transform       = `scale(${globalScale})`;
    page.element.style.marginBottom    = '';  // مسح أي margin قديم

    updateZoomPercentageDisplay();
}

// ─── تطبيق على جميع الصفحات ───

function applyTransformAll() {
    pages.forEach(page => applyTransform(page));
    _updateContainerPadding();
    updateZoomPercentageDisplay();
}

// ─── padding جانبي للـ container ───

function _updateContainerPadding() {
    const area = document.querySelector('.canvas-area');
    if (!area) return;
    const contPags = area.querySelector('.cont_pags');
    if (!contPags) return;

    const baseW   = (pages[0] && pages[0].canvas) ? pages[0].canvas.width : 800;
    const scaledW = baseW * globalScale;
    const areaW   = area.clientWidth;
    // padding يضمن أن الورقة دائماً في المنتصف وقابلة للـ scroll
    const sidePad = Math.max(30, (areaW - scaledW) / 2);
    contPags.style.paddingLeft  = `${sidePad}px`;
    contPags.style.paddingRight = `${sidePad}px`;
}

// ─── زر تكبير / تصغير ───

function zoomIn() {
    globalScale = Math.min(parseFloat((globalScale * 1.2).toFixed(4)), MAX_SCALE);
    applyTransformAll();
}

function zoomOut() {
    globalScale = Math.max(parseFloat((globalScale / 1.2).toFixed(4)), MIN_SCALE);
    applyTransformAll();
}

function resetZoom() {
    globalScale = 1;
    applyTransformAll();
    const area = document.querySelector('.canvas-area');
    if (area) {
        area.scrollLeft = (area.scrollWidth - area.clientWidth) / 2;
        area.scrollTop  = 0;
    }
}

// ─── zoom حول نقطة محددة (Ctrl+Wheel / Pinch) ───

function zoomAroundPoint(factor, clientX, clientY) {
    const area = document.querySelector('.canvas-area');
    if (!area) return;

    const rect   = area.getBoundingClientRect();
    // النقطة بالنسبة للمحتوى (قبل التغيير)
    const contentX = clientX - rect.left + area.scrollLeft;
    const contentY = clientY - rect.top  + area.scrollTop;

    const oldScale = globalScale;
    globalScale    = Math.max(MIN_SCALE, Math.min(parseFloat((oldScale * factor).toFixed(4)), MAX_SCALE));

    applyTransformAll();

    // حافظ على نفس النقطة تحت المؤشر/الإصبع
    const ratio      = globalScale / oldScale;
    area.scrollLeft  = contentX * ratio - (clientX - rect.left);
    area.scrollTop   = contentY * ratio - (clientY - rect.top);
}

// ─── عرض النسبة ───

function updateZoomPercentageDisplay() {
    if (typeof zoomPercentageSpan !== 'undefined' && zoomPercentageSpan) {
        zoomPercentageSpan.textContent = `${Math.round(globalScale * 100)}%`;
    }
}
