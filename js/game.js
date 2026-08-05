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
    
    // Physics & Balance
    this.balance = 0; // -1.0 (left fall) to +1.0 (right fall)
    this.balanceVelocity = 0;
    this.targetTiltInput = 0;
    this.filteredTiltInput = 0;
    
    // Gyro / Sensor Calibration
    this.calibrationGamma = 0;
    this.rawGamma = 0;
    this.gyroActive = false;
    this.gyroBound = false;
    
    // Player Motion
    this.forwardSpeed = 4.2; // units per sec
    this.isJumping = false;
    this.jumpY = 0;
    this.jumpVY = 0;
    this.gravity = -22;
    this.jumpPower = 8.5;
    this.inAirTrick = null;
    this.isSquatting = false;
    this.squatTimer = 0;
    
    // Step Animation
    this.walkCycle = 0;
    
    // Audio Engine
    this.audioCtx = null;
    this.audioInitialized = false;
    this.windSoundGain = null;

    // DOM Elements
    this.initDOM();
    
    // Setup Three.js Scene
    this.initThree();
    
    // Build 3D World & Load Megan 3D Character Model
    this.buildWorld();
    this.buildCharacter();
    
    // Input Event Listeners
    this.initInputs();
    
    // Animation Loop
    this.clock = new THREE.Clock();
    requestAnimationFrame((t) => this.animate(t));
  }

  /* -------------------------------------------------- */
  /* DOM INITIALIZATION                                 */
  /* -------------------------------------------------- */
  initDOM() {
    this.dom = {
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
      loaderBarFill: document.getElementById('loader-bar-fill')
    };

    this.musicEnabled = true;
    this.sfxEnabled = true;
    this.clickCount = 0;
    this.clickTimer = null;
    this.isModelLoaded = false;
    this.isLoadingRequested = false;

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
    if (this.dom.pauseModal) this.dom.pauseModal.classList.remove('hidden');
  }

  resumeGame() {
    if (this.state !== GAME_STATE.PAUSED) return;
    this.state = GAME_STATE.PLAYING;
    if (this.musicEnabled) this.playMusic();
    if (this.dom.pauseModal) this.dom.pauseModal.classList.add('hidden');
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

  stopMusic() {
    if (this.bgMusic) {
      this.bgMusic.pause();
      this.bgMusic.currentTime = 0;
    }
  }

  returnToHome() {
    this.state = GAME_STATE.START;
    this.isLoadingRequested = false;
    this.stopMusic();
    if (this.dom.startModal) this.dom.startModal.classList.remove('hidden');
    if (this.dom.gameoverModal) this.dom.gameoverModal.classList.add('hidden');
    this.distance = 0;
    this.score = 0;
    this.balance = 0;
    this.balanceVelocity = 0;
    if (this.dom.valDistance) this.dom.valDistance.textContent = '0 m';
    if (this.dom.valScore) this.dom.valScore.textContent = '0';
    if (this.dom.balanceNeedle) this.dom.balanceNeedle.style.left = '50%';
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
      0.1,
      1000
    );
    this.camera.position.set(0, 2.3, 3.8);
    this.camera.lookAt(0, 1.25, -5);

    // 1. BELEUCHTUNG & SCHATTEN: High-Visibility Character Lighting
    this.renderer = new THREE.WebGLRenderer({
      canvas: canvas,
      antialias: true,
      powerPreference: "high-performance"
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
  }

  buildBuildings() {
    this.buildings = [];
    const buildingGeo = new THREE.BoxGeometry(1, 1, 1);
    const buildingMat = new THREE.MeshStandardMaterial({
      color: 0x121a36,
      roughness: 0.7
    });

    for (let i = 0; i < 40; i++) {
      const isLeft = Math.random() > 0.5;
      const x = (isLeft ? -1 : 1) * (15 + Math.random() * 35);
      const z = -i * 20;
      const height = 40 + Math.random() * 80;
      const width = 12 + Math.random() * 16;
      const depth = 12 + Math.random() * 16;

      const building = new THREE.Mesh(buildingGeo, buildingMat);
      building.scale.set(width, height, depth);
      building.position.set(x, -height / 2 - 10, z);
      building.castShadow = true;
      building.receiveShadow = true;
      this.worldGroup.add(building);
      this.buildings.push(building);

      if (Math.random() > 0.4) {
        const antennaGeo = new THREE.CylinderGeometry(0.2, 0.2, 15);
        const antennaMat = new THREE.MeshBasicMaterial({ color: 0xff0055 });
        const antenna = new THREE.Mesh(antennaGeo, antennaMat);
        antenna.position.set(0, 0.5 + 7.5 / height, 0);
        building.add(antenna);
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

    // Load Real 3D Female Character Model (character.glb)
    this.loadGLTFCharacter();

    this.characterGroup.position.set(0, 0, 0);
  }

  loadGLTFCharacter() {
    if (this._gltfLoadingStarted) return;
    this._gltfLoadingStarted = true;

    // Timeout safety fallback: if network loading takes > 3.0s, construct procedural 3D Gymnast
    const fallbackTimer = setTimeout(() => {
      if (!this.femaleModel) {
        console.warn('⚠️ GLB loading timeout: creating procedural 3D gymnast fallback');
        this.buildProceduralGymnast();
        this._triggerStartSequence();
      }
    }, 3200);

    const setup = (gltf) => {
      clearTimeout(fallbackTimer);
      try {
        const model = gltf.scene;
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
        this.spine1Bone = null;
        this.spine2Bone = null;

        model.traverse(child => {
          const name = child.name.toLowerCase();
          if (name.includes('leftupleg')) this.leftUpLegBone = child;
          else if (name.includes('rightupleg')) this.rightUpLegBone = child;
          else if (name.includes('leftleg') && !name.includes('up')) this.leftLegBone = child;
          else if (name.includes('rightleg') && !name.includes('up')) this.rightLegBone = child;
          else if (name.includes('spine1') || (name.includes('spine') && !this.spine1Bone)) this.spine1Bone = child;
          else if (name.includes('spine2')) this.spine2Bone = child;

          if (child.isBone || child.type === 'Bone') {
            child.userData.initQ = child.quaternion.clone();
          }
        });

        [this.leftUpLegBone, this.rightUpLegBone, this.leftLegBone, this.rightLegBone, this.spine1Bone, this.spine2Bone]
        .forEach(b => {
          if (b && !b.userData.initQ) b.userData.initQ = b.quaternion.clone();
        });

        const box = new THREE.Box3().setFromObject(model);
        const h   = box.getSize(new THREE.Vector3()).y;
        model.scale.setScalar(1.75 / (h || 1));
        box.setFromObject(model);
        const c = box.getCenter(new THREE.Vector3());
        this.femaleModelInitPos = new THREE.Vector3(-c.x, -box.min.y + 0.040, -c.z);
        model.position.copy(this.femaleModelInitPos);

        this.femaleModel = model;
        this.airGroup.add(model);
        this.isModelLoaded = true;
        console.log('✅ Real 3D Female Character Model loaded & ready!');
      } catch (e) {
        console.error('Error during setup model:', e);
        if (!this.femaleModel) this.buildProceduralGymnast();
      }
      this._triggerStartSequence();
    };

    const onProgress = (xhr) => {
      const bytesLoaded = xhr.loaded || 0;
      const expectedTotal = (xhr.total && xhr.total > 0) ? xhr.total : 9362204;
      const percent = Math.min(99, Math.round((bytesLoaded / expectedTotal) * 100));
      if (this.dom.loaderPercent) this.dom.loaderPercent.textContent = percent + '%';
      if (this.dom.loaderBarFill) this.dom.loaderBarFill.style.width = percent + '%';
    };

    const onError = (err) => {
      clearTimeout(fallbackTimer);
      console.warn('GLB load error, creating procedural 3D gymnast fallback:', err);
      if (!this.femaleModel) this.buildProceduralGymnast();
      this._triggerStartSequence();
    };

    const modelUrl = 'assets/character.glb';
    if (typeof THREE.GLTFLoader !== 'undefined') {
      new THREE.GLTFLoader().load(modelUrl, setup, onProgress, onError);
    } else {
      this.buildProceduralGymnast();
      this._triggerStartSequence();
    }
  }

  buildProceduralGymnast() {
    if (this.femaleModel) return;
    const group = new THREE.Group();

    const skinMat = new THREE.MeshStandardMaterial({ color: 0xe0ac69, roughness: 0.6 });
    const topMat = new THREE.MeshStandardMaterial({ color: 0xff007f, roughness: 0.4 });
    const pantsMat = new THREE.MeshStandardMaterial({ color: 0x1a1638, roughness: 0.5 });

    // Torso
    const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.14, 0.50, 16), topMat);
    torso.position.y = 1.05;
    torso.castShadow = true;
    group.add(torso);

    // Head
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.12, 16, 16), skinMat);
    head.position.y = 1.45;
    head.castShadow = true;
    group.add(head);

    // Legs
    const legL = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.04, 0.75, 12), pantsMat);
    legL.position.set(-0.09, 0.42, 0);
    legL.castShadow = true;
    group.add(legL);

    const legR = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.04, 0.75, 12), pantsMat);
    legR.position.set(0.09, 0.42, 0);
    legR.castShadow = true;
    group.add(legR);

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

    if (this.poleTipLeft && this.poleTipRight) {
      const bend = Math.sin(time * 3.5) * 0.03;
      this.poleTipLeft.position.y = bend;
      this.poleTipRight.position.y = -bend;
    }
  }

  /* -------------------------------------------------- */
  /* INPUT & CONTROLS MANAGER                          */
  /* -------------------------------------------------- */

  initInputs() {
    // 1. Keyboard Controls
    window.addEventListener('keydown', (e) => {
      if (this.state !== GAME_STATE.PLAYING) {
        if (e.code === 'Space' || e.code === 'Enter') {
          this.requestSensorsAndStart();
        }
        return;
      }
      if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') this.targetTiltInput = -1.0;
      else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') this.targetTiltInput = 1.0;
      else if (e.code === 'Space') this.triggerJump();
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
        if (this.state !== GAME_STATE.PLAYING) {
          this.requestSensorsAndStart();
        }
      });
    };

    bindStartButton(this.dom.btnStart);
    bindStartButton(this.dom.btnRestart);
    bindStartButton(this.dom.btnEnableSensor);



    if (this.dom.btnCalibrate) {
      this.dom.btnCalibrate.addEventListener('click', () => {
        this.calibrationGamma = this.rawGamma || 0;
        this.showToast("Gyro Nulllage gespeichert!");
      });
    }

    const bindBtnClick = (elem, fn) => {
      if (!elem) return;
      elem.addEventListener('click', (e) => {
        if (e) e.stopPropagation();
        fn();
      });
    };

    bindBtnClick(this.dom.btnAction, () => this.handleActionClick());
    bindBtnClick(this.dom.btnPause, () => this.pauseGame());
    bindBtnClick(this.dom.btnResume, () => this.resumeGame());
    bindBtnClick(this.dom.btnToggleMusic, () => this.toggleMusic());
    bindBtnClick(this.dom.btnToggleSFX, () => this.toggleSFX());
    bindBtnClick(this.dom.btnPauseHome, () => this.returnToHome());

    this.bindGyro();
  }

  requestSensorsAndStart() {
    this.isLoadingRequested = true;

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
        if (this.dom.loadingOverlay) {
          this.dom.loadingOverlay.classList.add('hidden');
          this.dom.loadingOverlay.style.display = 'none';
        }
        if (this.state !== GAME_STATE.PLAYING) {
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
        this.showToast('📱 Gyroskop aktiv!');
      }

      this.gyroActive = true;
      this.rawGamma = raw;

      const delta = raw - this.calibrationGamma;
      // ÷15 so ±15° = full tilt input
      this.targetTiltInput = Math.max(-1.0, Math.min(1.0, delta / 15.0));
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
    this.targetTiltInput = 0;
    this.filteredTiltInput = 0;
    this.isJumping = false;
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

    // Reset Camera
    this.camera.position.set(0, 2.3, 3.8);
    this.camera.lookAt(0, 1.25, -5);

    // Hide Modals immediately
    if (this.dom.startModal) {
      this.dom.startModal.classList.add('hidden');
      this.dom.startModal.style.display = 'none';
    }
    if (this.dom.gameoverModal) {
      this.dom.gameoverModal.classList.add('hidden');
      this.dom.gameoverModal.style.display = 'none';
    }
  }

  triggerJump() {
    if (this.state !== GAME_STATE.PLAYING || this.isJumping) return;
    this.isJumping = true;
    this.trickProgress = 0;
    this.jumpVY = this.jumpPower;
    this.playAudioTone(300, 'sine', 0.12, 0.12);
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
    this.playFallSound();

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

    // Reset submit UI
    if (this.dom.scoreStatus)  { this.dom.scoreStatus.textContent = ''; this.dom.scoreStatus.className = 'score-status'; }
    if (this.dom.btnSubmitScore)  this.dom.btnSubmitScore.disabled = false;
    if (this.dom.nameEntrySection) this.dom.nameEntrySection.style.display = '';
    if (this.dom.gameoverLeaderboard) this.dom.gameoverLeaderboard.style.display = 'none';

    // Wire submit button (replace to avoid duplicate listeners)
    if (this.dom.btnSubmitScore) {
      const btn = this.dom.btnSubmitScore;
      const newBtn = btn.cloneNode(true);
      btn.parentNode.replaceChild(newBtn, btn);
      this.dom.btnSubmitScore = newBtn;

      newBtn.addEventListener('click', async () => {
        const name = (this.dom.playerNameInput?.value || '').trim();
        if (!name) {
          this._setScoreStatus('Bitte gib deinen Namen ein!', 'error');
          return;
        }
        newBtn.disabled = true;
        this._setScoreStatus('Wird gespeichert…', 'loading');
        const result = await window.HighscoreDB.submitScore(name, this.score, Math.floor(this.distance), this.tricksCount);
        if (result) {
          this._setScoreStatus('✅ Score gespeichert!', 'success');
          if (this.dom.nameEntrySection) this.dom.nameEntrySection.style.display = 'none';
          // Show leaderboard after submit
          await this._loadGameoverLeaderboard(name, this.score);
        } else {
          this._setScoreStatus('⚠️ Fehler beim Speichern. Nochmal versuchen?', 'error');
          newBtn.disabled = false;
        }
      });
    }

    setTimeout(() => {
      if (this.dom.gameoverModal) {
        this.dom.gameoverModal.style.display = 'flex';
        this.dom.gameoverModal.classList.remove('hidden');
      }
    }, 1000);
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

    updatePhysics(dt) {
    // 1. Smooth Tilt Input Filter & Deadzone
    this.filteredTiltInput += (this.targetTiltInput - this.filteredTiltInput) * 10.0 * dt;
    let input = this.filteredTiltInput;
    if (Math.abs(input) < 0.06) input = 0;

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

    // Smooth Wind Sound Audio Gain Fade-In (Anschwellen) & Fade-Out (Abklingen)
    if (this.windSoundGain) {
      const targetGain = (this.sfxEnabled && this.state === GAME_STATE.PLAYING) ? (0.02 + Math.abs(this.windForce) * 0.18) : 0;
      const currentGain = this.windSoundGain.gain.value;
      const fadeSpeed = (this.windForce !== 0) ? 2.8 : 1.2; // Zügiges Anschwellen, sanftes Ausklingen
      this.windSoundGain.gain.value += (targetGain - currentGain) * fadeSpeed * dt;
    }

    // 3. Balance Physics Equations
    const userControlTorque = -input * 4.2;
    const windTorque = this.windForce * 0.85;

    const autoRestoreTorque = (!this.windForce && Math.abs(input) < 0.15) ? -this.balance * 3.0 : 0;
    const gravityTorque = Math.abs(this.balance) > 0.28 ? Math.sign(this.balance) * (Math.abs(this.balance) - 0.28) * 4.5 : 0;

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
      this.fallVelocityY = 0;
      this.fallDirection = Math.sign(this.balance);
      this.gameOver(this.balance > 0 ? "Nach rechts abgestürzt!" : "Nach links abgestürzt!");
      return;
    }

    // 5. Forward Distance & Score Tracking
    this.distance += this.forwardSpeed * dt;
    this.score += Math.floor(this.forwardSpeed * dt * 10);

    this.dom.valDistance.textContent = `${Math.floor(this.distance)} m`;
    this.dom.valScore.textContent = this.score;

    // 6. Jump & 3 Natural Acrobatics Physics (Sprung, Sprung & Drehung, Salto, Hocke)
    if (this.isSquatting) {
      this.squatTimer += dt;
      const p = Math.sin(Math.min(1.0, this.squatTimer / 1.3) * Math.PI);
      
      if (this.hipsGroup) this.hipsGroup.position.y = -p * 0.38;
      if (this.spineGroup) this.spineGroup.rotation.x = p * 0.35;
      
      const qSquatThigh = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), p * 1.05);
      const qSquatKnee = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), p * 1.30);

      if (this.leftUpLegBone) {
        if (!this.leftUpLegBone.userData.initQ) this.leftUpLegBone.userData.initQ = this.leftUpLegBone.quaternion.clone();
        this.leftUpLegBone.quaternion.copy(qSquatThigh).multiply(this.leftUpLegBone.userData.initQ);
      }
      if (this.rightUpLegBone) {
        if (!this.rightUpLegBone.userData.initQ) this.rightUpLegBone.userData.initQ = this.rightUpLegBone.quaternion.clone();
        this.rightUpLegBone.quaternion.copy(qSquatThigh).multiply(this.rightUpLegBone.userData.initQ);
      }
      if (this.leftLegBone) {
        if (!this.leftLegBone.userData.initQ) this.leftLegBone.userData.initQ = this.leftLegBone.quaternion.clone();
        this.leftLegBone.quaternion.copy(qSquatKnee).multiply(this.leftLegBone.userData.initQ);
      }
      if (this.rightLegBone) {
        if (!this.rightLegBone.userData.initQ) this.rightLegBone.userData.initQ = this.rightLegBone.quaternion.clone();
        this.rightLegBone.quaternion.copy(qSquatKnee).multiply(this.rightLegBone.userData.initQ);
      }

      if (this.squatTimer >= 1.3) {
        this.isSquatting = false;
        this.squatTimer = 0;
        if (this.hipsGroup) this.hipsGroup.position.y = 0;
        if (this.spineGroup) this.spineGroup.rotation.x = 0;
        this.inAirTrick = null;
        this.showToast("Perfekte Hocke!");
      }
    } else if (this.isJumping) {
      this.jumpY += this.jumpVY * dt;
      this.jumpVY += this.gravity * dt;
      this.airGroup.position.y = this.jumpY;

      if (this.inAirTrick) {
        this.trickProgress = (this.trickProgress || 0) + dt * 2.2;
        const p = Math.min(1.0, this.trickProgress);

        if (this.inAirTrick.id === 'spin') {
          if (this.femaleModel) {
            this.femaleModel.rotation.y = Math.PI + p * Math.PI * 2;
          }
        } else if (this.inAirTrick.id === 'flip') {
          if (this.femaleModel) {
            this.femaleModel.rotation.x = p * Math.PI * 2;
          }
          const flipPhase = Math.sin(p * Math.PI);
          const qFlipKnee = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), flipPhase * 1.10);
          if (this.leftLegBone) this.leftLegBone.quaternion.copy(qFlipKnee).multiply(this.leftLegBone.userData.initQ);
          if (this.rightLegBone) this.rightLegBone.quaternion.copy(qFlipKnee).multiply(this.rightLegBone.userData.initQ);
        }
      }

      // Landing Check
      if (this.jumpY <= 0) {
        this.jumpY = 0;
        this.isJumping = false;
        this.trickProgress = 0;
        this.airGroup.position.y = 0;
        this.airGroup.rotation.set(0, 0, 0);

        if (this.femaleModel) {
          this.femaleModel.rotation.x = 0;
          this.femaleModel.rotation.y = Math.PI;
        }

        if (Math.abs(this.balance) > 0.4) {
          this.balance += Math.sign(this.balance) * 0.35;
          this.showToast("Wackelige Landung!");
        } else {
          this.showToast("Perfekte Landung!");
        }

        this.inAirTrick = null;
      }
    }

    // 7. SLOWER PRECISE TIGHTROPE GAIT (Runs ONLY when NOT squatting!)
    if (!this.isSquatting) {
      this.walkCycle += dt * 4.5; // Slower, measured step cadence
      if (Math.sin(this.walkCycle) > 0.95 && !this.isJumping) {
        this.playStepSound();
      }

      const stepSine = Math.sin(this.walkCycle);
      const stepAngle = stepSine * 0.42;

      // Precise inward thigh angle so left and right feet land directly on the tightrope wire centerline (X = 0)
      const inAngleL = 0.11 + Math.max(0, stepSine) * 0.14;
      const inAngleR = -0.11 - Math.max(0, -stepSine) * 0.14;

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
        const qKneeL = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.max(0, stepSine) * 0.48);
        this.leftLegBone.quaternion.copy(qKneeL).multiply(this.leftLegBone.userData.initQ);
      }
      if (this.rightLegBone) {
        if (!this.rightLegBone.userData.initQ) this.rightLegBone.userData.initQ = this.rightLegBone.quaternion.clone();
        const qKneeR = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.max(0, -stepSine) * 0.48);
        this.rightLegBone.quaternion.copy(qKneeR).multiply(this.rightLegBone.userData.initQ);
      }
    }

    // 8. OBERKÖRPER NEIGEN BEIM KIPPEN & GYRO BALANCIEREN:
    const phoneTilt = input;
    const spineTiltAngle = -phoneTilt * 0.45;
    const totalTorsoTilt = -this.balance * 0.55 + spineTiltAngle * 0.75;
    
    // Spine container curvature & real-time torso sway
    if (this.spineGroup) {
      this.spineGroup.rotation.z = totalTorsoTilt * 0.60;
      this.spineGroup.rotation.x = Math.abs(phoneTilt) * 0.12 + Math.abs(this.balance) * 0.18;
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
      this.femaleModel.rotation.y = Math.PI + stepTwist;
      this.femaleModel.rotation.z = totalTorsoTilt * 0.35;
    }

    if (this.hipsGroup) {
      this.hipsGroup.position.x = 0; // Strictly centered on tightrope wire
    }
    if (this.armsGroup) {
      this.armsGroup.rotation.z = this.balance * 0.95 + phoneTilt * 0.60;
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

    if (this.particles) {
      const positions = this.particles.geometry.attributes.position.array;
      for (let i = 2; i < positions.length; i += 3) {
        positions[i] += moveZ;
        if (positions[i] > 10) {
          positions[i] = -200;
        }
      }
      this.particles.geometry.attributes.position.needsUpdate = true;
    }
  }

  updateFalling(dt) {
    this.fallVelocityY += this.gravity * dt;
    this.characterGroup.position.y += this.fallVelocityY * dt;
    this.spineGroup.rotation.z += this.fallDirection * 4 * dt;
    this.spineGroup.rotation.x += 2 * dt;

    this.camera.position.y += 0.5 * dt;
    this.camera.lookAt(this.characterGroup.position);
  }
}

// Instantiate Game on Page Load
window.addEventListener('load', () => {
  window.game = new SeiltanzerGame();
});
