/**
 * السبورة الذكية - واجهة المستخدم
 * Smart Whiteboard - UI Interactions
 */

// -------------------- الوضع الليلي (Dark Mode) --------------------

function toggleDarkMode() {
    document.body.classList.toggle("dark-mode");
    const isDarkMode = document.body.classList.contains("dark-mode");
    if (darkModeBtn) {
        darkModeBtn.innerHTML = isDarkMode
            ? '<i class="fas fa-sun"></i>'
            : '<i class="fas fa-moon"></i>';
    }
    console.log(`تم تبديل وضع الإضاءة إلى: ${isDarkMode ? "داكن" : "فاتح"}`);
}

// -------------------- لوحة الإعدادات (Settings Panel) --------------------

function toggleSettingsPanel() {
    if (settingsPanel) {
        settingsPanel.classList.toggle("hidden");
    } else {
        console.error("Settings panel element not found.");
    }
}

// -------------------- الشريط الجانبي (Sidebar) --------------------

function toggleSidebar() {
    if (sidebar) {
        sidebar.classList.toggle("hidden");
    } else {
        console.error("Sidebar element not found.");
    }
}

// -------------------- مسح اللوحة (Clear Canvas) --------------------

function clearCanvas() {
    const page = pages[currentPage];
    if (!page || !page.ctx || !page.canvas) {
        console.error(`Page, context, or canvas not found for page ${currentPage + 1}.`);
        return;
    }

    saveToHistory(currentPage);

    page.ctx.clearRect(0, 0, page.canvas.width, page.canvas.height);
    console.log(`تم مسح محتوى الصفحة ${currentPage + 1}`);
}

// -------------------- مزج الألوان (Color Mixing) --------------------

function setupColorMixing() {
    const redSlider      = document.getElementById('red-slider')       || null;
    const greenSlider    = document.getElementById('green-slider')     || null;
    const blueSlider     = document.getElementById('blue-slider')      || null;
    const redValue       = document.getElementById('red-value')        || null;
    const greenValue     = document.getElementById('green-value')      || null;
    const blueValue      = document.getElementById('blue-value')       || null;
    const colorPreviewBox= document.getElementById('color-preview-box')|| null;
    const colorHexInput  = document.getElementById('color-hex')        || null;
    const addMixedColorBtn = document.getElementById('add-mixed-color')|| null;
    const customColorsGrid = document.querySelector('.custom-colors-grid') || null;

    if (!redSlider || !greenSlider || !blueSlider || !redValue || !greenValue ||
        !blueValue || !colorPreviewBox || !colorHexInput || !addMixedColorBtn || !customColorsGrid) {
        console.error("One or more color mixing elements not found.");
        return;
    }

    function updateColorPreview() {
        const r = redSlider.value, g = greenSlider.value, b = blueSlider.value;
        const hexColor = rgbToHex(parseInt(r), parseInt(g), parseInt(b));
        redValue.textContent   = r;
        greenValue.textContent = g;
        blueValue.textContent  = b;
        colorPreviewBox.style.backgroundColor = hexColor;
        colorHexInput.value = hexColor;
    }

    redSlider.addEventListener('input',   updateColorPreview);
    greenSlider.addEventListener('input', updateColorPreview);
    blueSlider.addEventListener('input',  updateColorPreview);

    colorHexInput.addEventListener('change', () => {
        const rgb = hexToRgb(colorHexInput.value);
        if (rgb) {
            redSlider.value   = rgb.r;
            greenSlider.value = rgb.g;
            blueSlider.value  = rgb.b;
            updateColorPreview();
        }
    });

    addMixedColorBtn.addEventListener('click', () => {
        const newColor = colorHexInput.value;
        const colorExists = Array.from(
            customColorsGrid.querySelectorAll('.custom-color:not(.add-custom-color)')
        ).some(el =>
            el.style.backgroundColor === newColor ||
            rgbToHexFromStyle(el.style.backgroundColor) === newColor
        );

        if (!colorExists) {
            const newColorDiv = document.createElement('div');
            newColorDiv.className = 'custom-color';
            newColorDiv.style.backgroundColor = newColor;
            newColorDiv.addEventListener('click', function () {
                setCurrentColor(newColor);
                updateColorUI(newColor);
                if (colorPicker) colorPicker.value = newColor;
            });

            const addColorButton = customColorsGrid.querySelector('.add-custom-color');
            if (addColorButton) {
                customColorsGrid.insertBefore(newColorDiv, addColorButton);
            } else {
                customColorsGrid.appendChild(newColorDiv);
            }
        } else {
            alert("هذا اللون موجود بالفعل في الألوان المخصصة.");
        }
    });

    // أحداث الألوان المخصصة الموجودة مسبقاً
    customColorsGrid.querySelectorAll('.custom-color:not(.add-custom-color)').forEach(colorDiv => {
        colorDiv.addEventListener('click', function () {
            const color = rgbToHexFromStyle(this.style.backgroundColor);
            setCurrentColor(color);
            updateColorUI(color);
            if (colorPicker) colorPicker.value = color;
        });
    });
}
