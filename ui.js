export class UI {
    constructor(simulation) {
        this.sim = simulation;
        this.selectedCreature = null;
        this.statsEl = document.getElementById('stats');
        this.inspectorEl = document.getElementById('inspector');
        this.fpsEl = document.getElementById('fps-display');
        this.populationHistory = [];
        this.maxHistory = 200;

        this.setupControls();
        this.setupCanvas();
    }

    setupControls() {
        document.getElementById('btn-pause').onclick = () => {
            this.sim.paused = !this.sim.paused;
            document.getElementById('btn-pause').textContent = this.sim.paused ? 'Play' : 'Pause';
        };

        document.getElementById('btn-restart').onclick = () => this.sim.restart();

        document.getElementById('speed').oninput = (e) => {
            this.sim.speed = parseFloat(e.target.value);
            document.getElementById('speed-val').textContent = this.sim.speed.toFixed(1) + 'x';
        };

        document.getElementById('btn-save').onclick = () => this.sim.save();
        document.getElementById('btn-load').onclick = () => this.sim.load();
    }

    setupCanvas() {
        const canvas = document.getElementById('world');
        canvas.onclick = (e) => {
            const rect = canvas.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            this.handleClick(x, y);
        };
    }

    handleClick(x, y) {
        const creatures = this.sim.creatures;
        let closest = null;
        let closestDist = Infinity;

        for (const c of creatures) {
            if (c.dead) continue;
            const d = Math.hypot(c.x - x, c.y - y);
            if (d < c.genes.size + 5 && d < closestDist) {
                closest = c;
                closestDist = d;
            }
        }

        this.selectedCreature = closest;
        this.updateInspector();
    }

    updateStats() {
        const creatures = this.sim.creatures.filter(c => !c.dead);
        const herbs = creatures.filter(c => c.isHerbivore).length;
        const omnis = creatures.filter(c => c.isOmnivore).length;
        const carns = creatures.filter(c => c.isCarnivore).length;
        const maxGen = creatures.reduce((max, c) => Math.max(max, c.generation), 0);

        this.populationHistory.push({ total: creatures.length, herbs, omnis, carns });
        if (this.populationHistory.length > this.maxHistory) {
            this.populationHistory.shift();
        }

        this.statsEl.innerHTML = `
            <div class="stat-row">
                <span>Pop: <b>${creatures.length}</b></span>
                <span class="herb">Herb: ${herbs}</span>
                <span class="omni">Omni: ${omnis}</span>
                <span class="carn">Carn: ${carns}</span>
            </div>
            <div class="stat-row">
                <span>Food: ${this.sim.world.food.filter(f => !f.isMeat).length}</span>
                <span>Meat: ${this.sim.world.food.filter(f => f.isMeat).length}</span>
                <span>Gen: ${maxGen}</span>
                <span>Tick: ${this.sim.tick}</span>
            </div>
        `;

        if (this.fpsEl) {
            this.fpsEl.textContent = `${this.sim.fps} fps`;
        }
    }

    updateInspector() {
        if (!this.selectedCreature || this.selectedCreature.dead) {
            this.inspectorEl.innerHTML = '<div class="inspector-empty">Click a creature to inspect</div>';
            this.selectedCreature = null;
            return;
        }

        const c = this.selectedCreature;
        const dietName = ['Herbivore', 'Omnivore', 'Carnivore'][c.genes.diet];
        const stateNames = ['Wander', 'Seek Food', 'Hunt', 'Flee'];
        const stateColors = ['rgba(120,160,200,0.7)', '#4ae68a', '#e64a4a', '#e6c44a'];

        this.inspectorEl.innerHTML = `
            <div class="inspector-header">
                <span class="diet-badge ${dietName.toLowerCase()}">${dietName}</span>
                <span class="state-badge" style="color:${stateColors[c.state]}">${stateNames[c.state]}</span>
                <span>Gen ${c.generation}</span>
            </div>
            <div class="inspector-stats">
                <div class="stat">Energy: ${c.energy.toFixed(0)} / ${c.maxEnergy.toFixed(0)}</div>
                <div class="energy-bar">
                    <div class="energy-fill" style="width: ${(c.energy / c.maxEnergy * 100).toFixed(0)}%"></div>
                </div>
                <div class="stat">Age: ${c.age} ticks</div>
                <div class="stat">Speed: ${Math.hypot(c.vx, c.vy).toFixed(1)} / ${c.genes.speed.toFixed(1)}</div>
            </div>
            <div class="inspector-genes">
                <div class="gene">SPD: ${c.genes.speed.toFixed(2)}</div>
                <div class="gene">PER: ${c.genes.perception.toFixed(0)}</div>
                <div class="gene">SIZ: ${c.genes.size.toFixed(2)}</div>
                <div class="gene">EFF: ${c.genes.efficiency.toFixed(2)}</div>
            </div>
        `;
    }

    update() {
        this.updateStats();
        if (this.selectedCreature) {
            this.updateInspector();
        }
    }

    getSelectedCreature() {
        return this.selectedCreature;
    }
}
