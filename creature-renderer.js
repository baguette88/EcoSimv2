// creature-renderer.js
// Spore Cell Stage creature rendering — wobbly membranes, internals, appendages, eyes, glow

const glowSprites = new Map();
let glowInitialized = false;

function initGlowSprites() {
    if (glowInitialized) return;
    const diets = [
        { key: 'herb', color: [80, 220, 120] },
        { key: 'carn', color: [220, 70, 70] },
        { key: 'omni', color: [220, 190, 70] }
    ];
    const size = 128;
    for (const d of diets) {
        const offscreen = document.createElement('canvas');
        offscreen.width = size;
        offscreen.height = size;
        const octx = offscreen.getContext('2d');
        const gradient = octx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
        gradient.addColorStop(0, `rgba(${d.color.join(',')}, 0.35)`);
        gradient.addColorStop(0.4, `rgba(${d.color.join(',')}, 0.12)`);
        gradient.addColorStop(1, `rgba(${d.color.join(',')}, 0)`);
        octx.fillStyle = gradient;
        octx.fillRect(0, 0, size, size);
        glowSprites.set(d.key, offscreen);
    }
    glowInitialized = true;
}

export class CreatureRenderer {

    static draw(ctx, creature, selected, tick) {
        initGlowSprites();

        if (creature.dead) {
            CreatureRenderer.drawGhost(ctx, creature, tick);
            return;
        }

        const energyRatio = creature.energy / creature.maxEnergy;

        // 1. Glow (behind everything)
        CreatureRenderer.drawGlow(ctx, creature, tick, energyRatio);

        // 2. Flagellum behind body (carnivores/omnivores)
        if (creature.isCarnivore || creature.isOmnivore) {
            CreatureRenderer.drawFlagellum(ctx, creature, tick);
        }

        // 3. Wobbly membrane body
        CreatureRenderer.drawMembrane(ctx, creature, tick, energyRatio);

        // 4. Internal structures
        CreatureRenderer.drawNucleus(ctx, creature, tick, energyRatio);
        CreatureRenderer.drawOrganelles(ctx, creature, tick);

        // 5. Cilia (herbivores/omnivores)
        if (creature.isHerbivore || creature.isOmnivore) {
            CreatureRenderer.drawCilia(ctx, creature, tick);
        }

        // 6. Spikes (carnivores/omnivores)
        if (creature.isCarnivore || creature.isOmnivore) {
            CreatureRenderer.drawSpikes(ctx, creature, tick);
        }

        // 7. Eyes
        CreatureRenderer.drawEyes(ctx, creature);

        // 8. State indicator
        CreatureRenderer.drawStateIndicator(ctx, creature, tick);

        // 9. Target line (when selected)
        if (selected) {
            CreatureRenderer.drawSelectionRing(ctx, creature, tick);
            if (creature.target && !creature.target.dead) {
                CreatureRenderer.drawTargetLine(ctx, creature);
            }
        }
    }

    static getMembraneVertices(creature, tick) {
        const numVertices = creature.genes.size < 6 ? 10 : creature.genes.size < 9 ? 12 : 14;
        const baseRadius = creature.genes.size;
        const vertices = [];

        for (let i = 0; i < numVertices; i++) {
            const vertexAngle = (i / numVertices) * Math.PI * 2;
            // Multiple sine waves for organic wobble
            const wobble1 = Math.sin(tick * 0.05 + i * 1.9 + creature.id * 0.7) * 0.12;
            const wobble2 = Math.sin(tick * 0.08 + i * 3.1 + creature.id * 1.3) * 0.06;
            const breathe = Math.sin(tick * 0.03 + creature.id * 0.5) * 0.04;
            const angularFactor = creature.isCarnivore ? 1.3 : 1.0;
            const r = baseRadius * (1 + (wobble1 + wobble2 + breathe) * angularFactor);

            vertices.push({
                x: creature.x + Math.cos(vertexAngle) * r,
                y: creature.y + Math.sin(vertexAngle) * r
            });
        }
        return vertices;
    }

    static drawMembranePath(ctx, vertices) {
        const n = vertices.length;
        // Smooth closed curve using midpoints + quadratic bezier
        ctx.beginPath();
        const first = vertices[0];
        const second = vertices[1];
        ctx.moveTo((first.x + second.x) / 2, (first.y + second.y) / 2);

        for (let i = 1; i < n; i++) {
            const curr = vertices[i];
            const next = vertices[(i + 1) % n];
            ctx.quadraticCurveTo(curr.x, curr.y, (curr.x + next.x) / 2, (curr.y + next.y) / 2);
        }
        // Close back to start
        ctx.quadraticCurveTo(first.x, first.y, (first.x + second.x) / 2, (first.y + second.y) / 2);
        ctx.closePath();
    }

