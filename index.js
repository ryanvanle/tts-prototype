class Ship {
  constructor(element, width, height) {
    this.grid = [];
    this.width = width;
    this.height = height;
    this.element = element;

    // Timer to help distinguish single/double clicks
    this.clickTimer = null;
    this.clickDelay = 250; // ms

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

        // --- Updated: Handle clicks vs. double-clicks ---

        // Listen for a single click
        cell.element.addEventListener("click", () => {
          // When a click happens, set a timer.
          // If the timer finishes, it was a single click.
          // If a dblclick happens, it will cancel this timer.

          // Clear any previous timer
          if (this.clickTimer) {
             clearTimeout(this.clickTimer);
             this.clickTimer = null;
          }

          this.clickTimer = setTimeout(() => {
            this.interactInput(cell, x, y, 'single');
            this.clickTimer = null;
          }, this.clickDelay);
        });

        // Listen for a double click
        cell.element.addEventListener("dblclick", () => {
          // Double click detected.

          // 1. Cancel the single-click timer
          if (this.clickTimer) {
            clearTimeout(this.clickTimer);
            this.clickTimer = null;
          }

          // 2. Send the double-click interaction
          this.interactInput(cell, x, y, 'double');
        });
        // ---

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

  // --- Updated: interactInput ---
  interactInput(cell, x, y, clickType) {
    if (this.player) {
      if (clickType === 'double') {
        // On double-click, call the new priority method
        console.log("interacted (double) with cell at", cell, x, y);
        this.player.moveToPriority(cell, x, y);
      } else {
        // On single-click, just add to queue
        console.log("interacted (single) with cell at", cell, x, y);
        this.player.moveTo(cell, x, y);
      }
    }
  }

}
class Player {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.element = this.createPlayerElement();

    this.moveQueue = [];
    this._isMoving = false;
    this._isInterrupted = false;

    this.destinationBadges = new Map();
  }

  createPlayerElement() {
    const el = document.createElement("div");
    el.classList.add("player");
    return el;
  }

  // --- New: stopAllMovement ---
  // Public method to be called by a global key listener
  stopAllMovement() {
    console.log("STOP command received.");

    // 1. Set the interrupt flag to stop the _executeMoveTo loop
    this._isInterrupted = true;

    // 2. Clear all pending moves from the queue
    this.moveQueue = [];

    // 3. Update badges to clear all destination markers
    this._updateDestinationBadges();
  }

  // --- (moveTo is unchanged) ---
  moveTo(cell, x, y) {
    this.moveQueue.push({ cell, x, y });
    this._updateDestinationBadges();
    this._processMoveQueue();
  }

  // --- (moveToPriority is unchanged) ---
  moveToPriority(cell, x, y) {
    console.log("Priority move requested to", x, y);
    this._isInterrupted = true;
    this.moveQueue = [];
    this.moveQueue.push({ cell, x, y });
    this._updateDestinationBadges();
    if (!this._isMoving) {
      this._processMoveQueue();
    }
  }

  // --- (_updateDestinationBadges is unchanged) ---
  _updateDestinationBadges() {
    for (const [key, { cell, badgeElement }] of this.destinationBadges.entries()) {
      try {
        if (cell && cell.element && cell.element.contains(badgeElement)) {
          cell.element.removeChild(badgeElement);
        }
        if (cell && cell.element) {
          cell.element.classList.remove('destination');
        }
      } catch (e) { /* ignore */ }
    }
    this.destinationBadges.clear();

    for (let i = 0; i < this.moveQueue.length; i++) {
      const { x, y } = this.moveQueue[i];
      const key = `${x},${y}`;
      if (this.destinationBadges.has(key)) {
        continue;
      }
      const cell = this._ship.grid[y][x];
      const badge = document.createElement('div');
      badge.classList.add('path-badge');
      badge.innerText = String(i + 1);
      if (!cell.element.style.position) cell.element.style.position = 'relative';
      cell.element.classList.add('destination');
      cell.element.appendChild(badge);
      this.destinationBadges.set(key, { cell, badgeElement: badge });
    }
  }

  // --- (_processMoveQueue is unchanged) ---
  async _processMoveQueue() {
    if (this._isMoving) {
      return;
    }
    this._isMoving = true;
    this._isInterrupted = false;

    try {
      while (this.moveQueue.length > 0) {
        if (this._isInterrupted) {
          console.log("Move queue processing stopped by interrupt.");
          break;
        }

        const { cell, x, y } = this.moveQueue[0];

        await this._executeMoveTo(cell, x, y);

        if (this._isInterrupted) {
          console.log("Move execution was interrupted.");
          break;
        }

        this.moveQueue.shift();
        this._updateDestinationBadges();
      }
    } finally {
      this._isMoving = false;

      if (this._isInterrupted) {
        this._isInterrupted = false;
        setTimeout(() => this._processMoveQueue(), 0);
      }
    }
  }

  // --- (_executeMoveTo is unchanged) ---
  async _executeMoveTo(cell, x, y) {
    if (!this._ship) { /*...*/ return; }
    const ship = this._ship;
    if (typeof x !== 'number' || typeof y !== 'number') { /*...*/ return; }
    if (x < 0 || x >= ship.width || y < 0 || y >= ship.height) { /*...*/ return; }
    const startCell = this._placedCell;
    if (!startCell) { /*...*/ return; }
    if (startCell.x === x && startCell.y === y) { /*...*/ return; }
    const targetCell = ship.grid[y][x];
    if (targetCell.tileType !== 'land') { /*...*/ return; }

    // BFS
    const key = (cx, cy) => `${cx},${cy}`;
    const dirs = [ [0, -1], [1, 0], [0, 1], [-1, 0] ];
    const queue = [];
    const visited = new Set();
    const parents = new Map();
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
    if (!found) { /*...*/ return; }

    // Reconstruct path
    const path = [];
    let curKey = key(x, y);
    while (curKey) {
      const [cx, cy] = curKey.split(',').map(Number);
      path.push(ship.grid[cy][cx]);
      curKey = parents.get(curKey);
    }
    path.reverse();
    if (path.length <= 1) { /*...*/ return; }

    // Animate along the path
    const sleep = (ms) => new Promise((res) => setTimeout(res, ms));
    const stepDelay = 140;

    for (let i = 1; i < path.length; i++) {
      if (this._isInterrupted) {
        console.warn("Move interrupted!");
        return;
      }

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

  // --- New: Spacebar stop listener ---
  document.addEventListener("keydown", (e) => {
    // We use e.code === "Space" to be precise
    if (e.code === "Space") {
      // Prevent spacebar from scrolling the page or clicking buttons
      e.preventDefault();
      console.log("Space pressed - stopping player.");
      player.stopAllMovement(); // Call the new method
    }
  });
  // ---
});