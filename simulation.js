import { Creature } from './creature.js';
import { World } from './world.js';
import { UI } from './ui.js';
import { EffectsSystem } from './effects.js';
import { dist } from './utils.js';

class Simulation {
    constructor() {
        this.bgCanvas = document.getElementById('bg-layer');
        this.canvas = document.getElementById('world');
        this.bgCtx = this.bgCanvas.getContext('2d');
        this.ctx = this.canvas.getContext('2d');
        this.creatures = [];
        this.world = null;
        this.effects = null;
        this.ui = null;
        this.paused = false;
        this.speed = 1;
        this.tick = 0;
        this.lowPopTicks = 0;
        this.bgFrameCounter = 0;

        // FPS tracking
        this.fpsFrames = 0;
        this.fpsLastTime = performance.now();
        this.fps = 60;

        this.resize();
        window.addEventListener('resize', () => this.resize());

        this.world = new World(this.canvas.width, this.canvas.height);
        this.effects = new EffectsSystem(this.canvas.width, this.canvas.height);
        this.ui = new UI(this);

        this.restart();
        this.loop();
    }

    resize() {
        const container = document.getElementById('canvas-container');
        const rect = container.getBoundingClientRect();
        this.canvas.width = rect.width;
        this.canvas.height = rect.height;
        this.bgCanvas.width = rect.width;
        this.bgCanvas.height = rect.height;
        if (this.world) {
            this.world.resize(rect.width, rect.height);
        }
        if (this.effects) {
            this.effects.resize(rect.width, rect.height);
        }
        // Force bg redraw on resize
        this.bgFrameCounter = 0;
    }

    restart() {
        this.creatures = [];
        this.tick = 0;
        this.lowPopTicks = 0;
        this.world = new World(this.canvas.width, this.canvas.height);
        this.effects = new EffectsSystem(this.canvas.width, this.canvas.height);

        for (let i = 0; i < 30; i++) {
            const x = Math.random() * this.canvas.width;
            const y = Math.random() * this.canvas.height;
            this.creatures.push(new Creature(x, y));
        }

        for (let i = 0; i < 100; i++) {
            this.world.spawnFood();
        }

        // Force bg redraw
        this.bgFrameCounter = 0;
    }

    update() {
        if (this.paused) return;

        for (let s = 0; s < this.speed; s++) {
            this.tick++;
            this.world.update(1);
            this.updateCreatures();
            this.checkCollisions();
            this.populationSafeguards();
        }

        this.effects.update(this.tick);
        this.ui.update();
    }

    updateCreatures() {
        const newCreatures = [];

        for (const creature of this.creatures) {
            if (creature.dead) continue;

            const offspring = creature.update(this.world, this.creatures, 1);
            if (offspring) {
                if (this.creatures.filter(c => !c.dead).length < 500) {
                    newCreatures.push(offspring);
                }
            }
        }

        this.creatures.push(...newCreatures);
        this.creatures = this.creatures.filter(c => {
            if (c.dead && Date.now() - c.deathTime > 2500) {
                return false;
            }
            return true;
        });
    }

    checkCollisions() {
        for (const creature of this.creatures) {
            if (creature.dead) continue;

            const nearbyFood = this.world.getFoodInRange(creature.x, creature.y, creature.genes.size + 5);
            for (const food of nearbyFood) {
                const d = dist(creature.x, creature.y, food.x, food.y);
                if (d < creature.genes.size + 3) {
                    if (creature.eat(food)) {
                        this.world.removeFood(food);
                        this.effects.spawnEatRipple(food.x, food.y);
                    }
                }
            }

            if (creature.genes.diet > 0 && creature.state === 2) {
                for (const other of this.creatures) {
                    if (other === creature || other.dead) continue;
                    const d = dist(creature.x, creature.y, other.x, other.y);
                    if (d < creature.genes.size + other.genes.size) {
                        if (creature.tryAttack(other)) {
                            this.world.spawnMeat(other.x, other.y, other.maxEnergy * 0.4);
                            this.effects.spawnDeathBurst(other.x, other.y, other.hue, other.genes.size);
                        }
                    }
                }
            }
        }
    }

    populationSafeguards() {
        const alive = this.creatures.filter(c => !c.dead);
        const herbs = alive.filter(c => c.isHerbivore);

        if (alive.length < 5) {
            this.lowPopTicks++;
            if (this.lowPopTicks > 200) {
                for (let i = 0; i < 10; i++) {
                    this.creatures.push(new Creature(
                        Math.random() * this.canvas.width,
                        Math.random() * this.canvas.height
                    ));
                }
                this.lowPopTicks = 0;
            }
        } else {
            this.lowPopTicks = 0;
        }

        if (herbs.length === 0 && alive.length > 0) {
            for (let i = 0; i < 5; i++) {
                const genes = {
                    speed: 2, perception: 100, size: 6, diet: 0, efficiency: 1
                };
                this.creatures.push(new Creature(
                    Math.random() * this.canvas.width,
                    Math.random() * this.canvas.height,
                    genes
                ));
            }
        }
    }

    draw() {
        // Background layer (every 3 frames — caustics, biome tints, distant organisms)
        this.bgFrameCounter++;
        if (this.bgFrameCounter % 3 === 0) {
            this.world.drawBackground(this.bgCtx, this.tick);
            this.effects.drawBackground(this.bgCtx, this.tick);
        }

        // Main layer — clear to transparent so bg shows through
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        // Bubbles behind creatures
        this.effects.drawBehindCreatures(this.ctx, this.tick);

        // Food
        this.world.drawFood(this.ctx, this.tick);

        // Creatures
        const selected = this.ui.getSelectedCreature();
        for (const creature of this.creatures) {
            creature.draw(this.ctx, creature === selected, this.tick);
        }

        // Death bursts, ripples on top
        this.effects.drawAboveCreatures(this.ctx);

        // FPS counter
        this.fpsFrames++;
        const now = performance.now();
        if (now - this.fpsLastTime > 1000) {
            this.fps = this.fpsFrames;
            this.fpsFrames = 0;
            this.fpsLastTime = now;
        }
    }

    loop() {
        this.update();
        this.draw();
        requestAnimationFrame(() => this.loop());
    }

    save() {
        const data = {
            version: 4,
            tick: this.tick,
            creatures: this.creatures.filter(c => !c.dead).map(c => c.toJSON()),
            world: this.world.toJSON(),
            settings: { speed: this.speed }
        };
        localStorage.setItem('ecosim_save', JSON.stringify(data));
        console.log('Saved', data.creatures.length, 'creatures');
    }

    load() {
        const raw = localStorage.getItem('ecosim_save');
        if (!raw) {
            console.log('No save found');
            return;
        }

        try {
            const data = JSON.parse(raw);
            if (data.version !== 3 && data.version !== 4) {
                console.log('Incompatible save version');
                return;
            }

            this.tick = data.tick;
            this.creatures = data.creatures.map(c => Creature.fromJSON(c));
            this.world.loadFromJSON(data.world);
            this.speed = data.settings.speed;
            document.getElementById('speed').value = this.speed;
            document.getElementById('speed-val').textContent = this.speed.toFixed(1) + 'x';
            console.log('Loaded', this.creatures.length, 'creatures');
        } catch (e) {
            console.error('Failed to load save:', e);
        }
    }
}

new Simulation();
