/**
 * السبورة الذكية - قفل Viewport + Pinch ذكي للأجهزة اللوحية
 * Smart Whiteboard - Viewport Lock & Smart Pinch Zoom
 *
 * ① Pinch-to-zoom للمتصفح    → ممنوع كلياً
 * ② Pull-to-refresh           → ممنوع تماماً
 * ③ Ctrl+= / Ctrl+-           → zoom كل الصفحات معاً
 * ④ Ctrl+0                    → إعادة zoom إلى 100% لكل الصفحات
 * ⑤ Ctrl+Wheel               → zoom كل الصفحات حول موقع المؤشر
 * ⑥ Pan (أداة اليد)           → scroll داخل .canvas-area
 * ⑦ Pinch بإصبعين ذكي        → zoom سلس مع momentum + حدود ناعمة
 */

(function () {
    'use strict';

    // =========================================================
    // ① منع Pinch-to-zoom في المتصفح على مستوى document
    // =========================================================

    document.addEventListener('touchstart', function (e) {
        if (e.touches.length > 1) e.preventDefault();
    }, { passive: false });

    document.addEventListener('touchmove', function (e) {
        if (e.touches.length > 1) e.preventDefault();
    }, { passive: false });

    document.addEventListener('gesturestart',  function (e) { e.preventDefault(); }, { passive: false });
    document.addEventListener('gesturechange', function (e) { e.preventDefault(); }, { passive: false });
    document.addEventListener('gestureend',    function (e) { e.preventDefault(); }, { passive: false });

    // =========================================================
    // ② منع Pull-to-refresh
    // =========================================================

    let _pullStartY = 0;

    document.addEventListener('touchstart', function (e) {
        if (e.touches.length === 1) _pullStartY = e.touches[0].clientY;
    }, { passive: true });

    document.addEventListener('touchmove', function (e) {
        if (e.touches.length !== 1) return;
        const dy = e.touches[0].clientY - _pullStartY;
        if (document.documentElement.scrollTop === 0 && dy > 0) {
            e.preventDefault();
        }
    }, { passive: false });

    // =========================================================
    // ③ + ④ Ctrl+= / Ctrl+- / Ctrl+0 → zoom كل الصفحات
    // =========================================================

    document.addEventListener('keydown', function (e) {
        const isCtrl = e.ctrlKey || e.metaKey;
        if (!isCtrl) return;

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
                if (typeof resetZoom === 'function') resetZoom();
                break;
        }
    });

    // =========================================================
    // ⑤ Ctrl+Wheel → zoom حول موقع المؤشر (كل الصفحات)
    // =========================================================

    document.addEventListener('wheel', function (e) {
        if (!e.ctrlKey && !e.metaKey) return;
        e.preventDefault();

        const factor = e.deltaY < 0 ? 1.1 : 0.9;
        if (typeof zoomAroundPoint === 'function') {
            zoomAroundPoint(factor, e.clientX, e.clientY);
        }
    }, { passive: false });

    // =========================================================
    // ⑥ + ⑦  Pan + Pinch ذكي داخل .canvas-area
    // =========================================================

    window.addEventListener('load', function () {
        const area = document.querySelector('.canvas-area');
        if (!area) return;

        area.style.overflowX          = 'auto';
        area.style.overflowY          = 'auto';
        area.style.overscrollBehavior = 'none';

        // ─── Pan بالماوس ───
        let _mp = false, _mx = 0, _my = 0, _sx = 0, _sy = 0;

        area.addEventListener('mousedown', function (e) {
            const isPan = typeof currentTool !== 'undefined' && currentTool === 'pan';
            const isMid = e.button === 1;
            if (!isPan && !isMid) return;

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

        // ─── Pan باللمس (إصبع واحد في وضع Pan) ───
        let _tp = false, _tx = 0, _ty = 0, _tsx = 0, _tsy = 0;

        area.addEventListener('touchstart', function (e) {
            const isPan = typeof currentTool !== 'undefined' && currentTool === 'pan';
            if (!isPan || e.touches.length !== 1) return;

            e.preventDefault();
            _tp  = true;
            _tx  = e.touches[0].clientX; _ty  = e.touches[0].clientY;
            _tsx = area.scrollLeft;       _tsy = area.scrollTop;
        }, { passive: false });

        area.addEventListener('touchmove', function (e) {
            if (!_tp) return;
            e.preventDefault();
            area.scrollLeft = _tsx - (e.touches[0].clientX - _tx);
            area.scrollTop  = _tsy - (e.touches[0].clientY - _ty);
        }, { passive: false });

        area.addEventListener('touchend',    function () { _tp = false; });
        area.addEventListener('touchcancel', function () { _tp = false; });

        // ─────────────────────────────────────────
        // ⑦ Pinch-to-zoom ذكي بإصبعين
        //    ميزات الـ "ذكاء":
        //    • momentum: استمرار حركة ناعمة بعد رفع الأصابع
        //    • إلغاء Pan أثناء Pinch لمنع الارتجاج
        //    • حدود ناعمة (rubber-band) عند الوصول لأقصى zoom
        //    • تتبع المركز لإبقاء النقطة المحددة ثابتة
        // ─────────────────────────────────────────

        let _pinchActive   = false;
        let _pinchDist     = 0;
        let _pinchScale    = 1;   // globalScale عند بداية الـ pinch
        let _pinchCX       = 0;   // مركز الـ pinch (بالنسبة للـ viewport)
        let _pinchCY       = 0;
        let _pinchScrollX  = 0;   // scroll عند بداية الـ pinch
        let _pinchScrollY  = 0;

        // Momentum
        let _velScale      = 0;   // سرعة التغيير
        let _lastFactor    = 1;
        let _lastTimestamp = 0;
        let _momentumFrame = null;

        function _stopMomentum() {
            if (_momentumFrame) {
                cancelAnimationFrame(_momentumFrame);
                _momentumFrame = null;
            }
            _velScale = 0;
        }

        function _runMomentum() {
            if (Math.abs(_velScale - 1) < 0.0005) {
                _velScale = 0;
                return;
            }

            const factor = 1 + (_velScale - 1) * 0.85; // تباطؤ تدريجي

            if (typeof zoomAroundPoint === 'function') {
                zoomAroundPoint(factor, _pinchCX, _pinchCY);
            }

            _velScale = 1 + (_velScale - 1) * 0.85;
            _momentumFrame = requestAnimationFrame(_runMomentum);
        }

        area.addEventListener('touchstart', function (e) {
            if (e.touches.length !== 2) return;
            e.preventDefault();
            _stopMomentum();
            _tp = false; // إلغاء Pan إذا كان شغالاً

            const t1 = e.touches[0], t2 = e.touches[1];
            _pinchActive  = true;
            _pinchDist    = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
            _pinchScale   = (typeof globalScale !== 'undefined') ? globalScale : 1;
            _pinchCX      = (t1.clientX + t2.clientX) / 2;
            _pinchCY      = (t1.clientY + t2.clientY) / 2;
            _pinchScrollX = area.scrollLeft;
            _pinchScrollY = area.scrollTop;
            _lastFactor   = 1;
            _lastTimestamp = e.timeStamp;
        }, { passive: false });

        area.addEventListener('touchmove', function (e) {
            if (!_pinchActive || e.touches.length !== 2) return;
            e.preventDefault();

            const t1   = e.touches[0], t2 = e.touches[1];
            const dist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);

            if (_pinchDist === 0) return;

            // حساب المركز الحالي للـ pinch
            const cx = (t1.clientX + t2.clientX) / 2;
            const cy = (t1.clientY + t2.clientY) / 2;

            const rawFactor   = dist / _pinchDist;
            const targetScale = _pinchScale * rawFactor;

            // حدود ناعمة (rubber-band) — لا نكسر الحدود فجأة
            let clampedScale;
            const minS = typeof MIN_SCALE !== 'undefined' ? MIN_SCALE : 0.2;
            const maxS = typeof MAX_SCALE !== 'undefined' ? MAX_SCALE : 5;

            if (targetScale < minS) {
                // rubber-band عند الحد الأدنى
                clampedScale = minS - (minS - targetScale) * 0.3;
                clampedScale = Math.max(clampedScale, minS * 0.7);
            } else if (targetScale > maxS) {
                // rubber-band عند الحد الأعلى
                clampedScale = maxS + (targetScale - maxS) * 0.3;
                clampedScale = Math.min(clampedScale, maxS * 1.3);
            } else {
                clampedScale = targetScale;
            }

            // حساب السرعة للـ momentum
            const dt = e.timeStamp - _lastTimestamp;
            if (dt > 0) {
                const instantFactor = clampedScale / (typeof globalScale !== 'undefined' ? globalScale : 1);
                _velScale = 1 + (instantFactor - 1) * Math.min(1, 16 / dt);
            }
            _lastFactor    = rawFactor;
            _lastTimestamp = e.timeStamp;

            // تطبيق الـ scale
            if (typeof globalScale !== 'undefined' && typeof applyTransformAll === 'function') {
                const oldScale = globalScale;
                globalScale    = Math.max(minS, Math.min(clampedScale, maxS));
                applyTransformAll();

                // اضبط scroll حتى يبقى مركز الـ pinch ثابتاً
                const rect       = area.getBoundingClientRect();
                const scaleRatio = globalScale / oldScale;
                const pivotX     = _pinchCX - rect.left + area.scrollLeft;
                const pivotY     = _pinchCY - rect.top  + area.scrollTop;
                area.scrollLeft  = pivotX * scaleRatio - (cx - rect.left);
                area.scrollTop   = pivotY * scaleRatio - (cy - rect.top);

                // حدّث مركز الـ pinch ليتبع حركة الأصابع
                _pinchCX = cx;
                _pinchCY = cy;
            }
        }, { passive: false });

        area.addEventListener('touchend', function (e) {
            if (e.touches.length < 2) {
                if (_pinchActive) {
                    _pinchActive = false;
                    // أطلق الـ momentum إذا كان هناك سرعة
                    if (Math.abs(_velScale - 1) > 0.003) {
                        _momentumFrame = requestAnimationFrame(_runMomentum);
                    }
                }
            }
        });

        area.addEventListener('touchcancel', function () {
            _pinchActive = false;
            _stopMomentum();
        });

        console.log('viewport-lock: جاهز (Pinch ذكي مفعّل)');
    });

})();
