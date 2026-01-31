import { clamp, randRange, dist, angleToward, hslToString } from './utils.js';
import { CreatureRenderer } from './creature-renderer.js';

const GENE_RANGES = {
    speed: [1, 5],
    perception: [50, 200],
    size: [4, 12],
    diet: [0, 2],
    efficiency: [0.5, 1.5]
};

const STATE = {
    WANDER: 0,
    SEEK_FOOD: 1,
    HUNT: 2,
    FLEE: 3
};

let nextId = 0;

export class Creature {
    constructor(x, y, genes = null, generation = 0, hue = null) {
        this.id = nextId++;
        this.x = x;
        this.y = y;
        this.generation = generation;

        if (genes) {
            this.genes = { ...genes };
        } else {
            this.genes = {
                speed: randRange(...GENE_RANGES.speed),
                perception: randRange(...GENE_RANGES.perception),
                size: randRange(...GENE_RANGES.size),
                diet: Math.floor(randRange(0, 3)),
                efficiency: randRange(...GENE_RANGES.efficiency)
            };
        }

        this.hue = hue ?? Math.random() * 360;
        this.maxEnergy = this.genes.size * 15;
        this.energy = this.maxEnergy * 0.7;
        this.age = 0;
        this.reproductionCooldown = 0;
        this.state = STATE.WANDER;
        this.target = null;
        this.angle = Math.random() * Math.PI * 2;
        this.fleeCooldown = 0;
        this.dead = false;
        this.deathTime = 0;

        // Velocity for momentum-based movement
        this.vx = Math.cos(this.angle) * 0.3;
        this.vy = Math.sin(this.angle) * 0.3;
    }

    get isHerbivore() { return this.genes.diet === 0; }
    get isOmnivore() { return this.genes.diet === 1; }
    get isCarnivore() { return this.genes.diet === 2; }
    get isHungry() { return this.energy < this.maxEnergy * 0.5; }
    get canReproduce() {
        return this.energy > this.maxEnergy * 0.7 &&
               this.age > 200 &&
               this.reproductionCooldown <= 0;
    }

    getMoveEnergyCost() {
        return 0.02 * this.genes.speed * (this.genes.size / 8);
    }

    getIdleEnergyCost() {
        return 0.01 * (this.genes.size / 8);
    }

    getColor() {
        const dietTint = this.genes.diet === 0 ? 120 : this.genes.diet === 2 ? 0 : 60;
        const h = (this.hue + dietTint * 0.2) % 360;
        const s = 65;
        const l = 45 + (this.energy / this.maxEnergy) * 15;
        return hslToString(h, s, l);
    }

    getBorderColor() {
        if (this.genes.diet === 0) return '#4a4';
        if (this.genes.diet === 2) return '#a44';
        return '#aa4';
    }

    update(world, creatures, speedMod) {
        if (this.dead) return null;

        this.age++;
        this.reproductionCooldown = Math.max(0, this.reproductionCooldown - 1);
        this.fleeCooldown = Math.max(0, this.fleeCooldown - 1);

        this.updateState(world, creatures);
        this.move(world, speedMod);
        this.consumeEnergy();

        if (this.energy <= 0) {
            this.die();
            return null;
        }

        if (this.canReproduce) {
            return this.reproduce();
        }

        return null;
    }

    updateState(world, creatures) {
        if (this.fleeCooldown > 0) {
            this.state = STATE.FLEE;
            return;
        }

        const nearbyFood = world.getFoodInRange(this.x, this.y, this.genes.perception);
        const validFood = nearbyFood.filter(f => this.canEat(f));

        const nearbyCreatures = creatures.filter(c =>
            c !== this && !c.dead &&
            dist(this.x, this.y, c.x, c.y) < this.genes.perception
        );

        const predators = nearbyCreatures.filter(c => this.isPredatorOf(c, this));
        if (predators.length > 0) {
            this.state = STATE.FLEE;
            this.target = predators.reduce((closest, p) =>
                dist(this.x, this.y, p.x, p.y) < dist(this.x, this.y, closest.x, closest.y) ? p : closest
            );
            return;
        }

        if ((this.isCarnivore || this.isOmnivore) && this.isHungry) {
            const prey = nearbyCreatures.filter(c => this.canAttack(c));
            if (prey.length > 0) {
                this.state = STATE.HUNT;
                this.target = prey.reduce((closest, p) =>
                    dist(this.x, this.y, p.x, p.y) < dist(this.x, this.y, closest.x, closest.y) ? p : closest
                );
                return;
            }
        }

        if (this.isHungry && validFood.length > 0) {
            this.state = STATE.SEEK_FOOD;
            this.target = validFood.reduce((closest, f) =>
                dist(this.x, this.y, f.x, f.y) < dist(this.x, this.y, closest.x, closest.y) ? f : closest
            );
            return;
        }

        this.state = STATE.WANDER;
        this.target = null;
    }

    canEat(food) {
        if (food.isMeat) {
            return this.genes.diet > 0;
        }
        return this.genes.diet < 2;
    }

    canAttack(other) {
        if (this.genes.diet === 0) return false;
        return this.genes.size > other.genes.size * 0.8;
    }

    isPredatorOf(a, b) {
        return a.genes.diet > 0 && a.genes.size > b.genes.size * 0.8;
    }

