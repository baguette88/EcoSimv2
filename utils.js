export function clamp(val, min, max) {
    return Math.max(min, Math.min(max, val));
}

export function lerp(a, b, t) {
    return a + (b - a) * t;
}

export function dist(x1, y1, x2, y2) {
    return Math.hypot(x2 - x1, y2 - y1);
}

export function randRange(min, max) {
    return min + Math.random() * (max - min);
}

export function randInt(min, max) {
    return Math.floor(randRange(min, max + 1));
}

export function hslToString(h, s, l) {
    return `hsl(${h}, ${s}%, ${l}%)`;
}

export function normalizeAngle(angle) {
    while (angle < 0) angle += Math.PI * 2;
    while (angle >= Math.PI * 2) angle -= Math.PI * 2;
    return angle;
}

export function angleToward(x1, y1, x2, y2) {
    return Math.atan2(y2 - y1, x2 - x1);
}

export function pickRandom(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
}
