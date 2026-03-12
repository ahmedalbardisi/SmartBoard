/**
 * السبورة الذكية - قفل Viewport
 * Smart Whiteboard - Viewport Lock
 *
 * ① منع Pinch-to-zoom و Pull-to-refresh في المتصفح
 * ② Ctrl+= / Ctrl+- / Ctrl+0  →  zoom الورقة فقط
 * ③ عجلة الماوس + Ctrl        →  zoom حول المؤشر
 * ④ Pan بالماوس (أداة اليد)   →  scroll في الحاوية
 * ⑤ إصبعان  →  Pinch-to-zoom  حول مركز الإصبعين (نقطة دقيقة)
 * ⑥ ثلاثة أصابع  →  Pan (scroll) بالإصبع الأول
 */

(function () {
    'use strict';

    // =========================================================
    // ① منع تدخل المتصفح
    // =========================================================

    // منع pinch-to-zoom المتصفح
    document.addEventListener('touchstart', function (e) {
        if (e.touches.length > 1) e.preventDefault();
    }, { passive: false });

    document.addEventListener('touchmove', function (e) {
        if (e.touches.length > 1) e.preventDefault();
    }, { passive: false });

    // Safari gesture events
    document.addEventListener('gesturestart',  function (e) { e.preventDefault(); }, { passive: false });
    document.addEventListener('gesturechange', function (e) { e.preventDefault(); }, { passive: false });
    document.addEventListener('gestureend',    function (e) { e.preventDefault(); }, { passive: false });

    // منع pull-to-refresh (سحب للأسفل من أعلى الصفحة)
    let _pullStartY = 0;
    document.addEventListener('touchstart', function (e) {
        if (e.touches.length === 1) _pullStartY = e.touches[0].clientY;
    }, { passive: true });
    document.addEventListener('touchmove', function (e) {
        if (e.touches.length !== 1) return;
        if (document.documentElement.scrollTop === 0 &&
            e.touches[0].clientY > _pullStartY + 8) {
            e.preventDefault();
        }
    }, { passive: false });

    // =========================================================
    // ② Ctrl+= / Ctrl+- / Ctrl+0
    // =========================================================

    document.addEventListener('keydown', function (e) {
        if (!e.ctrlKey && !e.metaKey) return;
        switch (e.key) {
            case '=': case '+':
                e.preventDefault();
                if (typeof zoomIn === 'function') zoomIn();
                break;
            case '-': case '_':
                e.preventDefault();
                if (typeof zoomOut === 'function') zoomOut();
                break;
            case '0':
                e.preventDefault();
                _resetZoom();
                break;
        }
    });

    function _resetZoom() {
        if (typeof pages === 'undefined') return;
        const page = pages[currentPage];
        if (!page) return;
        const area = document.querySelector('.canvas-area');
        if (!area) return;

        page.scale = 1;
        if (typeof applyTransform === 'function') applyTransform(page);

        // توسيط الورقة بعد reset
        const baseW = page.canvas ? page.canvas.width  : 800;
        area.scrollLeft = Math.max(0, (area.scrollWidth - area.clientWidth) / 2);
        area.scrollTop  = 0;
    }

    // =========================================================
    // ③ عجلة الماوس + Ctrl  →  zoom حول المؤشر
    // =========================================================

    document.addEventListener('wheel', function (e) {
        if (!e.ctrlKey && !e.metaKey) return;
        e.preventDefault();
        if (typeof pages === 'undefined') return;
        const page = pages[currentPage];
        if (!page || typeof window._zoomAround !== 'function') return;

        const factor = e.deltaY < 0 ? 1.1 : 0.9;
        window._zoomAround(page, page.scale * factor, e.clientX, e.clientY);
    }, { passive: false });

    // =========================================================
    // ④ Pan بالماوس + ⑤ Pinch + ⑥ 3 أصابع
    // =========================================================

    window.addEventListener('load', function () {
        const area = document.querySelector('.canvas-area');
        if (!area) return;

        area.style.overflowX          = 'auto';
        area.style.overflowY          = 'auto';
        area.style.overscrollBehavior = 'none';

        // --------------------------------------------------
        // ④ Pan بالماوس (أداة اليد أو الزر الأوسط)
        // --------------------------------------------------
        let _mp = false, _mx = 0, _my = 0, _sx = 0, _sy = 0;

        area.addEventListener('mousedown', function (e) {
            const isPan = typeof currentTool !== 'undefined' && currentTool === 'pan';
            if (!isPan && e.button !== 1) return;
            e.preventDefault();
            _mp = true;
            _mx = e.clientX; _my = e.clientY;
            _sx = area.scrollLeft; _sy = area.scrollTop;
            area.style.cursor = 'grabbing';
        });
        window.addEventListener('mousemove', function (e) {
            if (!_mp) return;
            area.scrollLeft = _sx - (e.clientX - _mx);
            area.scrollTop  = _sy - (e.clientY - _my);
        });
        window.addEventListener('mouseup', function () {
            if (!_mp) return;
            _mp = false;
            area.style.cursor = '';
        });

        // --------------------------------------------------
        // ⑤ إصبعان: Pinch-to-zoom حول مركز الإصبعين بدقة
        // --------------------------------------------------
        let _pinch = null;
        // {dist, scale, cx, cy, sx, sy}
        // cx/cy = مركز الإصبعين بإحداثيات المتصفح
        // sx/sy = scrollLeft/scrollTop عند بداية الـ pinch

        // --------------------------------------------------
        // ⑥ ثلاثة أصابع: Pan
        // --------------------------------------------------
        let _tri = null;
        // {x, y, sx, sy} = نقطة بداية اللمس والـ scroll

        // --------------------------------------------------
        // مستمع واحد لـ touchstart يفرز بين الحالات
        // --------------------------------------------------
        area.addEventListener('touchstart', function (e) {
            const n = e.touches.length;

            if (n === 2) {
                // بداية Pinch
                e.preventDefault();
                _tri = null;

                const t1 = e.touches[0], t2 = e.touches[1];
                const cx = (t1.clientX + t2.clientX) / 2;
                const cy = (t1.clientY + t2.clientY) / 2;

                _pinch = {
                    dist:  Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY),
                    scale: (typeof pages !== 'undefined' && pages[currentPage]) ? pages[currentPage].scale : 1,
                    cx, cy,
                    sx: area.scrollLeft,
                    sy: area.scrollTop
                };

            } else if (n === 3) {
                // بداية Pan بثلاثة أصابع
                e.preventDefault();
                _pinch = null;
                _tri = {
                    x:  e.touches[0].clientX,
                    y:  e.touches[0].clientY,
                    sx: area.scrollLeft,
                    sy: area.scrollTop
                };
            }
        }, { passive: false });

        // --------------------------------------------------
        // مستمع واحد لـ touchmove
        // --------------------------------------------------
        area.addEventListener('touchmove', function (e) {
            const n = e.touches.length;

            // --- Pinch ---
            if (n === 2 && _pinch) {
                e.preventDefault();
                if (typeof pages === 'undefined') return;
                const page = pages[currentPage];
                if (!page || typeof window._zoomAround !== 'function') return;

                const t1   = e.touches[0], t2 = e.touches[1];
                const dist  = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);

                if (_pinch.dist > 0) {
                    // Scale الجديد بناءً على نسبة المسافة
                    const newScale = Math.max(0.2, Math.min(_pinch.scale * (dist / _pinch.dist), 5));

                    // مركز الإصبعين الحالي
                    const cx = (t1.clientX + t2.clientX) / 2;
                    const cy = (t1.clientY + t2.clientY) / 2;

                    // نقطة التركيز بإحداثيات المحتوى (ثابتة = محسوبة من بداية الـ pinch)
                    const rect     = area.getBoundingClientRect();
                    const focusX   = _pinch.cx - rect.left;
                    const focusY   = _pinch.cy - rect.top;
                    const contentX = (_pinch.sx + focusX) / _pinch.scale;
                    const contentY = (_pinch.sy + focusY) / _pinch.scale;

                    page.scale = newScale;
                    if (typeof applyTransform === 'function') applyTransform(page);

                    // scroll ليبقى مركز الـ pinch في نفس مكانه
                    area.scrollLeft = contentX * newScale - focusX;
                    area.scrollTop  = contentY * newScale - focusY;
                }
                return;
            }

            // --- Pan بثلاثة أصابع ---
            if (n === 3 && _tri) {
                e.preventDefault();
                const dx = e.touches[0].clientX - _tri.x;
                const dy = e.touches[0].clientY - _tri.y;
                area.scrollLeft = _tri.sx - dx;
                area.scrollTop  = _tri.sy - dy;
                return;
            }

        }, { passive: false });

        // --------------------------------------------------
        // إعادة ضبط عند رفع الأصابع
        // --------------------------------------------------
        area.addEventListener('touchend', function (e) {
            if (e.touches.length < 2) _pinch = null;
            if (e.touches.length < 3) _tri   = null;
        });
        area.addEventListener('touchcancel', function () {
            _pinch = null;
            _tri   = null;
        });

        console.log('viewport-lock: جاهز ✓');
    });

})();