    move(world, speedMod) {
        const biome = world.getBiomeAt(this.x, this.y);
        const targetSpeed = this.genes.speed * speedMod * biome.speedMod;
        const drag = 0.92;
        const turnRate = 0.12;

        // Calculate desired direction
        let desiredAngle = this.angle;
        switch (this.state) {
            case STATE.WANDER:
                if (Math.random() < 0.02) {
                    desiredAngle = this.angle + (Math.random() - 0.5) * 1;
                }
                break;
            case STATE.SEEK_FOOD:
            case STATE.HUNT:
                if (this.target) {
                    desiredAngle = angleToward(this.x, this.y, this.target.x, this.target.y);
                }
                break;
            case STATE.FLEE:
                if (this.target) {
                    desiredAngle = angleToward(this.target.x, this.target.y, this.x, this.y);
                }
                break;
        }

        // Smooth angle interpolation
        let angleDiff = desiredAngle - this.angle;
        while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
        while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
        this.angle += angleDiff * turnRate;

        // Apply thrust
        const thrust = targetSpeed * 0.15;
        this.vx += Math.cos(this.angle) * thrust;
        this.vy += Math.sin(this.angle) * thrust;

        // Apply drag (water resistance)
        this.vx *= drag;
        this.vy *= drag;

        // Clamp max speed
        const currentSpeed = Math.hypot(this.vx, this.vy);
        if (currentSpeed > targetSpeed) {
            this.vx *= targetSpeed / currentSpeed;
            this.vy *= targetSpeed / currentSpeed;
        }

        // Update position
        this.x += this.vx;
        this.y += this.vy;

        // Soft boundary bouncing
        const s = this.genes.size;
        if (this.x < s) { this.x = s; this.vx = Math.abs(this.vx) * 0.5; }
        if (this.x > world.width - s) { this.x = world.width - s; this.vx = -Math.abs(this.vx) * 0.5; }
        if (this.y < s) { this.y = s; this.vy = Math.abs(this.vy) * 0.5; }
        if (this.y > world.height - s) { this.y = world.height - s; this.vy = -Math.abs(this.vy) * 0.5; }

        // Update facing to match velocity
        if (currentSpeed > 0.1) {
            this.angle = Math.atan2(this.vy, this.vx);
        }
    }

    consumeEnergy() {
        const cost = this.state === STATE.WANDER ? this.getIdleEnergyCost() : this.getMoveEnergyCost();
        this.energy -= cost;
    }

    eat(food) {
        const gained = food.energy * this.genes.efficiency;
        if (food.isMeat && this.isHerbivore) return false;
        if (!food.isMeat && this.isCarnivore) {
            this.energy += gained * 0.5;
        } else {
            this.energy += gained;
        }
        this.energy = Math.min(this.energy, this.maxEnergy);
        return true;
    }

    tryAttack(other) {
        if (!this.canAttack(other)) return false;

        const sizeDiff = this.genes.size - other.genes.size;
        const killChance = 0.3 + sizeDiff * 0.1 + this.genes.speed * 0.05;

        if (Math.random() < killChance) {
            this.energy += other.energy * 0.5;
            this.energy = Math.min(this.energy, this.maxEnergy);
            other.die();
            return true;
        } else {
            this.fleeCooldown = 50;
            other.fleeCooldown = 50;
            return false;
        }
    }

    reproduce() {
        const cost = this.maxEnergy * 0.4;
        this.energy -= cost;
        this.reproductionCooldown = 150;

        const childGenes = {};
        for (const [gene, [min, max]] of Object.entries(GENE_RANGES)) {
            let val = this.genes[gene];
            if (Math.random() < 0.15) {
                const mutation = val * (Math.random() * 0.2 - 0.1);
                val = clamp(val + mutation, min, max);
            }
            childGenes[gene] = gene === 'diet' ? Math.round(val) : val;
        }

        let childHue = this.hue;
        if (Math.random() < 0.15) {
            childHue = (childHue + (Math.random() * 10 - 5) + 360) % 360;
        }

        const offsetAngle = Math.random() * Math.PI * 2;
        const offsetDist = this.genes.size * 2;
        const childX = this.x + Math.cos(offsetAngle) * offsetDist;
        const childY = this.y + Math.sin(offsetAngle) * offsetDist;

        return new Creature(childX, childY, childGenes, this.generation + 1, childHue);
    }

    die() {
        this.dead = true;
        this.deathTime = Date.now();
    }

    draw(ctx, selected = false, tick = 0) {
        CreatureRenderer.draw(ctx, this, selected, tick);
    }

    toJSON() {
        return {
            x: this.x, y: this.y, genes: this.genes, generation: this.generation,
            hue: this.hue, energy: this.energy, age: this.age,
            reproductionCooldown: this.reproductionCooldown,
            vx: this.vx, vy: this.vy, angle: this.angle
        };
    }

    static fromJSON(data) {
        const c = new Creature(data.x, data.y, data.genes, data.generation, data.hue);
        c.energy = data.energy;
        c.age = data.age;
        c.reproductionCooldown = data.reproductionCooldown;
        if (data.vx !== undefined) {
            c.vx = data.vx;
            c.vy = data.vy;
            c.angle = data.angle;
        }
        return c;
    }
}

export { STATE };
