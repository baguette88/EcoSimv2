window.onload = function() {
    let pauseSimulation = false;
    let deaths = 0;
    let livingAnimals = 0;
    let maxLevel = 10;
    let timeScale = 1;
    let mutationRate = 0.1;

    const canvas = document.getElementById('ecosystem');
    const ctx = canvas.getContext('2d');
    const speedSlider = document.getElementById('speed-slider');
    const speedValue = document.getElementById('speed-value');
    const foodRateSlider = document.getElementById('food-rate');
    const foodRateValue = document.getElementById('food-rate-value');
    const mutationRateSlider = document.getElementById('mutation-rate');
    const mutationRateValue = document.getElementById('mutation-rate-value');
    const statusBar = document.getElementById('status-bar');
    const terminalContent = document.getElementById('terminal-content');

    function resizeCanvas() {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight - 300; // Adjust for controls, status bar, and terminal
    }

    window.addEventListener('resize', resizeCanvas);
    resizeCanvas();

    speedSlider.addEventListener('input', function() {
        timeScale = parseFloat(this.value);
        speedValue.textContent = timeScale.toFixed(1) + 'x';
    });

    foodRateSlider.addEventListener('input', function() {
        foodRateValue.textContent = this.value;
    });

    mutationRateSlider.addEventListener('input', function() {
        mutationRate = parseInt(this.value) / 100;
        mutationRateValue.textContent = this.value + '%';
    });

    class Animal {
        constructor(x, y, color, level = 0, speed = Math.min(Math.floor(Math.random() * 5) + 1, 5), iq = Math.floor(Math.random() * 10) + 1, metabolism = Math.min(Math.floor(Math.random() * 5) + 1, 3)) {
            this.x = x;
            this.y = y;
            this.size = 10;
            this.food = 88;
            this.dead = false;
            this.speed = speed;
            this.iq = iq;
            this.metabolism = metabolism;
            this.deathTime = null;
            this.color = color || `hsl(${Math.random() * 360}, 100%, 50%)`;
            this.level = level;
            this.reproduceCooldown = 0;
            this.hasEaten = false;
            this.isMaxLevel = false;
        }

        draw() {
            const radius = this.dead ? this.size / 2 : this.size;
            ctx.fillStyle = this.dead ? 'rgba(128, 128, 128, 0.5)' : this.color;
            ctx.strokeStyle = this.dead ? 'rgba(0, 0, 0, 0.5)' : 'black';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(this.x, this.y, radius, 0, 2 * Math.PI);
            ctx.fill();
            ctx.stroke();

            if (this.isMaxLevel) {
                ctx.save();
                ctx.strokeStyle = 'gold';
                ctx.lineWidth = 3;
                ctx.setLineDash([5, 5]);
                ctx.beginPath();
                ctx.arc(this.x, this.y, radius + 5, 0, 2 * Math.PI);
                ctx.stroke();
                ctx.restore();
            }

            ctx.fillStyle = 'white';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.font = '10px Arial';
            ctx.fillText(this.level, this.x, this.y);
        }

        move(foodItems) {
            if (!this.dead) {
                let newX = this.x;
                let newY = this.y;
                const angle = Math.random() * 2 * Math.PI;

                if (Math.random() < this.iq / 10 && foodItems.length > 0) {
                    const nearestFood = foodItems.reduce((nearest, food) => {
                        const d = Math.sqrt((food.x - this.x) ** 2 + (food.y - this.y) ** 2);
                        return (nearest && nearest.d < d) ? nearest : { food, d };
                    }, null).food;
                    const dx = nearestFood.x - this.x;
                    const dy = nearestFood.y - this.y;
                    const d = Math.sqrt(dx ** 2 + dy ** 2);
                    newX += 0.5 * this.speed * dx / d * timeScale;
                    newY += 0.5 * this.speed * dy / d * timeScale;
                } else {
                    newX += 0.5 * this.speed * Math.cos(angle) * timeScale;
                    newY += 0.5 * this.speed * Math.sin(angle) * timeScale;
                }

                if (newX - this.size < 0 || newX + this.size > canvas.width) {
                    newX = this.x - 0.5 * this.speed * Math.cos(angle) * timeScale;
                }
                if (newY - this.size < 0 || newY + this.size > canvas.height) {
                    newY = this.y - 0.5 * this.speed * Math.sin(angle) * timeScale;
                }

                this.x = newX;
                this.y = newY;
            }
        }

        consume(foodItems, animals) {
            if (!this.dead) {
                foodItems.forEach((food, index) => {
                    if (Math.sqrt((food.x - this.x) ** 2 + (food.y - this.y) ** 2) < this.size + food.size) {
                        this.food++;
                        this.hasEaten = true;
                        foodItems.splice(index, 1);
                    }
                });
                animals.forEach((animal) => {
                    if (!animal.dead && this.level >= animal.level + 2 && this.color !== animal.color) {
                        if (Math.sqrt((animal.x - this.x) ** 2 + (animal.y - this.y) ** 2) < this.size + animal.size) {
                            animal.dead = true;
                            if (!animal.dead) {
                                livingAnimals--;
                            }
                            deaths++;
                        }
                    }
                });
            }
        }

        update(timeScale) {
            this.food -= this.metabolism * timeScale / 10;
            let newLevel = Math.floor(this.food / 20);
            if (newLevel > this.level) {
                this.level = newLevel;
                this.size *= 1.1;
            }
            this.level = Math.floor(this.food / 20);
            this.reproduceCooldown = Math.max(0, this.reproduceCooldown - timeScale);
            if (this.food <= 0 && !this.dead) {
                this.dead = true;
                livingAnimals--;
                this.deathTime = Date.now();
            }
            if (this.level >= 10 && !this.isMaxLevel) {
                this.isMaxLevel = true;
                this.size *= 1.1;
            }

            if (this.food >= 55 && this.reproduceCooldown <= 0 && this.hasEaten) {
                this.food -= 20;
                this.reproduceCooldown = 1.5;
                this.hasEaten = false;
                const x = this.x + Math.random() * 20 - 10;
                const y = this.y + Math.random() * 20 - 10;
                const speed = Math.max(1, this.speed + (Math.random() < mutationRate ? Math.ceil(Math.random() * 3) - 1 : 0));
                const iq = Math.max(1, this.iq + (Math.random() < mutationRate ? Math.ceil(Math.random() * 3) - 1 : 0));
                const metabolism = Math.max(1, this.metabolism + (Math.random() < mutationRate ? Math.ceil(Math.random() * 3) - 1 : 0));
                return new Animal(x, y, this.color, this.level, speed, iq, metabolism);
            }

            return null;
        }
    }

    class Food {
        constructor(x, y) {
            this.x = x;
            this.y = y;
            this.size = 5;
        }

        draw() {
            ctx.fillStyle = 'green';
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.size, 0, 2 * Math.PI);
            ctx.fill();
        }
    }

    let animals = [];
    let foodItems = [];
    let colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8', '#F7DC6F', '#B19CD9', '#FF92A5', '#9BDB47', '#D9A9CB'];
    let lakes = [];

    function restart() {
        pauseSimulation = false;
        animals = [];
        foodItems = [];
        livingAnimals = 0;
        deaths = 0;

        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Create multiple lakes
        lakes = [];
        for (let i = 0; i < 3; i++) {
            const lakeWidth = Math.random() * 0.1 * canvas.width + 0.05 * canvas.width;
            const lakeHeight = Math.random() * 0.1 * canvas.height + 0.05 * canvas.height;
            const lakeX = Math.random() * (canvas.width - lakeWidth);
            const lakeY = Math.random() * (canvas.height - lakeHeight);
            lakes.push({ x: lakeX, y: lakeY, width: lakeWidth, height: lakeHeight });
        }

        for (let i = 0; i < 15; i++) {
            const x = Math.random() * (canvas.width - 20) + 10;
            const y = Math.random() * (canvas.height - 20) + 10;
            const colorIndex = i % colors.length;
            animals.push(new Animal(x, y, colors[colorIndex]));
            livingAnimals++;
        }
    }

    function spawnFood() {
        const x = Math.random() * (canvas.width - 10) + 5;
        const y = Math.random() * (canvas.height - 10) + 5;
        foodItems.push(new Food(x, y));
    }

    function displayStatus() {
        const animalCount = livingAnimals;
        const foodCount = foodItems.length;
        const highestLevel = animals.reduce((max, animal) => Math.max(max, animal.level), 0);
        statusBar.textContent = `Animals: ${animalCount} | Deaths: ${deaths} | Food: ${foodCount} | Highest Level: ${highestLevel}`;
    }

    function removeDeadAnimals() {
        const now = Date.now();
        for (let i = 0; i < animals.length; i++) {
            if (animals[i].dead && now - animals[i].deathTime >= 3000) {
                animals.splice(i, 1);
                i--;
            }
        }
    }

    function drawLakes() {
        ctx.fillStyle = 'rgba(0, 100, 255, 0.3)';
        lakes.forEach(lake => {
            ctx.fillRect(lake.x, lake.y, lake.width, lake.height);
        });
    }

    function update() {
        try {
            if (!pauseSimulation && timeScale > 0) {
                ctx.clearRect(0, 0, canvas.width, canvas.height);

                drawLakes();
                displayStatus();
                removeDeadAnimals();

                animals.forEach(animal => {
                    animal.move(foodItems);
                    animal.consume(foodItems, animals);
                    let offspring = animal.update(timeScale);
                    if (offspring) {
                        animals.push(offspring);
                        livingAnimals++;
                    }
                    animal.draw();
                });
                foodItems.forEach(food => food.draw());

                const foodRate = parseFloat(foodRateSlider.value) / 200;
                if (Math.random() < foodRate * timeScale) {
                    spawnFood();
                }
            }

            requestAnimationFrame(update);
        } catch (error) {
            logError(error);
        }
    }

    function pause() {
        pauseSimulation = !pauseSimulation;
        document.getElementById('pause-button').textContent = pauseSimulation ? '▶️ Resume' : '⏸️ Pause';
    }

    function logError(error) {
        const errorMessage = `${new Date().toISOString()} - Error: ${error.message}\n`;
        terminalContent.textContent += errorMessage;
        terminalContent.scrollTop = terminalContent.scrollHeight;
        console.error(error);
    }

    document.getElementById('restart-button').addEventListener('click', restart);
    document.getElementById('pause-button').addEventListener('click', pause);
    document.getElementById('spawn-animals').addEventListener('click', function() {
        for (let i = 0; i < 5; i++) {
            const x = Math.random() * (canvas.width - 20) + 10;
            const y = Math.random() * (canvas.height - 20) + 10;
            const colorIndex = Math.floor(Math.random() * colors.length);
            animals.push(new Animal(x, y, colors[colorIndex]));
            livingAnimals++;
        }
    });

    document.getElementById('clear-terminal').addEventListener('click', function() {
        terminalContent.textContent = '';
    });

    window.addEventListener('error', function(event) {
        logError(event.error);
    });

    restart();
    update();
};