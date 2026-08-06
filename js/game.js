/**
 * SEILTÄNZERIN 3D - High Wire Balancing Game Engine
 * Powered by Three.js (WebGL), FBXLoader & Web Audio API
 */

// Game States
const GAME_STATE = {
  START: 'START',
  PLAYING: 'PLAYING',
  PAUSED: 'PAUSED',
  FALLING: 'FALLING',
  GAMEOVER: 'GAMEOVER'
};

class SeiltanzerGame {
  constructor() {
    this.state = GAME_STATE.START;
    this.isLoadingRequested = false;
    
    // Core Parameters
    this.distance = 0;
    this.score = 0;
    this.highScore = parseInt(localStorage.getItem('seiltanzer_highscore') || '0', 10);
    this.tricksCount = 0;
    this.comboCount = 0;
    this.landingAbsorptionTimer = 0;
    this.currentWalkZ_L = 0.25;
    this.currentWalkZ_R = -0.25;
    this.smoothedWindForce = 0;
    
    // Physics & Balance
    this.balance = 0; // -1.0 (left fall) to +1.0 (right fall)
    this.balanceVelocity = 0;
    this.targetTiltInput = 0;
    this.filteredTiltInput = 0;
    this.smoothedBalance = 0;
    this.smoothedTiltInput = 0;
    
    // Gyro / Sensor Calibration
    this.calibrationGamma = 0;
    this.rawGamma = 0;
    this.gyroActive = false;
    this.gyroBound = false;
    this.lastRawGamma = 0;
    this.gyroSpeed = 0;
    
    // Player Motion
    this.forwardSpeed = 4.2; // units per sec
    this.isJumping = false;
    this.jumpY = 0;
    this.jumpVY = 0;
    this.gravity = -18;
    this.jumpPower = 6.5;
    this.inAirTrick = null;
    this.isSquatting = false;
    this.squatTimer = 0;
    this.isAnticipatingJump = false;
    this.jumpAnticipationTimer = 0;
    
    // Step Animation (Procedural IK)
    this.walkCycle = 0;
    this.leftFootWireZ = 0.25;
    this.rightFootWireZ = -0.25;
    this.stepTimer = 0;
    this.stanceLeg = 'right';
    this.swingStartWireZ = 0.25;
    this.swingTargetWireZ = -0.45;
    
    // Audio Engine
    this.audioCtx = null;
    this.audioInitialized = false;
    this.windSoundGain = null;

    // DOM Elements
    this.initDOM();
    
    // Setup Three.js Scene
    this.initThree();
    
    // Explicitly hide canvas-container on startup
    const canvasContainer = document.getElementById('canvas-container');
    if (canvasContainer) canvasContainer.style.display = 'none';
    
    // Build 3D World & Load Megan 3D Character Model
    this.buildWorld();
    this.buildCharacter();
    
    // Input Event Listeners
    this.initInputs();
    
    // Animation Loop
    this.clock = new THREE.Clock();
    
    this.onWindowResize();

    requestAnimationFrame((t) => this.animate(t));
  }

  /* -------------------------------------------------- */
  /* DOM INITIALIZATION                                 */
  /* -------------------------------------------------- */
  initDOM() {
    this.dom = {
      gameUi: document.getElementById('game-ui'),
      valDistance: document.getElementById('val-distance'),
      valScore: document.getElementById('val-score'),
      balanceNeedle: document.getElementById('balance-needle'),
      balanceTrack: document.getElementById('balance-track'),
      comboBanner: document.getElementById('combo-banner'),
      trickName: document.getElementById('trick-name'),
      trickPoints: document.getElementById('trick-points'),
      windIndicator: document.getElementById('wind-indicator'),
      windArrow: document.getElementById('wind-arrow'),
      windText: document.getElementById('wind-text'),
      sensorBanner: document.getElementById('sensor-banner'),
      btnEnableSensor: document.getElementById('btn-enable-sensor'),
      btnCalibrate: document.getElementById('btn-calibrate'),
      startModal: document.getElementById('start-modal'),
      gameoverModal: document.getElementById('gameover-modal'),
      btnStart: document.getElementById('btn-start'),
      btnRestart: document.getElementById('btn-restart'),
      statDist: document.getElementById('stat-dist'),
      statTricks: document.getElementById('stat-tricks'),
      statScore: document.getElementById('stat-score'),
      statHigh: document.getElementById('stat-high'),
      fallReason: document.getElementById('fall-reason'),
      btnJump: document.getElementById('btn-jump'),
      btnTrick: document.getElementById('btn-trick'),
      btnLeft: document.getElementById('btn-left'),
      btnRight: document.getElementById('btn-right'),
      // Highscore UI
      playerNameInput: document.getElementById('player-name-input'),
      btnSubmitScore: document.getElementById('btn-submit-score'),
      scoreStatus: document.getElementById('score-status'),
      nameEntrySection: document.getElementById('name-entry-section'),
      gameoverLeaderboard: document.getElementById('gameover-leaderboard'),
      gameoverLbList: document.getElementById('gameover-lb-list'),
      startLbList: document.getElementById('start-lb-list'),
      btnPause: document.getElementById('btn-pause'),
      pauseModal: document.getElementById('pause-modal'),
      btnResume: document.getElementById('btn-resume'),
      btnToggleMusic: document.getElementById('btn-toggle-music'),
      btnToggleSFX: document.getElementById('btn-toggle-sfx'),
      btnPauseHome: document.getElementById('btn-pause-home'),
      btnAction: document.getElementById('btn-action'),
      btnActionLabel: document.getElementById('btn-action-label'),
      loadingOverlay: document.getElementById('loading-overlay'),
      modelLoader: document.getElementById('model-loader'),
      loaderStatus: document.getElementById('loader-status'),
      loaderPercent: document.getElementById('loader-percent'),
      loaderBarFill: document.getElementById('loader-bar-fill'),
      nameModal: document.getElementById('name-modal'),
      usernameInput: document.getElementById('username-input'),
      btnSubmitName: document.getElementById('btn-submit-name')
    };

    this.musicEnabled = true;
    this.sfxEnabled = true;
    this.clickCount = 0;
    this.clickTimer = null;
    this.isModelLoaded = false;
    this.isLoadingRequested = false;

    // Police chase under-cloud variables
    this.policeActive = false;
    this.policeTimer = 10.0 + Math.random() * 10.0;
    this.policeZ = 0;
    this.policeSpeed = 0;
    this.policeX = 0;
    this.sirenTime = 0;
 
    this.initMusic();

    // Load the global leaderboard on the start screen
    this._loadStartLeaderboard();
  }

  initMusic() {
    try {
      this.bgMusic = new Audio('assets/tanzer.mp3');
      this.bgMusic.loop = true;
      this.bgMusic.volume = 0.40;
    } catch(err) {
      console.warn('Audio init warning:', err);
    }
    try {
      this.fallSound = new Audio('assets/fall.mp3');
      this.fallSound.volume = 0.85;
    } catch(err) {
      console.warn('Fall audio init warning:', err);
    }
    try {
      this.policeSound = new Audio('assets/police.m4a');
      this.policeSound.loop = false;
      this.policeSound.volume = 0.0;
    } catch(err) {
      console.warn('Police audio init warning:', err);
    }
  }

  playMusic() {
    if (this.bgMusic && this.musicEnabled) {
      this.bgMusic.currentTime = this.bgMusic.currentTime || 0;
      const promise = this.bgMusic.play();
      if (promise !== undefined) {
        promise.catch(err => {
          console.warn('Autoplay waiting for user gesture:', err);
        });
      }
    }
  }

  pauseGame() {
    if (this.state !== GAME_STATE.PLAYING) return;
    this.state = GAME_STATE.PAUSED;
    if (this.bgMusic) this.bgMusic.pause();
    if (this.policeSound) this.policeSound.pause();
    if (this.windSoundGain) {
      this.windSoundGain.gain.value = 0;
    }
    if (this.dom.pauseModal) {
      this.dom.pauseModal.classList.remove('hidden');
      this.dom.pauseModal.style.display = 'flex';
    }
  }

  resumeGame() {
    if (this.state !== GAME_STATE.PAUSED) return;
    this.state = GAME_STATE.PLAYING;
    if (this.musicEnabled) this.playMusic();
    if (this.dom.pauseModal) {
      this.dom.pauseModal.classList.add('hidden');
      this.dom.pauseModal.style.display = 'none';
    }
  }

  toggleMusic() {
    this.musicEnabled = !this.musicEnabled;
    if (this.musicEnabled) {
      if (this.state === GAME_STATE.PLAYING) this.playMusic();
      if (this.dom.btnToggleMusic) this.dom.btnToggleMusic.innerHTML = '🔊 Musik: An';
      this.showToast('🔊 Musik eingeschaltet');
    } else {
      if (this.bgMusic) this.bgMusic.pause();
      if (this.dom.btnToggleMusic) this.dom.btnToggleMusic.innerHTML = '🔇 Musik: Aus';
      this.showToast('🔇 Musik stummgeschaltet');
    }
  }

  toggleSFX() {
    this.sfxEnabled = !this.sfxEnabled;
    if (this.sfxEnabled) {
      if (this.dom.btnToggleSFX) this.dom.btnToggleSFX.innerHTML = '🔊 SFX: An';
      this.showToast('🔊 Soundeffekte eingeschaltet');
    } else {
      if (this.dom.btnToggleSFX) this.dom.btnToggleSFX.innerHTML = '🔇 SFX: Aus';
      this.showToast('🔇 Soundeffekte stummgeschaltet');
    }
  }

  stopMusic() {
    if (this.bgMusic) {
      this.bgMusic.pause();
      this.bgMusic.currentTime = 0;
    }
    if (this.policeSound) {
      this.policeSound.pause();
      this.policeSound.currentTime = 0;
    }
  }

  returnToHome() {
    this.state = GAME_STATE.START;
    this.isLoadingRequested = false;
    this.stopMusic();
    if (this.windSoundGain) {
      this.windSoundGain.gain.value = 0;
    }
    // Hide the 3D canvas – start screen shows the preview image instead
    const canvasContainer = document.getElementById('canvas-container');
    if (canvasContainer) canvasContainer.style.display = 'none';
    // Brief guard: prevent the same touch that opened Home from immediately starting a new game
    this.homeClickGuard = true;
    setTimeout(() => { this.homeClickGuard = false; }, 600);
    // Hide gameplay UI HUD
    if (this.dom.gameUi) {
      this.dom.gameUi.classList.add('hidden');
    }

    if (this.dom.startModal) {
      this.dom.startModal.classList.remove('hidden');
      this.dom.startModal.style.display = 'flex';
    }
    if (this.dom.pauseModal) {
      this.dom.pauseModal.classList.add('hidden');
      this.dom.pauseModal.style.display = 'none';
    }
    if (this.dom.gameoverModal) {
      this.dom.gameoverModal.classList.add('hidden');
      this.dom.gameoverModal.style.display = 'none';
    }
    this.distance = 0;
    this.score = 0;
    this.balance = 0;
    this.balanceVelocity = 0;
    this.smoothedBalance = 0;
    this.smoothedTiltInput = 0;
    this.isJumping = false;
    this.isAnticipatingJump = false;
    this.jumpAnticipationTimer = 0;
    this.landingAbsorptionTimer = 0;
    this.currentWalkZ_L = 0.25;
    this.currentWalkZ_R = -0.25;
    this.smoothedWindForce = 0;
    this.policeActive = false;
    this.policeTimer = 10.0 + Math.random() * 10.0;
    if (this.policeGroup) this.policeGroup.visible = false;
    if (this.dom.valDistance) this.dom.valDistance.textContent = '0 m';
    if (this.dom.valScore) this.dom.valScore.textContent = '0';
    if (this.dom.balanceNeedle) this.dom.balanceNeedle.style.left = '50%';

    // Reset character model position and pose for start screen showcase
    this.characterGroup.position.set(0, 0, 0);
    this.hipsGroup.position.set(0, 0, 0);
    this.spineGroup.rotation.set(0, 0, 0);
    this.airGroup.rotation.set(0, 0, 0);
    this.armsGroup.rotation.set(0, 0, 0);
    this.airGroup.position.y = 0;

    if (this.femaleModel) {
      this.femaleModel.rotation.set(0, Math.PI, 0);
      if (this.femaleModelInitPos) {
        this.femaleModel.position.copy(this.femaleModelInitPos);
      }
    }

    // Reset bone orientations
    [this.leftUpLegBone, this.rightUpLegBone, this.leftLegBone, this.rightLegBone, this.spine1Bone, this.spine2Bone,
     this.leftArmBone, this.rightArmBone, this.leftForeArmBone, this.rightForeArmBone, this.leftFootBone, this.rightFootBone].forEach(b => {
      if (b && b.userData.initQ) {
        b.quaternion.copy(b.userData.initQ);
      }
    });

    if (this.worldGroup) {
      this.worldGroup.position.set(0, 0, 0);
    }

    // Front showcase view (centered on mobile, offset on desktop)
    if (this.camera) {
      const isMobile = window.innerWidth < 768;
      if (isMobile) {
        // Shift the camera target downward so the gymnast sits perfectly in the top half of the screen on mobile
        this.camera.position.set(0, 1.10, -2.1);
        this.camera.lookAt(0, 0.82, 0);
      } else {
        // Offset camera to the right on desktop so the gymnast stands to the right of the menu
        this.camera.position.set(0.8, 1.35, -2.0);
        this.camera.lookAt(0.2, 1.15, 0);
      }
    }

    this.onWindowResize();
  }

  /* -------------------------------------------------- */
  /* THREE.JS SCENE SETUP                               */
  /* -------------------------------------------------- */
  initThree() {
    const canvas = document.getElementById('game-canvas');

    this.scene = new THREE.Scene();
    
    // 3. ATMOSPHÄRE & TIEFE: Mystischer Dämmerungs-Himmel & Soft-Nebel
    const bgMystic = new THREE.Color(0x16132d);
    this.scene.background = bgMystic;
    this.scene.fog = new THREE.FogExp2(0x16132d, 0.0075);

    // Camera setup (3rd Person View behind character at Z=0)
    this.camera = new THREE.PerspectiveCamera(
      65,
      window.innerWidth / window.innerHeight,
      0.5,
      1000
    );
    // Start page view: camera in front, looking at model's face/body (centered on mobile, offset on desktop)
    const isMobile = window.innerWidth < 768;
    if (isMobile) {
      // Shift the camera target downward so the gymnast sits perfectly in the top half of the screen on mobile
      this.camera.position.set(0, 1.10, -2.1);
      this.camera.lookAt(0, 0.82, 0);
    } else {
      // Offset camera to the right on desktop so the gymnast stands to the right of the menu
      this.camera.position.set(1.4, 1.35, -2.35);
      this.camera.lookAt(-0.15, 0.95, 0);
    }

    // 1. BELEUCHTUNG & SCHATTEN: High-Visibility Character Lighting
    this.renderer = new THREE.WebGLRenderer({
      canvas: canvas,
      antialias: true,
      powerPreference: "high-performance",
      logarithmicDepthBuffer: true
    });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    // 1. BELEUCHTUNG & SCHATTEN ERZWINGEN (MeshStandardMaterial & Soft Shadows)
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.85);
    this.scene.add(ambientLight);

    const hemiLight = new THREE.HemisphereLight(0x7c9cff, 0x221338, 0.95);
    hemiLight.position.set(0, 50, 0);
    this.scene.add(hemiLight);

    // Main Golden Celestial DirectionalLight with Soft Shadow Maps
    const mainSunLight = new THREE.DirectionalLight(0xffe6a3, 1.25);
    mainSunLight.position.set(25, 45, 20);
    mainSunLight.castShadow = true;
    mainSunLight.shadow.mapSize.width = 2048;
    mainSunLight.shadow.mapSize.height = 2048;
    mainSunLight.shadow.bias = -0.0001;
    mainSunLight.shadow.camera.near = 0.5;
    mainSunLight.shadow.camera.far = 180;
    mainSunLight.shadow.camera.left = -30;
    mainSunLight.shadow.camera.right = 30;
    mainSunLight.shadow.camera.top = 30;
    mainSunLight.shadow.camera.bottom = -30;
    this.scene.add(mainSunLight);

