/**
 * السبورة الذكية - الدوال المساعدة
 * Smart Whiteboard - Utility & Helper Functions
 */

// -------------------- تحويلات الألوان (Color Conversion) --------------------

function hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
    } : null;
}

function rgbToHex(r, g, b) {
    return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1).toUpperCase();
}

// تحويل نص rgb(255,0,0) إلى hex
function rgbToHexFromStyle(rgbString) {
    if (!rgbString || !rgbString.startsWith('rgb')) return rgbString;
    const rgbValues = rgbString.match(/\d+/g);
    if (rgbValues && rgbValues.length === 3) {
        return rgbToHex(parseInt(rgbValues[0]), parseInt(rgbValues[1]), parseInt(rgbValues[2]));
    }
    return rgbString;
}

// -------------------- حساب موضع الماوس/اللمس (Mouse / Touch Position) --------------------

function getMousePos(canvas, evt, currentScale, currentTranslateX, currentTranslateY) {
    if (!canvas) {
        console.error("Cannot get mouse position: canvas element is null.");
        return { x: 0, y: 0 };
    }
    const rect = canvas.getBoundingClientRect();

    const clientX = (evt.clientX !== undefined)
        ? evt.clientX
        : (evt.touches && evt.touches[0]
            ? evt.touches[0].clientX
            : (evt.changedTouches && evt.changedTouches[0]
                ? evt.changedTouches[0].clientX
                : 0));

    const clientY = (evt.clientY !== undefined)
        ? evt.clientY
        : (evt.touches && evt.touches[0]
            ? evt.touches[0].clientY
            : (evt.changedTouches && evt.changedTouches[0]
                ? evt.changedTouches[0].clientY
                : 0));

    const mouseX = clientX - rect.left;
    const mouseY = clientY - rect.top;

    return {
        x: mouseX / currentScale,
        y: mouseY / currentScale
    };
}

// -------------------- رسم الأشكال (Shape Drawing Helpers) --------------------

function drawArrow(ctx, fromX, fromY, toX, toY) {
    const headLength = 15;
    const angle = Math.atan2(toY - fromY, toX - fromX);

    ctx.beginPath();
    ctx.moveTo(fromX, fromY);
    ctx.lineTo(toX, toY);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(toX, toY);
    ctx.lineTo(
        toX - headLength * Math.cos(angle - Math.PI / 6),
        toY - headLength * Math.sin(angle - Math.PI / 6)
    );
    ctx.moveTo(toX, toY);
    ctx.lineTo(
        toX - headLength * Math.cos(angle + Math.PI / 6),
        toY - headLength * Math.sin(angle + Math.PI / 6)
    );
    ctx.stroke();
}

function drawTable(ctx, x, y, width, height, rows, cols) {
    if (rows <= 0 || cols <= 0) return;

    const rowHeight = height / rows;
    const colWidth  = width  / cols;

    ctx.beginPath();

    for (let i = 0; i <= rows; i++) {
        ctx.moveTo(x, y + i * rowHeight);
        ctx.lineTo(x + width, y + i * rowHeight);
    }
    for (let i = 0; i <= cols; i++) {
        ctx.moveTo(x + i * colWidth, y);
        ctx.lineTo(x + i * colWidth, y + height);
    }

    ctx.stroke();
}
