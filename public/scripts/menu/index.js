document.addEventListener('DOMContentLoaded', function () {
    let selectedSkin = "ship1.png";
    const playButton = document.getElementById('playButton');
    const playerNameInput = document.getElementById('playerName');

    let customSkinData = null;
    let isDrawing = false;
    let eraserMode = false;

    let bucketMode = false;
    let brushSize = 23;

    const skinOptions = document.querySelectorAll('.skin-option');
    const customSkinButton = document.getElementById('customSkinButton');
    const skinModal = document.getElementById('skinModal');

    const skinCanvas = document.getElementById('skinCanvas');
    const ctx = skinCanvas.getContext('2d');
    const gridCanvas = document.getElementById('gridCanvas');
    const gridCtx = gridCanvas.getContext('2d');

    const colorPicker = document.getElementById('colorPicker');
    const eraserButton = document.getElementById('eraserButton');
    const clearButton = document.getElementById('clearButton');
    const saveSkinButton = document.getElementById('saveSkinButton');
    const cancelSkinButton = document.getElementById('cancelSkinButton');

    const bucketButton = document.getElementById('bucketButton');
    const brushSizeInput = document.getElementById('brushSize');

    brushSizeInput.style.display = 'none';

    ctx.fillStyle = 'black';
    ctx.fillRect(0, 0, skinCanvas.width, skinCanvas.height);

    skinOptions.forEach(option => {
        option.addEventListener('click', function () {
            if (this.classList.contains('custom-skin')) return;

            skinOptions.forEach(opt => opt.classList.remove('selected'));

            this.classList.add('selected');
            selectedSkin = this.getAttribute('data-skin');
            customSkinData = null;
        });
    });

    customSkinButton.addEventListener('click', function () {
        const playerName = playerNameInput.value.trim();

        if (!playerName) {
            alert('Por favor, ingresa tu nombre para comenzar.');
            return;
        }

        skinModal.style.display = 'flex';

        drawGrid();
    });


    function drawGrid() {
        const w = skinCanvas.width, h = skinCanvas.height;
        gridCtx.clearRect(0, 0, w, h);
        gridCtx.strokeStyle = 'rgba(255,255,255,0.2)';
        gridCtx.lineWidth = 1;
        gridCtx.beginPath();
        for (let x = 0; x <= w; x += brushSize) {
            gridCtx.moveTo(x + 0.5, 0);
            gridCtx.lineTo(x + 0.5, h);
        }
        for (let y = 0; y <= h; y += brushSize) {
            gridCtx.moveTo(0, y + 0.5);
            gridCtx.lineTo(w, y + 0.5);
        }
        gridCtx.stroke();
    }

    function clearCanvas() {
        ctx.fillStyle = 'black';
        ctx.fillRect(0, 0, skinCanvas.width, skinCanvas.height);
        drawGrid();
    }

    brushSizeInput.addEventListener('input', () => {
        brushSize = parseInt(brushSizeInput.value, 24) || 1;
        clearCanvas();
    });

    bucketButton.addEventListener('click', () => {
        bucketMode = !bucketMode;
        eraserMode = false;
        bucketButton.textContent = bucketMode ? 'Pincel' : 'Cubeta';
        eraserButton.textContent = 'Borrador';
    });

    skinCanvas.addEventListener('mousedown', handleCanvasClick);
    skinCanvas.addEventListener('mousemove', draw);
    skinCanvas.addEventListener('mouseup', stopDrawing);
    skinCanvas.addEventListener('mouseout', stopDrawing);

    function handleCanvasClick(e) {
        if (bucketMode) {
            const rect = skinCanvas.getBoundingClientRect();
            const x = Math.floor(e.clientX - rect.left);
            const y = Math.floor(e.clientY - rect.top);
            const fillCol = hexToRgba(colorPicker.value);
            floodFill(x, y, fillCol);
        } else {
            startDrawing(e);
        }
    }

    function startDrawing(e) {
        isDrawing = true;
        draw(e);
    }

    function draw(e) {
        if (!isDrawing || bucketMode) return;
        const rect = skinCanvas.getBoundingClientRect();
        let x = e.clientX - rect.left;
        let y = e.clientY - rect.top;
        x = Math.floor(x / brushSize) * brushSize;
        y = Math.floor(y / brushSize) * brushSize;
        ctx.fillStyle = eraserMode ? 'black' : colorPicker.value;
        ctx.fillRect(x, y, brushSize, brushSize);
    }

    function stopDrawing() {
        isDrawing = false;
    }

    eraserButton.addEventListener('click', () => {
        eraserMode = !eraserMode;
        bucketMode = false;
        eraserButton.textContent = eraserMode ? 'Pincel' : 'Borrador';
        bucketButton.textContent = 'Cubeta';
    });

    function floodFill(startX, startY, fillColor) {
        const w = skinCanvas.width, h = skinCanvas.height;
        const img = ctx.getImageData(0, 0, w, h);
        const data = img.data;
        const stack = [[startX, startY]];
        const idx = (x, y) => (y * w + x) * 4;
        const targetIdx = idx(startX, startY);
        const targetColor = data.slice(targetIdx, targetIdx + 4).join(',');
        const newColor = fillColor.join(',');
        if (targetColor === newColor) return;
        while (stack.length) {
            const [x, y] = stack.pop();
            let i = idx(x, y);
            if (data.slice(i, i + 4).join(',') !== targetColor) continue;
            data[i] = fillColor[0];
            data[i + 1] = fillColor[1];
            data[i + 2] = fillColor[2];
            data[i + 3] = fillColor[3];
            if (x > 0) stack.push([x - 1, y]);
            if (x < w - 1) stack.push([x + 1, y]);
            if (y > 0) stack.push([x, y - 1]);
            if (y < h - 1) stack.push([x, y + 1]);
        }
        ctx.putImageData(img, 0, 0);
    }

    function hexToRgba(hex) {
        const v = hex.replace('#', '');
        const num = parseInt(v, 16);
        return [(num >> 16) & 255, (num >> 8) & 255, num & 255, 255];
    }

    clearButton.addEventListener('click', clearCanvas);

    cancelSkinButton.addEventListener('click', function () {
        skinModal.style.display = 'none';

        if (!customSkinData) {
            skinOptions.forEach(opt => opt.classList.remove('selected'));

            skinOptions.forEach(opt => {
                if (opt.getAttribute('data-skin') === selectedSkin) {
                    opt.classList.add('selected');
                }
            });

            if (!document.querySelector('.skin-option.selected')) {
                skinOptions[0].classList.add('selected');
                selectedSkin = skinOptions[0].getAttribute('data-skin');
            }
        }
    });

    skinModal.addEventListener('click', function (e) {
        if (e.target === skinModal) {
            cancelSkinButton.click();
        }
    });

    saveSkinButton.addEventListener('click', function () {
        if (!playerNameInput.value) {
            alert('Por favor, ingresa tu nombre antes de guardar tu diseño.');
            return;
        }

        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = 90;
        tempCanvas.height = 90;
        const tempCtx = tempCanvas.getContext('2d');

        tempCtx.fillStyle = 'black';
        tempCtx.fillRect(0, 0, 90, 90);
        tempCtx.drawImage(skinCanvas, 0, 0, skinCanvas.width, skinCanvas.height, 0, 0, 90, 90);

        customSkinData = tempCanvas.toDataURL('image/png');

        fetch('/save-skin', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                imageData: customSkinData,
                playerName: playerNameInput.value
            })
        })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    skinOptions.forEach(opt => opt.classList.remove('selected'));

                    customSkinButton.classList.add('selected');
                    selectedSkin = data.fileName;

                    const customSkinImage = document.getElementById('customSkinImage');
                    customSkinImage.src = data.skinPath;
                    customSkinImage.style.display = 'block';

                    const customSkinText = customSkinButton.querySelector('p');
                    if (customSkinText) {
                        customSkinText.style.display = 'none';
                    }

                    skinModal.style.display = 'none';
                } else {
                    alert('Error al guardar la imagen: ' + data.error);
                }
            })
            .catch(error => {
                console.error('Error:', error);
                alert('Ocurrió un error al guardar tu diseño. Inténtalo nuevamente.');
            });
    });

    playButton.addEventListener('click', function () {
        const playerName = playerNameInput.value.trim();

        if (!playerName) {
            alert('Por favor, ingresa tu nombre para comenzar.');
            return;
        }

        sessionStorage.setItem('playerName', playerName);
        sessionStorage.setItem('playerSkin', selectedSkin);

        window.location.href = '/game';
    });
});