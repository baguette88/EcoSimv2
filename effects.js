// effects.js
// Particle effects, ambient bubbles, death bursts, eat ripples

export class EffectsSystem {
    constructor(width, height) {
        this.width = width;
        this.height = height;
        this.deathBursts = [];
        this.ripples = [];
        this.bubbles = [];
        this.plankton = [];
        this.distantOrganisms = [];

        this.initPlankton(70);
        this.initBubbles(15);
        this.initDistantOrganisms(4);
    }

    resize(width, height) {
        this.width = width;
        this.height = height;
    }

    // === PLANKTON (background particles) ===
    initPlankton(count) {
        for (let i = 0; i < count; i++) {
            this.plankton.push({
                x: Math.random() * this.width,
                y: Math.random() * this.height,
                vx: (Math.random() - 0.5) * 0.15,
                vy: (Math.random() - 0.5) * 0.15,
                size: 0.5 + Math.random() * 1.5,
                alpha: 0.08 + Math.random() * 0.18,
                phase: Math.random() * Math.PI * 2
            });
        }
    }

    // === BUBBLES ===
    initBubbles(count) {
        for (let i = 0; i < count; i++) {
            this.bubbles.push(this.createBubble());
        }
    }

    createBubble() {
        return {
            x: Math.random() * this.width,
            y: this.height + Math.random() * 50,
            vx: (Math.random() - 0.5) * 0.3,
            vy: -(0.2 + Math.random() * 0.4),
            size: 1.5 + Math.random() * 3,
            alpha: 0.1 + Math.random() * 0.15,
            wobblePhase: Math.random() * Math.PI * 2
        };
    }

    // === DISTANT ORGANISMS (far background) ===
    initDistantOrganisms(count) {
        for (let i = 0; i < count; i++) {
            this.distantOrganisms.push({
                x: Math.random() * this.width,
                y: Math.random() * this.height,
                vx: (Math.random() - 0.5) * 0.05,
                vy: (Math.random() - 0.5) * 0.05,
                size: 25 + Math.random() * 50,
                hue: Math.random() * 360,
                alpha: 0.03 + Math.random() * 0.04,
                pulsePhase: Math.random() * Math.PI * 2
            });
        }
    }

    // === DEATH BURST ===
    spawnDeathBurst(x, y, hue, size) {
        const count = 8 + Math.floor(size);
        for (let i = 0; i < count; i++) {
            const angle = (i / count) * Math.PI * 2 + Math.random() * 0.5;
            const speed = 0.5 + Math.random() * 2;
            this.deathBursts.push({
                x, y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                life: 40 + Math.floor(Math.random() * 30),
                maxLife: 40 + Math.floor(Math.random() * 30),
                hue,
                size: 1 + Math.random() * 2
            });
        }
        // Cap total burst particles
        if (this.deathBursts.length > 200) {
            this.deathBursts.splice(0, this.deathBursts.length - 200);
        }
    }

    // === EAT RIPPLE ===
    spawnEatRipple(x, y) {
        this.ripples.push({
            x, y,
            radius: 0,
            maxRadius: 18,
            alpha: 0.5,
            life: 20
        });
    }

    // === UPDATE ALL ===
    update(tick) {
        // Plankton drift
        for (const p of this.plankton) {
            p.x += p.vx;
            p.y += p.vy;
            // Gentle current drift
            p.x += Math.sin(tick * 0.003 + p.phase) * 0.02;
            if (p.x < 0) p.x = this.width;
            if (p.x > this.width) p.x = 0;
            if (p.y < 0) p.y = this.height;
            if (p.y > this.height) p.y = 0;
        }

        // Bubbles float up
        for (let i = this.bubbles.length - 1; i >= 0; i--) {
            const b = this.bubbles[i];
            b.x += b.vx + Math.sin(tick * 0.05 + b.wobblePhase) * 0.15;
            b.y += b.vy;
            if (b.y < -10) {
                this.bubbles[i] = this.createBubble();
            }
        }

        // Distant organisms drift
        for (const d of this.distantOrganisms) {
            d.x += d.vx;
            d.y += d.vy;
            if (d.x < -d.size) d.x = this.width + d.size;
            if (d.x > this.width + d.size) d.x = -d.size;
            if (d.y < -d.size) d.y = this.height + d.size;
            if (d.y > this.height + d.size) d.y = -d.size;
        }

        // Death burst particles
        for (let i = this.deathBursts.length - 1; i >= 0; i--) {
            const p = this.deathBursts[i];
            p.x += p.vx;
            p.y += p.vy;
            p.vx *= 0.96;
            p.vy *= 0.96;
            p.life--;
            if (p.life <= 0) {
                this.deathBursts.splice(i, 1);
            }
        }

        // Ripples expand
        for (let i = this.ripples.length - 1; i >= 0; i--) {
            const r = this.ripples[i];
            r.radius += r.maxRadius / 20;
            r.alpha -= 0.5 / 20;
            r.life--;
            if (r.life <= 0) {
                this.ripples.splice(i, 1);
            }
        }
    }

    // === DRAW BACKGROUND LAYER (on bg canvas) ===
    drawBackground(ctx, tick) {
        // Distant organisms
        for (const d of this.distantOrganisms) {
            const pulse = 1 + Math.sin(tick * 0.01 + d.pulsePhase) * 0.15;
            const size = d.size * pulse;
            const gradient = ctx.createRadialGradient(d.x, d.y, 0, d.x, d.y, size);
            gradient.addColorStop(0, `hsla(${d.hue}, 30%, 40%, ${d.alpha * 1.5})`);
            gradient.addColorStop(1, `hsla(${d.hue}, 30%, 40%, 0)`);
            ctx.beginPath();
            ctx.arc(d.x, d.y, size, 0, Math.PI * 2);
            ctx.fillStyle = gradient;
            ctx.fill();
        }

        // Plankton
        for (const p of this.plankton) {
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(150, 200, 220, ${p.alpha})`;
            ctx.fill();
        }
    }

    // === DRAW MAIN LAYER (on main canvas, behind creatures) ===
    drawBehindCreatures(ctx, tick) {
        // Bubbles
        for (const b of this.bubbles) {
            ctx.beginPath();
            ctx.arc(b.x, b.y, b.size, 0, Math.PI * 2);
            ctx.strokeStyle = `rgba(140, 200, 230, ${b.alpha})`;
            ctx.lineWidth = 0.6;
            ctx.stroke();
            // Tiny highlight
            ctx.beginPath();
            ctx.arc(b.x - b.size * 0.25, b.y - b.size * 0.25, b.size * 0.25, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(200, 230, 255, ${b.alpha * 0.8})`;
            ctx.fill();
        }
    }

    // === DRAW MAIN LAYER (on main canvas, above creatures) ===
    drawAboveCreatures(ctx) {
        // Death burst particles
        for (const p of this.deathBursts) {
            const t = p.life / p.maxLife;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size * t, 0, Math.PI * 2);
            ctx.fillStyle = `hsla(${p.hue}, 50%, 60%, ${t * 0.7})`;
            ctx.fill();
        }

        // Eat ripples
        for (const r of this.ripples) {
            ctx.beginPath();
            ctx.arc(r.x, r.y, r.radius, 0, Math.PI * 2);
            ctx.strokeStyle = `rgba(100, 220, 150, ${Math.max(0, r.alpha)})`;
            ctx.lineWidth = 1;
            ctx.stroke();
        }
    }
}