    // Mystical Cyan Rim Light for sci-fi contours
    const mysticRim = new THREE.DirectionalLight(0x00f2fe, 0.75);
    mysticRim.position.set(-20, 15, -20);
    this.scene.add(mysticRim);



    // 2. POST-PROCESSING (UnrealBloomPass / Glow)
    if (typeof THREE.EffectComposer !== 'undefined' && typeof THREE.UnrealBloomPass !== 'undefined') {
      this.composer = new THREE.EffectComposer(this.renderer);
      const renderPass = new THREE.RenderPass(this.scene, this.camera);
      this.composer.addPass(renderPass);

      const bloomPass = new THREE.UnrealBloomPass(
        new THREE.Vector2(window.innerWidth, window.innerHeight),
        0.38, // Mystical bloom glow strength
        0.45, // radius
        0.88  // High threshold so neon rings & crystals glow brightly
      );
      this.composer.addPass(bloomPass);
    }

    window.addEventListener('resize', () => this.onWindowResize());
  }

  onWindowResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    if (this.composer) {
      this.composer.setSize(window.innerWidth, window.innerHeight);
    }
  }

  /* -------------------------------------------------- */
  /* BUILD WORLD & ENVIRONMENT                          */
  /* -------------------------------------------------- */
  buildWorld() {
    this.worldGroup = new THREE.Group();
    this.scene.add(this.worldGroup);

    // Add a beautifully glowing full moon in the sky (high up, off to the right, far away)
    const moonGroup = new THREE.Group();
    moonGroup.position.set(70, 110, -450);
    this.scene.add(moonGroup);

    // Moon sphere mesh
    const moonGeo = new THREE.SphereGeometry(7, 32, 32);
    const moonMat = new THREE.MeshBasicMaterial({ color: 0xfffef0, fog: false });
    const moon = new THREE.Mesh(moonGeo, moonMat);
    moonGroup.add(moon);

    // Glowing halo behind the moon
    const moonHaloTexture = this.createMoonHaloTexture();
    const haloGeo = new THREE.PlaneGeometry(45, 45);
    const haloMat = new THREE.MeshBasicMaterial({
      map: moonHaloTexture,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      fog: false
    });
    const halo = new THREE.Mesh(haloGeo, haloMat);
    halo.position.set(0, 0, -1); // Slightly behind the sphere
    moonGroup.add(halo);

    // Add starry night sky matching the moon
    this.buildStars();

    // 1. Tightrope Wire with Realistic Twisted Steel Cable Texture Pattern
    const textureLoader = new THREE.TextureLoader();
    const ropeTexture = textureLoader.load('assets/rope_texture.png');
    ropeTexture.wrapS = THREE.RepeatWrapping;
    ropeTexture.wrapT = THREE.RepeatWrapping;
    ropeTexture.repeat.set(4, 500);

    const ropeGeo = new THREE.CylinderGeometry(0.040, 0.040, 1000, 16);
    ropeGeo.rotateX(Math.PI / 2);
    const ropeMat = new THREE.MeshStandardMaterial({
      map: ropeTexture,
      bumpMap: ropeTexture,
      bumpScale: 0.08,
      metalness: 0.88,
      roughness: 0.30,
      color: 0xdddddd
    });
    this.ropeMesh = new THREE.Mesh(ropeGeo, ropeMat);
    this.ropeMesh.position.set(0, 0, -450);
    this.worldGroup.add(this.ropeMesh);

    // Dynamic Rope Support Rings
    this.ropeRings = [];
    const ringGeo = new THREE.TorusGeometry(0.055, 0.015, 8, 16);
    const ringMat = new THREE.MeshStandardMaterial({
      color: 0xff007f,
      emissive: 0xff007f,
      emissiveIntensity: 1.2,
      roughness: 0.2,
      metalness: 0.8
    });
    for (let i = 0; i < 40; i++) {
      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.position.set(0, 0, -i * 15);
      this.worldGroup.add(ring);
      this.ropeRings.push(ring);
    }


    // 2. Skyscrapers in Distance
    this.buildBuildings();

    // 3. Clouds & Wind Particles
    this.buildParticles();
    this.buildClouds();
  }

  createBuildingMaterials() {
    this.buildingMaterials = [];

    // Create 3 styles of procedural skyscraper textures with pre-defined repeat scales
    for (let style = 0; style < 3; style++) {
      const canvas = document.createElement('canvas');
      canvas.width = 128;
      canvas.height = 256;
      const ctx = canvas.getContext('2d');

      const emissiveCanvas = document.createElement('canvas');
      emissiveCanvas.width = 128;
      emissiveCanvas.height = 256;
      const eCtx = emissiveCanvas.getContext('2d');

      // Base building dark background
      ctx.fillStyle = '#0d111c';
      ctx.fillRect(0, 0, 128, 256);
      eCtx.fillStyle = '#000000';
      eCtx.fillRect(0, 0, 128, 256);

      if (style === 0) {
        // STYLE 0: Grid windows (larger blocks for standard repeat)
        const rows = 16;
        const cols = 4;
        const wWidth = 18;
        const wHeight = 10;
        const padX = 10;
        const padY = 5;

        for (let r = 0; r < rows; r++) {
          for (let c = 0; c < cols; c++) {
            const rand = Math.random();
            const x = c * (wWidth + padX) + padX;
            const y = r * (wHeight + padY) + padY;
            if (rand < 0.28) {
              const color = Math.random() > 0.4 ? '#ffe58f' : '#00f2fe';
              ctx.fillStyle = color;
              ctx.fillRect(x, y, wWidth, wHeight);
              eCtx.fillStyle = color;
              eCtx.fillRect(x, y, wWidth, wHeight);
            } else {
              ctx.fillStyle = '#171e2e';
              ctx.fillRect(x, y, wWidth, wHeight);
            }
          }
        }
      } else if (style === 1) {
        // STYLE 1: Modern horizontal office bands
        const bands = 12;
        const bandHeight = 10;
        const padY = 10;

        for (let b = 0; b < bands; b++) {
          const y = b * (bandHeight + padY) + padY;
          const rand = Math.random();
          if (rand < 0.35) {
            const color = Math.random() > 0.5 ? '#ffd591' : '#ff007f';
            ctx.fillStyle = color;
            ctx.fillRect(4, y, 120, bandHeight);
            eCtx.fillStyle = color;
            eCtx.fillRect(4, y, 120, bandHeight);
          } else {
            ctx.fillStyle = '#1c2438';
            ctx.fillRect(4, y, 120, bandHeight);
          }
        }
      } else {
        // STYLE 2: Art-deco vertical column window segments
        const cols = 4;
        const stripeWidth = 18;
        const padX = 12;

        for (let c = 0; c < cols; c++) {
          const x = c * (stripeWidth + padX) + padX;
          for (let segment = 0; segment < 8; segment++) {
            const y = segment * 30 + 4;
            const rand = Math.random();
            if (rand < 0.25) {
              const color = Math.random() > 0.5 ? '#ffe58f' : '#00f2fe';
              ctx.fillStyle = color;
              ctx.fillRect(x, y, stripeWidth, 22);
              eCtx.fillStyle = color;
              eCtx.fillRect(x, y, stripeWidth, 22);
            } else {
              ctx.fillStyle = '#171d2b';
              ctx.fillRect(x, y, stripeWidth, 22);
            }
          }
        }
      }

      const map = new THREE.CanvasTexture(canvas);
      map.wrapS = THREE.RepeatWrapping;
      map.wrapT = THREE.RepeatWrapping;
      map.repeat.set(3, 8); // Pre-configured repeat to prevent giant windows

      const emissiveMap = new THREE.CanvasTexture(emissiveCanvas);
      emissiveMap.wrapS = THREE.RepeatWrapping;
      emissiveMap.wrapT = THREE.RepeatWrapping;
      emissiveMap.repeat.set(3, 8);

      const mat = new THREE.MeshStandardMaterial({
        map: map,
        emissiveMap: emissiveMap,
        emissive: 0xffffff,
        emissiveIntensity: 0.8,
        roughness: 0.4,
        metalness: 0.2
      });

      this.buildingMaterials.push(mat);
    }
  }

  buildBuildings() {
    this.buildings = [];
    this.antennaLights = [];
    this.createBuildingMaterials();

    const roofMat = new THREE.MeshStandardMaterial({ color: 0x222633, roughness: 0.9 });
    const antennaMat = new THREE.MeshBasicMaterial({ color: 0x333b4d });
    const lightMat = new THREE.MeshBasicMaterial({ color: 0xff0000 });

    for (let i = 0; i < 40; i++) {
      const isLeft = Math.random() > 0.5;
      const x = (isLeft ? -1 : 1) * (15 + Math.random() * 35);
      const z = -i * 20;
      const height = 40 + Math.random() * 80;
      const width = 12 + Math.random() * 16;
      const depth = 12 + Math.random() * 16;

      // Select random facade material (shared globally to prevent crashes)
      const mat = this.buildingMaterials[Math.floor(Math.random() * this.buildingMaterials.length)];

      // Create the geometry with the actual dimensions directly instead of using scale.set().
      // This prevents the scale from being inherited by children meshes (antennas, lights, roofs).
      const buildingGeo = new THREE.BoxGeometry(width, height, depth);
      const building = new THREE.Mesh(buildingGeo, mat);
      building.position.set(x, -height / 2 - 10, z);
      building.castShadow = true;
      building.receiveShadow = true;
      this.worldGroup.add(building);
      this.buildings.push(building);

      // Add a roof slab on top of the main building
      const roofGeo = new THREE.BoxGeometry(width + 0.2, 0.4, depth + 0.2);
      const roof = new THREE.Mesh(roofGeo, roofMat);
      roof.position.set(0, height / 2 + 0.2, 0);
      building.add(roof);

      // 50% chance of stepped second tier (Art-Deco architecture)
      if (Math.random() > 0.5) {
        const tierHeight = height * 0.25;
        const tierWidth = width * 0.7;
        const tierDepth = depth * 0.7;

        const tierGeo = new THREE.BoxGeometry(tierWidth, tierHeight, tierDepth);
        const tierMat = this.buildingMaterials[Math.floor(Math.random() * this.buildingMaterials.length)];
        const tier = new THREE.Mesh(tierGeo, tierMat);
        tier.position.set(0, height / 2 + tierHeight / 2, 0);
        tier.castShadow = true;
        tier.receiveShadow = true;
        building.add(tier);

        // Add a secondary roof for the tier
        const tierRoofGeo = new THREE.BoxGeometry(tierWidth + 0.2, 0.4, tierDepth + 0.2);
        const tierRoof = new THREE.Mesh(tierRoofGeo, roofMat);
        tierRoof.position.set(0, tierHeight / 2 + 0.2, 0);
        tier.add(tierRoof);

        // Add antenna to the top of the tier
        if (Math.random() > 0.3) {
          const antennaGeo = new THREE.CylinderGeometry(0.06, 0.06, 12, 8);
          const antenna = new THREE.Mesh(antennaGeo, antennaMat);
          antenna.position.set(0, tierHeight / 2 + 6, 0);
          tier.add(antenna);

          // Flashing red warning light at top of antenna
          const lightGeo = new THREE.SphereGeometry(0.3, 8, 8);
          const lightMesh = new THREE.Mesh(lightGeo, lightMat);
          lightMesh.position.set(0, 6, 0);
          antenna.add(lightMesh);
          this.antennaLights.push(lightMesh);
        }
      } else {
        // Add antenna to the main building roof
        if (Math.random() > 0.4) {
          const antennaGeo = new THREE.CylinderGeometry(0.06, 0.06, 12, 8);
          const antenna = new THREE.Mesh(antennaGeo, antennaMat);
          antenna.position.set(0, height / 2 + 6, 0);
          building.add(antenna);

          // Flashing red warning light at top of antenna
          const lightGeo = new THREE.SphereGeometry(0.3, 8, 8);
          const lightMesh = new THREE.Mesh(lightGeo, lightMat);
          lightMesh.position.set(0, 6, 0);
          antenna.add(lightMesh);
          this.antennaLights.push(lightMesh);
        }
      }
    }

    // Safety Net Far Below
    const netGeo = new THREE.PlaneGeometry(100, 1000);
    const netMat = new THREE.MeshBasicMaterial({
      color: 0x050916,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.8
    });
    const net = new THREE.Mesh(netGeo, netMat);
    net.rotation.x = Math.PI / 2;
    net.position.set(0, -60, -450);
    this.worldGroup.add(net);
  }

  buildParticles() {
    const particleCount = 150;
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);

    for (let i = 0; i < particleCount * 3; i += 3) {
      positions[i] = (Math.random() - 0.5) * 40;
      positions[i + 1] = (Math.random() - 0.5) * 20 + 5;
      positions[i + 2] = -Math.random() * 200;
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const pMaterial = new THREE.PointsMaterial({
      color: 0x00f2fe,
      size: 0.15,
      transparent: true,
      opacity: 0.6
    });

    this.particles = new THREE.Points(geometry, pMaterial);
    this.worldGroup.add(this.particles);
  }

  buildStars() {
    const starCount = 400;
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(starCount * 3);

    for (let i = 0; i < starCount; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 600;
      positions[i * 3 + 1] = 25 + Math.random() * 140; // High in the night sky
      positions[i * 3 + 2] = -50 - Math.random() * 450; // Scattered background
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const starMat = new THREE.PointsMaterial({
      color: 0xffffff,
      size: 1.4,
      transparent: true,
      opacity: 0.85,
      fog: false
    });

    const stars = new THREE.Points(geometry, starMat);
    this.scene.add(stars);
  }

  createCloudTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');

    // Create a radial gradient for pure white-grey natural fog/clouds (no neon red/blue reflections)
    const grad = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
    grad.addColorStop(0, 'rgba(240, 242, 248, 1.0)');    // Soft white cloud center
    grad.addColorStop(0.3, 'rgba(200, 205, 218, 0.90)');  // Soft cloud grey
    grad.addColorStop(0.7, 'rgba(130, 135, 150, 0.45)');  // Natural mist grey
    grad.addColorStop(1, 'rgba(22, 19, 45, 0.0)');       // Smooth transparent edge
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 256, 256);

    return new THREE.CanvasTexture(canvas);
  }

  createMoonHaloTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');
    const grad = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    grad.addColorStop(0, 'rgba(255, 254, 244, 0.85)');
    grad.addColorStop(0.2, 'rgba(255, 254, 244, 0.45)');
    grad.addColorStop(0.5, 'rgba(255, 230, 180, 0.20)');
    grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 128, 128);
    return new THREE.CanvasTexture(canvas);
  }

  createSirenTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    const grad = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, 'rgba(255, 255, 255, 1.0)');
    grad.addColorStop(0.3, 'rgba(255, 255, 255, 0.8)');
    grad.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 64, 64);
    return new THREE.CanvasTexture(canvas);
  }

  buildClouds() {
    this.clouds = [];
    const cloudTexture = this.createCloudTexture();

    // Create 36 overlapping cloud planes spread vertically to form a realistic fog deck
    // with decreasing transparency downwards (deeper = more opaque)
    for (let i = 0; i < 36; i++) {
      const size = 180 + Math.random() * 80;
      const cloudGeo = new THREE.PlaneGeometry(size, size);

      // Y position between -36 and -51 (top to bottom fog layers)
      const depthRatio = i / 36; // 0 at top, 1 at bottom
      const y = -36 - depthRatio * 15;

      // Lower layers get higher opacity (decreasing transparency downwards for a true fog deck)
      const layerOpacity = 0.65 + depthRatio * 0.35;

      const cloudMat = new THREE.MeshBasicMaterial({
        map: cloudTexture,
        transparent: true,
        opacity: layerOpacity,
        depthWrite: false,
        blending: THREE.NormalBlending
      });

      const cloud = new THREE.Mesh(cloudGeo, cloudMat);
      cloud.rotation.x = -Math.PI / 2;
      cloud.rotation.z = Math.random() * Math.PI * 2;

      // Assign a fixed stable renderOrder to prevent dynamic transparency sorting jitter (z-fighting)
      cloud.renderOrder = 20 + i;

      const x = (Math.random() - 0.5) * 180;
      const z = -i * 22;

      cloud.position.set(x, y, z);

      // Store rotation/sway parameters
      cloud.userData = {
        rotSpeed: (Math.random() - 0.5) * 0.02,
        swayOffset: Math.random() * Math.PI * 2,
        swaySpeed: 0.12 + Math.random() * 0.15
      };

      this.worldGroup.add(cloud);
      this.clouds.push(cloud);
    }

    // Initialize Police Group and siren planes (positioned just inside/below the clouds)
    this.policeGroup = new THREE.Group();
    this.policeGroup.visible = false;
    this.worldGroup.add(this.policeGroup);

    const sirenTexture = this.createSirenTexture();
    const sirenGeo = new THREE.PlaneGeometry(45, 45); // 45 units wide to fit street corridors realistically

    const blueMat = new THREE.MeshBasicMaterial({
      map: sirenTexture,
      color: 0x0055ff,
      transparent: true,
      opacity: 0.0,
      depthTest: true,  // Enforce Z-buffer depth testing against opaque skyscraper walls
      depthWrite: false,
      blending: THREE.AdditiveBlending
    });
    this.policeBlueGlow = new THREE.Mesh(sirenGeo, blueMat);
    this.policeBlueGlow.rotation.x = -Math.PI / 2;
    this.policeBlueGlow.position.set(-3, 0, 0); // blue offset
    this.policeBlueGlow.renderOrder = 15; // Render after opaque buildings (0) but before clouds (20+) for realistic skyscraper occlusion
    this.policeGroup.add(this.policeBlueGlow);

    const redMat = new THREE.MeshBasicMaterial({
      map: sirenTexture,
      color: 0xff0044,
      transparent: true,
      opacity: 0.0,
      depthTest: true,  // Enforce Z-buffer depth testing against opaque skyscraper walls
      depthWrite: false,
      blending: THREE.AdditiveBlending
    });
    this.policeRedGlow = new THREE.Mesh(sirenGeo, redMat);
    this.policeRedGlow.rotation.x = -Math.PI / 2;
    this.policeRedGlow.position.set(3, 0, 0); // red offset
    this.policeRedGlow.renderOrder = 15; // Render after opaque buildings (0) but before clouds (20+) for realistic skyscraper occlusion
    this.policeGroup.add(this.policeRedGlow);
  }

  /* -------------------------------------------------- */
  /* REALISTIC 3D DANCER / TIGHTROPE ATHLETE            */
  /* -------------------------------------------------- */
  buildCharacter() {
    this.characterGroup = new THREE.Group();
    this.scene.add(this.characterGroup);

    this.hipsGroup = new THREE.Group();
    this.characterGroup.add(this.hipsGroup);

    this.spineGroup = new THREE.Group();
    this.hipsGroup.add(this.spineGroup);

    this.airGroup = new THREE.Group();
    this.spineGroup.add(this.airGroup);

    this.armsGroup = new THREE.Group();
    this.armsGroup.position.set(0, 1.45, 0);
    this.airGroup.add(this.armsGroup);

    // Note: GLTF model loads on demand when user presses Start (not on page load)
    // this.loadGLTFCharacter(); -- deferred

    this.characterGroup.position.set(0, 0, 0);
  }

  loadGLTFCharacter() {
    if (this._gltfLoadingStarted) return;
    this._gltfLoadingStarted = true;

    const modelUrl = 'assets/Ch22_nonPBR.glb';
    const expectedSize = 54145493;

    // Check GLTFLoader availability
    if (typeof THREE.GLTFLoader === 'undefined') {
      console.error('❌ THREE.GLTFLoader not available!');
      this.showToast('⚠️ GLTFLoader fehlt – Fallback');
      this.buildProceduralGymnast();
      this._triggerStartSequence();
      return;
    }

    // Safety fallback after 12 seconds
    const fallbackTimer = setTimeout(() => {
      if (!this.femaleModel) {
        console.warn('⚠️ GLB timeout – Fallback-Figur wird verwendet');
        this.showToast('⏱️ Timeout – Fallback-Figur');
        this.buildProceduralGymnast();
        this._triggerStartSequence();
      }
    }, 12000);

    const setup = (gltf) => {
      clearTimeout(fallbackTimer);
      try {
        const model = gltf.scene;
        console.log('✅ GLB geladen, Nodes:', model.children.length);
        model.rotation.set(0, Math.PI, 0);

        model.traverse(child => {
          if (child.isMesh || child.isSkinnedMesh) {
            child.castShadow    = true;
            child.receiveShadow = true;
            child.frustumCulled = false;
            const mats = Array.isArray(child.material) ? child.material : [child.material];
            mats.forEach(m => {
              if (m) {
                m.side = THREE.DoubleSide;
                if (m.roughness !== undefined) m.roughness = 0.65;
                if (m.metalness !== undefined) m.metalness = 0.08;
              }
            });
          }
        });

        this.leftUpLegBone = null;
        this.rightUpLegBone = null;
        this.leftLegBone = null;
        this.rightLegBone = null;
        this.leftFootBone = null;
        this.rightFootBone = null;
        this.spine1Bone = null;
        this.spine2Bone = null;
        this.leftArmBone = null;
        this.rightArmBone = null;
        this.leftForeArmBone = null;
        this.rightForeArmBone = null;
        this.headBone = null;

        const foundBones = [];
        model.traverse(child => {
          const name = child.name.toLowerCase();
          let matched = false;
          if (name.includes('leftupleg')) { this.leftUpLegBone = child; matched = true; }
          else if (name.includes('rightupleg')) { this.rightUpLegBone = child; matched = true; }
          else if (name.includes('leftleg') && !name.includes('up')) { this.leftLegBone = child; matched = true; }
          else if (name.includes('rightleg') && !name.includes('up')) { this.rightLegBone = child; matched = true; }
          else if (name.includes('leftfoot')) { this.leftFootBone = child; matched = true; }
          else if (name.includes('rightfoot')) { this.rightFootBone = child; matched = true; }
          else if (name.includes('leftforearm')) { this.leftForeArmBone = child; matched = true; }
          else if (name.includes('rightforearm')) { this.rightForeArmBone = child; matched = true; }
          else if (name.includes('leftarm') && !name.includes('fore')) { this.leftArmBone = child; matched = true; }
          else if (name.includes('rightarm') && !name.includes('fore')) { this.rightArmBone = child; matched = true; }
          else if (name.includes('spine2')) { this.spine2Bone = child; matched = true; }
          else if (name.includes('spine1') || (name.includes('spine') && !this.spine1Bone)) { this.spine1Bone = child; matched = true; }
          else if (name.includes('head')) { this.headBone = child; matched = true; }

          if (matched) {
            foundBones.push(`${child.name} -> key bone`);
          }

          if (child.isBone || child.type === 'Bone') {
            child.userData.initQ = child.quaternion.clone();
          }
        });

        console.log("🦴 Gefundene Key-Knochen:", foundBones);
        console.log("🦴 Status Knochen:", {
          leftUpLeg: !!this.leftUpLegBone,
          rightUpLeg: !!this.rightUpLegBone,
          leftLeg: !!this.leftLegBone,
          rightLeg: !!this.rightLegBone,
          spine1: !!this.spine1Bone,
          spine2: !!this.spine2Bone,
          leftArm: !!this.leftArmBone,
          rightArm: !!this.rightArmBone,
          leftForeArm: !!this.leftForeArmBone,
          rightForeArm: !!this.rightForeArmBone
        });

        if (!this.leftUpLegBone || !this.rightUpLegBone || !this.leftLegBone || !this.rightLegBone) {
          console.warn("⚠️ Einige Knochen wurden nicht gefunden! Alle Knochen im Modell:");
          model.traverse(child => {
            if (child.isBone || child.type === 'Bone') {
              console.log("  - Bone:", child.name);
            }
          });
        }

        [this.leftUpLegBone, this.rightUpLegBone, this.leftLegBone, this.rightLegBone, this.spine1Bone, this.spine2Bone,
         this.leftArmBone, this.rightArmBone, this.leftForeArmBone, this.rightForeArmBone, this.headBone]
          .forEach(b => { if (b && !b.userData.initQ) b.userData.initQ = b.quaternion.clone(); });

        const box = new THREE.Box3().setFromObject(model);
        const h   = box.getSize(new THREE.Vector3()).y;
        console.log('📐 Modellhöhe (vor Scale):', h.toFixed(3));
        model.scale.setScalar(1.75 / (h || 1));
        box.setFromObject(model);
        const c = box.getCenter(new THREE.Vector3());
        this.femaleModelInitPos = new THREE.Vector3(-c.x, -box.min.y + 0.040, -c.z);
        model.position.copy(this.femaleModelInitPos);

        this.femaleModel = model;
        this.airGroup.add(model);
        this.isModelLoaded = true;
        console.log('✅ 3D-Figur fertig montiert!');
      } catch (e) {
        console.error('❌ Fehler beim Setup der Figur:', e);
        this.showToast('❌ Figur-Fehler: ' + e.message);
        if (!this.femaleModel) this.buildProceduralGymnast();
      }
      this._triggerStartSequence();
    };

    const onProgress = (xhr) => {
      const loaded = xhr.loaded || 0;
      const total  = (xhr.total && xhr.total > 0) ? xhr.total : expectedSize;
      const percent = Math.min(99, Math.round((loaded / total) * 100));
      if (this.dom.loaderPercent) this.dom.loaderPercent.textContent = percent + '%';
      if (this.dom.loaderBarFill) this.dom.loaderBarFill.style.width = percent + '%';
    };

    const onError = (err) => {
      clearTimeout(fallbackTimer);
      console.error('❌ GLB Ladefehler:', err);
      this.showToast('❌ Ladefehler – Fallback-Figur');
      if (!this.femaleModel) this.buildProceduralGymnast();
      this._triggerStartSequence();
    };

    console.log('⏳ Lade Figur:', modelUrl);
    new THREE.GLTFLoader().load(modelUrl, setup, onProgress, onError);
  }

  buildProceduralGymnast() {
    if (this.femaleModel) return;
    const group = new THREE.Group();

    const skinMat  = new THREE.MeshStandardMaterial({ color: 0xe8b88a, roughness: 0.55 });
    const topMat   = new THREE.MeshStandardMaterial({ color: 0xff007f, emissive: 0x550022, roughness: 0.35, metalness: 0.1 });
    const pantsMat = new THREE.MeshStandardMaterial({ color: 0x1a1050, roughness: 0.5 });
    const hairMat  = new THREE.MeshStandardMaterial({ color: 0x1a0a00, roughness: 0.8 });
    const poleMat  = new THREE.MeshStandardMaterial({ color: 0xcccccc, metalness: 0.85, roughness: 0.15, emissive: 0x00f2fe, emissiveIntensity: 0.25 });

    // --- Head & Hair ---
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.115, 16, 16), skinMat);
    head.position.y = 1.50;
    head.castShadow = true;
    group.add(head);

    const hair = new THREE.Mesh(new THREE.SphereGeometry(0.118, 12, 12, 0, Math.PI * 2, 0, Math.PI * 0.55), hairMat);
    hair.position.copy(head.position);
    hair.position.y += 0.01;
    group.add(hair);

    // --- Torso ---
    const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.13, 0.52, 14), topMat);
    torso.position.y = 1.06;
    torso.castShadow = true;
    group.add(torso);

    // --- Hips ---
    const hips = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.12, 0.20, 12), pantsMat);
    hips.position.y = 0.78;
    group.add(hips);

    // --- Legs ---
    const legL = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.038, 0.72, 10), pantsMat);
    legL.position.set(-0.085, 0.38, 0);
    legL.castShadow = true;
    group.add(legL);
    const legR = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.038, 0.72, 10), pantsMat);
    legR.position.set(0.085, 0.38, 0);
    legR.castShadow = true;
    group.add(legR);

    // --- Arms (outstretched for balance) ---
    const armL = new THREE.Mesh(new THREE.CylinderGeometry(0.038, 0.028, 0.52, 8), topMat);
    armL.rotation.z = Math.PI / 2.2;
    armL.position.set(-0.36, 1.18, 0);
    armL.castShadow = true;
    group.add(armL);
    const armR = new THREE.Mesh(new THREE.CylinderGeometry(0.038, 0.028, 0.52, 8), topMat);
    armR.rotation.z = -Math.PI / 2.2;
    armR.position.set(0.36, 1.18, 0);
    armR.castShadow = true;
    group.add(armR);

    // --- Balancing Pole (2.8m wide, held horizontally) ---
    const poleGeo = new THREE.CylinderGeometry(0.018, 0.018, 2.80, 8);
    poleGeo.rotateZ(Math.PI / 2);
    const pole = new THREE.Mesh(poleGeo, poleMat);
    pole.position.set(0, 1.15, 0);
    pole.castShadow = true;
    group.add(pole);

    // Glowing tip spheres on each end of pole
    const tipGeo = new THREE.SphereGeometry(0.035, 8, 8);
    const tipMat = new THREE.MeshStandardMaterial({ color: 0x00f2fe, emissive: 0x00f2fe, emissiveIntensity: 1.5 });
    const tipL = new THREE.Mesh(tipGeo, tipMat);
    tipL.position.set(-1.40, 1.15, 0);
    group.add(tipL);
    const tipR = new THREE.Mesh(tipGeo, tipMat.clone());
    tipR.position.set(1.40, 1.15, 0);
    group.add(tipR);

    // Store tip refs for idle animation
    this.poleTipLeft  = tipL;
    this.poleTipRight = tipR;

    this.femaleModelInitPos = new THREE.Vector3(0, 0, 0);
    this.femaleModel = group;
    this.airGroup.add(group);
    this.isModelLoaded = true;
    console.log('✅ 3D Procedural Gymnast ready!');
  }

  _triggerStartSequence() {
    this.isModelLoaded = true;
    if (this.dom.loaderPercent) this.dom.loaderPercent.textContent = '100%';
    if (this.dom.loaderBarFill) this.dom.loaderBarFill.style.width = '100%';

    if (this.isLoadingRequested) {
      setTimeout(() => {
        if (this.dom.loadingOverlay) {
          this.dom.loadingOverlay.classList.add('hidden');
          this.dom.loadingOverlay.style.display = 'none';
        }
        if (this.state !== GAME_STATE.PLAYING) {
          this.playMusic();
          this.startGame();
        }
      }, 250);
    } else {
      this.onWindowResize();
    }
  }

  _finishLoadingFallback() {
    this.isModelLoaded = true;
    if (this.isLoadingRequested) {
      if (this.dom.loadingOverlay) {
        this.dom.loadingOverlay.classList.add('hidden');
        this.dom.loadingOverlay.style.display = 'none';
      }
      if (this.state !== GAME_STATE.PLAYING) {
        this.playMusic();
        this.startGame();
      }
    }
  }

  /** Safely store bone initial rotations once (idempotent) */
  _initBoneRotations() {
    const bones = [
      this.leftUpLegBone, this.rightUpLegBone, this.leftLegBone, this.rightLegBone,
      this.leftFootBone, this.rightFootBone, this.spine1Bone, this.spine2Bone,
      this.leftArmBone, this.rightArmBone, this.leftForeArmBone, this.rightForeArmBone
    ];
    bones.forEach(b => {
      if (b && !b.userData.initQ) b.userData.initQ = b.quaternion.clone();
    });
  }

  /** Gentle idle breathing & balance sway on start screen */
  updateIdleAnimation(dt) {
    if (!this.femaleModel) return;
    this._initBoneRotations();

    const time = this.clock.getElapsedTime();
    const idleSway = Math.sin(time * 1.8) * 0.06;
    const breath = Math.cos(time * 2.2) * 0.02;

    this.spineGroup.rotation.z = idleSway;
    this.spineGroup.rotation.x = breath;
    this.femaleModel.rotation.z = idleSway * 0.5;

    // Pose legs one in front of the other on the rope centerline (X = 0)
    // We use a fixed phase (0.8) of the walk cycle to create a stable tightrope stance
    const standPhase = 0.8;
    const stepAngle = standPhase * 0.58;

    const inAngleL = 0.11 + Math.max(0, standPhase) * 0.14;
    const inAngleR = -0.11 - Math.max(0, -standPhase) * 0.14;

    const qStep_L = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), stepAngle)
      .multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), -inAngleL));
    const qStep_R = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -stepAngle)
      .multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), -inAngleR));

    if (this.leftUpLegBone) {
      if (!this.leftUpLegBone.userData.initQ) this.leftUpLegBone.userData.initQ = this.leftUpLegBone.quaternion.clone();
      this.leftUpLegBone.quaternion.copy(qStep_L).multiply(this.leftUpLegBone.userData.initQ);
    }
    if (this.rightUpLegBone) {
      if (!this.rightUpLegBone.userData.initQ) this.rightUpLegBone.userData.initQ = this.rightUpLegBone.quaternion.clone();
      this.rightUpLegBone.quaternion.copy(qStep_R).multiply(this.rightUpLegBone.userData.initQ);
    }

    if (this.leftLegBone) {
      if (!this.leftLegBone.userData.initQ) this.leftLegBone.userData.initQ = this.leftLegBone.quaternion.clone();
      const qKneeL = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.max(0, standPhase) * 0.92);
      this.leftLegBone.quaternion.copy(qKneeL).multiply(this.leftLegBone.userData.initQ);
    }
    if (this.rightLegBone) {
      if (!this.rightLegBone.userData.initQ) this.rightLegBone.userData.initQ = this.rightLegBone.quaternion.clone();
      const qKneeR = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.max(0, -standPhase) * 0.92);
      this.rightLegBone.quaternion.copy(qKneeR).multiply(this.rightLegBone.userData.initQ);
    }

    // Adjust hip height to match the standing pose depth
    if (this.hipsGroup) {
      this.hipsGroup.position.y = -Math.abs(standPhase) * 0.05;
    }
  }

  /* -------------------------------------------------- */
  /* INPUT & CONTROLS MANAGER                          */
  /* -------------------------------------------------- */

  initInputs() {
    // 1. Keyboard Controls
    window.addEventListener('keydown', (e) => {
      if (this.state !== GAME_STATE.PLAYING) {
        if ((e.code === 'Space' || e.code === 'Enter') && this.state === GAME_STATE.GAMEOVER) {
          this.requestSensorsAndStart();
        }
        return;
      }
      if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') this.targetTiltInput = -1.0;
      else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') this.targetTiltInput = 1.0;
      else if (e.code === 'Space') this.handleActionClick();
      else if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W' || e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') this.triggerTrick();
    });

    window.addEventListener('keyup', (e) => {
      if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A' || e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
        this.targetTiltInput = 0;
      }
    });

    // 2. Touch Buttons
    const bindPointerAction = (elem, onDown, onUp) => {
      if (!elem) return;
      elem.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        try { elem.setPointerCapture(e.pointerId); } catch(err) {}
        if (onDown) onDown();
      });
      const endPointer = (e) => {
        e.preventDefault();
        if (onUp) onUp();
      };
      elem.addEventListener('pointerup', endPointer);
      elem.addEventListener('pointercancel', endPointer);
    };

    bindPointerAction(this.dom.btnLeft, () => { this.targetTiltInput = -1.0; }, () => { this.targetTiltInput = 0; });
    bindPointerAction(this.dom.btnRight, () => { this.targetTiltInput = 1.0; }, () => { this.targetTiltInput = 0; });
    bindPointerAction(this.dom.btnJump, () => this.triggerJump());
    bindPointerAction(this.dom.btnTrick, () => {
      if (!this.isJumping) this.triggerJump();
      this.triggerTrick();
    });

    // 3. Touch Swipe Drag Fallback
    let touchStartX = 0;
    const canvas = document.getElementById('game-canvas');
    canvas.addEventListener('touchstart', (e) => {
      if (e.touches.length > 0) {
        touchStartX = e.touches[0].clientX;
      }
    }, { passive: true });

    canvas.addEventListener('touchmove', (e) => {
      if (e.touches.length > 0) {
        const deltaX = e.touches[0].clientX - touchStartX;
        const norm = Math.max(-1.0, Math.min(1.0, deltaX / 120.0));
        this.targetTiltInput = norm;
      }
    }, { passive: true });

    canvas.addEventListener('touchend', () => {
      if (!this.gyroActive) {
        this.targetTiltInput = 0;
      }
    });

    // 4. UI Start / Restart Multi-Event Bindings (Click, Pointer, Touch)
    const bindStartButton = (elem) => {
      if (!elem) return;
      elem.addEventListener('click', (e) => {
        if (e) e.preventDefault();
        // Guard against touch-through from pause/home button
        if (this.homeClickGuard) return;
        this.requestFullscreen();
        if (this.state === GAME_STATE.START || this.state === GAME_STATE.GAMEOVER) {
          const savedName = localStorage.getItem('seiltanzer_username');
          if (savedName && savedName.trim().length > 0) {
            this.requestSensorsAndStart();
          } else {
            if (this.dom.startModal) this.dom.startModal.style.display = 'none';
            if (this.dom.nameModal) this.dom.nameModal.classList.remove('hidden');
          }
        }
      });
    };

    bindStartButton(this.dom.btnStart);
    bindStartButton(this.dom.btnRestart);
    bindStartButton(this.dom.btnEnableSensor);

    if (this.dom.btnSubmitName) {
      this.dom.btnSubmitName.addEventListener('click', () => {
        const name = (this.dom.usernameInput?.value || '').trim();
        if (!name) {
          this.showToast("Bitte gib deinen Namen ein!");
          return;
        }
        this.requestFullscreen();
        localStorage.setItem('seiltanzer_username', name);
        if (this.dom.playerNameInput) {
          this.dom.playerNameInput.value = name;
        }
        if (this.dom.nameModal) this.dom.nameModal.classList.add('hidden');
        this.requestSensorsAndStart();
      });
    }

    if (this.dom.btnCalibrate) {
      this.dom.btnCalibrate.addEventListener('click', () => {
        this.calibrationGamma = this.rawGamma || 0;
        this.showToast("Gyro Nulllage gespeichert!");
      });
    }

    const bindBtnClick = (elem, fn) => {
      if (!elem) return;
      let lastTriggered = 0;
      const handler = (e) => {
        const now = Date.now();
        if (now - lastTriggered < 200) return;
        lastTriggered = now;
        if (e) {
          e.stopPropagation();
          e.preventDefault();
        }
        fn();
      };
      elem.addEventListener('click', handler);
      elem.addEventListener('pointerdown', handler);
    };

    // Fullscreen Screen-Tap Handler for Action (Squat/Jump) during gameplay
    // Excludes top header area (clientY < 80) for pause button / HUD
    const handleScreenTap = (e) => {
      if (this.state !== GAME_STATE.PLAYING) return;
      const clientY = e.clientY !== undefined ? e.clientY : (e.touches && e.touches[0] ? e.touches[0].clientY : 100);
      if (clientY < 80) return; // Ignore taps in upper 80px header area
      if (e.target && (e.target.closest('button') || e.target.closest('.modal-screen') || e.target.closest('#hud-header'))) {
        return;
      }
      if (e) {
        e.stopPropagation();
        e.preventDefault();
      }
      this.handleActionClick();
    };

    window.addEventListener('pointerdown', handleScreenTap);

    bindBtnClick(this.dom.btnPause, () => this.pauseGame());
    bindBtnClick(this.dom.btnResume, () => this.resumeGame());
    bindBtnClick(this.dom.btnToggleMusic, () => this.toggleMusic());
    bindBtnClick(this.dom.btnToggleSFX, () => this.toggleSFX());
    bindBtnClick(this.dom.btnPauseHome, () => this.returnToHome());

    this.bindGyro();
  }

  requestFullscreen() {
    try {
      const docEl = document.documentElement;
      if (docEl.requestFullscreen) {
        docEl.requestFullscreen().catch(() => {});
      } else if (docEl.webkitRequestFullscreen) {
        docEl.webkitRequestFullscreen();
      } else if (docEl.mozRequestFullScreen) {
        docEl.mozRequestFullScreen();
      } else if (docEl.msRequestFullscreen) {
        docEl.msRequestFullscreen();
      }
    } catch(err) {
      // Ignored if user cancels or browser blocks fullscreen
    }
  }

  requestSensorsAndStart() {
    this.isLoadingRequested = true;

    // Start loading GLTF model now if not yet started
    if (!this._gltfLoadingStarted) {
      this.loadGLTFCharacter();
    }

    // Show Dedicated Loading Overlay Screen immediately on click
    if (this.dom.loadingOverlay) {
      this.dom.loadingOverlay.classList.remove('hidden');
      this.dom.loadingOverlay.style.display = 'flex';
    }

    if (this.isModelLoaded && this.femaleModel) {
      // Model is ALREADY loaded and ready in 3D scene: finish loading & start game
      if (this.dom.loaderPercent) this.dom.loaderPercent.textContent = '100%';
      if (this.dom.loaderBarFill) this.dom.loaderBarFill.style.width = '100%';
      setTimeout(() => {
        if (!this.isLoadingRequested) return; // cancelled by returnToHome
        if (this.dom.loadingOverlay) {
          this.dom.loadingOverlay.classList.add('hidden');
          this.dom.loadingOverlay.style.display = 'none';
        }
        if (this.state === GAME_STATE.START || this.state === GAME_STATE.GAMEOVER) {
          this.playMusic();
          this.startGame();
        }
      }, 300);
    } else {
      // Model is still loading in background: display real download progress and WAIT until done!
      if (this.dom.loaderPercent) this.dom.loaderPercent.textContent = '10%';
      if (this.dom.loaderBarFill) this.dom.loaderBarFill.style.width = '10%';
      if (!this.femaleModel && typeof THREE.GLTFLoader !== 'undefined') {
        this.loadGLTFCharacter();
      }
    }

    try {
      if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
        DeviceOrientationEvent.requestPermission()
          .then(state => {
            if (state === 'granted') {
              this.bindGyro();
              if (this.dom.sensorBanner) this.dom.sensorBanner.classList.add('hidden');
            }
          })
          .catch(err => console.warn('Gyro permission rejected:', err));
      }
      if (typeof DeviceMotionEvent !== 'undefined' && typeof DeviceMotionEvent.requestPermission === 'function') {
        DeviceMotionEvent.requestPermission().catch(() => {});
      }
    } catch (e) {
      console.warn('Sensor request error:', e);
    }

    this.bindGyro();
  }

  bindGyro() {
    if (this.gyroBound) return;
    this.gyroBound = true;

    let toastShown = false;

    const handleOrientation = (e) => {
      // gamma = left/right tilt (landscape), beta = front/back tilt (portrait)
      // For a phone held upright (portrait), gamma is the left/right tilt we want
      const raw = e.gamma;
      if (raw === null || raw === undefined) return;

      if (!toastShown) {
        toastShown = true;
        this.gyroActive = true;
        this.calibrationGamma = raw; // auto-calibrate on first reading
      }

      this.gyroActive = true;
      this.rawGamma = raw;

      if (this.lastRawGamma !== undefined) {
        const instantSpeed = Math.abs(raw - this.lastRawGamma) / 0.016; // approx 60Hz frame rate
        this.gyroSpeed += (instantSpeed - this.gyroSpeed) * 0.15; // low-pass filter
      }
      this.lastRawGamma = raw;

      const delta = raw - this.calibrationGamma;
      // ÷35 so ±35° = full tilt input (prevents hyper-sensitivity)
      this.targetTiltInput = Math.max(-1.0, Math.min(1.0, delta / 35.0));
    };

    window.addEventListener('deviceorientation', handleOrientation, true);
    window.addEventListener('deviceorientationabsolute', handleOrientation, true);
  }

  /* -------------------------------------------------- */
  /* WEB AUDIO PROCEDURAL SOUND ENGINE                  */
  /* -------------------------------------------------- */
  initAudio() {
    if (this.audioInitialized) return;
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      this.audioCtx = new AudioCtx();

      const bufferSize = this.audioCtx.sampleRate * 2;
      const noiseBuffer = this.audioCtx.createBuffer(1, bufferSize, this.audioCtx.sampleRate);
      const output = noiseBuffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        output[i] = Math.random() * 2 - 1;
      }

      const whiteNoise = this.audioCtx.createBufferSource();
      whiteNoise.buffer = noiseBuffer;
      whiteNoise.loop = true;

      const filter = this.audioCtx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.value = 350;
      filter.Q.value = 3.0;

      this.windSoundGain = this.audioCtx.createGain();
      this.windSoundGain.gain.value = 0.05;

      whiteNoise.connect(filter);
      filter.connect(this.windSoundGain);
      this.windSoundGain.connect(this.audioCtx.destination);
      whiteNoise.start();

      this.audioInitialized = true;
    } catch (e) {
      console.warn("Web Audio API not supported", e);
    }
  }

  playAudioTone(freq, type, duration, gainVal = 0.1) {
    if (!this.audioCtx) return;
    try {
      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, this.audioCtx.currentTime);
      gain.gain.setValueAtTime(gainVal, this.audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.audioCtx.currentTime + duration);

      osc.connect(gain);
      gain.connect(this.audioCtx.destination);
      osc.start();
      osc.stop(this.audioCtx.currentTime + duration);
    } catch (e) {}
  }

  playStepSound() {
    this.playAudioTone(130 + Math.random() * 30, 'triangle', 0.08, 0.07);
  }

  playTrickSound() {
    if (!this.audioCtx) return;
    this.playAudioTone(523.25, 'sine', 0.15, 0.15); // C5
    setTimeout(() => this.playAudioTone(659.25, 'sine', 0.15, 0.15), 100); // E5
    setTimeout(() => this.playAudioTone(783.99, 'sine', 0.25, 0.2), 200); // G5
  }

  playFallSound() {
    if (this.fallSound && this.sfxEnabled) {
      try {
        this.fallSound.currentTime = 0;
        this.fallSound.play().catch(err => console.warn('Fall sound play error:', err));
      } catch(e) {}
      return;
    }
    // Procedural fallback if file unavailable
    if (!this.audioCtx) return;
    const osc = this.audioCtx.createOscillator();
    const gain = this.audioCtx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(400, this.audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(60, this.audioCtx.currentTime + 1.2);
    gain.gain.setValueAtTime(0.2, this.audioCtx.currentTime);
    gain.gain.linearRampToValueAtTime(0.001, this.audioCtx.currentTime + 1.2);
    osc.connect(gain);
    gain.connect(this.audioCtx.destination);
    osc.start();
    osc.stop(this.audioCtx.currentTime + 1.2);
  }

  /* -------------------------------------------------- */
  /* GAME FLOW & LOOPS                                  */
  /* -------------------------------------------------- */
  startGame() {
    if (this.state === GAME_STATE.PLAYING) return;
    this.initAudio();
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }

    if (this.rawGamma) {
      this.calibrationGamma = this.rawGamma;
    }

    this.state = GAME_STATE.PLAYING;
    this.distance = 0;
    this.score = 0;
    this.tricksCount = 0;
    this.comboCount = 0;
    this.balance = 0;
    this.balanceVelocity = 0;
    this.leftFootWireZ = 0.25;
    this.rightFootWireZ = -0.25;
    this.stepTimer = 0;
    this.stanceLeg = 'right';
    this.swingStartWireZ = 0.25;
    this.swingTargetWireZ = -0.45;
    this.targetTiltInput = 0;
    this.filteredTiltInput = 0;
    this.smoothedBalance = 0;
    this.smoothedTiltInput = 0;
    this.isJumping = false;
    this.isAnticipatingJump = false;
    this.jumpAnticipationTimer = 0;
    this.jumpY = 0;
    this.jumpVY = 0;
    this.windForce = 0;
    this.windTimer = 0;
    
    // Reset Character Position & Rotations
    this.characterGroup.position.set(0, 0, 0);
    this.hipsGroup.position.set(0, 0, 0);
    this.spineGroup.rotation.set(0, 0, 0);
    this.airGroup.rotation.set(0, 0, 0);
    this.armsGroup.rotation.set(0, 0, 0);
    this.airGroup.position.y = 0;

    if (this.femaleModel) {
      this.femaleModel.rotation.set(0, Math.PI, 0);
      if (this.femaleModelInitPos) {
        this.femaleModel.position.copy(this.femaleModelInitPos);
      }
    }

    // Reset bone orientations to their initial poses
    [this.leftUpLegBone, this.rightUpLegBone, this.leftLegBone, this.rightLegBone, this.spine1Bone, this.spine2Bone,
     this.leftArmBone, this.rightArmBone, this.leftForeArmBone, this.rightForeArmBone, this.leftFootBone, this.rightFootBone].forEach(b => {
      if (b && b.userData.initQ) {
        b.quaternion.copy(b.userData.initQ);
      }
    });

    // Reset World Z position
    if (this.worldGroup) {
      this.worldGroup.position.set(0, 0, 0);
    }

    // Reset Camera position and orientation
    this.camera.position.set(0, 2.3, 3.8);
    this.camera.lookAt(0, 1.25, -5);

    this.onWindowResize();

    // Show gameplay UI HUD
    if (this.dom.gameUi) {
      this.dom.gameUi.classList.remove('hidden');
    }

    if (this.dom.pauseModal) {
      this.dom.pauseModal.classList.add('hidden');
      this.dom.pauseModal.style.display = 'none';
    }
    if (this.dom.startModal) {
      this.dom.startModal.classList.add('hidden');
      this.dom.startModal.style.display = 'none';
    }
    if (this.dom.gameoverModal) {
      this.dom.gameoverModal.classList.add('hidden');
      this.dom.gameoverModal.style.display = 'none';
    }
    // Show the 3D canvas when game starts
    const canvasContainer = document.getElementById('canvas-container');
    if (canvasContainer) canvasContainer.style.display = 'block';
  }

  triggerJump() {
    if (this.state !== GAME_STATE.PLAYING || this.isJumping) return;
    this.isJumping = true;
    this.isAnticipatingJump = true;
    this.jumpAnticipationTimer = 0;
    this.trickProgress = 0;
    this.jumpTime = 0;
    this.jumpY = 0;
    this.jumpVY = 0; // launch velocity will be set after anticipation completes
  }

  handleActionClick() {
    if (this.state !== GAME_STATE.PLAYING) return;

    this.clickCount++;

    if (this.clickTimer) {
      clearTimeout(this.clickTimer);
    }

    const feedbackMsgs = {
      1: '1x Sprung ⬆️',
      2: '2x Sprung & Drehung 🔄',
      3: '3x Salto 🤸‍♀️',
      4: '4x In die Hocke 🧘'
    };
    const countClamped = Math.min(4, this.clickCount);
    this.showToast(feedbackMsgs[countClamped] || `${countClamped}x Hocke 🧘`);

    this.clickTimer = setTimeout(() => {
      const finalCount = this.clickCount;
      this.clickCount = 0;

      if (finalCount === 1) {
        this.triggerJump();
      } else if (finalCount === 2) {
        this.triggerSpecificTrick('spin');
      } else if (finalCount === 3) {
        this.triggerSpecificTrick('flip');
      } else if (finalCount >= 4) {
        this.triggerSpecificTrick('squat');
      }
    }, 280);
  }

  triggerSpecificTrick(typeId) {
    if (this.state !== GAME_STATE.PLAYING || this.inAirTrick || this.isSquatting) return;

    const trickMap = {
      'spin': { id: 'spin', name: 'SPRUNG & DREHUNG', points: 350 },
      'flip': { id: 'flip', name: 'SALTO', points: 500 },
      'squat': { id: 'squat', name: 'IN DIE HOCKE GEHEN', points: 400 }
    };

    const trick = trickMap[typeId];
    if (!trick) return;

    if (trick.id === 'squat') {
      this.isSquatting = true;
      this.squatTimer = 0;
      this.inAirTrick = trick;
    } else {
      if (!this.isJumping) {
        this.triggerJump();
      }
      this.inAirTrick = trick;
    }

    this.tricksCount++;
    this.comboCount++;
    const pointsGained = trick.points * this.comboCount;
    this.score += pointsGained;

    this.showComboBanner(trick.name, `+${pointsGained} PTS`);
    this.playTrickSound();
  }

  triggerTrick() {
    if (this.state !== GAME_STATE.PLAYING || this.inAirTrick || this.isSquatting) return;
    
    const tricks = [
      { id: 'spin', name: 'SPRUNG & DREHUNG', points: 350 },
      { id: 'flip', name: 'SALTO', points: 500 },
      { id: 'squat', name: 'IN DIE HOCKE GEHEN', points: 400 }
    ];

    const trick = tricks[Math.floor(Math.random() * tricks.length)];
    
    if (trick.id === 'squat') {
      this.isSquatting = true;
      this.squatTimer = 0;
      this.inAirTrick = trick;
    } else {
      if (!this.isJumping) {
        this.triggerJump();
      }
      this.inAirTrick = trick;
    }

    this.tricksCount++;
    this.comboCount++;
    const pointsGained = trick.points * this.comboCount;
    this.score += pointsGained;

    this.showComboBanner(trick.name, `+${pointsGained} PTS`);
    this.playTrickSound();
  }

  showComboBanner(name, pts) {
    this.dom.trickName.textContent = name;
    this.dom.trickPoints.textContent = pts;
    this.dom.comboBanner.classList.add('active');
    setTimeout(() => {
      this.dom.comboBanner.classList.remove('active');
    }, 1200);
  }

  showToast(msg) {
    const toast = document.createElement('div');
    toast.style.cssText = `
      position: absolute; top: 120px; left: 50%; transform: translateX(-50%);
      background: rgba(0,242,254,0.9); color: #000; font-weight: 800; font-size: 12px;
      padding: 6px 16px; border-radius: 20px; z-index: 100; pointer-events: none;
      box-shadow: 0 4px 15px rgba(0,242,254,0.5);
    `;
    toast.textContent = msg;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 1800);
  }

  gameOver(reason) {
    this.state = GAME_STATE.GAMEOVER;

    if (this.dom.gameUi) {
      this.dom.gameUi.classList.add('hidden');
    }

    if (this.score > this.highScore) {
      this.highScore = this.score;
      localStorage.setItem('seiltanzer_highscore', this.highScore.toString());
    }

    // Populate Game Over Stats
    this.dom.fallReason.textContent = reason;
    this.dom.statDist.textContent = `${Math.floor(this.distance)} m`;
    this.dom.statTricks.textContent = this.tricksCount;
    this.dom.statScore.textContent = this.score;
    this.dom.statHigh.textContent = this.highScore;

    // Automatic score submission in background using the name from start modal
    const name = localStorage.getItem('seiltanzer_username') || 'Spieler';
    
    if (this.dom.scoreStatus) {
      this.dom.scoreStatus.textContent = 'Score wird eingetragen…';
      this.dom.scoreStatus.className = 'score-status loading';
    }

    // Submit score immediately in background
    (async () => {
      try {
        const result = await window.HighscoreDB.submitScore(name, this.score, Math.floor(this.distance), this.tricksCount);
        if (result) {
          this._setScoreStatus('✅ In Weltrangliste eingetragen!', 'success');
          await this._loadGameoverLeaderboard(name, this.score);
        } else {
          this._setScoreStatus('⚠️ Verbindung fehlgeschlagen (offline)', 'error');
          await this._loadGameoverLeaderboard(name, this.score);
        }
      } catch (err) {
        console.error('Leaderboard error:', err);
        this._setScoreStatus('⚠️ Verbindung fehlgeschlagen (offline)', 'error');
        await this._loadGameoverLeaderboard(name, this.score);
      }
    })();

    setTimeout(() => {
      if (this.dom.gameoverModal) {
        this.dom.gameoverModal.style.display = 'flex';
        this.dom.gameoverModal.classList.remove('hidden');
      }
    }, 150);
  }

  _setScoreStatus(msg, cls) {
    if (!this.dom.scoreStatus) return;
    this.dom.scoreStatus.textContent = msg;
    this.dom.scoreStatus.className = `score-status ${cls}`;
  }

  async _loadStartLeaderboard() {
    try {
      const scores = await window.HighscoreDB.fetchTopScores(10);
      this._renderLeaderboard(this.dom.startLbList, scores, null, null);
    } catch (e) {
      if (this.dom.startLbList) this.dom.startLbList.innerHTML = '<div class="lb-empty">Bestenliste nicht verfügbar</div>';
    }
  }

  async _loadGameoverLeaderboard(submittedName, submittedScore) {
    if (this.dom.gameoverLeaderboard) this.dom.gameoverLeaderboard.style.display = '';
    if (this.dom.gameoverLbList) this.dom.gameoverLbList.innerHTML = '<div class="lb-loading">Lade Bestenliste…</div>';
    const scores = await window.HighscoreDB.fetchTopScores(10);
    this._renderLeaderboard(this.dom.gameoverLbList, scores, submittedName, submittedScore);
  }

  _renderLeaderboard(container, scores, highlightName, highlightScore) {
    if (!container) return;
    if (!scores || scores.length === 0) {
      container.innerHTML = '<div class="lb-empty">Noch keine Scores 🎮</div>';
      return;
    }
    const medals = ['🥇', '🥈', '🥉'];
    container.innerHTML = scores.map((entry, i) => {
      const rank = i + 1;
      const rankLabel = medals[i] || rank;
      const isHighlight = highlightName && entry.name === highlightName && entry.score === highlightScore;
      const rankClass = rank <= 3 ? `rank-${rank}` : '';
      const hlClass = isHighlight ? 'highlight' : '';
      return `<div class="lb-row ${rankClass} ${hlClass}">
        <span class="lb-rank">${rankLabel}</span>
        <span class="lb-name">${this._escapeHtml(entry.name)}</span>
        <span class="lb-score-val">${entry.score.toLocaleString()}</span>
      </div>`;
    }).join('');
  }

  _escapeHtml(str) {
    return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  /* -------------------------------------------------- */
  /* ANIMATION & REALISTIC ORGANIC BALANCING TICK       */
  /* -------------------------------------------------- */
  animate(timestamp) {
    requestAnimationFrame((t) => this.animate(t));

    const dt = Math.min(this.clock.getDelta(), 0.1);

    if (this.mixer) {
      if (this.state === GAME_STATE.PLAYING) {
        this.mixer.update(dt * 1.1);
      } else if (this.state === GAME_STATE.START) {
        this.mixer.update(dt * 0.4);
      }
    }

    if (this.state === GAME_STATE.PLAYING) {
      this.updatePhysics(dt);
      this.updateWorld(dt);
    } else if (this.state === GAME_STATE.START) {
      this.updateIdleAnimation(dt);
    } else if (this.state === GAME_STATE.FALLING) {
      this.updateFalling(dt);
    }

    if (this.composer) {
      this.composer.render();
    } else {
      this.renderer.render(this.scene, this.camera);
    }
  }

  _solveIK(hipX, hipY, hipZ, targetX, targetY, targetZ) {
    const L1 = 0.44;
    const L2 = 0.44;

    const dx = targetX - hipX;
    const dy = targetY - hipY;
    // Invert dz because character is facing world -Z (rotated by 180 degrees)
    const dz = -(targetZ - hipZ);

    const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
    const d_clamp = Math.max(0.1, Math.min(L1 + L2 - 0.001, d));

    // Law of Cosines
    const cosA = (L1 * L1 + d_clamp * d_clamp - L2 * L2) / (2 * L1 * d_clamp);
    const cosB = (L1 * L1 + L2 * L2 - d_clamp * d_clamp) / (2 * L1 * L2);

    const A = Math.acos(Math.max(-1, Math.min(1, cosA)));
    const B = Math.acos(Math.max(-1, Math.min(1, cosB)));

    // Knee bend (flexion) is rotation around X-axis
    const kneeAngle = Math.PI - B;

    // Hip flexion (X-axis) and adduction (Z-axis to center the foot)
    // Use + A to project knees forward (away from camera) instead of backward
    const hipAngleX = Math.atan2(dz, -dy) + A;
    const hipAngleZ = Math.atan2(dx, -dy);

    return {
      hipX: hipAngleX,
      hipZ: hipAngleZ,
      kneeX: kneeAngle
    };
  }

  updatePhysics(dt) {
    // 0. Slow adaptive calibration magnet (neutralizes slow drift/posture changes on gyro)
    if (this.gyroActive && this.state === GAME_STATE.PLAYING) {
      this.calibrationGamma += (this.rawGamma - this.calibrationGamma) * 0.045 * dt;
    }

    // 1. Smooth Tilt Input Filter
    this.filteredTiltInput += (this.targetTiltInput - this.filteredTiltInput) * 6.5 * dt;
    let input = this.filteredTiltInput;

    // 2. Wind Gust System
    this.windTimer -= dt;
    if (this.windTimer <= 0) {
      if (Math.random() < 0.4) {
        this.windForce = (0.4 + Math.random() * 0.6) * (Math.random() > 0.5 ? 1 : -1);
        this.windTimer = 3.5 + Math.random() * 4;
        this.dom.windIndicator.classList.add('active');
        this.dom.windArrow.style.transform = `rotate(${this.windForce > 0 ? 0 : 180}deg)`;
      } else {
        this.windForce = 0;
        this.windTimer = 2.5;
        this.dom.windIndicator.classList.remove('active');
      }
    }

    // Smooth out wind force transitions to prevent jerky changes
    this.smoothedWindForce += (this.windForce - this.smoothedWindForce) * 2.5 * dt;

    // Smooth Wind Sound Audio Gain Fade-In (Anschwellen) & Fade-Out (Abklingen)
    if (this.windSoundGain) {
      const targetGain = (this.sfxEnabled && this.state === GAME_STATE.PLAYING) ? (0.02 + Math.abs(this.smoothedWindForce) * 0.18) : 0;
      const currentGain = this.windSoundGain.gain.value;
      const fadeSpeed = (this.windForce !== 0) ? 2.8 : 1.2; // Zügiges Anschwellen, sanftes Ausklingen
      this.windSoundGain.gain.value += (targetGain - currentGain) * fadeSpeed * dt;
    }

    // 3. Balance Physics Equations
    const deadInput = Math.abs(input) < 0.05 ? 0 : input;
    const userControlTorque = -deadInput * 3.6;
    const windTorque = this.smoothedWindForce * 0.85;

    // Auto-Stabilization: pull back to center when user holds the phone still (or doesn't steer)
    let stillness = 1.0;
    if (this.gyroActive) {
      // If physical rotation speed is below 1.5 degrees/sec, consider it still (scale stillness 0 to 1)
      stillness = Math.max(0, Math.min(1.0, 1.0 - (this.gyroSpeed / 1.5)));
    } else {
      stillness = (this.targetTiltInput === 0) ? 1.0 : 0.0;
    }
    const autoRestoreTorque = -this.balance * 3.8 * stillness;
    const gravityTorque = Math.abs(this.balance) > 0.28 ? Math.sign(this.balance) * (Math.abs(this.balance) - 0.28) * 3.8 : 0;

    this.balanceVelocity += (userControlTorque + windTorque + autoRestoreTorque + gravityTorque) * dt;
    this.balance += this.balanceVelocity * dt;

    this.balanceVelocity *= 0.90;

    // HUD Needle Sync with Smooth HSL Color Gradient (Grün -> Gelb -> Rot)
    const needlePos = 50 + (this.balance * 50);
    this.dom.balanceNeedle.style.left = `${Math.max(0, Math.min(100, needlePos))}%`;

    const absBal = Math.min(1.0, Math.abs(this.balance));
    // Hue ranges smoothly from 135 (Grün) down to 0 (Rot)
    const hue = Math.max(0, 135 * (1.0 - Math.pow(absBal, 1.1)));
    const colorTop = `hsl(${Math.round(hue)}, 100%, 50%)`;
    const colorBottom = `hsl(${Math.round(Math.max(0, hue - 15))}, 100%, 38%)`;

    this.dom.balanceNeedle.style.background = `linear-gradient(180deg, ${colorTop}, ${colorBottom})`;
    this.dom.balanceNeedle.style.boxShadow = `0 0 14px ${colorTop}`;

    if (this.dom.balanceTrack) {
      if (absBal > 0.40) {
        this.dom.balanceTrack.style.borderColor = `hsla(${Math.round(hue)}, 100%, 50%, 0.7)`;
        this.dom.balanceTrack.style.boxShadow = `0 0 12px hsla(${Math.round(hue)}, 100%, 50%, 0.4)`;
      } else {
        this.dom.balanceTrack.style.borderColor = '';
        this.dom.balanceTrack.style.boxShadow = '';
      }
    }

    // 4. Fall Check
    if (Math.abs(this.balance) > 1.0) {
      this.state = GAME_STATE.FALLING;
      this.stopMusic();
      this.playFallSound();
      if (this.windSoundGain) {
        this.windSoundGain.gain.value = 0;
      }
      this.fallVelocityY = 0;
      this.fallDirection = Math.sign(this.balance);
      this.fallReason = this.balance > 0 ? "Nach rechts abgestürzt!" : "Nach links abgestürzt!";
      return;
    }

    // 5. Forward Distance & Score Tracking (Scale by 0.20 to count meters at a realistic walking speed of ~0.84 m/s)
    this.distance += this.forwardSpeed * dt * 0.20;
    this.score += Math.floor(this.forwardSpeed * dt * 0.20 * 10);

    this.dom.valDistance.textContent = `${Math.floor(this.distance)} m`;
    this.dom.valScore.textContent = this.score;

    // 6. Jump & 3 Natural Acrobatics Physics (Sprung, Sprung & Drehung, Salto, Hocke)
    if (this.isSquatting) {
      this.squatTimer += dt;
      if (this.squatTimer <= dt) {
        this.trickStartFootZ_L = this.currentWalkZ_L !== undefined ? this.currentWalkZ_L : 0.25;
        this.trickStartFootZ_R = this.currentWalkZ_R !== undefined ? this.currentWalkZ_R : -0.25;
      }
      // p: 0→1→0 over 1.3s (smooth in-out)
      const p = Math.sin(Math.min(1.0, this.squatTimer / 1.3) * Math.PI);
      
      // Pelvis/Hips drop: sink down strictly vertically (no backward shift)
      const hipDropY = -p * 0.45;
      if (this.hipsGroup) {
        this.hipsGroup.position.y = hipDropY;
        this.hipsGroup.position.z = 0;
      }

      // Spine stays almost upright (very minimal forward lean)
      if (this.spineGroup) {
        this.spineGroup.rotation.x = p * 0.05;
      }

      // Hip joint offsets
      const hipOffsetL = 0.14;
      const hipOffsetR = -0.14;

      // Solve leg IK (keep feet close together on the wire at targetX = 0.03 / -0.03 and staggered in tandem)
      const ikL = this._solveIK(hipOffsetL, hipDropY, 0, 0.03, -0.90, this.trickStartFootZ_L);
      const ikR = this._solveIK(hipOffsetR, hipDropY, 0, -0.03, -0.90, this.trickStartFootZ_R);

      // Knie-Vektoren: front (Right) straight forward (kneeOutR = 0), back (Left) bends downward/outward (kneeOutL = p * 0.18)
      const kneeOutL = p * 0.18;
      const kneeOutR = 0;

      const qHipL = new THREE.Quaternion()
        .setFromAxisAngle(new THREE.Vector3(1, 0, 0), ikL.hipX)
        .multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), ikL.hipZ + kneeOutL));
      const qKneeL = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -ikL.kneeX); // Negative knee bend
      const qAnkleL = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), ikL.kneeX - ikL.hipX)
        .multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), -kneeOutL))
        .multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), 0.10));

      const qHipR = new THREE.Quaternion()
        .setFromAxisAngle(new THREE.Vector3(1, 0, 0), ikR.hipX)
        .multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), ikR.hipZ + kneeOutR));
      const qKneeR = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -ikR.kneeX); // Negative knee bend
      const qAnkleR = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), ikR.kneeX - ikR.hipX)
        .multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), -kneeOutR))
        .multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), -0.10));

      if (this.leftUpLegBone  && this.leftUpLegBone.userData.initQ)  { this.leftUpLegBone.quaternion.copy(this.leftUpLegBone.userData.initQ).multiply(qHipL); }
      if (this.rightUpLegBone && this.rightUpLegBone.userData.initQ) { this.rightUpLegBone.quaternion.copy(this.rightUpLegBone.userData.initQ).multiply(qHipR); }
      if (this.leftLegBone    && this.leftLegBone.userData.initQ)    { this.leftLegBone.quaternion.copy(this.leftLegBone.userData.initQ).multiply(qKneeL); }
      if (this.rightLegBone   && this.rightLegBone.userData.initQ)   { this.rightLegBone.quaternion.copy(this.rightLegBone.userData.initQ).multiply(qKneeR); }
      if (this.leftFootBone   && this.leftFootBone.userData.initQ)   { this.leftFootBone.quaternion.copy(this.leftFootBone.userData.initQ).multiply(qAnkleL); }
      if (this.rightFootBone  && this.rightFootBone.userData.initQ)  { this.rightFootBone.quaternion.copy(this.rightFootBone.userData.initQ).multiply(qAnkleR); }

      // Arm balancing poses: raise sideways up/outward
      if (this.leftArmBone  && this.leftArmBone.userData.initQ) {
        const qSquatArmL = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), -p * 0.50);
        this.leftArmBone.quaternion.copy(this.leftArmBone.userData.initQ).multiply(qSquatArmL);
      }
      if (this.rightArmBone && this.rightArmBone.userData.initQ) {
        const qSquatArmR = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), p * 0.50);
        this.rightArmBone.quaternion.copy(this.rightArmBone.userData.initQ).multiply(qSquatArmR);
      }

      if (this.squatTimer >= 1.3) {
        this.isSquatting = false;
        this.squatTimer = 0;
        if (this.hipsGroup) this.hipsGroup.position.y = 0;
        if (this.spineGroup) this.spineGroup.rotation.x = 0;
        [this.leftUpLegBone, this.rightUpLegBone, this.leftLegBone, this.rightLegBone,
         this.leftFootBone, this.rightFootBone, this.leftArmBone, this.rightArmBone].forEach(b => {
          if (b && b.userData.initQ) b.quaternion.copy(b.userData.initQ);
        });
        this.inAirTrick = null;
        this.showToast("Perfekte Hocke!");
      }
    } else if (this.isJumping) {
      if (this.isAnticipatingJump) {
        this.jumpAnticipationTimer += dt;
        if (this.jumpAnticipationTimer <= dt) {
          this.trickStartFootZ_L = this.currentWalkZ_L !== undefined ? this.currentWalkZ_L : 0.25;
          this.trickStartFootZ_R = this.currentWalkZ_R !== undefined ? this.currentWalkZ_R : -0.25;
        }
        const duration = 0.35;
        const t = Math.min(1.0, this.jumpAnticipationTimer / duration);
        
        // Easing timing: ease-in drop, compression hold, snap extension launch
        let p = 0;
        if (t < 0.65) {
          const nt = t / 0.65;
          p = nt * nt; // quick ease-in down
        } else if (t < 0.88) {
          p = 1.0; // compression hold at lowest point
        } else {
          const rt = (t - 0.88) / 0.12;
          p = 1.0 - rt * rt; // snap extension release
        }
        
        // Pelvis/Hips drop: sink down strictly vertically
        const hipDropY = -p * 0.28;
        if (this.hipsGroup) {
          this.hipsGroup.position.y = hipDropY;
          this.hipsGroup.position.z = 0;
        }

        // Spine stays almost upright
        if (this.spineGroup) {
          this.spineGroup.rotation.x = p * 0.05;
        }

        // Hip joint offsets
        const hipOffsetL = 0.14;
        const hipOffsetR = -0.14;

        // Solve leg IK (feet close together X = 0.03 / -0.03 and staggered in tandem)
        const ikL = this._solveIK(hipOffsetL, hipDropY, 0, 0.03, -0.90, this.trickStartFootZ_L);
        const ikR = this._solveIK(hipOffsetR, hipDropY, 0, -0.03, -0.90, this.trickStartFootZ_R);

        // Knie-Vektoren: front (Right) straight forward (kneeOutR = 0), back (Left) bends downward/outward (kneeOutL = p * 0.18)
        const kneeOutL = p * 0.18;
        const kneeOutR = 0;

        const qHipL = new THREE.Quaternion()
          .setFromAxisAngle(new THREE.Vector3(1, 0, 0), ikL.hipX)
          .multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), ikL.hipZ + kneeOutL));
        const qKneeL = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -ikL.kneeX); // Negative knee bend
        const qAnkleL = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), ikL.kneeX - ikL.hipX)
          .multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), -kneeOutL))
          .multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), 0.10));

        const qHipR = new THREE.Quaternion()
          .setFromAxisAngle(new THREE.Vector3(1, 0, 0), ikR.hipX)
          .multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), ikR.hipZ + kneeOutR));
        const qKneeR = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -ikR.kneeX); // Negative knee bend
        const qAnkleR = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), ikR.kneeX - ikR.hipX)
          .multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), -kneeOutR))
          .multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), -0.10));

        // Arm balancing poses: raise sideways up/outward to signal tension prep
        const qAnticArmL = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), -p * 0.40);
        const qAnticArmR = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), p * 0.40);

        if (this.leftUpLegBone  && this.leftUpLegBone.userData.initQ)  this.leftUpLegBone.quaternion.copy(this.leftUpLegBone.userData.initQ).multiply(qHipL);
        if (this.rightUpLegBone && this.rightUpLegBone.userData.initQ) this.rightUpLegBone.quaternion.copy(this.rightUpLegBone.userData.initQ).multiply(qHipR);
        if (this.leftLegBone    && this.leftLegBone.userData.initQ)    this.leftLegBone.quaternion.copy(this.leftLegBone.userData.initQ).multiply(qKneeL);
        if (this.rightLegBone   && this.rightLegBone.userData.initQ)   this.rightLegBone.quaternion.copy(this.rightLegBone.userData.initQ).multiply(qKneeR);
        if (this.leftFootBone   && this.leftFootBone.userData.initQ)   this.leftFootBone.quaternion.copy(this.leftFootBone.userData.initQ).multiply(qAnkleL);
        if (this.rightFootBone  && this.rightFootBone.userData.initQ)  this.rightFootBone.quaternion.copy(this.rightFootBone.userData.initQ).multiply(qAnkleR);
        if (this.leftArmBone    && this.leftArmBone.userData.initQ)    this.leftArmBone.quaternion.copy(this.leftArmBone.userData.initQ).multiply(qAnticArmL);
        if (this.rightArmBone   && this.rightArmBone.userData.initQ)   this.rightArmBone.quaternion.copy(this.rightArmBone.userData.initQ).multiply(qAnticArmR);

        if (this.jumpAnticipationTimer >= 0.35) {
          // Launch!
          this.isAnticipatingJump = false;
          this.jumpVY = this.jumpPower;
          this.jumpTime = 0;
          this.jumpPeakY = 0.01;
          this.playAudioTone(300, 'sine', 0.12, 0.12);
          
          // Clear offsets before air trick begins
          if (this.hipsGroup) {
            this.hipsGroup.position.y = 0;
            this.hipsGroup.position.z = 0;
          }
          if (this.spineGroup) this.spineGroup.rotation.x = 0;
          
          // Reset bones to initial rotation so air trick poses are clean
          [this.leftUpLegBone, this.rightUpLegBone, this.leftLegBone, this.rightLegBone,
           this.leftFootBone, this.rightFootBone, this.leftArmBone, this.rightArmBone,
           this.leftForeArmBone, this.rightForeArmBone, this.headBone].forEach(b => {
             if (b && b.userData.initQ) b.quaternion.copy(b.userData.initQ);
           });
        }
      } else {
        // Normal jump in air physics
        this.jumpTime = (this.jumpTime || 0) + dt;
        this.jumpY += this.jumpVY * dt;
        this.jumpVY += this.gravity * dt;
        this.airGroup.position.y = this.jumpY;
        this.jumpPeakY = Math.max(this.jumpPeakY || 0.01, this.jumpY);

        if (this.inAirTrick) {
          const airTime = 2 * this.jumpPower / Math.abs(this.gravity);
          const p = Math.min(1.0, this.jumpTime / airTime);

          if (this.inAirTrick.id === 'spin') {
            // Full 360° Y-axis spin
            if (this.femaleModel) {
              this.femaleModel.rotation.y = Math.PI + p * Math.PI * 2;
            }
            // Form a circle with the arms in front of the body
            const spinTuck = Math.sin(p * Math.PI);
            const qSpinArmL = new THREE.Quaternion()
              .setFromAxisAngle(new THREE.Vector3(1, 0, 0),  spinTuck * 0.90)
              .multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1),  spinTuck * 0.85));
            const qSpinArmR = new THREE.Quaternion()
              .setFromAxisAngle(new THREE.Vector3(1, 0, 0),  spinTuck * 0.90)
              .multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), -spinTuck * 0.85));

            const qSpinForeL = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0),  spinTuck * 1.30);
            const qSpinForeR = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, -1, 0), spinTuck * 1.30);

            // Staggered knee bend for realistic rotation posture (knees bend backward, positive X)
            const qSpinKneeL = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), spinTuck * 0.50);
            const qSpinKneeR = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), spinTuck * 0.30);

            if (this.leftArmBone)  this.leftArmBone.quaternion.copy(this.leftArmBone.userData.initQ || new THREE.Quaternion()).multiply(qSpinArmL);
            if (this.rightArmBone) this.rightArmBone.quaternion.copy(this.rightArmBone.userData.initQ || new THREE.Quaternion()).multiply(qSpinArmR);
            if (this.leftForeArmBone)  this.leftForeArmBone.quaternion.copy(this.leftForeArmBone.userData.initQ || new THREE.Quaternion()).multiply(qSpinForeL);
            if (this.rightForeArmBone) this.rightForeArmBone.quaternion.copy(this.rightForeArmBone.userData.initQ || new THREE.Quaternion()).multiply(qSpinForeR);
            if (this.leftLegBone)  this.leftLegBone.quaternion.copy(this.leftLegBone.userData.initQ || new THREE.Quaternion()).multiply(qSpinKneeL);
            if (this.rightLegBone) this.rightLegBone.quaternion.copy(this.rightLegBone.userData.initQ || new THREE.Quaternion()).multiply(qSpinKneeR);

          } else if (this.inAirTrick.id === 'flip') {
            // Backflip: rotate backward around X axis, full 360°
            if (this.femaleModel) {
              this.femaleModel.rotation.x = -p * Math.PI * 2;
            }

            // Asymmetric Tuck & Open timing (tuck in by 35%, hold till 75%, open rapidly)
            let tuck = 0;
            if (p < 0.35) {
              tuck = Math.sin((p / 0.35) * Math.PI / 2);
            } else if (p < 0.75) {
              tuck = 1.0;
            } else {
              const op = (1.0 - p) / 0.25;
              tuck = op * op; // rapid open
            }

            // Head Spotting: bend neck forward at the end to lock gaze on the wire
            let qSpotHead = new THREE.Quaternion();
            if (p > 0.75) {
              const spotFactor = (p - 0.75) / 0.25; // 0 to 1
              qSpotHead.setFromAxisAngle(new THREE.Vector3(1, 0, 0), -spotFactor * 0.45);
            }

            // STAGGERED TUCK: one foot/leg is tucked higher/tighter than the other (staggered voreinander)
            // Thighs rotate forward (positive X) to tuck toward the chest relative to the pelvis
            const qTuckThighL = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), tuck * 1.45); // Left (front) thigh toward chest
            const qTuckKneeL  = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0),  tuck * 1.95); // Left knee bent back
            const qTuckAnkleL = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -tuck * 0.60);

            const qTuckThighR = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), tuck * 1.05); // Right (back) thigh stays lower
            const qTuckKneeR  = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0),  tuck * 1.55); // Right knee bent less
            const qTuckAnkleR = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -tuck * 0.40);

            // Knee grabbing: arms move forward/inward to grab knees
            const qFlipArmL = new THREE.Quaternion()
              .setFromAxisAngle(new THREE.Vector3(1, 0, 0),  tuck * 1.30)
              .multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), -tuck * 0.35));
            const qFlipArmR = new THREE.Quaternion()
              .setFromAxisAngle(new THREE.Vector3(1, 0, 0),  tuck * 1.30)
              .multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1),  tuck * 0.35));

            const qFlipForeL = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0),  tuck * 0.90);
            const qFlipForeR = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, -1, 0), tuck * 0.90);

            if (this.leftUpLegBone  && this.leftUpLegBone.userData.initQ)  this.leftUpLegBone.quaternion.copy(this.leftUpLegBone.userData.initQ).multiply(qTuckThighL);
            if (this.rightUpLegBone && this.rightUpLegBone.userData.initQ) this.rightUpLegBone.quaternion.copy(this.rightUpLegBone.userData.initQ).multiply(qTuckThighR);
            if (this.leftLegBone    && this.leftLegBone.userData.initQ)    this.leftLegBone.quaternion.copy(this.leftLegBone.userData.initQ).multiply(qTuckKneeL);
            if (this.rightLegBone   && this.rightLegBone.userData.initQ)   this.rightLegBone.quaternion.copy(this.rightLegBone.userData.initQ).multiply(qTuckKneeR);
            if (this.leftFootBone   && this.leftFootBone.userData.initQ)   this.leftFootBone.quaternion.copy(this.leftFootBone.userData.initQ).multiply(qTuckAnkleL);
            if (this.rightFootBone  && this.rightFootBone.userData.initQ)  this.rightFootBone.quaternion.copy(this.rightFootBone.userData.initQ).multiply(qTuckAnkleR);
            if (this.leftArmBone    && this.leftArmBone.userData.initQ)    this.leftArmBone.quaternion.copy(this.leftArmBone.userData.initQ).multiply(qFlipArmL);
            if (this.rightArmBone   && this.rightArmBone.userData.initQ)   this.rightArmBone.quaternion.copy(this.rightArmBone.userData.initQ).multiply(qFlipArmR);
            if (this.leftForeArmBone  && this.leftForeArmBone.userData.initQ)  this.leftForeArmBone.quaternion.copy(this.leftForeArmBone.userData.initQ).multiply(qFlipForeL);
            if (this.rightForeArmBone && this.rightForeArmBone.userData.initQ) this.rightForeArmBone.quaternion.copy(this.rightForeArmBone.userData.initQ).multiply(qFlipForeR);
            if (this.headBone       && this.headBone.userData.initQ)       this.headBone.quaternion.copy(this.headBone.userData.initQ).multiply(qSpotHead);
          }
        } else {
          // Normal jump in air physics: keep a beautiful staggered stride split pose (Left forward, Right back)
          const airTime = 2 * this.jumpPower / Math.abs(this.gravity);
          const p = Math.sin(Math.min(1.0, this.jumpTime / airTime) * Math.PI); // parabolic ease-in-out peak factor

          // Left leg (front): hip flexed forward, knee bent slightly
          const qHipL = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0),  p * 0.40);
          const qKneeL = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), p * 0.35);
          const qAnkleL = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -p * 0.05);

          // Right leg (back): hip extended backward, knee bent slightly
          const qHipR = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -p * 0.20);
          const qKneeR = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), p * 0.50);
          const qAnkleR = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), p * 0.30);

          if (this.leftUpLegBone  && this.leftUpLegBone.userData.initQ)  this.leftUpLegBone.quaternion.copy(this.leftUpLegBone.userData.initQ).multiply(qHipL);
          if (this.rightUpLegBone && this.rightUpLegBone.userData.initQ) this.rightUpLegBone.quaternion.copy(this.rightUpLegBone.userData.initQ).multiply(qHipR);
          if (this.leftLegBone    && this.leftLegBone.userData.initQ)    this.leftLegBone.quaternion.copy(this.leftLegBone.userData.initQ).multiply(qKneeL);
          if (this.rightLegBone   && this.rightLegBone.userData.initQ)   this.rightLegBone.quaternion.copy(this.rightLegBone.userData.initQ).multiply(qKneeR);
          if (this.leftFootBone   && this.leftFootBone.userData.initQ)   this.leftFootBone.quaternion.copy(this.leftFootBone.userData.initQ).multiply(qAnkleL);
          if (this.rightFootBone  && this.rightFootBone.userData.initQ)  this.rightFootBone.quaternion.copy(this.rightFootBone.userData.initQ).multiply(qAnkleR);
        }

        // Landing Prep: blend to perfect tandem landing pose as she falls from the highest position (jumpPeakY) to the ground
        if (this.jumpVY < 0) {
          const blend = Math.max(0.0, Math.min(1.0, 1.0 - (this.jumpY / this.jumpPeakY)));

          const hipOffsetL = 0.14;
          const hipOffsetR = -0.14;

          const ikL_t = this._solveIK(hipOffsetL, 0, 0, 0.03, -0.90, 0.25);
          const ikR_t = this._solveIK(hipOffsetR, 0, 0, -0.03, -0.90, -0.25);

          const qHipL_t = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), ikL_t.hipX)
            .multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), ikL_t.hipZ));
          const qKneeL_t = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -ikL_t.kneeX);
          const qAnkleL_t = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), ikL_t.kneeX - ikL_t.hipX)
            .multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), 0.10));

          const qHipR_t = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), ikR_t.hipX)
            .multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), ikR_t.hipZ));
          const qKneeR_t = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -ikR_t.kneeX);
          const qAnkleR_t = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), ikR_t.kneeX - ikR_t.hipX)
            .multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), -0.10));

          const qArmL_t = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), -0.50);
          const qArmR_t = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), 0.50);

          // Apply blend using slerp on the bones
          if (this.leftUpLegBone  && this.leftUpLegBone.userData.initQ) {
            const currentQ = this.leftUpLegBone.quaternion.clone();
            const targetQ = this.leftUpLegBone.userData.initQ.clone().multiply(qHipL_t);
            this.leftUpLegBone.quaternion.copy(currentQ.slerp(targetQ, blend));
          }
          if (this.rightUpLegBone && this.rightUpLegBone.userData.initQ) {
            const currentQ = this.rightUpLegBone.quaternion.clone();
            const targetQ = this.rightUpLegBone.userData.initQ.clone().multiply(qHipR_t);
            this.rightUpLegBone.quaternion.copy(currentQ.slerp(targetQ, blend));
          }
          if (this.leftLegBone    && this.leftLegBone.userData.initQ) {
            const currentQ = this.leftLegBone.quaternion.clone();
            const targetQ = this.leftLegBone.userData.initQ.clone().multiply(qKneeL_t);
            this.leftLegBone.quaternion.copy(currentQ.slerp(targetQ, blend));
          }
          if (this.rightLegBone   && this.rightLegBone.userData.initQ) {
            const currentQ = this.rightLegBone.quaternion.clone();
            const targetQ = this.rightLegBone.userData.initQ.clone().multiply(qKneeR_t);
            this.rightLegBone.quaternion.copy(currentQ.slerp(targetQ, blend));
          }
          if (this.leftFootBone   && this.leftFootBone.userData.initQ) {
            const currentQ = this.leftFootBone.quaternion.clone();
            const targetQ = this.leftFootBone.userData.initQ.clone().multiply(qAnkleL_t);
            this.leftFootBone.quaternion.copy(currentQ.slerp(targetQ, blend));
          }
          if (this.rightFootBone  && this.rightFootBone.userData.initQ) {
            const currentQ = this.rightFootBone.quaternion.clone();
            const targetQ = this.rightFootBone.userData.initQ.clone().multiply(qAnkleR_t);
            this.rightFootBone.quaternion.copy(currentQ.slerp(targetQ, blend));
          }
          if (this.leftArmBone    && this.leftArmBone.userData.initQ) {
            const currentQ = this.leftArmBone.quaternion.clone();
            const targetQ = this.leftArmBone.userData.initQ.clone().multiply(qArmL_t);
            this.leftArmBone.quaternion.copy(currentQ.slerp(targetQ, blend));
          }
          if (this.rightArmBone   && this.rightArmBone.userData.initQ) {
            const currentQ = this.rightArmBone.quaternion.clone();
            const targetQ = this.rightArmBone.userData.initQ.clone().multiply(qArmR_t);
            this.rightArmBone.quaternion.copy(currentQ.slerp(targetQ, blend));
          }
          // Reset forearms to straight/initQ so arms look wide
          if (this.leftForeArmBone  && this.leftForeArmBone.userData.initQ) {
            const currentQ = this.leftForeArmBone.quaternion.clone();
            const targetQ = this.leftForeArmBone.userData.initQ;
            this.leftForeArmBone.quaternion.copy(currentQ.slerp(targetQ, blend));
          }
          if (this.rightForeArmBone && this.rightForeArmBone.userData.initQ) {
            const currentQ = this.rightForeArmBone.quaternion.clone();
            const targetQ = this.rightForeArmBone.userData.initQ;
            this.rightForeArmBone.quaternion.copy(currentQ.slerp(targetQ, blend));
          }
          // Reset head rotation back to look forward
          if (this.headBone && this.headBone.userData.initQ) {
            const currentQ = this.headBone.quaternion.clone();
            const targetQ = this.headBone.userData.initQ;
            this.headBone.quaternion.copy(currentQ.slerp(targetQ, blend));
          }
        }

      // Landing Check
      if (this.jumpY <= 0) {
        this.jumpY = 0;
        this.isJumping = false;
        this.landingAbsorptionTimer = 0.25; // Trigger landing absorption!
        this.jumpTime = 0;
        this.trickProgress = 0;
        this.airGroup.position.y = 0;
        this.airGroup.rotation.set(0, 0, 0);

        if (this.femaleModel) {
          this.femaleModel.rotation.x = 0;
          this.femaleModel.rotation.y = Math.PI;
        }

        // Reset leg, arm and forearm bones to stand flat on the wire
        [
          this.leftUpLegBone, this.rightUpLegBone, this.leftLegBone, this.rightLegBone,
          this.leftFootBone, this.rightFootBone, this.leftArmBone, this.rightArmBone,
          this.leftForeArmBone, this.rightForeArmBone
        ].forEach(b => {
          if (b && b.userData.initQ) b.quaternion.copy(b.userData.initQ);
        });

        if (Math.abs(this.balance) > 0.4) {
          this.balance += Math.sign(this.balance) * 0.35;
          this.showToast("Wackelige Landung!");
        }

        this.leftFootWireZ = 0.25;
        this.rightFootWireZ = -0.25;
        this.stepTimer = 0;
        this.stanceLeg = 'right';
        this.swingStartWireZ = 0.25;
        this.swingTargetWireZ = -0.45;

        this.inAirTrick = null;
      }
    }
  }
  let stepSine = 0;
    // 7. LANDING ABSORPTION OR REAL PROCEDURAL IK GAIT
    if (this.landingAbsorptionTimer > 0) {
      this.landingAbsorptionTimer -= dt;
      const ap = Math.max(0.0, this.landingAbsorptionTimer / 0.25);
      const p = Math.sin(ap * Math.PI); // dip factor: 0 -> 1 -> 0
      
      // Pelvis/Hips drop: sink down strictly vertically
      const hipDropY = -p * 0.26;
      if (this.hipsGroup) {
        this.hipsGroup.position.y = hipDropY;
        this.hipsGroup.position.z = 0;
      }

      // Spine stays almost upright
      if (this.spineGroup) {
        this.spineGroup.rotation.x = p * 0.05;
      }

      // Hip joint offsets
      const hipOffsetL = 0.14;
      const hipOffsetR = -0.14;

      // Solve leg IK (feet close together X = 0.03 / -0.03 and staggered in tandem)
      const ikL = this._solveIK(hipOffsetL, hipDropY, 0, 0.03, -0.90, 0.25);
      const ikR = this._solveIK(hipOffsetR, hipDropY, 0, -0.03, -0.90, -0.25);

      // Knie-Vektoren: front (Right) straight forward (kneeOutR = 0), back (Left) bends downward/outward (kneeOutL = p * 0.18)
      const kneeOutL = p * 0.18;
      const kneeOutR = 0;

      const qHipL = new THREE.Quaternion()
        .setFromAxisAngle(new THREE.Vector3(1, 0, 0), ikL.hipX)
        .multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), ikL.hipZ + kneeOutL));
      const qKneeL = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -ikL.kneeX); // Negative knee bend
      const qAnkleL = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), ikL.kneeX - ikL.hipX)
        .multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), -kneeOutL))
        .multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), 0.10));

      const qHipR = new THREE.Quaternion()
        .setFromAxisAngle(new THREE.Vector3(1, 0, 0), ikR.hipX)
        .multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), ikR.hipZ + kneeOutR));
      const qKneeR = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -ikR.kneeX); // Negative knee bend
      const qAnkleR = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), ikR.kneeX - ikR.hipX)
        .multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), -kneeOutR))
        .multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), -0.10));

      // Balance-Ausgleich: Arms spread wide sideways
      const qLandArmL = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), -p * 0.50);
      const qLandArmR = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), p * 0.50);

      if (this.leftUpLegBone  && this.leftUpLegBone.userData.initQ)  this.leftUpLegBone.quaternion.copy(this.leftUpLegBone.userData.initQ).multiply(qHipL);
      if (this.rightUpLegBone && this.rightUpLegBone.userData.initQ) this.rightUpLegBone.quaternion.copy(this.rightUpLegBone.userData.initQ).multiply(qHipR);
      if (this.leftLegBone    && this.leftLegBone.userData.initQ)    this.leftLegBone.quaternion.copy(this.leftLegBone.userData.initQ).multiply(qKneeL);
      if (this.rightLegBone   && this.rightLegBone.userData.initQ)   this.rightLegBone.quaternion.copy(this.rightLegBone.userData.initQ).multiply(qKneeR);
      if (this.leftFootBone   && this.leftFootBone.userData.initQ)   this.leftFootBone.quaternion.copy(this.leftFootBone.userData.initQ).multiply(qAnkleL);
      if (this.rightFootBone  && this.rightFootBone.userData.initQ)  this.rightFootBone.quaternion.copy(this.rightFootBone.userData.initQ).multiply(qAnkleR);
      if (this.leftArmBone    && this.leftArmBone.userData.initQ)    this.leftArmBone.quaternion.copy(this.leftArmBone.userData.initQ).multiply(qLandArmL);
      if (this.rightArmBone   && this.rightArmBone.userData.initQ)   this.rightArmBone.quaternion.copy(this.rightArmBone.userData.initQ).multiply(qLandArmR);
    } else if (!this.isSquatting && !this.isJumping) {
      // Step duration is fixed for natural walking frequency
      const stepDuration = 0.85; // Slower, deliberate high-wire walk
      const stepDistance = 0.22; // Very short steps, stance foot stays almost vertical
      const halfDist = stepDistance / 2;

      // Update timer
      this.stepTimer += dt;
      if (this.stepTimer >= stepDuration) {
        if (!this.isJumping) {
          this.playStepSound();
        }
        this.stepTimer = 0;
        this.stanceLeg = (this.stanceLeg === 'right') ? 'left' : 'right';
      }

      // Swing progress: 0 to 1
      const t = Math.min(1.0, this.stepTimer / stepDuration);
      
      // Cosine ease for smooth swing motion
      const p = (1 - Math.cos(t * Math.PI)) / 2;

      // Stance foot Z relative to hips: slides from front (-halfDist) to back (halfDist)
      const stanceZ = -halfDist + stepDistance * t;

      // Swing foot Z relative to hips: swings from back (halfDist) to front (-halfDist)
      const swingZ = halfDist - stepDistance * p;

      // Assign raw Z coordinates relative to hips
      let rawZ_L, rawZ_R;
      if (this.stanceLeg === 'right') {
        rawZ_R = stanceZ;
        rawZ_L = swingZ;
      } else {
        rawZ_L = stanceZ;
        rawZ_R = swingZ;
      }

      // Direct IK targets (compact step, no extra scaling needed)
      const ikZ_L = rawZ_L;
      const ikZ_R = rawZ_R;

      // Save current walk Z coordinates so tricks/jumps can start seamlessly
      this.currentWalkZ_L = ikZ_L;
      this.currentWalkZ_R = ikZ_R;

      // Parabolic lift height for the swing foot
      const liftY = Math.sin(t * Math.PI) * 0.08;
      const leftFootY = -0.90 + (this.stanceLeg === 'right' ? liftY : 0);
      const rightFootY = -0.90 + (this.stanceLeg === 'left' ? liftY : 0);

      // Torque/twist using swing progress for torso twist
      stepSine = (this.stanceLeg === 'right' ? 1 : -1) * Math.sin(t * Math.PI);

      // Hips bob up and down naturally
      if (this.hipsGroup && !this.isJumping) {
        this.hipsGroup.position.y = -0.01 - Math.sin(t * Math.PI) * 0.035;
      }

      // Bone lengths (proportional to Meg's skinned mesh scale)
      const L1 = 0.44;
      const L2 = 0.44;

      // Hip joint offsets (X position) relative to center
      const hipOffsetL = 0.14;
      const hipOffsetR = -0.14;

      // Solve IK for Left Leg (target X = 0 to be centered on the wire)
      const ikL = this._solveIK(hipOffsetL, 0, 0, 0, leftFootY, ikZ_L);
      const qHipL = new THREE.Quaternion()
        .setFromAxisAngle(new THREE.Vector3(1, 0, 0), ikL.hipX)
        .multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), ikL.hipZ));
      const qKneeL = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -ikL.kneeX); // Negative knee bend

      // Solve IK for Right Leg (target X = 0 to be centered on the wire)
      const ikR = this._solveIK(hipOffsetR, 0, 0, 0, rightFootY, ikZ_R);
      const qHipR = new THREE.Quaternion()
        .setFromAxisAngle(new THREE.Vector3(1, 0, 0), ikR.hipX)
        .multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), ikR.hipZ));
      const qKneeR = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -ikR.kneeX); // Negative knee bend

      // Apply in local bone coordinate systems
      if (this.leftUpLegBone  && this.leftUpLegBone.userData.initQ)  this.leftUpLegBone.quaternion.copy(this.leftUpLegBone.userData.initQ).multiply(qHipL);
      if (this.rightUpLegBone && this.rightUpLegBone.userData.initQ) this.rightUpLegBone.quaternion.copy(this.rightUpLegBone.userData.initQ).multiply(qHipR);

      if (this.leftLegBone  && this.leftLegBone.userData.initQ)  this.leftLegBone.quaternion.copy(this.leftLegBone.userData.initQ).multiply(qKneeL);
      if (this.rightLegBone && this.rightLegBone.userData.initQ) this.rightLegBone.quaternion.copy(this.rightLegBone.userData.initQ).multiply(qKneeR);

      // Ankles flex to compensate hip rotation to keep foot sole flat on the wire + rotate slightly inward (toe-in) for tightrope grip
      const qToeInL = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0),  0.10);
      const qToeInR = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), -0.10);

      const qAnkleL = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), ikL.kneeX - ikL.hipX).multiply(qToeInL);
      const qAnkleR = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), ikR.kneeX - ikR.hipX).multiply(qToeInR);

      if (this.leftFootBone  && this.leftFootBone.userData.initQ)  this.leftFootBone.quaternion.copy(this.leftFootBone.userData.initQ).multiply(qAnkleL);
      if (this.rightFootBone && this.rightFootBone.userData.initQ) this.rightFootBone.quaternion.copy(this.rightFootBone.userData.initQ).multiply(qAnkleR);
    }

    // 8. OBERKÖRPER NEIGEN BEIM KIPPEN & GYRO BALANCIEREN:
    const phoneTilt = input;
    
    // Decouple physics from visual display to filter out hectic/twitchy movements
    this.smoothedBalance += (this.balance - this.smoothedBalance) * 7.5 * dt;
    this.smoothedTiltInput += (phoneTilt - this.smoothedTiltInput) * 7.5 * dt;

    const spineTiltAngle = -this.smoothedTiltInput * 0.45;
    const totalTorsoTilt = -this.smoothedBalance * 0.55 + spineTiltAngle * 0.75;
    
    // Spine container curvature & real-time torso sway
    if (this.spineGroup) {
      this.spineGroup.rotation.z = totalTorsoTilt * 0.60;
      this.spineGroup.rotation.x = Math.abs(this.smoothedTiltInput) * 0.12 + Math.abs(this.smoothedBalance) * 0.18;
    }

    if (this.spine1Bone) {
      if (!this.spine1Bone.userData.initQ) this.spine1Bone.userData.initQ = this.spine1Bone.quaternion.clone();
      const qSpine1 = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), totalTorsoTilt * 0.40);
      this.spine1Bone.quaternion.copy(qSpine1).multiply(this.spine1Bone.userData.initQ);
    }

    if (this.spine2Bone) {
      if (!this.spine2Bone.userData.initQ) this.spine2Bone.userData.initQ = this.spine2Bone.quaternion.clone();
      const qSpine2 = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), totalTorsoTilt * 0.40);
      this.spine2Bone.quaternion.copy(qSpine2).multiply(this.spine2Bone.userData.initQ);
    }

    // Strictly lock character X position to wire centerline X = 0 (No lateral body shifting)
    if (this.femaleModel && this.femaleModelInitPos) {
      this.femaleModel.position.x = this.femaleModelInitPos.x;
      const stepTwist = stepSine * 0.08;
      // Don't override Y during a spin trick, don't override X during a flip trick
      if (!this.inAirTrick || this.inAirTrick.id !== 'spin') {
        this.femaleModel.rotation.y = Math.PI + stepTwist;
      }
      if (!this.inAirTrick || this.inAirTrick.id !== 'flip') {
        this.femaleModel.rotation.x = 0;
      }
      this.femaleModel.rotation.z = totalTorsoTilt * 0.35;
    }

    if (this.hipsGroup) {
      this.hipsGroup.position.x = 0; // Strictly centered on tightrope wire
    }
    if (this.armsGroup) {
      this.armsGroup.rotation.z = this.smoothedBalance * 0.95 + this.smoothedTiltInput * 0.60;
    }

    // Dynamic procedural arm balancing animations for the 3D model (only when not performing a trick)
    const isSpinning = (this.inAirTrick && this.inAirTrick.id === 'spin');
    const isSquattingOrFlipped = this.isSquatting || (this.inAirTrick && this.inAirTrick.id === 'flip');

    if (!isSpinning && !isSquattingOrFlipped) {
      if (this.leftArmBone) {
        if (!this.leftArmBone.userData.initQ) this.leftArmBone.userData.initQ = this.leftArmBone.quaternion.clone();
        const qArmL = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), this.smoothedBalance * 0.45 + this.smoothedTiltInput * 0.30);
        this.leftArmBone.quaternion.copy(qArmL).multiply(this.leftArmBone.userData.initQ);
      }
      if (this.rightArmBone) {
        if (!this.rightArmBone.userData.initQ) this.rightArmBone.userData.initQ = this.rightArmBone.quaternion.clone();
        const qArmR = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), this.smoothedBalance * 0.45 + this.smoothedTiltInput * 0.30);
        this.rightArmBone.quaternion.copy(qArmR).multiply(this.rightArmBone.userData.initQ);
      }
      if (this.leftForeArmBone) {
        if (!this.leftForeArmBone.userData.initQ) this.leftForeArmBone.userData.initQ = this.leftForeArmBone.quaternion.clone();
        const qForeL = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.abs(this.smoothedBalance) * 0.25);
        this.leftForeArmBone.quaternion.copy(qForeL).multiply(this.leftForeArmBone.userData.initQ);
      }
      if (this.rightForeArmBone) {
        if (!this.rightForeArmBone.userData.initQ) this.rightForeArmBone.userData.initQ = this.rightForeArmBone.quaternion.clone();
        const qForeR = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, -1, 0), Math.abs(this.smoothedBalance) * 0.25);
        this.rightForeArmBone.quaternion.copy(qForeR).multiply(this.rightForeArmBone.userData.initQ);
      }
    }

    this.characterGroup.position.set(0, 0, 0);

        // FLUSH GPU SKELETON BUFFERS EVERY FRAME FOR ALL 6 SKINNED MESHES
    if (this.femaleModel) {
      this.femaleModel.updateMatrixWorld(true);
      this.femaleModel.traverse(child => {
        if (child.isSkinnedMesh && child.skeleton) {
          child.skeleton.update();
        }
      });
    }
  }

  updateWorld(dt) {
    const moveZ = this.forwardSpeed * dt;

    if (this.ropeRings) {
      for (let ring of this.ropeRings) {
        ring.position.z += moveZ;
        if (ring.position.z > 10) {
          ring.position.z -= 600;
        }
      }
    }

    if (this.buildings) {
      for (let b of this.buildings) {
        b.position.z += moveZ;
        if (b.position.z > 25) {
          b.position.z -= 800;
        }
      }
    }

    // Flash skyscraper warning lights (aviation lights)
    this.lightFlashTimer = (this.lightFlashTimer || 0) + dt;
    if (this.lightFlashTimer >= 1.0) {
      this.lightFlashTimer = 0;
    }
    const lightsOn = this.lightFlashTimer < 0.25;
    if (this.antennaLights) {
      for (let light of this.antennaLights) {
        light.visible = lightsOn;
      }
    }

    if (this.clouds) {
      this.cloudTime = (this.cloudTime || 0) + dt;
      for (let cloud of this.clouds) {
        // Move clouds along Z (scrolling world effect)
        cloud.position.z += moveZ;
        // Slow rotation
        cloud.rotation.z += cloud.userData.rotSpeed * dt;
        // Gentle horizontal sway
        const sway = Math.sin(this.cloudTime * cloud.userData.swaySpeed + cloud.userData.swayOffset) * 0.08;
        cloud.position.x += sway;

        // Wrap around when past camera
        if (cloud.position.z > 60) {
          cloud.position.z -= 800;
          cloud.position.x = (Math.random() - 0.5) * 160;
        }
      }
    }

    // Police chase under-cloud sirens update
    if (this.policeGroup) {
      if (!this.policeActive) {
        this.policeTimer = (this.policeTimer || 10.0) - dt;
        if (this.policeTimer <= 0) {
          this.policeActive = true;
          this.policeGroup.visible = false; // Hide lights initially for 1.5s sound lead-in
          this.policeElapsedTime = 0;
          this.sirenTime = 0;

          // Position on a street to the left or right of the wire
          this.policeX = Math.random() > 0.5 ? (-25 - Math.random() * 20) : (25 + Math.random() * 20);

          // Always start near the player and speed away into the far distance (negative Z)
          this.policeZ = -15;
          this.policeSpeed = -85; // Calibrated so that it speeds away and disappears in ~9-11 seconds

          this.policeGroup.position.set(this.policeX, -42.0, this.policeZ);

          // Play the siren sound 1.5s BEFORE lights become visible
          if (this.policeSound && this.sfxEnabled && this.state === GAME_STATE.PLAYING) {
            this.policeSound.volume = 0.0;
            this.policeSound.currentTime = 0;
            const playPromise = this.policeSound.play();
            if (playPromise !== undefined) {
              playPromise.catch(error => {
                console.warn("Police sound playback interrupted:", error);
              });
            }
          }
        }
      } else {
        this.policeElapsedTime += dt;

        // Sound starts at t=0, light becomes visible and starts driving at t=1.5s (1.5s after sound starts)
        const lightDelay = 1.5;
        if (this.policeElapsedTime >= lightDelay) {
          this.policeGroup.visible = true;
          // Move along Z, accounting for city scrolling (moveZ) so it stays anchored to the streets
          this.policeZ += this.policeSpeed * dt + moveZ;
          this.policeGroup.position.z = this.policeZ;
        } else {
          this.policeGroup.visible = false;
        }

        // Dynamic Siren Sound Volume:
        // Fade-in over first 1.5s (before light appears)
        // Hold volume from 1.5s to 5.5s
        // Gradual fade-out over 5s (5.5s to 10.5s) as car drives into distance
        if (this.policeSound) {
          let targetVol = 0.65;
          if (this.policeElapsedTime < 1.5) {
            targetVol *= (this.policeElapsedTime / 1.5); // Fade in over 1.5s before light appears
          } else if (this.policeElapsedTime >= 5.5) {
            const fadeProgress = Math.min(1.0, (this.policeElapsedTime - 5.5) / 5.0);
            targetVol *= (1.0 - fadeProgress); // Long gradual fade-out over 5s (5.5s to 10.5s)
          }
          // Turn off sound immediately if paused or game state is not playing
          this.policeSound.volume = targetVol * (this.sfxEnabled && this.state === GAME_STATE.PLAYING ? 1 : 0);

          if (this.policeElapsedTime >= 10.5 && !this.policeSound.paused) {
            this.policeSound.pause();
          }
        }

        // Flash sirens rapidly (rapid blue/red alternate) when light is visible
        if (this.policeElapsedTime >= lightDelay) {
          this.sirenTime += dt;
          const cycle = Math.floor(this.sirenTime * 16) % 4; // 16 Hz cycle
          if (cycle === 0) {
            this.policeBlueGlow.material.opacity = 0.90;
            this.policeRedGlow.material.opacity = 0.0;
          } else if (cycle === 1) {
            this.policeBlueGlow.material.opacity = 0.0;
            this.policeRedGlow.material.opacity = 0.0;
          } else if (cycle === 2) {
            this.policeBlueGlow.material.opacity = 0.0;
            this.policeRedGlow.material.opacity = 0.90;
          } else {
            this.policeBlueGlow.material.opacity = 0.0;
            this.policeRedGlow.material.opacity = 0.0;
          }
        }

        // Check if finished (out of bounds relative to camera viewport, or timed out at 11s)
        const outOfBounds = this.policeZ < -780;
        if (outOfBounds || this.policeElapsedTime >= 11.0) {
          this.policeActive = false;
          this.policeGroup.visible = false;
          // Set random timer for the next chase (min 15 seconds, up to 35 seconds)
          this.policeTimer = 15.0 + Math.random() * 20.0;

          if (this.policeSound) {
            this.policeSound.pause();
            this.policeSound.currentTime = 0;
          }
        }
      }
    }

    if (this.particles) {
      const positions = this.particles.geometry.attributes.position.array;
      const windDriftX = this.smoothedWindForce * 18 * dt;

      // Adjust particle visibility and size dynamically based on wind intensity
      if (this.particles.material) {
        const windIntensity = Math.abs(this.smoothedWindForce);
        this.particles.material.opacity = 0.45 + windIntensity * 0.45;
        this.particles.material.size = 0.14 + windIntensity * 0.12;
      }

      for (let i = 2; i < positions.length; i += 3) {
        // Move Z forward (character walking speed)
        positions[i] += moveZ;
        if (positions[i] > 10) {
          positions[i] = -200;
        }

        // Move X sideways (crosswind drift)
        positions[i - 2] += windDriftX;
        // Wrap X positions to stay within bounds
        if (positions[i - 2] > 20) {
          positions[i - 2] = -20;
        } else if (positions[i - 2] < -20) {
          positions[i - 2] = 20;
        }
      }
      this.particles.geometry.attributes.position.needsUpdate = true;
    }
  }

  updateFalling(dt) {
    this.fallVelocityY += this.gravity * dt;
    this.characterGroup.position.y += this.fallVelocityY * dt;

    if (this.femaleModel) {
      this.femaleModel.rotation.x += 4.5 * dt;
      this.femaleModel.rotation.y += 3.2 * dt;
      this.femaleModel.rotation.z += this.fallDirection * 6.0 * dt;
    }

    if (this.spineGroup) {
      this.spineGroup.rotation.z += this.fallDirection * 3 * dt;
    }

    // Camera tracks the falling character
    this.camera.position.y += (this.characterGroup.position.y + 2.5 - this.camera.position.y) * 4.0 * dt;
    this.camera.position.z += (this.characterGroup.position.z + 3.5 - this.camera.position.z) * 4.0 * dt;
    this.camera.lookAt(this.characterGroup.position);

    if (this.characterGroup.position.y < -30) {
      this.gameOver(this.fallReason || "Abgestürzt!");
    }
  }
}

// Instantiate Game on Page Load
window.addEventListener('load', () => {
  window.game = new SeiltanzerGame();
});
