import express from 'express';
import { createServer } from 'http';
import * as socketIO from 'socket.io';
import { writeFile } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import sharp from 'sharp';

const app = express();
const server = createServer(app);
const io = new socketIO.Server(server);

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

app.use(express.static('public'));
app.use(express.json({ limit: '5mb' }));

app.get('/', (req, res) => {
    res.sendFile(join(__dirname, 'public/index.html'));
});

app.get('/game', (req, res) => {
    res.sendFile(join(__dirname, 'public/game.html'));
});

app.post('/save-skin', async (req, res) => {
    const { imageData, playerName } = req.body;

    if (!imageData || !playerName) {
        return res.status(400).json({ error: 'Datos incompletos' });
    }

    try {
        const base64Data = imageData.replace(/^data:image\/png;base64,/, '');
        const imageBuffer = Buffer.from(base64Data, 'base64');

        const metadata = await sharp(imageBuffer).metadata();

        if (metadata.width !== 90 || metadata.height !== 90) {
            return res.status(400).json({
                error: 'Dimensiones de imagen incorrectas. La imagen debe ser exactamente de 90x90 píxeles.',
                actualSize: `${metadata.width}x${metadata.height}`
            });
        }

        const fileName = `${playerName}_${Date.now()}.png`;
        const filePath = join(__dirname, 'public/assets/skins', fileName);

        writeFile(filePath, imageBuffer, (err) => {
            if (err) {
                console.error(err);
                return res.status(500).json({ error: 'Error al guardar la imagen' });
            }

            const skinPath = `assets/skins/${fileName}`;

            res.json({
                success: true,
                skinPath: skinPath,
                fileName: fileName
            });
        });
    } catch (error) {
        console.error('Error al procesar la imagen:', error);
        return res.status(500).json({ error: 'Error al procesar la imagen' });
    }
});

app.get('/players', (req, res) => {
    const playersList = Object.values(gameState.players).map(player => (player));
    res.json(playersList);
});

app.get('/player/:id', (req, res) => {
    const playerId = req.params.id;

    if (gameState.players[playerId]) {
        res.json({
            id: playerId,
            name: gameState.players[playerId].name,
            skin: gameState.players[playerId].skin,
            score: gameState.players[playerId].score,
            alive: gameState.players[playerId].alive
        });
    } else {
        res.status(404).json({ error: 'Jugador no encontrado' });
    }
});

app.get('/scores', (req, res) => {
    const scores = Object.values(gameState.players).map(player => ({
        id: player.id,
        name: player.name,
        score: player.score
    })).sort((a, b) => b.score - a.score);

    res.json(scores);
});

let gameState = {
    players: {},
    bullets: {},
    powerUps: [],
    gameArea: { width: 2000, height: 1500 }
};

setInterval(() => {
    if (Object.keys(gameState.players).length > 0 && gameState.powerUps.length < 5) {
        const powerUpType = Math.random() > 0.5 ? 'triple' : 'homing';
        gameState.powerUps.push({
            id: Date.now(),
            type: powerUpType,
            x: Math.random() * gameState.gameArea.width,
            y: Math.random() * gameState.gameArea.height,
            width: 30,
            height: 30
        });
        io.emit('powerUpSpawned', gameState.powerUps[gameState.powerUps.length - 1]);
    }
}, 10000);

