import { randRange, lerp, dist } from './utils.js';

const BIOMES = {
    GRASSLAND: { name: 'Grassland', foodMod: 1.5, speedMod: 1.0, tint: [30, 80, 30], particleDensity: 1.2 },
    DESERT:    { name: 'Desert',    foodMod: 0.5, speedMod: 1.2, tint: [80, 70, 30], particleDensity: 0.5 },
    SWAMP:     { name: 'Swamp',     foodMod: 1.0, speedMod: 0.7, tint: [30, 50, 40], particleDensity: 2.0 },
    TUNDRA:    { name: 'Tundra',    foodMod: 0.3, speedMod: 0.9, tint: [40, 50, 70], particleDensity: 0.3 }
};

class Food {
    constructor(x, y, isMeat = false, energy = 15) {
        this.x = x;
        this.y = y;
        this.isMeat = isMeat;
        this.energy = energy;
        this.decay = isMeat ? 300 : Infinity;
        this.age = 0;

        // Visual properties
        if (!isMeat) {
            this.tendrilCount = 2 + Math.floor(Math.random() * 2);
            this.tendrilAngles = [];
            this.tendrilLengths = [];
            for (let i = 0; i < this.tendrilCount; i++) {
                this.tendrilAngles.push(Math.random() * Math.PI * 2);
                this.tendrilLengths.push(4 + Math.random() * 5);
            }
        } else {
            this.blobVertices = 5;
            this.blobOffsets = [];
            for (let i = 0; i < this.blobVertices; i++) {
                this.blobOffsets.push(0.6 + Math.random() * 0.8);
            }
        }
    }

    update() {
        this.age++;
        return this.age < this.decay;
    }

    draw(ctx, tick = 0) {
        if (this.isMeat) {
            this.drawMeat(ctx, tick);
        } else {
            this.drawPlant(ctx, tick);
        }
    }

    drawPlant(ctx, tick) {
        const coreRadius = 2.5;

        // Central dot with glow
        const gradient = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, coreRadius * 3);
        gradient.addColorStop(0, 'rgba(60, 180, 80, 0.7)');
        gradient.addColorStop(0.5, 'rgba(40, 140, 60, 0.2)');
        gradient.addColorStop(1, 'rgba(30, 100, 40, 0)');
        ctx.beginPath();
        ctx.arc(this.x, this.y, coreRadius * 3, 0, Math.PI * 2);
        ctx.fillStyle = gradient;
        ctx.fill();

        // Solid core
        ctx.beginPath();
        ctx.arc(this.x, this.y, coreRadius, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(70, 190, 90, 0.85)';
        ctx.fill();

        // Tendrils
        ctx.strokeStyle = 'rgba(50, 150, 65, 0.6)';
        ctx.lineWidth = 0.8;
        for (let i = 0; i < this.tendrilCount; i++) {
            const baseAngle = this.tendrilAngles[i];
            const length = this.tendrilLengths[i];
            const wave = Math.sin(tick * 0.025 + i * 2.2 + this.x * 0.05) * 0.4;
            const angle = baseAngle + wave;

            const sx = this.x + Math.cos(baseAngle) * coreRadius;
            const sy = this.y + Math.sin(baseAngle) * coreRadius;
            const ex = this.x + Math.cos(angle) * (coreRadius + length);
            const ey = this.y + Math.sin(angle) * (coreRadius + length);
            const cpx = (sx + ex) / 2 + Math.cos(angle + Math.PI / 2) * 3;
            const cpy = (sy + ey) / 2 + Math.sin(angle + Math.PI / 2) * 3;

            ctx.beginPath();
            ctx.moveTo(sx, sy);
            ctx.quadraticCurveTo(cpx, cpy, ex, ey);
            ctx.stroke();
        }
    }

    drawMeat(ctx, tick) {
        const alpha = Math.max(0.3, 1 - this.age / this.decay);
        const radius = 3.5;

        // Glow
        const gradient = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, radius * 2.5);
        gradient.addColorStop(0, `rgba(160, 70, 40, ${alpha * 0.3})`);
        gradient.addColorStop(1, `rgba(120, 50, 30, 0)`);
        ctx.beginPath();
        ctx.arc(this.x, this.y, radius * 2.5, 0, Math.PI * 2);
        ctx.fillStyle = gradient;
        ctx.fill();

        // Blobby shape
        ctx.beginPath();
        for (let i = 0; i < this.blobVertices; i++) {
            const angle = (i / this.blobVertices) * Math.PI * 2;
            const r = radius * this.blobOffsets[i];
            const vx = this.x + Math.cos(angle) * r;
            const vy = this.y + Math.sin(angle) * r;
            if (i === 0) ctx.moveTo(vx, vy);
            else ctx.lineTo(vx, vy);
        }
        ctx.closePath();
        ctx.fillStyle = `rgba(150, 75, 45, ${alpha})`;
        ctx.fill();
    }
}

