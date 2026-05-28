import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

export class MazeRenderer {
  constructor(containerId) {
    this.container = document.getElementById(containerId);
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.controls = null;

    // Maze parameters
    this.maze = null;
    this.ox = 0;
    this.oy = 0;
    this.oz = 0;

    // Rendered elements
    this.wallMesh = null;        // Active slice walls (solid)
    this.wallBorderMesh = null;  // Active slice wall borders (neon)
    this.ghostMesh = null;       // Inactive walls (ghost/transparent solid)
    this.ghostBorderMesh = null; // Inactive wall borders (ghost neon)
    
    this.playerMesh = null;
    this.playerLight = null;
    this.startMesh = null;
    this.exitMesh = null;
    this.exitLight = null;

    this.activePathLine = null;  // Current path line (magenta)
    this.hintPathLine = null;    // A* hint line (green dashed)
    this.exploredPoints = null;   // Particle system for explored cells (stardust)

    // Rendering settings
    this.sliceMode = 'none'; // 'none', 'x', 'y', 'z'
    this.sliceValue = 0;
    this.sliceThickness = 0; // 0 means just the single plane, 1 means ±1 layer, etc.
    this.autoSlice = true;
    this.xRayOpacity = 0.05; // Opacity of the ghost cage
    this.showHintPath = false;
    this.showExploredPath = true;

    // Game state tracking
    this.playerPos = { x: 0, y: 0, z: 0 };
    this.exploredCells = new Set(); // Stores string keys "x,y,z"

    this.init();
    this.animate();
  }

  init() {
    // 1. Create Scene
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x050508);
    this.scene.fog = new THREE.FogExp2(0x050508, 0.015);

