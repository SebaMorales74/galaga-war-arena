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

// Servir archivos estáticos
app.use(express.static('public'));
app.use(express.json({ limit: '5mb' }));

// Rutas de páginas
app.get('/', (req, res) => {
    res.sendFile(join(__dirname, 'public/index.html'));
});
app.get('/game', (req, res) => {
    res.sendFile(join(__dirname, 'public/game.html'));
});

// Guardar skin personalizada
app.post('/save-skin', async (req, res) => {
    const { imageData, playerName } = req.body;

    if (!imageData || !playerName) {
        return res.status(400).json({ error: 'Datos incompletos' });
    }

    try {
        // Eliminar el prefijo del data URL
        const base64Data = imageData.replace(/^data:image\/png;base64,/, '');
        const imageBuffer = Buffer.from(base64Data, 'base64');

        // Verificar dimensiones de la imagen
        const metadata = await sharp(imageBuffer).metadata();

        // Verificar si las dimensiones son exactamente 90x90
        if (metadata.width !== 90 || metadata.height !== 90) {
            return res.status(400).json({
                error: 'Dimensiones de imagen incorrectas. La imagen debe ser exactamente de 90x90 píxeles.',
                actualSize: `${metadata.width}x${metadata.height}`
            });
        }

        // Crear un nombre de archivo único
        const fileName = `${playerName}_${Date.now()}.png`;
        const filePath = join(__dirname, 'public/assets/skins', fileName);

        // Guardar el archivo
        writeFile(filePath, imageBuffer, (err) => {
            if (err) {
                console.error(err);
                return res.status(500).json({ error: 'Error al guardar la imagen' });
            }

            const skinPath = `assets/skins/${fileName}`;

            // Guardar la referencia a la nueva skin en sessionStorage del cliente
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

// Ruta para obtener la lista de jugadores
app.get('/players', (req, res) => {
    const playersList = Object.values(gameState.players).map(player => (player));
    res.json(playersList);
});

// Ruta para obtener información de un jugador específico
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

// Configuración del juego
let gameState = {
    players: {},
    bullets: {},
    powerUps: [],
    gameArea: { width: 2000, height: 1500 }
};

// Intervalo para generar power-ups
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

// Manejo de conexiones Socket.IO
io.on('connection', (socket) => {
    console.log('Nuevo jugador conectado:', socket.id);

    // console.log(gameState.players)

    // Jugador se une al juego
    socket.on('joinGame', (playerData) => {
        console.log(playerData)

        // Posición aleatoria para el jugador
        const position = {
            x: Math.random() * gameState.gameArea.width,
            y: Math.random() * gameState.gameArea.height
        };

        // Crear jugador
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

        // Informar al cliente de su ID y posición inicial
        socket.emit('gameJoined', {
            id: socket.id,
            position: position,
            gameState: gameState
        });

        // Informar a todos los demás jugadores
        socket.broadcast.emit('playerJoined', gameState.players[socket.id]);
    });

    // Actualización de movimiento del jugador
    socket.on('playerMovement', (movementData) => {
        if (gameState.players[socket.id] && gameState.players[socket.id].alive) {
            gameState.players[socket.id].x = movementData.x;
            gameState.players[socket.id].y = movementData.y;
            gameState.players[socket.id].rotation = movementData.rotation;

            // Informar a los demás jugadores
            socket.broadcast.emit('playerMoved', {
                id: socket.id,
                x: movementData.x,
                y: movementData.y,
                rotation: movementData.rotation
            });
        }
    });

    // Jugador dispara
    socket.on('playerShoot', (bulletData) => {
        const player = gameState.players[socket.id];

        if (player && player.alive && !player.reloading) {
            // Comprobar munición
            if (player.ammo > 0) {
                player.ammo--;

                // Crear balas según el powerup
                const bullets = [];

                if (player.powerUp === 'triple') {
                    // Disparo triple: bala central y dos laterales
                    for (let i = -1; i <= 1; i++) {
                        const angle = player.rotation + (i * 0.2);
                        const bulletId = `${socket.id}_${Date.now()}_${i}`;

                        bullets.push({
                            id: bulletId,
                            playerId: socket.id,
                            x: bulletData.x,
                            y: bulletData.y,
                            velocityX: Math.cos(angle) * 10,
                            velocityY: Math.sin(angle) * 10,
                            damage: 25,
                            type: 'triple'
                        });

                        gameState.bullets[bulletId] = bullets[bullets.length - 1];
                    }
                } else if (player.powerUp === 'homing') {
                    // Disparo teledirigido
                    const bulletId = `${socket.id}_${Date.now()}`;
                    const bullet = {
                        id: bulletId,
                        playerId: socket.id,
                        x: bulletData.x,
                        y: bulletData.y,
                        velocityX: Math.cos(player.rotation) * 8,
                        velocityY: Math.sin(player.rotation) * 8,
                        damage: 35,
                        type: 'homing',
                        target: findClosestEnemy(player)
                    };

                    bullets.push(bullet);
                    gameState.bullets[bulletId] = bullet;
                } else {
                    // Disparo normal
                    const bulletId = `${socket.id}_${Date.now()}`;
                    const bullet = {
                        id: bulletId,
                        playerId: socket.id,
                        x: bulletData.x,
                        y: bulletData.y,
                        velocityX: Math.cos(player.rotation) * 10,
                        velocityY: Math.sin(player.rotation) * 10,
                        damage: 25,
                        type: 'normal'
                    };

                    bullets.push(bullet);
                    gameState.bullets[bulletId] = bullet;
                }

                // Informar a todos los jugadores de los disparos
                io.emit('bulletCreated', bullets);

                // Si se quedó sin munición, iniciar recarga
                if (player.ammo <= 0) {
                    player.reloading = true;
                    setTimeout(() => {
                        if (gameState.players[socket.id]) {
                            gameState.players[socket.id].ammo = 10;
                            gameState.players[socket.id].reloading = false;
                            socket.emit('ammoReloaded', { ammo: 10 });
                        }
                    }, 1000);
                }
            }
        }
    });

    // Jugador recoge power-up
    socket.on('collectPowerUp', (powerUpId) => {
        const powerUpIndex = gameState.powerUps.findIndex(pu => pu.id === powerUpId);

        if (powerUpIndex !== -1 && gameState.players[socket.id]) {
            const powerUp = gameState.powerUps[powerUpIndex];
            gameState.players[socket.id].powerUp = powerUp.type;

            // Eliminar power-up del juego
            gameState.powerUps.splice(powerUpIndex, 1);

            // Informar a todos los jugadores
            io.emit('powerUpCollected', {
                playerId: socket.id,
                powerUpId: powerUpId,
                powerUpType: powerUp.type
            });
        }
    });

    // Jugador recibe daño
    socket.on('playerHit', (data) => {
        const { bulletId, targetId } = data;

        if (gameState.bullets[bulletId] && gameState.players[targetId]) {
            const bullet = gameState.bullets[bulletId];
            const player = gameState.players[targetId];

            // Aplicar daño
            player.health -= bullet.damage;

            // Eliminar la bala
            delete gameState.bullets[bulletId];
            io.emit('bulletDestroyed', { id: bulletId });

            // Comprobar si el jugador ha muerto
            if (player.health <= 0) {
                player.alive = false;

                // Actualizar puntuación del jugador que disparó
                if (gameState.players[bullet.playerId]) {
                    gameState.players[bullet.playerId].score += 100;
                    io.to(bullet.playerId).emit('scoreUpdated', {
                        score: gameState.players[bullet.playerId].score
                    });
                }

                // Informar a todos de la muerte
                io.emit('playerKilled', {
                    killed: targetId,
                    killer: bullet.playerId
                });
            } else {
                // Informar del daño
                io.emit('playerDamaged', {
                    id: targetId,
                    health: player.health
                });
            }
        }
    });

    // Jugador quiere reaparecer
    socket.on('respawn', () => {
        if (gameState.players[socket.id] && !gameState.players[socket.id].alive) {
            // Posición aleatoria para reaparecer
            const position = {
                x: Math.random() * gameState.gameArea.width,
                y: Math.random() * gameState.gameArea.height
            };

            // Reiniciar valores del jugador
            gameState.players[socket.id].x = position.x;
            gameState.players[socket.id].y = position.y;
            gameState.players[socket.id].health = 100;
            gameState.players[socket.id].ammo = 10;
            gameState.players[socket.id].reloading = false;
            gameState.players[socket.id].powerUp = null;
            gameState.players[socket.id].alive = true;

            // Informar al jugador y a los demás
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

    // Jugador se desconecta
    socket.on('disconnect', () => {
        console.log('Jugador desconectado:', socket.id);

        if (gameState.players[socket.id]) {
            // Eliminar todas las balas del jugador
            for (const bulletId in gameState.bullets) {
                if (gameState.bullets[bulletId].playerId === socket.id) {
                    delete gameState.bullets[bulletId];
                }
            }

            // Eliminar al jugador
            delete gameState.players[socket.id];

            // Informar a los demás jugadores
            io.emit('playerDisconnected', { id: socket.id });
        }
    });
});

// Actualización del estado del juego (balas)
setInterval(() => {
    let bulletsUpdated = false;

    // Actualizar posición de las balas
    for (const bulletId in gameState.bullets) {
        const bullet = gameState.bullets[bulletId];

        // Para balas teledirigidas, ajustar la velocidad hacia el objetivo
        if (bullet.type === 'homing' && bullet.target) {
            const targetPlayer = gameState.players[bullet.target];

            if (targetPlayer && targetPlayer.alive) {
                // Calcular dirección hacia el objetivo
                const dx = targetPlayer.x - bullet.x;
                const dy = targetPlayer.y - bullet.y;
                const distance = Math.sqrt(dx * dx + dy * dy);

                // Ajustar velocidad gradualmente hacia el objetivo
                if (distance > 0) {
                    const factor = 0.1; // Factor de ajuste de dirección
                    bullet.velocityX += (dx / distance) * factor;
                    bullet.velocityY += (dy / distance) * factor;

                    // Normalizar velocidad
                    const speed = Math.sqrt(bullet.velocityX * bullet.velocityX + bullet.velocityY * bullet.velocityY);
                    bullet.velocityX = (bullet.velocityX / speed) * 8;
                    bullet.velocityY = (bullet.velocityY / speed) * 8;
                }
            }
        }

        // Actualizar posición
        bullet.x += bullet.velocityX;
        bullet.y += bullet.velocityY;
        bulletsUpdated = true;

        // Comprobar si la bala está fuera de los límites
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

        // Comprobar colisiones con jugadores
        for (const playerId in gameState.players) {
            const player = gameState.players[playerId];

            // No colisionar con el jugador que disparó
            if (playerId !== bullet.playerId && player.alive) {
                // Distancia entre bala y jugador (colisión simple)
                const dx = player.x - bullet.x;
                const dy = player.y - bullet.y;
                const distance = Math.sqrt(dx * dx + dy * dy);

                // Radio de colisión del jugador (ajustar según necesidad)
                const hitRadius = 30;

                if (distance < hitRadius) {
                    // Emitir evento de colisión para que los clientes puedan manejarlo
                    io.emit('bulletHit', {
                        bulletId: bulletId,
                        targetId: playerId
                    });

                    // Eliminar la bala
                    delete gameState.bullets[bulletId];
                    break;
                }
            }
        }
    }

    // Enviar actualización de balas a todos los clientes si hubo cambios
    if (bulletsUpdated) {
        io.emit('bulletsUpdate', gameState.bullets);
    }
}, 16); // Aproximadamente 60 FPS

// Función para encontrar el enemigo más cercano
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

// Iniciar el servidor
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Servidor en funcionamiento en el puerto ${PORT}`);
});