function CustomSkinsHandler(selectedSkin) {
    let customSkinData = null;
    let isDrawing = false;
    let eraserMode = false;

    const playerNameInput = document.getElementById('playerName');

    const skinOptions = document.querySelectorAll('.skin-option');
    const customSkinButton = document.getElementById('customSkinButton');
    const skinModal = document.getElementById('skinModal');
    const skinCanvas = document.getElementById('skinCanvas');
    const ctx = skinCanvas.getContext('2d');
    const colorPicker = document.getElementById('colorPicker');
    const eraserButton = document.getElementById('eraserButton');
    const clearButton = document.getElementById('clearButton');
    const saveSkinButton = document.getElementById('saveSkinButton');
    const cancelSkinButton = document.getElementById('cancelSkinButton');

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

        ctx.fillStyle = 'black';
        ctx.fillRect(0, 0, skinCanvas.width, skinCanvas.height);
    });

    skinCanvas.addEventListener('mousedown', startDrawing);
    skinCanvas.addEventListener('mousemove', draw);
    skinCanvas.addEventListener('mouseup', stopDrawing);
    skinCanvas.addEventListener('mouseout', stopDrawing);

    function startDrawing(e) {
        isDrawing = true;
        draw(e);
    }

    function draw(e) {
        if (!isDrawing) return;

        const rect = skinCanvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        ctx.lineWidth = 10;
        ctx.lineCap = 'round';

        if (eraserMode) {
            ctx.strokeStyle = 'black';
            ctx.lineWidth = 15;
        } else {
            ctx.strokeStyle = colorPicker.value;
        }

        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x, y);
        ctx.stroke();
    }

    function stopDrawing() {
        isDrawing = false;
    }

    eraserButton.addEventListener('click', function () {
        eraserMode = !eraserMode;
        this.textContent = eraserMode ? 'Pincel' : 'Borrador';
    });

    clearButton.addEventListener('click', function () {
        ctx.fillStyle = 'black';
        ctx.fillRect(0, 0, skinCanvas.width, skinCanvas.height);
    });

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
}

export default CustomSkinsHandler;