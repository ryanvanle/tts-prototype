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

    this.moveQueue = [];
    this._isMoving = false; // Tracks if the queue processor is active

    // key: "x,y", value: { cell, badgeElement }
    this.destinationBadges = new Map();
  }

  createPlayerElement() {
    const el = document.createElement("div");
    el.classList.add("player");
    return el;
  }

  // Adds to queue and updates all badges
  moveTo(cell, x, y) {
    this.moveQueue.push({ cell, x, y });
    this._updateDestinationBadges(); // Update badges immediately
    this._processMoveQueue();
  }

  // Clears all current queue badges and redraws them
  _updateDestinationBadges() {
    // 1. Clear all existing badges from the DOM and the map
    for (const [key, { cell, badgeElement }] of this.destinationBadges.entries()) {
      try {
        if (cell && cell.element && cell.element.contains(badgeElement)) {
          cell.element.removeChild(badgeElement);
        }
        if (cell && cell.element) {
          cell.element.classList.remove('destination');
        }
      } catch (e) {
        // ignore errors
      }
    }
    this.destinationBadges.clear();

    // 2. Redraw all badges based on the current queue
    for (let i = 0; i < this.moveQueue.length; i++) {
      const { x, y } = this.moveQueue[i];
      const key = `${x},${y}`;

      // If the same coordinate is queued multiple times,
      // only show the badge for the *first* time it appears.
      if (this.destinationBadges.has(key)) {
        continue;
      }

      const cell = this._ship.grid[y][x];

      const badge = document.createElement('div');
      badge.classList.add('path-badge');
      badge.innerText = String(i + 1); // 1-indexed queue order

      if (!cell.element.style.position) cell.element.style.position = 'relative';
      cell.element.classList.add('destination');
      cell.element.appendChild(badge);

      this.destinationBadges.set(key, { cell, badgeElement: badge });
    }
  }

  // --- Updated: _processMoveQueue ---
  // This version fixes the disappearing badge bug
  async _processMoveQueue() {
    if (this._isMoving) {
      return;
    }
    this._isMoving = true;

    try {
      // Keep processing as long as there are items in the queue
      while (this.moveQueue.length > 0) {

        // 1. PEEK at the first item, but DON'T remove it.
        //    This item is our "currently running" move.
        const { cell, x, y } = this.moveQueue[0];

        // 2. Execute the move. While this is 'await'ing,
        //    the moveQueue still contains this item.
        await this._executeMoveTo(cell, x, y);

        // 3. NOW that the move is 100% complete,
        //    remove it from the front of the queue.
        this.moveQueue.shift();

        // 4. Update the badges. This will remove the "1"
        //    that just finished and shift all others (2->1, 3->2, etc.)
        this._updateDestinationBadges();
      }
    } finally {
      this._isMoving = false;
    }
  }

  // --- _executeMoveTo ---
  // (This method is unchanged)
  async _executeMoveTo(cell, x, y) {
    if (!this._ship) {
      console.error("Player doesn't know which ship it's on!");
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

    if (startCell.x === x && startCell.y === y) {
      console.log('moveTo: already at target', x, y);
      return;
    }

    const targetCell = ship.grid[y][x];
    if (targetCell.tileType !== 'land') {
      console.warn('moveTo: target is not land (wall)', x, y, targetCell.tileType);
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

    // Reconstruct path
    const path = [];
    let curKey = key(x, y);
    while (curKey) {
      const [cx, cy] = curKey.split(',').map(Number);
      path.push(ship.grid[cy][cx]);
      curKey = parents.get(curKey);
    }
    path.reverse();

    if (path.length <= 1) {
      console.log('moveTo: already at target (path length <=1)', x, y);
      return;
    }

    // Animate along the path
    const sleep = (ms) => new Promise((res) => setTimeout(res, ms));
    const stepDelay = 140; // ms per step

    for (let i = 1; i < path.length; i++) {
      const next = path[i];

      const prev = this._placedCell;
      if (prev && prev.element && this.element && prev.element.contains(this.element)) {
        prev.element.removeChild(this.element);
      }
      if (prev && prev.entity === this) {
        prev.entity = null;
      }

      next.element.appendChild(this.element);
      next.entity = this;
      this._placedCell = next;
      this.x = next.x;
      this.y = next.y;

      await sleep(stepDelay);
    }

    console.log('Player moved to', this.x, this.y);
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

