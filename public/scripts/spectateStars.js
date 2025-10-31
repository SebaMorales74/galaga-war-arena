/* moving starfield (no parallax) for spectate.html */
(function(){
    const canvas = document.getElementById('starsCanvas');
    if(!canvas) return;
    const ctx = canvas.getContext('2d');

    let w = canvas.width = window.innerWidth;
    let h = canvas.height = window.innerHeight;

    window.addEventListener('resize', ()=>{
        w = canvas.width = window.innerWidth;
        h = canvas.height = window.innerHeight;
        initStars();
    });

    const STARS = [];
    const BASE_COUNT = Math.max(100, Math.floor((w*h)/11000));

    function rand(min, max){ return Math.random()*(max-min)+min }

    function initStars(){
        STARS.length = 0;
        const count = BASE_COUNT;
        for(let i=0;i<count;i++){
            const z = Math.random()*0.9 + 0.1; // depth
            const speed = rand(10, 80) * (1.0 - z); // px/sec, farther stars slower
            STARS.push({
                x: Math.random()*w,
                y: Math.random()*h,
                z: z,
                size: rand(0.4, 2.2) * (1.2 - z),
                baseAlpha: rand(0.15, 0.9),
                speed: speed
            });
        }
    }

    let last = performance.now();
    function draw(){
        const now = performance.now();
        const dt = Math.min(0.05, (now - last) / 1000); // cap delta to avoid big jumps
        last = now;

        // clear + subtle backdrop
        ctx.clearRect(0,0,w,h);
        const g = ctx.createLinearGradient(0,0,0,h);
        g.addColorStop(0, 'rgba(10,18,36,0.02)');
        g.addColorStop(1, 'rgba(2,6,12,0.12)');
        ctx.fillStyle = g;
        ctx.fillRect(0,0,w,h);

        ctx.globalCompositeOperation = 'lighter';
        for(let i=0;i<STARS.length;i++){
            const s = STARS[i];

            // update position (move downward); wrap when offscreen
            s.y += s.speed * dt;
            // small horizontal drift for variety
            s.x += Math.sin((now*0.0005) + i) * 0.1 * (1 - s.z);
            if(s.y > h + 8){
                s.y = -8;
                s.x = Math.random()*w;
            }

            const alpha = s.baseAlpha * (0.6 + 0.4 * Math.sin((now*0.002) + i));

            // glow radial
            const rad = s.size * (1 + (1 - s.z));
            const x = s.x;
            const y = s.y;
            const grad = ctx.createRadialGradient(x, y, 0, x, y, rad*3);
            grad.addColorStop(0, 'rgba(255,255,255,' + (alpha) + ')');
            grad.addColorStop(0.3, 'rgba(126,240,255,' + (alpha*0.22) + ')');
            grad.addColorStop(1, 'rgba(126,240,255,0)');

            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.arc(x, y, rad*1.2, 0, Math.PI*2);
            ctx.fill();
        }
        ctx.globalCompositeOperation = 'source-over';

        requestAnimationFrame(draw);
    }

    // initialize & run
    initStars();
    draw();
})();