export class World {
    constructor(width, height) {
        this.width = width;
        this.height = height;
        this.food = [];
        this.gridSize = 100;
        this.grid = new Map();
        this.baseSpawnRate = 2;

        // Caustic light blobs
        this.caustics = [];
        for (let i = 0; i < 5; i++) {
            this.caustics.push({
                phaseX: Math.random() * Math.PI * 2,
                phaseY: Math.random() * Math.PI * 2,
                speedX: 0.002 + Math.random() * 0.003,
                speedY: 0.002 + Math.random() * 0.003,
                amplitudeX: 0.15 + Math.random() * 0.2,
                amplitudeY: 0.15 + Math.random() * 0.2,
                radius: 0.15 + Math.random() * 0.15
            });
        }

        // Parallax background layers
        this.bgLayers = [];
        this.bgLayersLoaded = false;
        this.mouseX = 0.5;
        this.mouseY = 0.5;
        const layerConfigs = [
            { src: 'assets/layer1_deep.png', speed: 0.02, parallax: 0.01, alpha: 0.9 },
            { src: 'assets/layer2_mid.png',  speed: 0.05, parallax: 0.025, alpha: 0.6 },
            { src: 'assets/layer3_near.png', speed: 0.08, parallax: 0.04, alpha: 0.4 }
        ];
        let loaded = 0;
        for (const cfg of layerConfigs) {
            const img = new Image();
            img.onload = () => {
                loaded++;
                if (loaded === layerConfigs.length) this.bgLayersLoaded = true;
            };
            img.src = cfg.src;
            this.bgLayers.push({ img, ...cfg, offsetX: 0, offsetY: 0 });
        }

        // Track mouse for parallax
        document.addEventListener('mousemove', (e) => {
            this.mouseX = e.clientX / window.innerWidth;
            this.mouseY = e.clientY / window.innerHeight;
        });
    }

    resize(width, height) {
        this.width = width;
        this.height = height;
    }

    getBiomeAt(x, y) {
        const midX = this.width / 2;
        const midY = this.height / 2;
        const blend = 50;

        const inLeft = x < midX;
        const inTop = y < midY;

        let biome;
        if (inLeft && inTop) biome = BIOMES.GRASSLAND;
        else if (!inLeft && inTop) biome = BIOMES.DESERT;
        else if (inLeft && !inTop) biome = BIOMES.SWAMP;
        else biome = BIOMES.TUNDRA;

        const distToMidX = Math.abs(x - midX);
        const distToMidY = Math.abs(y - midY);

        if (distToMidX < blend || distToMidY < blend) {
            const blendFactor = Math.min(distToMidX, distToMidY) / blend;
            return {
                ...biome,
                foodMod: lerp(1, biome.foodMod, blendFactor),
                speedMod: lerp(1, biome.speedMod, blendFactor)
            };
        }

        return biome;
    }

    spawnFood(count = 1) {
        for (let i = 0; i < count; i++) {
            let x, y;
            if (this.food.length > 0 && Math.random() < 0.8) {
                const parent = this.food[Math.floor(Math.random() * this.food.length)];
                const angle = Math.random() * Math.PI * 2;
                const d = randRange(10, 50);
                x = parent.x + Math.cos(angle) * d;
                y = parent.y + Math.sin(angle) * d;
            } else {
                x = randRange(10, this.width - 10);
                y = randRange(10, this.height - 10);
            }

            x = Math.max(5, Math.min(this.width - 5, x));
            y = Math.max(5, Math.min(this.height - 5, y));

            const biome = this.getBiomeAt(x, y);
            if (Math.random() < biome.foodMod) {
                this.food.push(new Food(x, y));
            }
        }
    }

    spawnMeat(x, y, energy) {
        this.food.push(new Food(x, y, true, energy));
    }

    update(speed) {
        this.food = this.food.filter(f => f.update());

        const spawnChance = this.baseSpawnRate * speed / 60;
        if (Math.random() < spawnChance) {
            this.spawnFood();
        }

        this.rebuildGrid();
    }

    rebuildGrid() {
        this.grid.clear();
        for (const f of this.food) {
            const key = this.getGridKey(f.x, f.y);
            if (!this.grid.has(key)) this.grid.set(key, []);
            this.grid.get(key).push(f);
        }
    }

    getGridKey(x, y) {
        const gx = Math.floor(x / this.gridSize);
        const gy = Math.floor(y / this.gridSize);
        return `${gx},${gy}`;
    }

    getFoodInRange(x, y, range) {
        const results = [];
        const gx = Math.floor(x / this.gridSize);
        const gy = Math.floor(y / this.gridSize);
        const cellRange = Math.ceil(range / this.gridSize);

        for (let dx = -cellRange; dx <= cellRange; dx++) {
            for (let dy = -cellRange; dy <= cellRange; dy++) {
                const key = `${gx + dx},${gy + dy}`;
                const cell = this.grid.get(key);
                if (cell) {
                    for (const f of cell) {
                        if (dist(x, y, f.x, f.y) < range) {
                            results.push(f);
                        }
                    }
                }
            }
        }
        return results;
    }

    removeFood(food) {
        const idx = this.food.indexOf(food);
        if (idx !== -1) this.food.splice(idx, 1);
    }