    static drawMembrane(ctx, creature, tick, energyRatio) {
        const vertices = CreatureRenderer.getMembraneVertices(creature, tick);

        CreatureRenderer.drawMembranePath(ctx, vertices);

        // Semi-transparent fill
        const alpha = 0.25 + energyRatio * 0.35;
        const dietTint = creature.genes.diet === 0 ? 120 : creature.genes.diet === 2 ? 0 : 60;
        const h = (creature.hue + dietTint * 0.2) % 360;
        const l = 40 + energyRatio * 20;
        ctx.fillStyle = `hsla(${h}, 60%, ${l}%, ${alpha})`;
        ctx.fill();

        // Membrane edge — slightly brighter, more opaque
        ctx.strokeStyle = `hsla(${h}, 70%, ${l + 15}%, ${0.4 + energyRatio * 0.3})`;
        ctx.lineWidth = 1.5;
        ctx.stroke();
    }

    static drawNucleus(ctx, creature, tick, energyRatio) {
        const nucleusRadius = creature.genes.size * 0.32;
        const orbitRadius = creature.genes.size * 0.12;
        const orbitAngle = tick * 0.007 + creature.id * 2;
        const nx = creature.x + Math.cos(orbitAngle) * orbitRadius;
        const ny = creature.y + Math.sin(orbitAngle) * orbitRadius;

        ctx.beginPath();
        ctx.arc(nx, ny, nucleusRadius, 0, Math.PI * 2);

        const dietTint = creature.genes.diet === 0 ? 120 : creature.genes.diet === 2 ? 0 : 60;
        const h = (creature.hue + dietTint * 0.2) % 360;
        const brightness = 25 + energyRatio * 25;
        ctx.fillStyle = `hsla(${h}, 55%, ${brightness}%, 0.55)`;
        ctx.fill();
    }

    static drawOrganelles(ctx, creature, tick) {
        const count = creature.genes.size < 6 ? 2 : creature.genes.size < 9 ? 3 : 4;
        for (let i = 0; i < count; i++) {
            const phase = tick * 0.01 + i * (Math.PI * 2 / count) + creature.id * 1.1;
            const driftRadius = creature.genes.size * 0.45;
            const ox = creature.x + Math.cos(phase) * driftRadius * Math.sin(phase * 0.7 + i);
            const oy = creature.y + Math.sin(phase) * driftRadius * Math.cos(phase * 0.5 + i);

            ctx.beginPath();
            ctx.arc(ox, oy, 1.2 + creature.genes.size * 0.05, 0, Math.PI * 2);
            ctx.fillStyle = `hsla(${(creature.hue + i * 70) % 360}, 60%, 55%, 0.4)`;
            ctx.fill();
        }
    }

    static drawCilia(ctx, creature, tick) {
        const numCilia = creature.isOmnivore
            ? (creature.genes.size < 6 ? 8 : 12)
            : (creature.genes.size < 6 ? 16 : 22);
        const ciliaLength = creature.genes.size * 0.3;
        const dietTint = creature.genes.diet === 0 ? 120 : 60;
        const h = (creature.hue + dietTint * 0.2) % 360;

        ctx.strokeStyle = `hsla(${h}, 45%, 60%, 0.5)`;
        ctx.lineWidth = 0.7;

        for (let i = 0; i < numCilia; i++) {
            const baseAngle = (i / numCilia) * Math.PI * 2;
            const waveOffset = Math.sin(tick * 0.12 + i * 0.6 + creature.id) * 0.35;
            const angle = baseAngle + waveOffset;

            const innerR = creature.genes.size * 0.95;
            const outerR = creature.genes.size + ciliaLength;

            ctx.beginPath();
            ctx.moveTo(
                creature.x + Math.cos(baseAngle) * innerR,
                creature.y + Math.sin(baseAngle) * innerR
            );
            ctx.lineTo(
                creature.x + Math.cos(angle) * outerR,
                creature.y + Math.sin(angle) * outerR
            );
            ctx.stroke();
        }
    }

