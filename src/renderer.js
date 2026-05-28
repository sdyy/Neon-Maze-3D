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
    this.fpvWallMesh = null;       // Full maze walls for FPV
    this.fpvWallBorderMesh = null; // Full maze wall borders for FPV
    this.fogExp = null;            // Cache for scene fog density
    
    this.playerGroup = null;     // Group containing player mesh, light, and local keys compass
    this.playerMesh = null;
    this.playerLight = null;
    this.startMesh = null;
    this.exitMesh = null;
    this.exitLight = null;

    // FPV Camera and state variables
    this.fpCamera = null;
    this.fpYaw = -Math.PI / 4;
    this.fpPitch = 0;
    this.isDraggingFPV = false;
    this.lastMouseX = 0;
    this.lastMouseY = 0;
    this.playerAnimatedPos = new THREE.Vector3(); // Smoothly interpolated position

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

    // Cache scene fog for selective rendering
    this.fogExp = new THREE.FogExp2(0x050508, 0.015);
    this.scene.fog = this.fogExp;

    // 2. Create Cameras
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;
    
    // Overview/Orbit Camera
    this.camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 1000);
    this.camera.position.set(15, 20, 25);
    this.camera.layers.enable(0); // Renders Layer 0 (Common items)
    this.camera.layers.enable(1); // Renders Layer 1 (Sliced walls & key guides)

    // First Person Camera (FPV)
    this.fpCamera = new THREE.PerspectiveCamera(70, width / height, 0.05, 50);
    this.fpCamera.layers.enable(0); // Renders Layer 0 (Common items)
    this.fpCamera.layers.enable(2); // Renders Layer 2 (Full unsliced walls)
    const euler = new THREE.Euler(this.fpPitch, this.fpYaw, 0, 'YXZ');
    this.fpCamera.quaternion.setFromEuler(euler);

    // 3. Create WebGL Renderer
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.autoClear = false; // Render twice for dual viewport split screen
    this.container.appendChild(this.renderer.domElement);

    // 4. Create Orbit Controls (Bound ONLY to pip-overlay overlay div)
    const pipOverlay = document.getElementById('pip-overlay');
    this.controls = new OrbitControls(this.camera, pipOverlay || this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.05;
    this.controls.maxPolarAngle = Math.PI;
    this.controls.minDistance = 2;
    this.controls.maxDistance = 150;

    // 5. Add Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.15);
    ambientLight.layers.enable(1);
    ambientLight.layers.enable(2);
    this.scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 0.2);
    dirLight.position.set(10, 20, 15);
    dirLight.layers.enable(1);
    dirLight.layers.enable(2);
    this.scene.add(dirLight);

    // 6. Setup Drag Listeners on canvas for FPV camera rotation
    const onMouseDown = (e) => {
      // Only drag FPV look when clicking main canvas (not UI overlay panel)
      if (e.target !== this.renderer.domElement) return;
      this.isDraggingFPV = true;
      this.lastMouseX = e.clientX;
      this.lastMouseY = e.clientY;
      this.container.style.cursor = 'grabbing';
    };

    const onMouseMove = (e) => {
      if (!this.isDraggingFPV) return;
      const dx = e.clientX - this.lastMouseX;
      const dy = e.clientY - this.lastMouseY;
      
      this.fpYaw -= dx * 0.0025;
      this.fpPitch -= dy * 0.0025;
      
      // Clamp pitch to prevent flipping upside down
      const limit = Math.PI / 2.15;
      this.fpPitch = Math.max(-limit, Math.min(limit, this.fpPitch));
      
      const euler = new THREE.Euler(this.fpPitch, this.fpYaw, 0, 'YXZ');
      this.fpCamera.quaternion.setFromEuler(euler);
      
      this.lastMouseX = e.clientX;
      this.lastMouseY = e.clientY;
    };

    const onMouseUp = () => {
      this.isDraggingFPV = false;
      this.container.style.cursor = 'default';
    };

    this.container.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);

    // 7. Window Resize Listener
    window.addEventListener('resize', this.onWindowResize.bind(this));
  }

  onWindowResize() {
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;
    
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    
    this.fpCamera.aspect = width / height;
    this.fpCamera.updateProjectionMatrix();
    
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

    // Snap animated position immediately on new maze
    this.playerAnimatedPos.set(this.ox, this.oy, this.oz);

    // Reset FPV rotation facing
    this.fpYaw = -Math.PI / 4;
    this.fpPitch = 0;
    const euler = new THREE.Euler(this.fpPitch, this.fpYaw, 0, 'YXZ');
    if (this.fpCamera) {
      this.fpCamera.quaternion.setFromEuler(euler);
    }

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

    // Reset Camera view to close-up overview centered on player
    this.camera.position.copy(this.playerAnimatedPos).add(new THREE.Vector3(4, 5, 6));
    this.controls.target.copy(this.playerAnimatedPos);
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
    removeAndDispose(this.fpvWallMesh);
    removeAndDispose(this.fpvWallBorderMesh);
    removeAndDispose(this.startMesh);
    removeAndDispose(this.exitMesh);
    removeAndDispose(this.activePathLine);
    removeAndDispose(this.hintPathLine);
    removeAndDispose(this.exploredPoints);

    if (this.playerGroup) {
      this.scene.remove(this.playerGroup);
      this.playerGroup.traverse(child => {
        if (child.geometry) child.geometry.dispose();
        if (child.material) {
          if (Array.isArray(child.material)) child.material.forEach(m => m.dispose());
          else child.material.dispose();
        }
      });
      this.playerGroup = null;
    }

    if (this.exitLight) this.scene.remove(this.exitLight);

    this.wallMesh = null;
    this.wallBorderMesh = null;
    this.ghostMesh = null;
    this.ghostBorderMesh = null;
    this.fpvWallMesh = null;
    this.fpvWallBorderMesh = null;
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
    // Create Player Group (moves everything together)
    this.playerGroup = new THREE.Group();
    this.scene.add(this.playerGroup);

    // 1. Player (Octahedron for sci-fi look)
    const playerGeo = new THREE.OctahedronGeometry(0.24);
    const playerMat = new THREE.MeshBasicMaterial({ color: 0x00ffcc });
    this.playerMesh = new THREE.Mesh(playerGeo, playerMat);
    this.playerGroup.add(this.playerMesh);

    this.playerLight = new THREE.PointLight(0x00ffcc, 1.8, 6, 1.2);
    this.playerLight.layers.enable(1);
    this.playerLight.layers.enable(2);
    this.playerGroup.add(this.playerLight);

    // 3D Directional Key Crosshair (floating visual helper around player)
    const axisMaterialX = new THREE.LineBasicMaterial({ color: 0xff3333, transparent: true, opacity: 0.5 });
    const axisMaterialY = new THREE.LineBasicMaterial({ color: 0x33ff33, transparent: true, opacity: 0.5 });
    const axisMaterialZ = new THREE.LineBasicMaterial({ color: 0x3333ff, transparent: true, opacity: 0.5 });

    const createAxisLine = (points, material) => {
      const geo = new THREE.BufferGeometry().setFromPoints(points);
      const line = new THREE.Line(geo, material);
      line.layers.set(1); // Set to Layer 1 (only visible in Orbit minimap)
      return line;
    };

    // Draw coordinate lines extending from the player (only on Layer 1)
    this.playerGroup.add(createAxisLine([new THREE.Vector3(-0.7, 0, 0), new THREE.Vector3(0.7, 0, 0)], axisMaterialX));
    this.playerGroup.add(createAxisLine([new THREE.Vector3(0, -0.7, 0), new THREE.Vector3(0, 0.7, 0)], axisMaterialY));
    this.playerGroup.add(createAxisLine([new THREE.Vector3(0, 0, -0.7), new THREE.Vector3(0, 0, 0.7)], axisMaterialZ));

    // Place camera-facing text sprites indicating which keys map to which local 3D direction (Layer 1)
    this.labelD = this.createLabelSprite('D', '#ff3333');
    this.labelD.position.set(0.85, 0, 0);
    this.labelD.layers.set(1);
    this.playerGroup.add(this.labelD);

    this.labelA = this.createLabelSprite('A', '#ff3333');
    this.labelA.position.set(-0.85, 0, 0);
    this.labelA.layers.set(1);
    this.playerGroup.add(this.labelA);

    this.labelSpace = this.createLabelSprite('Q/Space', '#33ff33');
    this.labelSpace.position.set(0, 0.85, 0);
    this.labelSpace.layers.set(1);
    this.playerGroup.add(this.labelSpace);

    this.labelShift = this.createLabelSprite('E/Shift', '#33ff33');
    this.labelShift.position.set(0, -0.85, 0);
    this.labelShift.layers.set(1);
    this.playerGroup.add(this.labelShift);

    this.labelS = this.createLabelSprite('S', '#3333ff');
    this.labelS.position.set(0, 0, 0.85);
    this.labelS.layers.set(1);
    this.playerGroup.add(this.labelS);

    this.labelW = this.createLabelSprite('W', '#3333ff');
    this.labelW.position.set(0, 0, -0.85);
    this.labelW.layers.set(1);
    this.playerGroup.add(this.labelW);

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
    this.exitLight.layers.enable(1);
    this.exitLight.layers.enable(2);
    this.exitLight.position.copy(this.exitMesh.position);
    this.scene.add(this.exitLight);

    // Update Player position in scene space
    this.updatePlayerMeshPosition();
  }

  updatePlayerMeshPosition() {
    // Deprecated since positions are updated smoothly in animate(), 
    // but kept for compatibility.
    const px = this.playerPos.x + this.ox;
    const py = this.playerPos.y + this.oy;
    const pz = this.playerPos.z + this.oz;

    if (this.playerGroup) {
      this.playerGroup.position.set(px, py, pz);
    }
  }

  setPlayerPosition(x, y, z) {
    this.playerPos = { x, y, z };
    this.exploredCells.add(`${x},${y},${z}`);

    // If starting a new game or resetting, snap animated position immediately
    if (x === 0 && y === 0 && z === 0) {
      this.playerAnimatedPos.set(this.ox, this.oy, this.oz);
      if (this.playerGroup) {
        this.playerGroup.position.copy(this.playerAnimatedPos);
      }
    }

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

    // FPV Geometry Arrays (Full unsliced maze walls for FPV camera)
    const fpvPositions = [];
    const fpvNormals = [];
    const fpvIndices = [];
    const fpvLinePositions = [];

    // Active Slice Geometry Arrays (Sliced walls for Minimap camera)
    const activePositions = [];
    const activeNormals = [];
    const activeIndices = [];
    const activeLinePositions = [];

    // Ghost Geometry Arrays (Sliced ghost walls for Minimap camera)
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

          // Get target arrays for sliced minimap
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
            const quad = [
              [sx + 0.5, sy - 0.5, sz - 0.5],
              [sx + 0.5, sy + 0.5, sz - 0.5],
              [sx + 0.5, sy + 0.5, sz + 0.5],
              [sx + 0.5, sy - 0.5, sz + 0.5],
              [1, 0, 0]
            ];
            pushQuad(fpvPositions, fpvNormals, fpvIndices, fpvLinePositions, ...quad);
            pushQuad(pos, norm, idx, line, ...quad);
          }
          // -X Wall
          if (x === 0 && cell.walls.nx) {
            const quad = [
              [sx - 0.5, sy - 0.5, sz - 0.5],
              [sx - 0.5, sy - 0.5, sz + 0.5],
              [sx - 0.5, sy + 0.5, sz + 0.5],
              [sx - 0.5, sy + 0.5, sz - 0.5],
              [-1, 0, 0]
            ];
            pushQuad(fpvPositions, fpvNormals, fpvIndices, fpvLinePositions, ...quad);
            pushQuad(pos, norm, idx, line, ...quad);
          }

          // +Y Wall
          if (cell.walls.py) {
            const quad = [
              [sx - 0.5, sy + 0.5, sz - 0.5],
              [sx - 0.5, sy + 0.5, sz + 0.5],
              [sx + 0.5, sy + 0.5, sz + 0.5],
              [sx + 0.5, sy + 0.5, sz - 0.5],
              [0, 1, 0]
            ];
            pushQuad(fpvPositions, fpvNormals, fpvIndices, fpvLinePositions, ...quad);
            pushQuad(pos, norm, idx, line, ...quad);
          }
          // -Y Wall
          if (y === 0 && cell.walls.ny) {
            const quad = [
              [sx - 0.5, sy - 0.5, sz - 0.5],
              [sx + 0.5, sy - 0.5, sz - 0.5],
              [sx + 0.5, sy - 0.5, sz + 0.5],
              [sx - 0.5, sy - 0.5, sz + 0.5],
              [0, -1, 0]
            ];
            pushQuad(fpvPositions, fpvNormals, fpvIndices, fpvLinePositions, ...quad);
            pushQuad(pos, norm, idx, line, ...quad);
          }

          // +Z Wall
          if (cell.walls.pz) {
            const quad = [
              [sx - 0.5, sy - 0.5, sz + 0.5],
              [sx + 0.5, sy - 0.5, sz + 0.5],
              [sx + 0.5, sy + 0.5, sz + 0.5],
              [sx - 0.5, sy + 0.5, sz + 0.5],
              [0, 0, 1]
            ];
            pushQuad(fpvPositions, fpvNormals, fpvIndices, fpvLinePositions, ...quad);
            pushQuad(pos, norm, idx, line, ...quad);
          }
          // -Z Wall
          if (z === 0 && cell.walls.nz) {
            const quad = [
              [sx - 0.5, sy - 0.5, sz - 0.5],
              [sx - 0.5, sy + 0.5, sz - 0.5],
              [sx + 0.5, sy + 0.5, sz - 0.5],
              [sx + 0.5, sy - 0.5, sz - 0.5],
              [0, 0, -1]
            ];
            pushQuad(fpvPositions, fpvNormals, fpvIndices, fpvLinePositions, ...quad);
            pushQuad(pos, norm, idx, line, ...quad);
          }
        }
      }
    }

    // 1. Render Full Walls for FPV camera (Layer 2)
    // Uses MeshStandardMaterial with high metallic reflections and player PointLight support for depth shading
    this.updateMeshObject('fpvWallMesh', fpvPositions, fpvNormals, fpvIndices, 
      new THREE.MeshStandardMaterial({
        color: 0x091c4a,
        emissive: 0x030f30, // Deep base self-illumination
        roughness: 0.3,
        metalness: 0.8,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.65
      }),
      2
    );

    this.updateLineObject('fpvWallBorderMesh', fpvLinePositions, 
      new THREE.LineBasicMaterial({
        color: 0x00ffff,
        transparent: true,
        opacity: 0.85
      }),
      2
    );

    // 2. Render Sliced Walls for Minimap camera (Layer 1)
    // Uses self-luminous MeshBasicMaterial to stay crystal clear regardless of lighting
    this.updateMeshObject('wallMesh', activePositions, activeNormals, activeIndices, 
      new THREE.MeshBasicMaterial({
        color: 0x0088ff,
        transparent: true,
        opacity: 0.6,
        side: THREE.DoubleSide,
        depthWrite: true
      }),
      1
    );

    this.updateLineObject('wallBorderMesh', activeLinePositions, 
      new THREE.LineBasicMaterial({
        color: 0x00ffff,
        transparent: true,
        opacity: 1.0
      }),
      1
    );

    // 3. Render Ghost background walls for Minimap (Layer 1)
    this.updateMeshObject('ghostMesh', ghostPositions, ghostNormals, ghostIndices, 
      new THREE.MeshBasicMaterial({
        color: 0x081530,
        transparent: true,
        opacity: this.xRayOpacity,
        side: THREE.DoubleSide,
        depthWrite: false
      }),
      1
    );

    this.updateLineObject('ghostBorderMesh', ghostLinePositions, 
      new THREE.LineBasicMaterial({
        color: 0x00ffff,
        transparent: true,
        opacity: this.xRayOpacity * 0.8,
        depthWrite: false
      }),
      1
    );
  }

  updateMeshObject(propName, pos, norm, idx, material, layer = 0) {
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
    this[propName].layers.set(layer);
    this.scene.add(this[propName]);
  }

  updateLineObject(propName, pos, material, layer = 0) {
    if (this[propName]) {
      this.scene.remove(this[propName]);
      this[propName].geometry.dispose();
      this[propName] = null;
    }

    if (pos.length === 0) return;

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));

    this[propName] = new THREE.LineSegments(geo, material);
    this[propName].layers.set(layer);
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

  // Create camera-facing floating text labels using Canvas sprite texture (High Res & Sharp)
  createLabelSprite(text, color) {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');

    // Rounded rectangle background
    ctx.fillStyle = 'rgba(10, 10, 20, 0.85)';
    ctx.strokeStyle = color;
    ctx.lineWidth = 4;

    const x = 4, y = 4, w = 248, h = 56, r = 12;
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Draw text centered (large and crisp!)
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 28px Monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 128, 32);

    const texture = new THREE.CanvasTexture(canvas);
    const material = new THREE.SpriteMaterial({ 
      map: texture, 
      transparent: true,
      depthTest: false, // Ensure label is drawn on top of walls
      depthWrite: false 
    });
    const sprite = new THREE.Sprite(material);
    sprite.scale.set(0.6, 0.15, 1);
    return sprite;
  }

  // Get camera-relative grid direction vectors for FPV keyboard controls
  getMovementDirections() {
    if (!this.fpCamera) {
      return {
        forward: { dx: 0, dy: 0, dz: -1 },
        backward: { dx: 0, dy: 0, dz: 1 },
        left: { dx: -1, dy: 0, dz: 0 },
        right: { dx: 1, dy: 0, dz: 0 }
      };
    }

    const dir = new THREE.Vector3();
    this.fpCamera.getWorldDirection(dir);
    
    // Horizontal forward vector (ignore Y components)
    const forward = new THREE.Vector3(dir.x, 0, dir.z).normalize();
    
    // Determine closest horizontal axis
    let fdx = 0;
    let fdz = 0;
    
    if (Math.abs(forward.x) > Math.abs(forward.z)) {
      fdx = Math.sign(forward.x);
    } else {
      fdz = Math.sign(forward.z);
    }
    
    // Right side vector (rotated 90 degrees clockwise around Y-axis)
    const rdx = -fdz;
    const rdz = fdx;
    
    return {
      forward: { dx: fdx, dy: 0, dz: fdz },
      backward: { dx: -fdx, dy: 0, dz: -fdz },
      right: { dx: rdx, dy: 0, dz: rdz },
      left: { dx: -rdx, dy: 0, dz: -rdz }
    };
  }

  animate() {
    requestAnimationFrame(this.animate.bind(this));

    const time = Date.now() * 0.003;

    // 1. Smoothly interpolate player position for first-person and minimap view tracking
    if (this.maze && this.playerAnimatedPos) {
      const tx = this.playerPos.x + this.ox;
      const ty = this.playerPos.y + this.oy;
      const tz = this.playerPos.z + this.oz;
      
      this.playerAnimatedPos.x += (tx - this.playerAnimatedPos.x) * 0.16;
      this.playerAnimatedPos.y += (ty - this.playerAnimatedPos.y) * 0.16;
      this.playerAnimatedPos.z += (tz - this.playerAnimatedPos.z) * 0.16;
      
      if (this.playerGroup) {
        this.playerGroup.position.copy(this.playerAnimatedPos);
      }
      
      if (this.fpCamera) {
        this.fpCamera.position.copy(this.playerAnimatedPos);
      }
      
      // Update Orbit overview target to center on player and follow
      if (this.controls) {
        const delta = new THREE.Vector3().copy(this.playerAnimatedPos).sub(this.controls.target);
        this.camera.position.add(delta);
        this.controls.target.copy(this.playerAnimatedPos);
      }
    }

    // 2. Rotate player octahedron body for dynamic visual effect
    if (this.playerMesh) {
      this.playerMesh.rotation.x += 0.01;
      this.playerMesh.rotation.y += 0.015;
    }

    // Update orbit controls
    if (this.controls) this.controls.update();

    // Pulse effects for exits, point lights
    if (this.exitMesh) {
      const scale = 1 + Math.sin(time) * 0.08;
      this.exitMesh.scale.set(scale, scale, scale);
    }
    if (this.exitLight) {
      this.exitLight.intensity = 2 + Math.sin(time * 1.5) * 0.5;
    }
    if (this.playerLight) {
      this.playerLight.intensity = 1.8 + Math.cos(time * 2) * 0.25;
    }

    // 3. Render dual views (Main FPV + Picture-in-Picture Minimap)
    if (this.renderer && this.scene) {
      const width = this.container.clientWidth;
      const height = this.container.clientHeight;

      this.renderer.setSize(width, height, false);

      // --- Viewport 1: First Person View (Main screen) ---
      this.scene.fog = this.fogExp; // Enable depth fog for First-Person immersion
      
      this.renderer.setViewport(0, 0, width, height);
      this.renderer.setScissor(0, 0, width, height);
      this.renderer.setScissorTest(false);
      this.renderer.clear(); // Clear whole canvas color & depth

      // Hide player model body during FPV render so camera isn't inside it
      if (this.playerMesh) this.playerMesh.visible = false;

      this.renderer.render(this.scene, this.fpCamera);

      // --- Viewport 2: Orbit Overview View (Auxiliary PiP minimap) ---
      this.scene.fog = null; // Temporarily disable scene fog so 3D minimap renders crystal clear!

      const pipWidth = 240;
      const pipHeight = 180;
      const pipX = width - pipWidth - 20;
      const pipY = 20;

      this.renderer.setViewport(pipX, pipY, pipWidth, pipHeight);
      this.renderer.setScissor(pipX, pipY, pipWidth, pipHeight);
      this.renderer.setScissorTest(true);
      
      this.renderer.clearDepth(); // Clear depth buffer so PiP draws correctly

      // Show player body in Orbit Overview PiP render
      if (this.playerMesh) this.playerMesh.visible = true;

      this.renderer.render(this.scene, this.camera);
    }
  }
}
