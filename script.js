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

function restart() {
    pauseSimulation = false;
    animals = [];
    foodItems = [];
    livingAnimals = 0;
    deaths = 0;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Create multiple lakes
    for (let i = 0; i < 3; i++) {
        const lakeWidth = Math.random() * 0.1 * canvas.width + 0.05 * canvas.width;
        const lakeHeight = Math.random() * 0.1 * canvas.height + 0.05 * canvas.height;
        const lakeX = Math.random() * (canvas.width - lakeWidth);
        const lakeY = Math.random() * (canvas.height - lakeHeight);
        ctx.fillStyle = 'rgba(0, 100, 255, 0.3)';
        ctx.fillRect(lakeX, lakeY, lakeWidth, lakeHeight);
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

function update() {
    if (!pauseSimulation && timeScale > 0) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Redraw lakes
        for (let i = 0; i < 3; i++) {
            const lakeWidth = Math.random() * 0.1 * canvas.width + 0.05 * canvas.width;
            const lakeHeight = Math.random() * 0.1 * canvas.height + 0.05 * canvas.height;
            const lakeX = Math.random() * (canvas.width - lakeWidth);
            const lakeY = Math.random() * (canvas.height - lakeHeight);
            ctx.fillStyle = 'rgba(0, 100, 255, 0.3)';
            ctx.fillRect(lakeX, lakeY, lakeWidth, lakeHeight);
        }

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
}

function pause() {
    pauseSimulation = !pauseSimulation;
    document.getElementById('pause-button').textContent = pauseSimulation ? '▶️ Resume' : '⏸️ Pause';
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

restart();
update();
;