    static drawFlagellum(ctx, creature, tick) {
        const lengthMult = creature.isCarnivore ? 2.5 : 1.5;
        const tailLength = creature.genes.size * lengthMult;
        const segments = 10;
        const amplitude = creature.genes.size * 0.45;
        const tailAngle = creature.angle + Math.PI;

        // Speed-dependent wave frequency
        const speed = creature.vx !== undefined
            ? Math.hypot(creature.vx, creature.vy)
            : creature.genes.speed;
        const waveSpeed = 0.1 + speed * 0.06;

        const dietTint = creature.genes.diet === 2 ? 0 : 60;
        const h = (creature.hue + dietTint * 0.2) % 360;

        ctx.beginPath();
        ctx.strokeStyle = `hsla(${h}, 50%, 55%, 0.6)`;
        ctx.lineWidth = creature.isCarnivore ? 2 : 1.5;

        const startX = creature.x + Math.cos(tailAngle) * creature.genes.size * 0.8;
        const startY = creature.y + Math.sin(tailAngle) * creature.genes.size * 0.8;
        ctx.moveTo(startX, startY);

        for (let i = 1; i <= segments; i++) {
            const t = i / segments;
            const dist = tailLength * t;
            const wave = Math.sin(tick * waveSpeed + t * 5) * amplitude * t;
            const perpAngle = tailAngle + Math.PI / 2;
            const taper = 1 - t * 0.3; // slightly thinner at tip

            const px = startX + Math.cos(tailAngle) * dist + Math.cos(perpAngle) * wave * taper;
            const py = startY + Math.sin(tailAngle) * dist + Math.sin(perpAngle) * wave * taper;
            ctx.lineTo(px, py);
        }
        ctx.stroke();
    }

    static drawSpikes(ctx, creature, tick) {
        const numSpikes = creature.isCarnivore ? 5 : 2;
        const spikeLength = creature.genes.size * 0.5;
        const spreadAngle = creature.isCarnivore ? Math.PI * 0.5 : Math.PI * 0.25;

        const h = (creature.hue) % 360;
        ctx.fillStyle = `hsla(${h}, 50%, 45%, 0.65)`;

        for (let i = 0; i < numSpikes; i++) {
            const spikeAngle = creature.angle +
                (i - (numSpikes - 1) / 2) * (spreadAngle / Math.max(numSpikes - 1, 1));

            const baseR = creature.genes.size * 0.85;
            const tipR = creature.genes.size + spikeLength;
            // Slight pulse
            const pulse = 1 + Math.sin(tick * 0.08 + i * 1.2) * 0.05;
            const tipX = creature.x + Math.cos(spikeAngle) * tipR * pulse;
            const tipY = creature.y + Math.sin(spikeAngle) * tipR * pulse;

            const perpAngle = spikeAngle + Math.PI / 2;
            const halfWidth = 1.8;
            const bx1 = creature.x + Math.cos(spikeAngle) * baseR + Math.cos(perpAngle) * halfWidth;
            const by1 = creature.y + Math.sin(spikeAngle) * baseR + Math.sin(perpAngle) * halfWidth;
            const bx2 = creature.x + Math.cos(spikeAngle) * baseR - Math.cos(perpAngle) * halfWidth;
            const by2 = creature.y + Math.sin(spikeAngle) * baseR - Math.sin(perpAngle) * halfWidth;

            ctx.beginPath();
            ctx.moveTo(bx1, by1);
            ctx.lineTo(tipX, tipY);
            ctx.lineTo(bx2, by2);
            ctx.closePath();
            ctx.fill();
        }
    }

