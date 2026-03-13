/**
 * السبورة الذكية - التكبير والتصغير (Global Scale)
 * إصلاح: منع انزياح الورقة على محور X عند التكبير/التصغير
 *
 * المنهج:
 * - transform-origin: top center  → الورقة تتمدد/تنكمش من المركز
 * - الـ wrapper يأخذ عرض الورقة الأصلي دائماً (لا scaledW)
 * - cont_pags يتوسط الـ wrappers بـ align-items: center
 * - بهذا لا يوجد انزياح أفقي مطلقاً
 */

let globalScale = 1;
const MIN_SCALE = 0.2;
const MAX_SCALE = 5;

// ─── ضمان wrapper لكل صفحة ───

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
        // العرض ثابت = عرض الورقة الأصلي (التوسيط يتولاه align-items: center)
        wrapper.style.width    = `${baseW}px`;
        // الارتفاع = الارتفاع الفعلي بعد الـ scale لمنع الفراغات الرأسية
        wrapper.style.height   = `${baseH * globalScale}px`;
        wrapper.style.overflow = 'visible';
        wrapper.style.position = 'relative';
        wrapper.style.flexShrink = '0';
    }

    // transform من المركز العلوي → لا انزياح أفقي
    page.element.style.transformOrigin = 'top center';
    page.element.style.transform       = `scale(${globalScale})`;
    page.element.style.position        = 'absolute';
    page.element.style.top             = '0';
    page.element.style.left            = '50%';
    page.element.style.marginLeft      = `${-baseW / 2}px`;
    page.element.style.marginBottom    = '';

    updateZoomPercentageDisplay();
}

// ─── تطبيق على جميع الصفحات ───

function applyTransformAll() {
    pages.forEach(page => applyTransform(page));
    _updateContainerMinWidth();
    updateZoomPercentageDisplay();
}

// ─── ضبط min-width للحاوية لضمان scroll أفقي عند التكبير ───

function _updateContainerMinWidth() {
    const area = document.querySelector('.canvas-area');
    if (!area) return;
    const contPags = area.querySelector('.cont_pags');
    if (!contPags) return;

    const baseW   = (pages[0] && pages[0].canvas) ? pages[0].canvas.width  : 800;
    const scaledW = baseW * globalScale;

    // min-width يضمن ظهور scrollbar أفقي عند التكبير
    contPags.style.minWidth = `${scaledW + 60}px`;
}

// ─── تكبير / تصغير ───

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

    const rect     = area.getBoundingClientRect();
    const contentX = clientX - rect.left + area.scrollLeft;
    const contentY = clientY - rect.top  + area.scrollTop;

    const oldScale = globalScale;
    globalScale    = Math.max(MIN_SCALE, Math.min(
        parseFloat((oldScale * factor).toFixed(4)), MAX_SCALE
    ));

    applyTransformAll();

    const ratio     = globalScale / oldScale;
    area.scrollLeft = contentX * ratio - (clientX - rect.left);
    area.scrollTop  = contentY * ratio - (clientY - rect.top);
}

// ─── عرض النسبة المئوية ───

function updateZoomPercentageDisplay() {
    if (typeof zoomPercentageSpan !== 'undefined' && zoomPercentageSpan) {
        zoomPercentageSpan.textContent = `${Math.round(globalScale * 100)}%`;
    }
}
