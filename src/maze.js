export class Cell {
  constructor(x, y, z) {
    this.x = x;
    this.y = y;
    this.z = z;
    this.visited = false;
    // Walls for this cell: true means wall exists
    this.walls = {
      px: true, // +x (East)
      nx: true, // -x (West)
      py: true, // +y (Up)
      ny: true, // -y (Down)
      pz: true, // +z (South)
      nz: true  // -z (North)
    };
  }
}

export class Maze3D {
  constructor(width, height, depth) {
    this.width = width;
    this.height = height;
    this.depth = depth;
    this.grid = [];
    this.initGrid();
  }

  initGrid() {
    this.grid = [];
    for (let x = 0; x < this.width; x++) {
      this.grid[x] = [];
      for (let y = 0; y < this.height; y++) {
        this.grid[x][y] = [];
        for (let z = 0; z < this.depth; z++) {
          this.grid[x][y][z] = new Cell(x, y, z);
        }
      }
    }
  }

  generate() {
    this.initGrid();
    const stack = [];
    let current = this.grid[0][0][0];
    current.visited = true;
    let visitedCount = 1;
    const totalCells = this.width * this.height * this.depth;

    while (visitedCount < totalCells) {
      const neighbors = this.getUnvisitedNeighbors(current);
      if (neighbors.length > 0) {
        // Choose a random neighbor
        const next = neighbors[Math.floor(Math.random() * neighbors.length)];
        this.removeWall(current, next);
        stack.push(current);
        current = next;
        current.visited = true;
        visitedCount++;
      } else if (stack.length > 0) {
        current = stack.pop();
      } else {
        // Fallback for safety to prevent infinite loop if somehow isolated
        break;
      }
    }
  }

  getUnvisitedNeighbors(cell) {
    const neighbors = [];
    const dirs = [
      { dx: 1, dy: 0, dz: 0 },
      { dx: -1, dy: 0, dz: 0 },
      { dx: 0, dy: 1, dz: 0 },
      { dx: 0, dy: -1, dz: 0 },
      { dx: 0, dy: 0, dz: 1 },
      { dx: 0, dy: 0, dz: -1 }
    ];

    for (const d of dirs) {
      const nx = cell.x + d.dx;
      const ny = cell.y + d.dy;
      const nz = cell.z + d.dz;

      if (
        nx >= 0 && nx < this.width &&
        ny >= 0 && ny < this.height &&
        nz >= 0 && nz < this.depth
      ) {
        const neighbor = this.grid[nx][ny][nz];
        if (!neighbor.visited) {
          neighbors.push(neighbor);
        }
      }
    }
    return neighbors;
  }

  removeWall(a, b) {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const dz = b.z - a.z;

    if (dx === 1) {
      a.walls.px = false;
      b.walls.nx = false;
    } else if (dx === -1) {
      a.walls.nx = false;
      b.walls.px = false;
    } else if (dy === 1) {
      a.walls.py = false;
      b.walls.ny = false;
    } else if (dy === -1) {
      a.walls.ny = false;
      b.walls.py = false;
    } else if (dz === 1) {
      a.walls.pz = false;
      b.walls.nz = false;
    } else if (dz === -1) {
      a.walls.nz = false;
      b.walls.pz = false;
    }
  }

  // Check if movement in a direction is blocked by a wall
  isBlocked(x, y, z, dx, dy, dz) {
    if (
      x + dx < 0 || x + dx >= this.width ||
      y + dy < 0 || y + dy >= this.height ||
      z + dz < 0 || z + dz >= this.depth
    ) {
      return true; // Out of bounds
    }

    const cell = this.grid[x][y][z];
    if (dx === 1) return cell.walls.px;
    if (dx === -1) return cell.walls.nx;
    if (dy === 1) return cell.walls.py;
    if (dy === -1) return cell.walls.ny;
    if (dz === 1) return cell.walls.pz;
    if (dz === -1) return cell.walls.nz;

    return true;
  }

  // BFS solver from current start to target end
  solve(start, end) {
    const queue = [start];
    const visited = new Set();
    const parentMap = new Map();
    const key = (p) => `${p.x},${p.y},${p.z}`;

    visited.add(key(start));
    let found = false;

    while (queue.length > 0) {
      const curr = queue.shift();
      if (curr.x === end.x && curr.y === end.y && curr.z === end.z) {
        found = true;
        break;
      }

      const cell = this.grid[curr.x][curr.y][curr.z];
      const dirs = [
        { dx: 1, dy: 0, dz: 0, wall: 'px' },
        { dx: -1, dy: 0, dz: 0, wall: 'nx' },
        { dx: 0, dy: 1, dz: 0, wall: 'py' },
        { dx: 0, dy: -1, dz: 0, wall: 'ny' },
        { dx: 0, dy: 0, dz: 1, wall: 'pz' },
        { dx: 0, dy: 0, dz: -1, wall: 'nz' }
      ];

      for (const d of dirs) {
        if (!cell.walls[d.wall]) {
          const nx = curr.x + d.dx;
          const ny = curr.y + d.dy;
          const nz = curr.z + d.dz;
          const neighborCoord = { x: nx, y: ny, z: nz };
          const neighborKey = key(neighborCoord);

          if (!visited.has(neighborKey)) {
            visited.add(neighborKey);
            parentMap.set(neighborKey, key(curr));
            queue.push(neighborCoord);
          }
        }
      }
    }

    if (!found) return [];

    // Reconstruct path
    const path = [];
    let currKey = key(end);
    const startKey = key(start);

    while (currKey !== startKey) {
      const [cx, cy, cz] = currKey.split(',').map(Number);
      path.push({ x: cx, y: cy, z: cz });
      currKey = parentMap.get(currKey);
    }
    path.push(start);
    path.reverse();
    return path;
  }
}
