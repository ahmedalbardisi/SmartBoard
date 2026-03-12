/**
 * السبورة الذكية - قفل Viewport
 * Smart Whiteboard - Viewport Lock
 *
 * ① منع Pinch-to-zoom و Pull-to-refresh في المتصفح
 * ② Ctrl+= / Ctrl+- / Ctrl+0  →  zoom الورقة فقط
 * ③ عجلة الماوس + Ctrl        →  zoom حول المؤشر
 * ④ Pan بالماوس (أداة اليد)   →  scroll في الحاوية
 * ⑤ إصبعان  →  Pinch-to-zoom حول مركز الإصبعين بدقة
 * ⑥ ثلاثة أصابع  →  Pan (scroll)
 */

(function () {
    'use strict';

    // =========================================================
    // ① منع تدخل المتصفح
    // =========================================================

    document.addEventListener('touchstart', function (e) {
        if (e.touches.length > 1) e.preventDefault();
    }, { passive: false });

    document.addEventListener('touchmove', function (e) {
        if (e.touches.length > 1) e.preventDefault();
    }, { passive: false });

    // Safari
    document.addEventListener('gesturestart',  function (e) { e.preventDefault(); }, { passive: false });
    document.addEventListener('gesturechange', function (e) { e.preventDefault(); }, { passive: false });
    document.addEventListener('gestureend',    function (e) { e.preventDefault(); }, { passive: false });

    // Pull-to-refresh
    let _pullY = 0;
    document.addEventListener('touchstart', function (e) {
        if (e.touches.length === 1) _pullY = e.touches[0].clientY;
    }, { passive: true });
    document.addEventListener('touchmove', function (e) {
        if (e.touches.length !== 1) return;
        if (document.documentElement.scrollTop === 0 &&
            e.touches[0].clientY > _pullY + 8) e.preventDefault();
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
        // توسيط أفقي بعد reset
        setTimeout(function () {
            area.scrollLeft = Math.max(0, (area.scrollWidth - area.clientWidth) / 2);
            area.scrollTop  = 0;
        }, 0);
    }

    // =========================================================
    // ③ عجلة الماوس + Ctrl  →  zoom حول المؤشر
    // =========================================================

    document.addEventListener('wheel', function (e) {
        if (!e.ctrlKey && !e.metaKey) return;
        e.preventDefault();
        if (typeof pages === 'undefined') return;
        const page = pages[currentPage];
        if (!page) return;

        const factor = e.deltaY < 0 ? 1.1 : 0.9;
        _zoomAt(page.scale * factor, e.clientX, e.clientY);
    }, { passive: false });

    // =========================================================
    // دالة مشتركة: Zoom حول نقطة clientX/clientY
    // =========================================================

    function _zoomAt(newScale, clientX, clientY) {
        if (typeof pages === 'undefined') return;
        const page = pages[currentPage];
        if (!page) return;

        newScale = Math.max(0.2, Math.min(newScale, 5));

        const area = document.querySelector('.canvas-area');
        if (!area) {
            page.scale = newScale;
            if (typeof applyTransform === 'function') applyTransform(page);
            return;
        }

        const rect = area.getBoundingClientRect();

        // موقع نقطة التركيز داخل الحاوية (مع الـ scroll)
        const fx = (clientX !== null) ? clientX - rect.left : rect.width  / 2;
        const fy = (clientY !== null) ? clientY - rect.top  : rect.height / 2;

        // إحداثيات المحتوى قبل التكبير
        // المحتوى يبدأ من scrollLeft ونقطة التركيز على بُعد fx منه
        // لكن applyTransform يستخدم transform-origin: top left
        // لذا الإحداثيات الحقيقية على المحتوى = (scroll + focus) / currentScale
        const contentX = (area.scrollLeft + fx) / page.scale;
        const contentY = (area.scrollTop  + fy) / page.scale;

        const oldScale  = page.scale;
        page.scale      = newScale;

        if (typeof applyTransform === 'function') applyTransform(page);

        // بعد applyTransform نضبط scroll حتى تبقى نقطة التركيز في مكانها
        area.scrollLeft = contentX * newScale - fx;
        area.scrollTop  = contentY * newScale - fy;
    }

    // نُصدّر للاستخدام من zoom.js
    window._zoomAt = _zoomAt;

    // =========================================================
    // ④ + ⑤ + ⑥  تُضاف بعد load
    // =========================================================

    window.addEventListener('load', function () {
        const area = document.querySelector('.canvas-area');
        if (!area) return;

        area.style.overflowX          = 'auto';
        area.style.overflowY          = 'auto';
        area.style.overscrollBehavior = 'none';

        // ④ Pan بالماوس
        var _mp = false, _mx = 0, _my = 0, _sx = 0, _sy = 0;

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

        // ⑤ Pinch-to-zoom   ⑥ Pan بثلاثة أصابع
        // نستخدم مستمع واحد للـ area يفرز بين الحالات

        var _pinch = null; // { dist, scale, cx, cy }  مركز ثابت طوال الـ gesture
        var _tri   = null; // { x, y, sx, sy }

        area.addEventListener('touchstart', function (e) {
            var n = e.touches.length;

            if (n === 2) {
                e.preventDefault();
                _tri = null;
                var t1 = e.touches[0], t2 = e.touches[1];
                var cx = (t1.clientX + t2.clientX) / 2;
                var cy = (t1.clientY + t2.clientY) / 2;
                _pinch = {
                    dist:  Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY),
                    scale: (typeof pages !== 'undefined' && pages[currentPage]) ? pages[currentPage].scale : 1,
                    // نحفظ إحداثيات المحتوى عند مركز الـ pinch — تبقى ثابتة طوال الـ gesture
                    // contentX = (scrollLeft + focusX) / scale
                    cx: cx,
                    cy: cy,
                    // scroll عند بداية الـ gesture لحساب contentX/Y مرة واحدة
                    sx: area.scrollLeft,
                    sy: area.scrollTop
                };
                return;
            }

            if (n === 3) {
                e.preventDefault();
                _pinch = null;
                _tri = {
                    x:  e.touches[0].clientX,
                    y:  e.touches[0].clientY,
                    sx: area.scrollLeft,
                    sy: area.scrollTop
                };
                return;
            }
        }, { passive: false });

        area.addEventListener('touchmove', function (e) {
            var n = e.touches.length;

            // ⑤ Pinch
            if (n === 2 && _pinch) {
                e.preventDefault();

                if (typeof pages === 'undefined') return;
                var page = pages[currentPage];
                if (!page) return;

                var t1   = e.touches[0], t2 = e.touches[1];
                var dist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
                if (_pinch.dist === 0) return;

                var newScale = Math.max(0.2, Math.min(_pinch.scale * (dist / _pinch.dist), 5));

                // نقطة التركيز الثابتة (محسوبة مرة واحدة عند بداية الـ pinch)
                var rect   = area.getBoundingClientRect();
                var fx     = _pinch.cx - rect.left; // موقع المركز داخل viewport الحاوية
                var fy     = _pinch.cy - rect.top;

                // إحداثيات المحتوى الثابتة عند نقطة المركز
                var contentX = (_pinch.sx + fx) / _pinch.scale;
                var contentY = (_pinch.sy + fy) / _pinch.scale;

                page.scale = newScale;
                if (typeof applyTransform === 'function') applyTransform(page);

                // اضبط scroll حتى تبقى نقطة المركز في مكانها
                area.scrollLeft = contentX * newScale - fx;
                area.scrollTop  = contentY * newScale - fy;
                return;
            }

            // ⑥ Pan بثلاثة أصابع
            if (n === 3 && _tri) {
                e.preventDefault();
                area.scrollLeft = _tri.sx - (e.touches[0].clientX - _tri.x);
                area.scrollTop  = _tri.sy - (e.touches[0].clientY - _tri.y);
                return;
            }

        }, { passive: false });

        area.addEventListener('touchend', function (e) {
            if (e.touches.length < 2) _pinch = null;
            if (e.touches.length < 3) _tri   = null;
        });
        area.addEventListener('touchcancel', function () {
            _pinch = null;
            _tri   = null;
        });

        console.log('viewport-lock: جاهز');
    });

})();