    // 2. Create Camera
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;
    this.camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 1000);
    this.camera.position.set(15, 20, 25);

    // 3. Create Renderer
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.container.appendChild(this.renderer.domElement);

    // 4. Create Orbit Controls
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.05;
    this.controls.maxPolarAngle = Math.PI; // Full rotation
    this.controls.minDistance = 2;
    this.controls.maxDistance = 150;

    // 5. Add Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.15);
    this.scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 0.2);
    dirLight.position.set(10, 20, 15);
    this.scene.add(dirLight);

    // 6. Window Resize Listener
    window.addEventListener('resize', this.onWindowResize.bind(this));
  }

  onWindowResize() {
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }

  setMaze(maze) {
    this.maze = maze;
    
    // Calculate offset to center the maze at (0, 0, 0)
    this.ox = -(maze.width - 1) / 2;
    this.oy = -(maze.height - 1) / 2;
    this.oz = -(maze.depth - 1) / 2;

    this.playerPos = { x: 0, y: 0, z: 0 };
    this.exploredCells.clear();
    this.exploredCells.add('0,0,0');

    // Reset slice settings
    if (this.sliceMode !== 'none' && this.autoSlice) {
      this.sliceValue = 0; // Starts at player Y=0, X=0, or Z=0
    }

    // Clean up previous meshes
    this.cleanupMazeMeshes();

    // Create Start/Exit/Player meshes
    this.createInteractiveObjects();

    // Generate Maze Wall Geometries
    this.updateMazeGeometries();

    // Reset Camera view depending on maze size
    const maxDim = Math.max(maze.width, maze.height, maze.depth);
    this.camera.position.set(maxDim * 1.2, maxDim * 1.5, maxDim * 1.8);
    this.controls.target.set(0, 0, 0);
    this.controls.update();

    // Redraw paths
    this.updatePathLines();
  }

  cleanupMazeMeshes() {
    const removeAndDispose = (mesh) => {
      if (mesh) {
        this.scene.remove(mesh);
        if (mesh.geometry) mesh.geometry.dispose();
        if (Array.isArray(mesh.material)) {
          mesh.material.forEach(m => m.dispose());
        } else if (mesh.material) {
          mesh.material.dispose();
        }
      }
    };

    removeAndDispose(this.wallMesh);
    removeAndDispose(this.wallBorderMesh);
    removeAndDispose(this.ghostMesh);
    removeAndDispose(this.ghostBorderMesh);
    removeAndDispose(this.playerMesh);
    removeAndDispose(this.startMesh);
    removeAndDispose(this.exitMesh);
    removeAndDispose(this.activePathLine);
    removeAndDispose(this.hintPathLine);
    removeAndDispose(this.exploredPoints);

    if (this.playerLight) this.scene.remove(this.playerLight);
    if (this.exitLight) this.scene.remove(this.exitLight);

    this.wallMesh = null;
    this.wallBorderMesh = null;
    this.ghostMesh = null;
    this.ghostBorderMesh = null;
    this.playerMesh = null;
    this.playerLight = null;
    this.startMesh = null;
    this.exitMesh = null;
    this.exitLight = null;
    this.activePathLine = null;
    this.hintPathLine = null;
    this.exploredPoints = null;
  }

  createInteractiveObjects() {
    // 1. Player
    const playerGeo = new THREE.SphereGeometry(0.25, 32, 32);
    const playerMat = new THREE.MeshBasicMaterial({ color: 0x00ffcc });
    this.playerMesh = new THREE.Mesh(playerGeo, playerMat);
    this.scene.add(this.playerMesh);

    this.playerLight = new THREE.PointLight(0x00ffcc, 1.5, 6, 1.5);
    this.scene.add(this.playerLight);

    // 2. Start (Blue glowing sphere)
    const startGeo = new THREE.SphereGeometry(0.2, 16, 16);
    const startMat = new THREE.MeshBasicMaterial({ color: 0x3366ff, transparent: true, opacity: 0.8 });
    this.startMesh = new THREE.Mesh(startGeo, startMat);
    this.startMesh.position.set(this.ox, this.oy, this.oz);
    this.scene.add(this.startMesh);

    // 3. Exit (Gold glowing sphere)
    const exitGeo = new THREE.SphereGeometry(0.28, 32, 32);
    const exitMat = new THREE.MeshBasicMaterial({ color: 0xffaa00 });
    this.exitMesh = new THREE.Mesh(exitGeo, exitMat);
    this.exitMesh.position.set(
      (this.maze.width - 1) + this.ox,
      (this.maze.height - 1) + this.oy,
      (this.maze.depth - 1) + this.oz
    );
    this.scene.add(this.exitMesh);

    this.exitLight = new THREE.PointLight(0xffaa00, 2, 8, 1);
    this.exitLight.position.copy(this.exitMesh.position);
    this.scene.add(this.exitLight);

    // Update Player position in scene space
    this.updatePlayerMeshPosition();
  }

  updatePlayerMeshPosition() {
    const px = this.playerPos.x + this.ox;
    const py = this.playerPos.y + this.oy;
    const pz = this.playerPos.z + this.oz;

    this.playerMesh.position.set(px, py, pz);
    this.playerLight.position.set(px, py, pz);
  }

  setPlayerPosition(x, y, z) {
    this.playerPos = { x, y, z };
    this.exploredCells.add(`${x},${y},${z}`);

    this.updatePlayerMeshPosition();

    // Auto slice tracking
    if (this.autoSlice && this.sliceMode !== 'none') {
      let changed = false;
      if (this.sliceMode === 'x' && this.sliceValue !== x) {
        this.sliceValue = x;
        changed = true;
      } else if (this.sliceMode === 'y' && this.sliceValue !== y) {
        this.sliceValue = y;
        changed = true;
      } else if (this.sliceMode === 'z' && this.sliceValue !== z) {
        this.sliceValue = z;
        changed = true;
      }

      if (changed) {
        this.updateMazeGeometries();
      }
    }

    this.updatePathLines();
  }

  // Slicing parameters change
  updateSliceSettings(mode, value, autoTrack, xRayOpacity) {
    let changed = false;

    if (this.sliceMode !== mode) {
      this.sliceMode = mode;
      changed = true;
    }
    
    this.autoSlice = autoTrack;
    
    if (this.autoSlice && this.sliceMode !== 'none') {
      // Force to player coordinate
      const currentTargetVal = this.sliceMode === 'x' ? this.playerPos.x : 
                               (this.sliceMode === 'y' ? this.playerPos.y : this.playerPos.z);
      if (this.sliceValue !== currentTargetVal) {
        this.sliceValue = currentTargetVal;
        changed = true;
      }
    } else if (this.sliceValue !== value) {
      this.sliceValue = value;
      changed = true;
    }

    if (this.xRayOpacity !== xRayOpacity) {
      this.xRayOpacity = xRayOpacity;
      if (this.ghostMesh && this.ghostMesh.material) {
        this.ghostMesh.material.opacity = this.xRayOpacity;
      }
      if (this.ghostBorderMesh && this.ghostBorderMesh.material) {
        this.ghostBorderMesh.material.opacity = this.xRayOpacity * 2.5;
      }
    }

    if (changed) {
      this.updateMazeGeometries();
    }
  }

  updateShowPaths(showHint, showExplored) {
    this.showHintPath = showHint;
    this.showExploredPath = showExplored;
    this.updatePathLines();
  }

  // Generates/updates the buffer geometries for walls and lines based on current slices
  updateMazeGeometries() {
    if (!this.maze) return;

    // Active Slice Geometry Arrays
    const activePositions = [];
    const activeNormals = [];
    const activeIndices = [];
    const activeLinePositions = [];

    // Ghost Geometry Arrays
    const ghostPositions = [];
    const ghostNormals = [];
    const ghostIndices = [];
    const ghostLinePositions = [];

    const w = this.maze.width;
    const h = this.maze.height;
    const d = this.maze.depth;

    const checkSlice = (x, y, z) => {
      if (this.sliceMode === 'none') return true;
      if (this.sliceMode === 'x') return Math.abs(x - this.sliceValue) <= this.sliceThickness;
      if (this.sliceMode === 'y') return Math.abs(y - this.sliceValue) <= this.sliceThickness;
      if (this.sliceMode === 'z') return Math.abs(z - this.sliceValue) <= this.sliceThickness;
      return true;
    };

    // Helper: Add Quad and Line definitions
    const pushQuad = (posArr, normArr, idxArr, lineArr, v0, v1, v2, v3, norm) => {
      const startIdx = posArr.length / 3;
      posArr.push(...v0, ...v1, ...v2, ...v3);
      normArr.push(...norm, ...norm, ...norm, ...norm);
      idxArr.push(
        startIdx, startIdx + 1, startIdx + 2,
        startIdx, startIdx + 2, startIdx + 3
      );
      
      // Wireframe border
      lineArr.push(
        ...v0, ...v1,
        ...v1, ...v2,
        ...v2, ...v3,
        ...v3, ...v0
      );
    };

    // Iterate through all cells
    for (let x = 0; x < w; x++) {
      for (let y = 0; y < h; y++) {
        for (let z = 0; z < d; z++) {
          const cell = this.maze.grid[x][y][z];
          const isCellActive = checkSlice(x, y, z);

          // Get target arrays
          const pos = isCellActive ? activePositions : ghostPositions;
          const norm = isCellActive ? activeNormals : ghostNormals;
          const idx = isCellActive ? activeIndices : ghostIndices;
          const line = isCellActive ? activeLinePositions : ghostLinePositions;

          // Compute absolute scene coords
          const sx = x + this.ox;
          const sy = y + this.oy;
          const sz = z + this.oz;

          // +X Wall
          if (cell.walls.px) {
            pushQuad(pos, norm, idx, line,
              [sx + 0.5, sy - 0.5, sz - 0.5],
              [sx + 0.5, sy + 0.5, sz - 0.5],
              [sx + 0.5, sy + 0.5, sz + 0.5],
              [sx + 0.5, sy - 0.5, sz + 0.5],
              [1, 0, 0]
            );
          }
          // -X Wall (Only draw on boundary x=0 to prevent double drawing)
          if (x === 0 && cell.walls.nx) {
            pushQuad(pos, norm, idx, line,
              [sx - 0.5, sy - 0.5, sz - 0.5],
              [sx - 0.5, sy - 0.5, sz + 0.5],
              [sx - 0.5, sy + 0.5, sz + 0.5],
              [sx - 0.5, sy + 0.5, sz - 0.5],
              [-1, 0, 0]
            );
          }

          // +Y Wall
          if (cell.walls.py) {
            pushQuad(pos, norm, idx, line,
              [sx - 0.5, sy + 0.5, sz - 0.5],
              [sx - 0.5, sy + 0.5, sz + 0.5],
              [sx + 0.5, sy + 0.5, sz + 0.5],
              [sx + 0.5, sy + 0.5, sz - 0.5],
              [0, 1, 0]
            );
          }
          // -Y Wall (Only draw on boundary y=0)
          if (y === 0 && cell.walls.ny) {
            pushQuad(pos, norm, idx, line,
              [sx - 0.5, sy - 0.5, sz - 0.5],
              [sx + 0.5, sy - 0.5, sz - 0.5],
              [sx + 0.5, sy - 0.5, sz + 0.5],
              [sx - 0.5, sy - 0.5, sz + 0.5],
              [0, -1, 0]
            );
          }

          // +Z Wall
          if (cell.walls.pz) {
            pushQuad(pos, norm, idx, line,
              [sx - 0.5, sy - 0.5, sz + 0.5],
              [sx + 0.5, sy - 0.5, sz + 0.5],
              [sx + 0.5, sy + 0.5, sz + 0.5],
              [sx - 0.5, sy + 0.5, sz + 0.5],
              [0, 0, 1]
            );
          }
          // -Z Wall (Only draw on boundary z=0)
          if (z === 0 && cell.walls.nz) {
            pushQuad(pos, norm, idx, line,
              [sx - 0.5, sy - 0.5, sz - 0.5],
              [sx - 0.5, sy + 0.5, sz - 0.5],
              [sx + 0.5, sy + 0.5, sz - 0.5],
              [sx + 0.5, sy - 0.5, sz - 0.5],
              [0, 0, -1]
            );
          }
        }
      }
    }

    // Update active meshes in scene (use bright self-luminous MeshBasicMaterial)
    this.updateMeshObject('wallMesh', activePositions, activeNormals, activeIndices, 
      new THREE.MeshBasicMaterial({
        color: 0x0055cc,
        transparent: true,
        opacity: 0.45,
        side: THREE.DoubleSide,
        depthWrite: true
      })
    );

    this.updateLineObject('wallBorderMesh', activeLinePositions, 
      new THREE.LineBasicMaterial({
        color: 0x00ffff,
        transparent: true,
        opacity: 1.0
      })
    );

    // Update ghost meshes in scene
    this.updateMeshObject('ghostMesh', ghostPositions, ghostNormals, ghostIndices, 
      new THREE.MeshBasicMaterial({
        color: 0x0a1535,
        transparent: true,
        opacity: this.xRayOpacity,
        side: THREE.DoubleSide,
        depthWrite: false
      })
    );

    this.updateLineObject('ghostBorderMesh', ghostLinePositions, 
      new THREE.LineBasicMaterial({
        color: 0x224488,
        transparent: true,
        opacity: this.xRayOpacity * 2.5,
        depthWrite: false
      })
    );
  }

  updateMeshObject(propName, pos, norm, idx, material) {
    // Clean old mesh
    if (this[propName]) {
      this.scene.remove(this[propName]);
      this[propName].geometry.dispose();
      this[propName] = null;
    }

    if (pos.length === 0) return;

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(norm, 3));
    geo.setIndex(idx);

    this[propName] = new THREE.Mesh(geo, material);
    this.scene.add(this[propName]);
  }

  updateLineObject(propName, pos, material) {
    // Clean old line
    if (this[propName]) {
      this.scene.remove(this[propName]);
      this[propName].geometry.dispose();
      this[propName] = null;
    }

    if (pos.length === 0) return;

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));

    this[propName] = new THREE.LineSegments(geo, material);
    this.scene.add(this[propName]);
  }

  updatePathLines() {
    if (!this.maze) return;

    // --- 1. ACTIVE PATH (from start to player) ---
    // Compute current path using solver
    const activePath = this.maze.solve({ x: 0, y: 0, z: 0 }, this.playerPos);

    if (this.activePathLine) {
      this.scene.remove(this.activePathLine);
      this.activePathLine.geometry.dispose();
      this.activePathLine = null;
    }

    if (activePath.length > 1) {
      const points = activePath.map(p => new THREE.Vector3(p.x + this.ox, p.y + this.oy, p.z + this.oz));
      const geo = new THREE.BufferGeometry().setFromPoints(points);
      const mat = new THREE.LineBasicMaterial({
        color: 0xff007f, // Neon Pink
        linewidth: 3,    // standard line width (browser defaults to 1 usually, but material is solid)
        transparent: true,
        opacity: 0.95
      });
      this.activePathLine = new THREE.Line(geo, mat);
      this.scene.add(this.activePathLine);
    }

    // --- 2. EXPLORED TRAIL (Stardust particles) ---
    if (this.exploredPoints) {
      this.scene.remove(this.exploredPoints);
      this.exploredPoints.geometry.dispose();
      this.exploredPoints = null;
    }

    if (this.showExploredPath && this.exploredCells.size > 0) {
      // Find elements in exploredCells that are NOT on the active path
      const activeKeys = new Set(activePath.map(p => `${p.x},${p.y},${p.z}`));
      const points = [];

      for (const key of this.exploredCells) {
        if (!activeKeys.has(key)) {
          const [x, y, z] = key.split(',').map(Number);
          points.push(new THREE.Vector3(x + this.ox, y + this.oy, z + this.oz));
        }
      }

      if (points.length > 0) {
        const geo = new THREE.BufferGeometry().setFromPoints(points);
        // Create custom glowing dot sprite or simple round particles
        const sprite = this.createPointSprite();
        const mat = new THREE.PointsMaterial({
          color: 0x9933ff, // Neon Violet
          size: 0.35,
          map: sprite,
          transparent: true,
          blending: THREE.AdditiveBlending,
          depthWrite: false
        });
        this.exploredPoints = new THREE.Points(geo, mat);
        this.scene.add(this.exploredPoints);
      }
    }

    // --- 3. HINT PATH (A* solver from player to exit) ---
    if (this.hintPathLine) {
      this.scene.remove(this.hintPathLine);
      this.hintPathLine.geometry.dispose();
      this.hintPathLine = null;
    }

    if (this.showHintPath) {
      const exitPos = { x: this.maze.width - 1, y: this.maze.height - 1, z: this.maze.depth - 1 };
      const hintPath = this.maze.solve(this.playerPos, exitPos);

      if (hintPath.length > 1) {
        const points = hintPath.map(p => new THREE.Vector3(p.x + this.ox, p.y + this.oy, p.z + this.oz));
        const geo = new THREE.BufferGeometry().setFromPoints(points);
        const mat = new THREE.LineDashedMaterial({
          color: 0x33ff33, // Glowing Lime Green
          dashSize: 0.3,
          gapSize: 0.2,
          linewidth: 2
        });
        this.hintPathLine = new THREE.Line(geo, mat);
        this.hintPathLine.computeLineDistances(); // Required for dashed line rendering
        this.scene.add(this.hintPathLine);
      }
    }
  }

  // Create a round circular texture programmatically
  createPointSprite() {
    const canvas = document.createElement('canvas');
    canvas.width = 16;
    canvas.height = 16;
    const ctx = canvas.getContext('2d');
    
    // Draw glowing circle
    const grad = ctx.createRadialGradient(8, 8, 0, 8, 8, 8);
    grad.addColorStop(0, 'rgba(255, 255, 255, 1)');
    grad.addColorStop(0.3, 'rgba(153, 51, 255, 0.8)');
    grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 16, 16);
    
    const texture = new THREE.CanvasTexture(canvas);
    return texture;
  }

  animate() {
    requestAnimationFrame(this.animate.bind(this));

    // Update orbit controls
    if (this.controls) this.controls.update();

    // Pulse effects for exits, point lights
    const time = Date.now() * 0.003;
    
    if (this.exitMesh) {
      const scale = 1 + Math.sin(time) * 0.08;
      this.exitMesh.scale.set(scale, scale, scale);
    }
    if (this.exitLight) {
      this.exitLight.intensity = 2 + Math.sin(time * 1.5) * 0.5;
    }
    if (this.playerLight) {
      this.playerLight.intensity = 1.5 + Math.cos(time * 2) * 0.25;
    }

    // Render scene
    if (this.renderer && this.scene && this.camera) {
      this.renderer.render(this.scene, this.camera);
    }
  }
}
