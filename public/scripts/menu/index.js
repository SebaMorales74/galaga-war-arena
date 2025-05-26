import CustomSkinsHandler from "./customSkinsHandler.js";

document.addEventListener('DOMContentLoaded', function () {
    let selectedSkin = "ship1.png";
    const playButton = document.getElementById('playButton');
    const playerNameInput = document.getElementById('playerName');

    CustomSkinsHandler(selectedSkin);

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