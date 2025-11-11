// Create an N x N grid of square tiles inside the #ship element.
// Usage:
//   createGrid(8)        // creates an 8x8 grid
// The function is exposed on `window` so you can call it from the console.

document.addEventListener('DOMContentLoaded', () => {
  const el = document.getElementById('ship');

  if (!el) {
    console.warn('No #ship element found to populate grid.');
    return;
  }

  /**
   * Ship class encapsulates the grid element and operations on it.
   * - createGrid(rows, cols)
   * - clear()
   * - getTile(row, col)
   * - setTile(row, col, { className, content })
   */
  /**
   * Player represents the player entity on the ship grid.
   * - row, col: current tile coordinates
   * - speed: milliseconds per step when following a path
   */
  class Player {
    constructor(row = 0, col = 0, opts = {}) {
      this.row = Number(row) || 0;
      this.col = Number(col) || 0;
      // speed in ms for each movement step (used by followPath)
      this.speed = typeof opts.speed === 'number' ? opts.speed : 150;
    }

    setPos(row, col) {
      this.row = Number(row) || 0;
      this.col = Number(col) || 0;
    }

    setSpeed(ms) {
      if (typeof ms === 'number' && ms >= 0) this.speed = ms;
    }
  }

  /**
   * Customer represents a draggable customer on the ship grid.
   * - row, col: current tile coordinates
   */
  // Customer is represented as a plain object: { row: number, col: number, health: number }

  /**
   * createCustomer - factory that returns a plain customer object similar to Player
   * @param {number} row
   * @param {number} col
   * @param {{health?: number}} opts
   * @returns {{row:number,col:number,health:number,setPos:function,setHealth:function,decrement:function}}
   */
  function createCustomer(row = 0, col = 0, opts = {}) {
    const r = Number(row) || 0;
    const c = Number(col) || 0;
    const health = typeof opts.health === 'number' ? opts.health : 5;
    return {
      row: r,
      col: c,
      health,
      setPos(newRow, newCol) {
        this.row = Number(newRow) || 0;
        this.col = Number(newCol) || 0;
      },
      setHealth(h) {
        this.health = typeof h === 'number' ? h : Number(h) || 0;
      },
      decrement() {
        this.health = Math.max(0, (typeof this.health === 'number' ? this.health : 0) - 1);
        return this.health;
      },
    };
  }
  class Ship {
    /**
     * @param {HTMLElement|string} elementOrSelector
     */
    constructor(elementOrSelector) {
      this.el =
        typeof elementOrSelector === 'string'
          ? document.querySelector(elementOrSelector)
          : elementOrSelector;
      if (!this.el) throw new Error('Ship element not found');
      this.rows = 0;
      this.cols = 0;
      // 2D array to keep track of tile state: grid[row][col] = { className, content, row, col }
      this.grid = [];
      // optional callback users can set: (row, col, state) => {}
      this.onTileClick = null;
      // player info: { row, col }
      this.player = null;

      // Event delegation: log row/col when a tile is clicked and notify callback
      this.el.addEventListener('click', (e) => {
        const target = e.target.closest('[data-row][data-col]');
        if (!target || !this.el.contains(target)) return;
        const row = Number(target.dataset.row);
        const col = Number(target.dataset.col);
        // print to console as requested
        console.log('Tile clicked:', row, col);

        // dispatch a custom DOM event on the ship element with details
        const ev = new CustomEvent('ship:tileclick', {
          detail: { row, col, state: this.getTileState(row, col) },
        });
        this.el.dispatchEvent(ev);

        // call optional JS callback
        try {
          if (typeof this.onTileClick === 'function') this.onTileClick(row, col, this.getTileState(row, col));
        } catch (err) {
          console.error('onTileClick handler error', err);
        }
      });

      // Drag & drop handlers for Customer movement (HTML5 DnD)
      // We use event delegation on the ship element so newly-created tiles work automatically.
      this.el.addEventListener('dragstart', (e) => {
        const target = e.target.closest('[data-row][data-col]');
        if (!target || !this.el.contains(target)) return;
        const row = Number(target.dataset.row);
        const col = Number(target.dataset.col);
        const state = this.getTileState(row, col) || {};
        // only allow dragging when the tile currently contains a customer
        if (!state.hasCustomer) {
          // prevent drag if it's not a customer
          e.preventDefault();
          return;
        }
        try {
          e.dataTransfer.setData('text/plain', JSON.stringify({ type: 'customer', row, col }));
          e.dataTransfer.effectAllowed = 'move';
        } catch (err) {
          // ignore serialization issues in older browsers
        }
      });

      this.el.addEventListener('dragover', (e) => {
        // allow drop
        e.preventDefault();
        try {
          e.dataTransfer.dropEffect = 'move';
        } catch (err) {
          // ignore when not available
        }
      });

      this.el.addEventListener('drop', (e) => {
        e.preventDefault();
        const target = e.target.closest('[data-row][data-col]');
        if (!target || !this.el.contains(target)) return;
        const row = Number(target.dataset.row);
        const col = Number(target.dataset.col);
        try {
          const raw = e.dataTransfer.getData('text/plain');
          if (!raw) return;
          const obj = JSON.parse(raw);
          if (obj && obj.type === 'customer') {
            // Move the customer to the drop target
            this.initCustomer(row, col);
          }
        } catch (err) {
          console.error('Error handling drop event', err);
        }
      });
    }

    /** Clear all tiles */
    clear() {
      this.el.innerHTML = '';
      this.rows = 0;
      this.cols = 0;
      this.grid = [];
      return this;
    }

    /**
     * Create a rows x cols grid. Backwards-compatible: createGrid(n) => n x n.
     * @param {number} rows
     * @param {number} cols
     */
    createGrid(rows = 8, cols) {
      if (cols === undefined) cols = rows;
      rows = Math.max(1, Math.floor(Number(rows) || 0));
      cols = Math.max(1, Math.floor(Number(cols) || 0));
      // reset any existing tiles first, then set rows/cols
      this.clear();

      this.rows = rows;
      this.cols = cols;

      // set CSS columns
      this.el.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;
      this.grid = Array.from({ length: rows }, (_, r) =>
        Array.from({ length: cols }, (_, c) => ({
          // default to 'land' tiles
          className: 'land',
          content: '',
          row: r,
          col: c,
        }))
      );

      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const state = this.grid[r][c];
          const cell = document.createElement('div');
          cell.className = state.className;
          cell.textContent = state.content;
          cell.dataset.row = r;
          cell.dataset.col = c;
          this.el.appendChild(cell);
        }
      }
      // initialize player on the first tile (0,0)
      if (this.rows > 0 && this.cols > 0) {
        this.initPlayer(0, 0);
        // initialize a customer at the top-right tile (row 0, last column)
        this.initCustomer(0, this.cols - 1);
      }
      return this;
    }

    /** Get the tile element at (row, col) or null if out of range */
    getTile(row, col) {
      if (row < 0 || col < 0 || row >= this.rows || col >= this.cols) return null;
      const index = row * this.cols + col;
      return this.el.children[index] || null;
    }

    /** Get the state object for a tile (from the internal 2D grid) */
    getTileState(row, col) {
      if (row < 0 || col < 0 || row >= this.rows || col >= this.cols) return null;
      return this.grid[row] ? this.grid[row][col] : null;
    }

    /**
     * Set properties on a tile. className replaces the element's className.
     * @param {number} row
     * @param {number} col
     * @param {{className?:string, content?:string}} opts
     */
    setTile(row, col, opts = {}) {
      const tile = this.getTile(row, col);
      if (!tile) return null;

      // ensure internal state exists
      if (!this.grid[row]) this.grid[row] = [];
      if (!this.grid[row][col]) this.grid[row][col] = { className: tile.className || 'tile', content: tile.textContent || '', row, col };

      const state = this.grid[row][col];
      if (opts.className !== undefined) state.className = opts.className;
      if (opts.content !== undefined) state.content = opts.content;

      // apply to DOM
      tile.className = state.className;
      tile.textContent = state.content;
      return tile;
    }

    /** Set the internal tile state directly and update DOM */
    setTileState(row, col, newState = {}) {
      if (row < 0 || col < 0 || row >= this.rows || col >= this.cols) return null;
      const state = Object.assign({}, this.grid[row][col] || { row, col, className: 'tile', content: '' }, newState);
      this.grid[row][col] = state;
      const tile = this.getTile(row, col);
      if (tile) {
        tile.className = state.className;
        tile.textContent = state.content;
      }
      return state;
    }

    /** Initialize or move the player onto a tile. Player is represented by adding a 'player' class to the tile element and marking internal state. */
    initPlayer(row = 0, col = 0) {
      // clamp
      row = Math.max(0, Math.min(this.rows - 1, Number(row) || 0));
      col = Math.max(0, Math.min(this.cols - 1, Number(col) || 0));

      // remove player marker from previous tile if present
      if (this.player) {
        const prev = this.player;
        const prevTile = this.getTile(prev.row, prev.col);
        if (prevTile) prevTile.classList.remove('player');
        if (this.grid[prev.row] && this.grid[prev.row][prev.col]) {
          this.grid[prev.row][prev.col].hasPlayer = false;
        }
      }

      // ensure internal state cell exists
      if (!this.grid[row]) this.grid[row] = [];
      if (!this.grid[row][col]) this.grid[row][col] = { row, col, className: 'tile', content: '' };

      // mark new player position as a Player instance (preserve speed if present)
      if (this.player && this.player instanceof Player) {
        // update existing player position
        this.player.setPos(row, col);
      } else {
        // create a new player; default speed will be used
        const prevSpeed = this.player && this.player.speed ? this.player.speed : undefined;
        this.player = new Player(row, col, { speed: prevSpeed });
      }
      this.grid[row][col].hasPlayer = true;

      // add player class to the tile element
      const tile = this.getTile(row, col);
      if (tile) {
        tile.classList.add('player');
      }

      console.log('Player initialized at', this.player);
      return this.player;
    }

    /** Move player to a new tile (alias for initPlayer) */
    movePlayerTo(row, col) {
      return this.initPlayer(row, col);
    }

    /**
     * Initialize or move the customer onto a tile. Customer is represented by adding a 'customer' class
     * to the tile element and marking internal state. Tiles with a customer become draggable.
     */
    initCustomer(row = 0, col = 0) {
      // clamp
      row = Math.max(0, Math.min(this.rows - 1, Number(row) || 0));
      col = Math.max(0, Math.min(this.cols - 1, Number(col) || 0));

      // remove customer marker from previous tile if present
      if (this.customer) {
        const prev = this.customer;
        const prevTile = this.getTile(prev.row, prev.col);
        if (prevTile) {
          prevTile.classList.remove('customer');
          // remove hearts UI from previous tile if present
          try {
            const prevHearts = prevTile.querySelector && prevTile.querySelector('.customer-hearts');
            if (prevHearts) prevHearts.remove();
          } catch (err) {}
          // turn off draggable on previous tile
          try {
            prevTile.draggable = false;
          } catch (err) {}
        }
        if (this.grid[prev.row] && this.grid[prev.row][prev.col]) {
          this.grid[prev.row][prev.col].hasCustomer = false;
        }
        // clear any existing heart-decrement timer when customer is removed/moved
        try {
          if (this._heartTimer) {
            clearTimeout(this._heartTimer);
            this._heartTimer = null;
          }
        } catch (err) {}
      }

      // ensure internal state cell exists
      if (!this.grid[row]) this.grid[row] = [];
      if (!this.grid[row][col]) this.grid[row][col] = { row, col, className: 'tile', content: '' };

      // create or update customer as a plain object (use factory for new customers)
      if (this.customer && typeof this.customer === 'object') {
        // prefer using setPos if available (returned by createCustomer)
        if (typeof this.customer.setPos === 'function') {
          this.customer.setPos(row, col);
        } else {
          this.customer.row = Number(row) || 0;
          this.customer.col = Number(col) || 0;
        }
        if (typeof this.customer.health !== 'number') this.customer.health = 5;
      } else {
        this.customer = createCustomer(row, col, { health: 5 });
      }
      this.grid[row][col].hasCustomer = true;

      // add customer class and make tile draggable
      const tile = this.getTile(row, col);
      if (tile) {
        tile.classList.add('customer');
        try {
          tile.draggable = true;
        } catch (err) {}

        // create or update a heart container below the customer avatar
        try {
          let hearts = tile.querySelector('.customer-hearts');
          const maxHearts = 5;
          const healthCount = this.customer && typeof this.customer.health === 'number' ? Math.max(0, Math.min(maxHearts, this.customer.health)) : maxHearts;
          const heartsHtml = Array.from({ length: maxHearts }, (_, i) =>
            i < healthCount ? '<span class="heart">❤</span>' : '<span class="heart empty">❤</span>'
          ).join('');

          if (!hearts) {
            hearts = document.createElement('div');
            hearts.className = 'customer-hearts';
            hearts.innerHTML = heartsHtml;
            tile.appendChild(hearts);
          } else {
            hearts.innerHTML = heartsHtml;
          }
          // clear any existing timer before setting a new one
          try {
            if (this._heartTimer) {
              clearTimeout(this._heartTimer);
              this._heartTimer = null;
            }
          } catch (err) {}

          // start a 10s timer that decrements the customer's health by 1, then re-render
          // This will repeat: initCustomer re-creates the timer as long as health > 0.
          try {
            if (this.customer && typeof this.customer.health === 'number' && this.customer.health > 0) {
              this._heartTimer = setTimeout(() => {
                try {
                  if (!this.customer) return;
                  // decrement health but never below 0
                  this.customer.health = Math.max(0, (typeof this.customer.health === 'number' ? this.customer.health : 0) - 1);
                  // re-render current customer tile to update hearts UI and restart timer if needed
                  if (this.customer) this.initCustomer(this.customer.row, this.customer.col);
                } catch (err) {
                  // ignore timer errors
                }
              }, 10000);
            }
          } catch (err) {}
        } catch (err) {
          // ignore DOM errors
        }
      }

      console.log('Customer initialized at', this.customer);
      return this.customer;
    }

    /** Move customer to a new tile (alias for initCustomer) */
    moveCustomerTo(row, col) {
      return this.initCustomer(row, col);
    }
  }

  // create an instance and expose API
  const shipObj = new Ship(el);
  window.Ship = Ship;
  window.ship = shipObj;
  window.createGrid = (...args) => shipObj.createGrid(...args);

  // default grid
  shipObj.createGrid(10, 20);

  // ----- dev-buttons integration -----
  // Wire the dev-buttons UI so selecting a button changes the current action
  // and when painting mode is enabled, clicking a tile will change its type.
  (function attachDevButtons() {
    const dev = document.querySelector('.dev-buttons');
    if (!dev) return;

    const stateSpan = dev.querySelector('.dev-buttons-state');
    const toggleSpan = dev.querySelector('#dev-buttons-toggle');
    const buttons = Array.from(dev.querySelectorAll('button'));

    let paintMode = false; // toggled by Toggle button
    let currentType = 'land'; // default

    function updateUI() {
      if (stateSpan) stateSpan.textContent = currentType;
      if (toggleSpan) toggleSpan.textContent = paintMode ? 'ON' : 'OFF';
    }

    // map buttons by their text (case-insensitive)
    buttons.forEach((btn) => {
      const key = (btn.textContent || '').trim().toLowerCase();
      btn.addEventListener('click', () => {
        if (key === 'toggle') {
          paintMode = !paintMode;
          updateUI();
          return;
        }

        if (['land', 'water', 'table'].includes(key)) {
          currentType = key;
          updateUI();
        }
      });
    });

    // set initial UI
    updateUI();

    // Toggle visibility of the dev-buttons section when the user presses 'P'
    // Pressing P hides the dev buttons; pressing P again shows them.
    let devVisible = true;
    function setDevVisible(visible) {
      devVisible = !!visible;
      try {
        // Use display none so layout collapses when hidden
        dev.style.display = devVisible ? '' : 'none';
      } catch (err) {
        // ignore if dev is removed
      }
    }

    // Listen for global keydown for 'p' (case-insensitive)
    window.addEventListener('keydown', (ev) => {
      // ignore if modifier keys used
      if (ev.ctrlKey || ev.altKey || ev.metaKey || ev.shiftKey) return;
      if ((ev.key || '').toLowerCase() === 'p') {
        setDevVisible(!devVisible);
      }
    });

    // set ship callback to perform painting when a tile is clicked or queue destinations when clicking a land tile
    (function setupTileClickHandlerWithQueue() {
  const destQueue = [];
  let processing = false; // indicates whether we're currently processing the queue
  // movementToken increments when we want to cancel any in-progress movement.
  // followPath captures the current token and will stop early if it changes.
  let movementToken = 0;

      function sleep(ms) {
        return new Promise((res) => setTimeout(res, ms));
      }

      const rows = () => shipObj.rows;
      const cols = () => shipObj.cols;
      const inBounds = (r, c) => r >= 0 && c >= 0 && r < rows() && c < cols();

      function keyFor(r, c) {
        return `${r},${c}`;
      }

      // BFS shortest path on land tiles
      function findPath(start, goal) {
        const startKey = keyFor(start.row, start.col);
        const goalKey = keyFor(goal.row, goal.col);
        const queue = [startKey];
        const visited = new Set([startKey]);
        const prev = new Map();

        // Track best candidate (reachable tile) minimizing Manhattan distance to goal
        let bestCandidate = null; // { key, dist }

        while (queue.length) {
          const key = queue.shift();
          const [r, c] = key.split(',').map(Number);

          // If this tile is directly adjacent to the goal and is walkable, return path to it
          const manhattanToGoal = Math.abs(r - goal.row) + Math.abs(c - goal.col);
          const stateHere = shipObj.getTileState(r, c) || {};
          const walkableHere = stateHere.className === 'land' && !stateHere.hasCustomer;
          if (manhattanToGoal === 1 && walkableHere) {
            // reconstruct path to this key
            const pathKeys = [];
            let cur = key;
            pathKeys.push(cur);
            while (cur !== startKey) {
              cur = prev.get(cur);
              if (!cur) break;
              pathKeys.push(cur);
            }
            pathKeys.reverse();
            return pathKeys.map((k) => {
              const [rr, cc] = k.split(',').map(Number);
              return { row: rr, col: cc };
            });
          }

          // keep track of a best candidate reachable tile (walkable) by Manhattan distance to goal
          if (walkableHere) {
            if (!bestCandidate || manhattanToGoal < bestCandidate.dist) {
              bestCandidate = { key, dist: manhattanToGoal };
            }
          }

          const neighbors = [[r - 1, c], [r + 1, c], [r, c - 1], [r, c + 1]];
          for (const [nr, nc] of neighbors) {
            if (!inBounds(nr, nc)) continue;
            const nKey = keyFor(nr, nc);
            if (visited.has(nKey)) continue;
            const state = shipObj.getTileState(nr, nc) || {};
            // treat tiles with customers as blocked; only traverse land tiles without customers
            if (state.className !== 'land' || state.hasCustomer) continue;
            visited.add(nKey);
            prev.set(nKey, key);
            queue.push(nKey);
          }
        }

        // If we didn't find a path to a tile adjacent to goal, but we have a reachable candidate,
        // return the path to that candidate (the reachable tile closest to the customer).
        if (bestCandidate) {
          const pathKeys = [];
          let cur = bestCandidate.key;
          pathKeys.push(cur);
          while (cur !== startKey) {
            cur = prev.get(cur);
            if (!cur) break;
            pathKeys.push(cur);
          }
          pathKeys.reverse();
          return pathKeys.map((k) => {
            const [rr, cc] = k.split(',').map(Number);
            return { row: rr, col: cc };
          });
        }

        // no reachable path found
        return null;
      }

      async function followPath(path) {
        if (!path || path.length === 0) return;
        const token = movementToken;
        let i = 0;
        if (shipObj.player && path.length && path[0].row === shipObj.player.row && path[0].col === shipObj.player.col) i = 1;
          for (; i < path.length; i++) {
          // stop if a cancellation occurred
          if (token !== movementToken) return;
          const step = path[i];
          shipObj.movePlayerTo(step.row, step.col);
          // small delay so movement is visible; use player speed if available.
          // will finish sleeping even if cancelled, but the token check above prevents further steps after cancellation.
          const stepDelay = shipObj.player && typeof shipObj.player.speed === 'number' ? shipObj.player.speed : 150;
          await sleep(stepDelay);
          if (token !== movementToken) return;
        }
      }

      function markDestinationTile(row, col, text = '') {
        const tile = shipObj.getTile(row, col);
        if (!tile) return null;
        // avoid duplicate badge
        if (tile.querySelector('.tile-dest')) return tile.querySelector('.tile-dest');
        const span = document.createElement('span');
        span.className = 'tile-dest';
        span.textContent = text || `${row},${col}`;
        tile.appendChild(span);
        return span;
      }

      function unmarkDestinationTile(row, col) {
        const tile = shipObj.getTile(row, col);
        if (!tile) return;
        const span = tile.querySelector('.tile-dest');
        if (span) tile.removeChild(span);
        // also remove any active highlight
        tile.classList.remove('dest-active');
      }

      function updateQueueBadges() {
        // iterate queued destinations and set their badge to the queue index (1-based)
        destQueue.forEach((d, idx) => {
          const tile = shipObj.getTile(d.row, d.col);
          if (!tile) return;
          let badge = tile.querySelector('.tile-dest');
          if (!badge) {
            badge = markDestinationTile(d.row, d.col, '');
            if (!badge) return;
          }
          // Do not overwrite a 'no-path' marker if already set for that tile
          if (badge.textContent === 'no-path') return;
          badge.textContent = String(idx + 1);
        });
      }

      // helper to clear the entire destination queue and remove badges
      // returns a promise that resolves once any in-progress processing has stopped
      async function clearQueue() {
        // bump token to cancel any in-progress followPath
        movementToken++;
        // remove queued badges
        while (destQueue.length) {
          const d = destQueue.shift();
          unmarkDestinationTile(d.row, d.col);
        }
        // remove any active destination highlights on the grid
        const actives = shipObj.el.querySelectorAll('.dest-active');
        actives.forEach((n) => n.classList.remove('dest-active'));
        updateQueueBadges();

        // wait for any processing loop to finish
        while (processing) {
          // small delay
          // eslint-disable-next-line no-await-in-loop
          await sleep(20);
        }
      }

      // track last clicked tile (useful for double-space behavior)
      let lastClicked = null;

      async function processQueue() {
        if (processing) return;
        processing = true;
        while (destQueue.length) {
          const target = destQueue[0];
          // find path from current player pos to target
          if (!shipObj.player) shipObj.initPlayer(0, 0);
          const start = { row: shipObj.player.row, col: shipObj.player.col };
          const goal = { row: target.row, col: target.col };

          if (start.row === goal.row && start.col === goal.col) {
            // reached immediately
            unmarkDestinationTile(goal.row, goal.col);
            destQueue.shift();
            updateQueueBadges();
            continue;
          }

          const path = findPath(start, goal);
          if (!path) {
            console.log('No path found to queued target', goal);
            // indicate unreachable by updating badge
            const tile = shipObj.getTile(goal.row, goal.col);
            const badge = tile && tile.querySelector('.tile-dest');
            if (badge) badge.textContent = 'no-path';
            // remove from queue so it won't block others
            destQueue.shift();
            updateQueueBadges();
            continue;
          }

          console.log('Following path to queued target:', goal, path);
          // mark active destination visually
          const activeTile = shipObj.getTile(goal.row, goal.col);
          if (activeTile) activeTile.classList.add('dest-active');

          await followPath(path);

          // reached: clear marker and pop queue
          unmarkDestinationTile(goal.row, goal.col);
          if (activeTile) activeTile.classList.remove('dest-active');
          destQueue.shift();
          updateQueueBadges();
        }
        processing = false;
      }

      // Space key handling: single press clears the queue; double-press clears queue and re-queues lastClicked as first
      (function setupSpaceKeyControls() {
        let lastSpaceTs = 0;
        const DOUBLE_MS = 350;

  async function onSpacePress(e) {
          // only act on plain Space key without modifiers
          if (e.code !== 'Space' && e.key !== ' ') return;
          e.preventDefault();
          const now = Date.now();
          const since = now - lastSpaceTs;
          lastSpaceTs = now;

          if (since <= DOUBLE_MS) {
            // double press: clear queue then put lastClicked as the only destination (if any)
            console.log('Double Space detected: clearing queue and enqueuing last clicked');
            await clearQueue();
            if (lastClicked) {
              destQueue.push({ row: lastClicked.row, col: lastClicked.col });
              markDestinationTile(lastClicked.row, lastClicked.col, `${lastClicked.row},${lastClicked.col}`);
              updateQueueBadges();
              processQueue();
            } else {
              console.log('No last clicked tile to enqueue');
            }
          } else {
            // single press: clear the queue
            console.log('Space pressed: clearing destination queue');
            await clearQueue();
          }
        }

        window.addEventListener('keydown', onSpacePress);
      })();

      // double-click a tile to clear the queue and set that tile as the sole destination
      shipObj.el.addEventListener('dblclick', async (e) => {
        const target = e.target.closest('[data-row][data-col]');
        if (!target || !shipObj.el.contains(target)) return;
        const row = Number(target.dataset.row);
        const col = Number(target.dataset.col);
        const state = shipObj.getTileState(row, col);
        if (!state || state.className !== 'land') {
          console.log('Double-clicked tile is not land; ignoring.', { row, col, state });
          return;
        }

        console.log('Tile double-clicked: clearing queue and enqueuing this tile as first', { row, col });
        lastClicked = { row, col };
        await clearQueue();
        destQueue.push({ row, col });
        markDestinationTile(row, col, `${row},${col}`);
        updateQueueBadges();
        processQueue();
      });

      shipObj.onTileClick = async (row, col /*, state */) => {
        const targetState = shipObj.getTileState(row, col);
        if (paintMode) {
          // change the tile's class to the selected type and clear content
          const newState = shipObj.setTileState(row, col, { className: currentType, content: '' });

          // update the ship element's class to reflect the last-painted tile type
          if (shipObj.el && shipObj.el.classList) {
            shipObj.el.classList.remove('last-land', 'last-water', 'last-table');
            shipObj.el.classList.add(`last-${(newState && newState.className) || currentType}`);
          }

          // Debug: print the changed tile and the current internal grid state
          console.log('Tile painted:', { row, col, newState });
          console.log('Current internal grid snapshot:', shipObj.grid);
          return;
        }

        // non-paint mode: only enqueue land tiles
        if (!targetState || targetState.className !== 'land') {
          console.log('Clicked tile is not land; ignoring enqueue request.', { row, col, state: targetState });
          return;
        }

        // remember last clicked tile
        lastClicked = { row, col };

        // avoid enqueueing duplicates
        if (destQueue.some((d) => d.row === row && d.col === col)) {
          console.log('Destination already queued:', { row, col });
          return;
        }

        // if player is already on the tile, ignore
        if (shipObj.player && shipObj.player.row === row && shipObj.player.col === col) {
          console.log('Player already on clicked tile');
          return;
        }

        // enqueue destination and mark tile
        destQueue.push({ row, col });
  markDestinationTile(row, col, `${row},${col}`);
  updateQueueBadges();
        console.log('Enqueued destination:', { row, col }, 'Queue length:', destQueue.length);

        // start processing if not already
        processQueue();
      };
    })();
  })();
});
