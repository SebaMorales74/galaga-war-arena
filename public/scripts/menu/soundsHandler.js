const playerNameInput = document.getElementById('playerName');
const playMusicButton = document.getElementById('playMusicButton');
const interactiveElements = document.querySelectorAll('.button, .skin-option, #colorPicker');
const buttons = document.querySelectorAll('.button, .skin-option, #eraserButton, #clearButton');

const skinCanvas = document.getElementById('skinCanvas');

const clickDownSound = document.getElementById('clickDownSound');
const clickUpSound = document.getElementById('clickUpSound');
const hoverSound = document.getElementById('hoverSound');

const inputEnterSound = document.getElementById('inputEnter');
const inputLeaveSound = document.getElementById('inputLeave');

const typeSound = document.getElementById('typeSound');
const bgmSound = document.getElementById('bgmSound');


function playSound(sound) {
    const clone = sound.cloneNode();
    clone.volume = 0.6;
    const p = clone.play();
    if (p !== undefined) {
        p.catch(err => console.warn('Playback prevented:', err));
    }
    clone.addEventListener('ended', () => clone.remove());
}

bgmSound.muted = true;
bgmSound.loop = true;
bgmSound.volume = 0.2;
bgmSound.play()
    .then(() => {
        console.log('BGM autoplay muted iniciado');
        bgmSound.pause();
    })
    .catch(e => {
        console.warn('BGM autoplay prevented:', e);
        bgmSound.pause();
    });

playMusicButton.addEventListener('click', () => {
    if (bgmSound.muted) {
        bgmSound.muted = false;
        bgmSound.play().catch(e => console.warn(e));
        playMusicButton.textContent = 'Música Activada';
    } else {
        bgmSound.muted = true;
        bgmSound.pause();
        playMusicButton.textContent = 'Silenciar Música';
    }
});

playerNameInput.addEventListener('input', function (e) {
    playSound(typeSound);
});

interactiveElements.forEach(el =>
    el.addEventListener('mouseenter', () => playSound(hoverSound))
);

interactiveElements.forEach(el =>
    el.addEventListener('mousedown', () => playSound(clickDownSound))
);

buttons.forEach(button => {
    button.addEventListener('click', function () {
        playSound(clickUpSound);
    });
});

playerNameInput.addEventListener('focus', () => playSound(inputEnterSound));
playerNameInput.addEventListener('blur', () => playSound(inputLeaveSound));