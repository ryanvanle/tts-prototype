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
        cell.element.classList.add("land");
        this.element.appendChild(cell.element);
      }
    }

  }
}

document.addEventListener("DOMContentLoaded", () => {
  const shipElement = document.getElementById("ship");
  const ship = new Ship(shipElement, 20, 10);
  console.log("hi")
  console.log(ship);
});