    static drawEyes(ctx, creature) {
        const eyeSize = Math.max(1.8, creature.genes.size * 0.2);
        const pupilSize = eyeSize * 0.55;
        const eyeForward = creature.genes.size * 0.3;

        const isCarnivore = creature.isCarnivore;
        const eyeCount = isCarnivore ? 1 : 2;
        const eyeSpacing = creature.genes.size * 0.3;

        for (let i = 0; i < eyeCount; i++) {
            let perpOffset = 0;
            if (eyeCount === 2) {
                perpOffset = (i === 0 ? -1 : 1) * eyeSpacing;
            }

            const perpAngle = creature.angle + Math.PI / 2;
            const ex = creature.x + Math.cos(creature.angle) * eyeForward + Math.cos(perpAngle) * perpOffset;
            const ey = creature.y + Math.sin(creature.angle) * eyeForward + Math.sin(perpAngle) * perpOffset;

            // Sclera (white of eye)
            ctx.beginPath();
            ctx.arc(ex, ey, eyeSize, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(220, 235, 255, 0.92)';
            ctx.fill();

            // Pupil (faces movement direction)
            const pupilOffset = eyeSize * 0.28;
            const px = ex + Math.cos(creature.angle) * pupilOffset;
            const py = ey + Math.sin(creature.angle) * pupilOffset;
            ctx.beginPath();
            ctx.arc(px, py, pupilSize, 0, Math.PI * 2);
            ctx.fillStyle = '#0a0a12';
            ctx.fill();

            // Tiny specular highlight
            ctx.beginPath();
            ctx.arc(ex + eyeSize * 0.15, ey - eyeSize * 0.15, eyeSize * 0.2, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
            ctx.fill();
        }
    }

    static drawGlow(ctx, creature, tick, energyRatio) {
        const key = creature.isHerbivore ? 'herb' : creature.isCarnivore ? 'carn' : 'omni';
        const sprite = glowSprites.get(key);
        if (!sprite) return;

        // Pulse: breathing + state intensity
        const stateBoost = (creature.state === 2 || creature.state === 3) ? 0.25 : 0;
        const pulse = 0.8 + Math.sin(tick * 0.035 + creature.id * 0.9) * 0.12 + stateBoost;
        const glowSize = creature.genes.size * 4.5 * pulse;

        const prevAlpha = ctx.globalAlpha;
        ctx.globalAlpha = (0.25 + energyRatio * 0.5) * pulse;
        ctx.drawImage(sprite,
            creature.x - glowSize / 2,
            creature.y - glowSize / 2,
            glowSize, glowSize
        );
        ctx.globalAlpha = prevAlpha;
    }

    static drawSelectionRing(ctx, creature, tick) {
        const ringRadius = creature.genes.size + 8;
        ctx.beginPath();
        ctx.arc(creature.x, creature.y, ringRadius, 0, Math.PI * 2);
        ctx.setLineDash([4, 4]);
        ctx.lineDashOffset = -tick * 0.4;
        ctx.strokeStyle = 'rgba(180, 210, 255, 0.7)';
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.setLineDash([]);
    }

    static drawStateIndicator(ctx, creature, tick) {
        // Only show for active states (not wander)
        if (creature.state === 0) return; // WANDER = no indicator

        const indicatorY = creature.y - creature.genes.size - 8;
        const indicatorX = creature.x;
        const pulse = 0.6 + Math.sin(tick * 0.15) * 0.4;

        if (creature.state === 1) {
            // SEEK_FOOD: small green dot above creature
            ctx.beginPath();
            ctx.arc(indicatorX, indicatorY, 2, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(80, 200, 100, ${0.5 * pulse})`;
            ctx.fill();
        } else if (creature.state === 2) {
            // HUNT: red crosshair/aggressive indicator
            const s = 3;
            ctx.strokeStyle = `rgba(220, 60, 60, ${0.7 * pulse})`;
            ctx.lineWidth = 1.2;
            ctx.beginPath();
            ctx.moveTo(indicatorX - s, indicatorY);
            ctx.lineTo(indicatorX + s, indicatorY);
            ctx.moveTo(indicatorX, indicatorY - s);
            ctx.lineTo(indicatorX, indicatorY + s);
            ctx.stroke();
        } else if (creature.state === 3) {
            // FLEE: rapid flashing exclamation
            const flashAlpha = Math.sin(tick * 0.3) > 0 ? 0.8 : 0.2;
            ctx.fillStyle = `rgba(255, 200, 50, ${flashAlpha})`;
            ctx.font = `bold ${Math.max(8, creature.genes.size * 0.8)}px sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('!', indicatorX, indicatorY);
        }
    }

    static drawTargetLine(ctx, creature) {
        const target = creature.target;
        ctx.beginPath();
        ctx.moveTo(creature.x, creature.y);
        ctx.lineTo(target.x, target.y);
        ctx.setLineDash([3, 6]);
        const isHostile = creature.state === 2;
        ctx.strokeStyle = isHostile
            ? 'rgba(220, 80, 80, 0.25)'
            : creature.state === 3
                ? 'rgba(255, 200, 50, 0.2)'
                : 'rgba(80, 200, 120, 0.2)';
        ctx.lineWidth = 0.8;
        ctx.stroke();
        ctx.setLineDash([]);
    }

    static drawGhost(ctx, creature, tick) {
        // Fading dead creature ghost
        const elapsed = Date.now() - creature.deathTime;
        const fadeDuration = 2000;
        if (elapsed > fadeDuration) return;

        const t = elapsed / fadeDuration;
        const alpha = (1 - t) * 0.4;
        const scale = 1 - t * 0.5;
        const size = creature.genes.size * scale;

        ctx.beginPath();
        ctx.arc(creature.x, creature.y, size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(80, 100, 120, ${alpha})`;
        ctx.fill();
    }
}