io.on('connection', (socket) => {
    console.log('Nuevo jugador conectado:', socket.id);
    socket.on('joinGame', (playerData) => {
        console.log(playerData)

        const position = {
            x: Math.random() * gameState.gameArea.width,
            y: Math.random() * gameState.gameArea.height
        };

        gameState.players[socket.id] = {
            id: socket.id,
            name: playerData.name,
            skin: playerData.skin,
            x: position.x,
            y: position.y,
            rotation: 0,
            speed: 5,
            health: 100,
            ammo: 10,
            reloading: false,
            powerUp: null,
            score: 0,
            alive: true
        };

        const playersList = Object.values(gameState.players).map(player => (player));
        console.log(playersList)

        socket.emit('gameJoined', {
            id: socket.id,
            position: position,
            gameState: gameState
        });

        socket.broadcast.emit('playerJoined', gameState.players[socket.id]);
    });

    socket.on('playerMovement', (movementData) => {
        if (gameState.players[socket.id] && gameState.players[socket.id].alive) {
            gameState.players[socket.id].x = movementData.x;
            gameState.players[socket.id].y = movementData.y;
            gameState.players[socket.id].rotation = movementData.rotation;

            socket.broadcast.emit('playerMoved', {
                id: socket.id,
                x: movementData.x,
                y: movementData.y,
                rotation: movementData.rotation
            });
        }
    });

    socket.on('playerShoot', (bulletData) => {
        const player = gameState.players[socket.id];

        if (player && player.alive) {
            if (player.reloading) {
                socket.emit('shootDenied', { reason: 'reloading' });
                return;
            }

            if (player.ammo <= 0) {
                if (!player.reloading) {
                    player.reloading = true;
                    socket.emit('reloadStarted');

                    setTimeout(() => {
                        if (gameState.players[socket.id]) {
                            gameState.players[socket.id].ammo = 10;
                            gameState.players[socket.id].reloading = false;
                            socket.emit('ammoReloaded', { ammo: 10 });
                        }
                    }, 1000);
                }
                return;
            }

            if (bulletData.reload) {
                player.reloading = true;
                player.ammo = 0;
                socket.emit('reloadStarted');

                setTimeout(() => {
                    if (gameState.players[socket.id]) {
                        gameState.players[socket.id].ammo = 10;
                        gameState.players[socket.id].reloading = false;
                        socket.emit('ammoReloaded', { ammo: 10 });
                    }
                }, 1000);
                return;
            }

            player.ammo--;

            socket.emit('ammoUpdated', { ammo: player.ammo });

            const bullets = [];

            if (player.powerUp === 'triple') {
                for (let i = -1; i <= 1; i++) {
                    const angle = player.rotation + (i * 0.2);
                    const bulletId = `${socket.id}_${Date.now()}_${i}`;

                    bullets.push({
                        id: bulletId,
                        playerId: socket.id,
                        x: bulletData.x,
                        y: bulletData.y,
                        velocityX: Math.cos(angle) * 15,
                        velocityY: Math.sin(angle) * 15,
                        damage: 25,
                        type: 'triple'
                    });

                    gameState.bullets[bulletId] = bullets[bullets.length - 1];
                }
            } else if (player.powerUp === 'homing') {
                const bulletId = `${socket.id}_${Date.now()}`;
                const bullet = {
                    id: bulletId,
                    playerId: socket.id,
                    x: bulletData.x,
                    y: bulletData.y,
                    velocityX: Math.cos(player.rotation) * 15,
                    velocityY: Math.sin(player.rotation) * 15,
                    damage: 35,
                    type: 'homing',
                    target: findClosestEnemy(player)
                };

                bullets.push(bullet);
                gameState.bullets[bulletId] = bullet;
            } else {
                const bulletId = `${socket.id}_${Date.now()}`;
                const bullet = {
                    id: bulletId,
                    playerId: socket.id,
                    x: bulletData.x,
                    y: bulletData.y,
                    velocityX: Math.cos(player.rotation) * 15,
                    velocityY: Math.sin(player.rotation) * 15,
                    damage: 25,
                    type: 'normal'
                };

                bullets.push(bullet);
                gameState.bullets[bulletId] = bullet;
            }

            io.emit('bulletCreated', bullets);

            if (player.ammo <= 0) {
                player.reloading = true;
                socket.emit('reloadStarted');

                setTimeout(() => {
                    if (gameState.players[socket.id]) {
                        gameState.players[socket.id].ammo = 10;
                        gameState.players[socket.id].reloading = false;
                        socket.emit('ammoReloaded', { ammo: 10 });
                    }
                }, 1000);
            }
        }
    });

    socket.on('collectPowerUp', (powerUpId) => {
        const powerUpIndex = gameState.powerUps.findIndex(pu => pu.id === powerUpId);

        if (powerUpIndex !== -1 && gameState.players[socket.id]) {
            const powerUp = gameState.powerUps[powerUpIndex];
            gameState.players[socket.id].powerUp = powerUp.type;

            gameState.powerUps.splice(powerUpIndex, 1);

            io.emit('powerUpCollected', {
                playerId: socket.id,
                powerUpId: powerUpId,
                powerUpType: powerUp.type
            });
        }
    });

    socket.on('respawn', () => {
        if (gameState.players[socket.id] && !gameState.players[socket.id].alive) {
            const position = {
                x: Math.random() * gameState.gameArea.width,
                y: Math.random() * gameState.gameArea.height
            };

            gameState.players[socket.id].x = position.x;
            gameState.players[socket.id].y = position.y;
            gameState.players[socket.id].health = 100;
            gameState.players[socket.id].ammo = 10;
            gameState.players[socket.id].reloading = false;
            gameState.players[socket.id].powerUp = null;
            gameState.players[socket.id].alive = true;

            socket.emit('respawned', {
                position: position
            });

            socket.broadcast.emit('playerRespawned', {
                id: socket.id,
                x: position.x,
                y: position.y
            });
        }
    });

    socket.on('disconnect', () => {
        console.log('Jugador desconectado:', socket.id);

        if (gameState.players[socket.id]) {
            for (const bulletId in gameState.bullets) {
                if (gameState.bullets[bulletId].playerId === socket.id) {
                    delete gameState.bullets[bulletId];
                }
            }

            delete gameState.players[socket.id];

            io.emit('playerDisconnected', { id: socket.id });
        }
    });
});

