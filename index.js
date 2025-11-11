class Ship {
  constructor(element, width, height) {
    this.grid = [];
    this.width = width;
    this.height = height;
    this.element = element;
    this.initGrid(width, height);
  }

  initGrid(width, height) {
    for (let y = 0; y < height; y++) {
      const row = [];
      for (let x = 0; x < width; x++) {
        let cell = {
          "element": document.createElement("div"),
          "x": x,
          "y": y,
          "tileType": "land"
        };
        row.push(cell);
      }
      this.grid.push(row);
    }

    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        const cell = this.grid[y][x];
        cell.element.classList.add(cell.tileType);
        cell.element.addEventListener("click", () => {
          this.interactInput(cell, x, y);
        });
        this.element.appendChild(cell.element);
      }
    }
  }

  initPlayer(player) {
    let isValid = player && typeof player.x === 'number' && typeof player.y === 'number';
    if (!isValid) {
      console.warn('placePlayer: invalid player or coordinates', player);
      return;
    }

    let isOutOfBounds = player.x < 0 || player.x >= this.width || player.y < 0 || player.y >= this.height;
    if (isOutOfBounds) {
      console.warn('placePlayer: player out of bounds', player.x, player.y);
      return;
    }

    const cell = this.grid[player.y][player.x];
    if (player.element) {
      cell.element.appendChild(player.element);
    }

    cell.entity = player;
    player._placed = true;
    player._placedCell = cell;
    player._ship = this;
    this.player = player;
  }

  interactInput(cell, x, y) {
    if (this.player) {
      this.player.moveTo(cell, x, y);
    }

    console.log("interacted with cell at", cell, x, y);
  }

}

class Player {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.element = this.createPlayerElement();
  }

  createPlayerElement() {
    const el = document.createElement("div");
    el.classList.add("player");
    return el;
  }

  async moveTo(cell, x, y) {
    if (!this._ship) {
      console.error("Player doesn't know which ship it's on!");
      return;
    }

    // Prevent concurrent moves
    if (this._isMoving) {
      console.warn('moveTo: already moving');
      return;
    }

    const ship = this._ship;

    // validate target
    if (typeof x !== 'number' || typeof y !== 'number') {
      console.warn('moveTo: invalid coordinates', x, y);
      return;
    }

    if (x < 0 || x >= ship.width || y < 0 || y >= ship.height) {
      console.warn('moveTo: target out of bounds', x, y);
      return;
    }

    const startCell = this._placedCell;
    if (!startCell) {
      console.warn('moveTo: player not placed on ship');
      return;
    }

    const targetCell = ship.grid[y][x];
    // treat non-land as wall
    if (targetCell.tileType !== 'land') {
      console.warn('moveTo: target is not land (wall)', x, y, targetCell.tileType);
      return;
    }

    // If we're already there, nothing to do
    if (startCell.x === x && startCell.y === y) {
      console.log('moveTo: already at target', x, y);
      return;
    }

    // BFS
    const key = (cx, cy) => `${cx},${cy}`;
    const dirs = [ [0, -1], [1, 0], [0, 1], [-1, 0] ];
    const queue = [];
    const visited = new Set();
    const parents = new Map(); // childKey -> parentKey

    queue.push(startCell);
    visited.add(key(startCell.x, startCell.y));
    parents.set(key(startCell.x, startCell.y), null);

    let found = false;
    while (queue.length) {
      const cur = queue.shift();
      if (cur.x === x && cur.y === y) {
        found = true;
        break;
      }

      for (const [dx, dy] of dirs) {
        const nx = cur.x + dx;
        const ny = cur.y + dy;
        if (nx < 0 || nx >= ship.width || ny < 0 || ny >= ship.height) continue;
        const neighbor = ship.grid[ny][nx];
        const nkey = key(nx, ny);
        if (visited.has(nkey)) continue;
        // Only traverse land tiles
        if (neighbor.tileType !== 'land') continue;
        visited.add(nkey);
        parents.set(nkey, key(cur.x, cur.y));
        queue.push(neighbor);
      }
    }

    if (!found) {
      console.warn('moveTo: no path to target', x, y);
      return;
    }

    // Reconstruct path from target back to start
    const path = [];
    let curKey = key(x, y);
    while (curKey) {
      const [cx, cy] = curKey.split(',').map(Number);
      path.push(ship.grid[cy][cx]);
      curKey = parents.get(curKey);
    }
    path.reverse(); // path[0] should be startCell, last is targetCell

    // If path is only the start cell, nothing to do
    if (path.length <= 1) {
      console.log('moveTo: already at target (path length <=1)', x, y);
      return;
    }

    // Animate along the path (skip index 0 which is start)
    const sleep = (ms) => new Promise((res) => setTimeout(res, ms));
    const stepDelay = 140; // ms per step — tweakable

    this._isMoving = true;
    try {
      for (let i = 1; i < path.length; i++) {
        const next = path[i];

        // Remove element from current placed cell
        const prev = this._placedCell;
        if (prev && prev.element && this.element && prev.element.contains(this.element)) {
          prev.element.removeChild(this.element);
        }
        if (prev && prev.entity === this) {
          prev.entity = null;
        }

        // Append to next cell
        next.element.appendChild(this.element);
        next.entity = this;
        this._placedCell = next;
        this.x = next.x;
        this.y = next.y;

        // Optionally, you can add a CSS class for walking animation here

        // Wait a bit before next step
        // If it's the last step, we still await once so the final position is visible briefly
        await sleep(stepDelay);
      }

      console.log('Player moved to', this.x, this.y);
    } finally {
      this._isMoving = false;
    }
  }
}

document.addEventListener("DOMContentLoaded", () => {
  const shipElement = document.getElementById("ship");
  const ship = new Ship(shipElement, 20, 10);
  console.log("hi");
  console.log(ship);

  // create the player and place into the ship grid
  const player = new Player(0, 0); // example starting coords
  ship.initPlayer(player);
  console.log('placed player', player);
});