    // === BACKGROUND RENDERING (on bg canvas, every ~3 frames) ===
    drawBackground(ctx, tick) {
        const w = this.width;
        const h = this.height;

        // Deep underwater base gradient (always drawn as fallback)
        const bgGrad = ctx.createRadialGradient(w * 0.5, h * 0.5, 0, w * 0.5, h * 0.5, Math.max(w, h) * 0.6);
        bgGrad.addColorStop(0, '#081428');
        bgGrad.addColorStop(0.6, '#0a1a30');
        bgGrad.addColorStop(1, '#0c2040');
        ctx.fillStyle = bgGrad;
        ctx.fillRect(0, 0, w, h);

        // Parallax image layers
        if (this.bgLayersLoaded) {
            const mx = (this.mouseX - 0.5) * 2; // -1 to 1
            const my = (this.mouseY - 0.5) * 2;

            for (const layer of this.bgLayers) {
                // Autonomous slow drift + mouse parallax
                layer.offsetX = Math.sin(tick * layer.speed * 0.01) * 15 + mx * layer.parallax * w;
                layer.offsetY = Math.cos(tick * layer.speed * 0.008) * 10 + my * layer.parallax * h;

                const prevAlpha = ctx.globalAlpha;
                ctx.globalAlpha = layer.alpha;

                // Draw image scaled to cover canvas, with parallax offset
                const scale = Math.max(w / layer.img.width, h / layer.img.height) * 1.1;
                const iw = layer.img.width * scale;
                const ih = layer.img.height * scale;
                const ix = (w - iw) / 2 + layer.offsetX;
                const iy = (h - ih) / 2 + layer.offsetY;
                ctx.drawImage(layer.img, ix, iy, iw, ih);

                ctx.globalAlpha = prevAlpha;
            }
        }

        // Biome tints (soft radial gradients on top of images)
        const midX = w / 2;
        const midY = h / 2;
        const biomeSpots = [
            { x: midX * 0.5, y: midY * 0.5, tint: BIOMES.GRASSLAND.tint, size: Math.max(w, h) * 0.4 },
            { x: midX * 1.5, y: midY * 0.5, tint: BIOMES.DESERT.tint, size: Math.max(w, h) * 0.4 },
            { x: midX * 0.5, y: midY * 1.5, tint: BIOMES.SWAMP.tint, size: Math.max(w, h) * 0.4 },
            { x: midX * 1.5, y: midY * 1.5, tint: BIOMES.TUNDRA.tint, size: Math.max(w, h) * 0.4 }
        ];

        for (const spot of biomeSpots) {
            const grad = ctx.createRadialGradient(spot.x, spot.y, 0, spot.x, spot.y, spot.size);
            grad.addColorStop(0, `rgba(${spot.tint[0]}, ${spot.tint[1]}, ${spot.tint[2]}, 0.06)`);
            grad.addColorStop(0.7, `rgba(${spot.tint[0]}, ${spot.tint[1]}, ${spot.tint[2]}, 0.02)`);
            grad.addColorStop(1, `rgba(${spot.tint[0]}, ${spot.tint[1]}, ${spot.tint[2]}, 0)`);
            ctx.beginPath();
            ctx.arc(spot.x, spot.y, spot.size, 0, Math.PI * 2);
            ctx.fillStyle = grad;
            ctx.fill();
        }

        // Caustic light effect (on top of everything)
        const prevComp = ctx.globalCompositeOperation;
        ctx.globalCompositeOperation = 'lighter';
        for (const c of this.caustics) {
            const cx = w * (0.5 + Math.sin(tick * c.speedX + c.phaseX) * c.amplitudeX);
            const cy = h * (0.5 + Math.sin(tick * c.speedY + c.phaseY) * c.amplitudeY);
            const radius = Math.min(w, h) * c.radius;

            const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
            grad.addColorStop(0, 'rgba(80, 160, 200, 0.03)');
            grad.addColorStop(0.5, 'rgba(60, 130, 180, 0.012)');
            grad.addColorStop(1, 'rgba(40, 100, 160, 0)');
            ctx.beginPath();
            ctx.arc(cx, cy, radius, 0, Math.PI * 2);
            ctx.fillStyle = grad;
            ctx.fill();
        }
        ctx.globalCompositeOperation = prevComp;
    }

    // === FOOD RENDERING (on main canvas, every frame) ===
    drawFood(ctx, tick) {
        for (const f of this.food) {
            f.draw(ctx, tick);
        }
    }

    // Legacy draw method for compatibility
    draw(ctx) {
        this.drawBackground(ctx, 0);
        this.drawFood(ctx, 0);
    }

    toJSON() {
        return {
            food: this.food.map(f => ({
                x: f.x, y: f.y, isMeat: f.isMeat, energy: f.energy, age: f.age, decay: f.decay
            }))
        };
    }

    loadFromJSON(data) {
        this.food = data.food.map(f => {
            const food = new Food(f.x, f.y, f.isMeat, f.energy);
            food.age = f.age;
            food.decay = f.decay;
            return food;
        });
    }
}