setInterval(() => {
    let bulletsUpdated = false;

    for (const bulletId in gameState.bullets) {
        const bullet = gameState.bullets[bulletId];

        if (bullet.type === 'homing' && bullet.target) {
            const targetPlayer = gameState.players[bullet.target];

            if (targetPlayer && targetPlayer.alive) {
                const dx = targetPlayer.x - bullet.x;
                const dy = targetPlayer.y - bullet.y;
                const distance = Math.sqrt(dx * dx + dy * dy);

                if (distance > 0) {
                    const factor = 0.1;
                    bullet.velocityX += (dx / distance) * factor;
                    bullet.velocityY += (dy / distance) * factor;

                    const speed = Math.sqrt(bullet.velocityX * bullet.velocityX + bullet.velocityY * bullet.velocityY);
                    bullet.velocityX = (bullet.velocityX / speed) * 16;
                    bullet.velocityY = (bullet.velocityY / speed) * 16;
                }
            }
        }

        bullet.x += bullet.velocityX;
        bullet.y += bullet.velocityY;
        bulletsUpdated = true;

        if (
            bullet.x < 0 ||
            bullet.x > gameState.gameArea.width ||
            bullet.y < 0 ||
            bullet.y > gameState.gameArea.height
        ) {
            delete gameState.bullets[bulletId];
            io.emit('bulletDestroyed', { id: bulletId });
            continue;
        }

        for (const playerId in gameState.players) {
            const player = gameState.players[playerId];

            if (playerId !== bullet.playerId && player.alive) {
                const dx = player.x - bullet.x;
                const dy = player.y - bullet.y;
                const distance = Math.sqrt(dx * dx + dy * dy);

                const hitRadius = 30;

                if (distance < hitRadius) {
                    player.health -= bullet.damage;

                    io.emit('bulletHit', {
                        bulletId: bulletId,
                        targetId: playerId,
                        damage: bullet.damage,
                        health: player.health
                    });

                    delete gameState.bullets[bulletId];
                    io.emit('bulletDestroyed', { id: bulletId });

                    if (player.health <= 0) {
                        player.alive = false;

                        if (gameState.players[bullet.playerId]) {
                            gameState.players[bullet.playerId].score += 100;

                            io.emit('globalScoreUpdate', {
                                playerId: bullet.playerId,
                                score: gameState.players[bullet.playerId].score
                            });

                            io.to(bullet.playerId).emit('scoreUpdated', {
                                score: gameState.players[bullet.playerId].score
                            });
                        }

                        io.emit('playerKilled', {
                            killed: playerId,
                            killer: bullet.playerId
                        });
                    } else {
                        io.emit('playerDamaged', {
                            id: playerId,
                            health: player.health
                        });
                    }

                    break;
                }
            }
        }
    }

    if (bulletsUpdated) {
        io.emit('bulletsUpdate', gameState.bullets);
    }
}, 16);

// Añadir un intervalo para sincronizar puntuaciones periódicamente (cada 30 segundos)
setInterval(() => {
    // Solo enviar si hay jugadores activos
    if (Object.keys(gameState.players).length > 0) {
        io.emit('scoreboardSync', Object.values(gameState.players).map(player => ({
            id: player.id,
            name: player.name,
            score: player.score,
            alive: player.alive
        })));
    }
}, 30000);

function findClosestEnemy(player) {
    let closestDistance = Infinity;
    let closestPlayer = null;

    for (const playerId in gameState.players) {
        // No apuntar a sí mismo
        if (playerId !== player.id && gameState.players[playerId].alive) {
            const enemy = gameState.players[playerId];
            const dx = enemy.x - player.x;
            const dy = enemy.y - player.y;
            const distance = Math.sqrt(dx * dx + dy * dy);

            if (distance < closestDistance) {
                closestDistance = distance;
                closestPlayer = playerId;
            }
        }
    }

    return closestPlayer;
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Servidor en funcionamiento en el puerto ${PORT}`);
});