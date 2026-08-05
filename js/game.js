/**
 * SEILTÄNZERIN 3D - High Wire Balancing Game Engine
 * Powered by Three.js (WebGL), FBXLoader & Web Audio API
 */

// Game States
const GAME_STATE = {
  START: 'START',
  PLAYING: 'PLAYING',
  FALLING: 'FALLING',
  GAMEOVER: 'GAMEOVER'
};

class SeiltanzerGame {
  constructor() {
    this.state = GAME_STATE.START;
    
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
    this.forwardSpeed = 7.0; // units per sec
    this.isJumping = false;
    this.jumpY = 0;
    this.jumpVY = 0;
    this.gravity = -22;
    this.jumpPower = 8.5;
    this.inAirTrick = null;
    
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
      btnRight: document.getElementById('btn-right')
    };
  }

  /* -------------------------------------------------- */
  /* THREE.JS SCENE SETUP                               */
  /* -------------------------------------------------- */
  initThree() {
    const canvas = document.getElementById('game-canvas');

    this.scene = new THREE.Scene();
    
    // Dramatic Sunset/Alpine Atmospheric Fog
    this.scene.background = new THREE.Color(0x0a1026);
    this.scene.fog = new THREE.FogExp2(0x0a1026, 0.007);

    // Camera setup (3rd Person View behind character at Z=0)
    this.camera = new THREE.PerspectiveCamera(
      65,
      window.innerWidth / window.innerHeight,
      0.1,
      1000
    );
    this.camera.position.set(0, 3.1, 5.2);
    this.camera.lookAt(0, 1.7, -10);

    // Renderer setup
    this.renderer = new THREE.WebGLRenderer({
      canvas: canvas,
      antialias: true,
      powerPreference: "high-performance"
    });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.85);
    this.scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffdfa9, 1.4);
    dirLight.position.set(20, 40, 20);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 1024;
    dirLight.shadow.mapSize.height = 1024;
    dirLight.shadow.camera.near = 0.5;
    dirLight.shadow.camera.far = 150;
    dirLight.shadow.camera.left = -20;
    dirLight.shadow.camera.right = 20;
    dirLight.shadow.camera.top = 20;
    dirLight.shadow.camera.bottom = -20;
    this.scene.add(dirLight);

    const fillLight = new THREE.DirectionalLight(0x00f2fe, 0.55);
    fillLight.position.set(-20, 10, -20);
    this.scene.add(fillLight);

    window.addEventListener('resize', () => this.onWindowResize());
  }

  onWindowResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  /* -------------------------------------------------- */
  /* BUILD WORLD & ENVIRONMENT                          */
  /* -------------------------------------------------- */
  buildWorld() {
    this.worldGroup = new THREE.Group();
    this.scene.add(this.worldGroup);

    // 1. Tightrope Wire (Single Center Line X = 0)
    const ropeGeo = new THREE.CylinderGeometry(0.035, 0.035, 1000, 12);
    ropeGeo.rotateX(Math.PI / 2);
    const ropeMat = new THREE.MeshStandardMaterial({
      color: 0xdddddd,
      metalness: 0.85,
      roughness: 0.25
    });
    this.ropeMesh = new THREE.Mesh(ropeGeo, ropeMat);
    this.ropeMesh.position.set(0, 0, -450);
    this.worldGroup.add(this.ropeMesh);

    // Dynamic Rope Support Rings
    this.ropeRings = [];
    const ringGeo = new THREE.TorusGeometry(0.055, 0.015, 8, 16);
    const ringMat = new THREE.MeshStandardMaterial({ color: 0xff007f });
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

    // Build Metallic 5.4m Balance Pole Group
    this.armsGroup = new THREE.Group();
    this.armsGroup.position.set(0, 1.45, 0);
    this.airGroup.add(this.armsGroup);

    const poleMat = new THREE.MeshStandardMaterial({
      color: 0xffd700, // Metallic Gold Carbon
      metalness: 0.9,
      roughness: 0.15
    });

    const poleGeo = new THREE.CylinderGeometry(0.028, 0.028, 5.4, 16);
    poleGeo.rotateZ(Math.PI / 2);
    this.balancePole = new THREE.Mesh(poleGeo, poleMat);
    this.balancePole.position.set(0, -0.35, -0.15);
    this.balancePole.castShadow = true;
    this.armsGroup.add(this.balancePole);

    const weightGeo = new THREE.SphereGeometry(0.06, 12, 12);
    const weightMat = new THREE.MeshStandardMaterial({ color: 0xff007f, metalness: 0.9, roughness: 0.1 });
    
    this.poleTipLeft = new THREE.Mesh(weightGeo, weightMat);
    this.poleTipLeft.position.set(-2.7, 0, 0);
    this.balancePole.add(this.poleTipLeft);

    this.poleTipRight = new THREE.Mesh(weightGeo, weightMat);
    this.poleTipRight.position.set(2.7, 0, 0);
    this.balancePole.add(this.poleTipRight);

    // Load Megan 3D Model (character.fbx)
    this.loadGLTFCharacter();

    this.characterGroup.position.set(0, 0, 0);
  }

  loadGLTFCharacter() {
    const setupModel = (modelObj) => {
      this.femaleModel = modelObj;

      this.femaleModel.rotation.set(0, Math.PI, 0);
      this.femaleModel.scale.set(1, 1, 1);
      this.femaleModel.position.set(0, 0, 0);

      this.leftUpLegBone = null;
      this.leftLegBone = null;
      this.rightUpLegBone = null;
      this.rightLegBone = null;
      this.spine1Bone = null;
      this.spine2Bone = null;

      this.femaleModel.traverse((child) => {
        // Exact Mixamo bone names: mixamorig2:LeftUpLeg etc.
        const n = child.name;
        const bName = n.toLowerCase().replace(/mixamorig\d*:/g, '');

        if (child.rotation) {
          child.userData.initRotation = child.rotation.clone();
        }

        if (bName === 'leftupleg') {
          this.leftUpLegBone = child;
        } else if (bName === 'leftleg') {
          this.leftLegBone = child;
        } else if (bName === 'rightupleg') {
          this.rightUpLegBone = child;
        } else if (bName === 'rightleg') {
          this.rightLegBone = child;
        } else if (bName === 'spine1') {
          this.spine1Bone = child;
        } else if (bName === 'spine2') {
          this.spine2Bone = child;
        } else if (bName === 'spine' && !this.spine1Bone) {
          this.spine1Bone = child;
        }

        if (child.isMesh) {
          child.castShadow = true;
          child.receiveShadow = true;
          if (child.material) {
            child.material.side = THREE.DoubleSide;
          }
        }
      });
      console.log('Bones found - LeftUpLeg:', !!this.leftUpLegBone, 'RightUpLeg:', !!this.rightUpLegBone, 'Spine1:', !!this.spine1Bone);

      const box = new THREE.Box3().setFromObject(this.femaleModel);
      const size = box.getSize(new THREE.Vector3());
      const targetHeight = 1.75;
      const scaleFactor = targetHeight / (size.y || 1.0);
      this.femaleModel.scale.set(scaleFactor, scaleFactor, scaleFactor);

      box.setFromObject(this.femaleModel);
      const center = box.getCenter(new THREE.Vector3());
      this.femaleModel.position.x = -center.x;
      this.femaleModel.position.y = -box.min.y;
      this.femaleModel.position.z = -center.z;

      this.airGroup.add(this.femaleModel);
      console.log("✅ Megan 3D Model loaded & centered on wire!");
      this.showToast("✅ Megan 3D geladen!");
    };

    const handleProgress = (xhr) => {
      if (xhr.lengthComputable) {
        const percent = Math.round((xhr.loaded / xhr.total) * 100);
        this.showToast(`Lade Megan: ${percent}%`);
      }
    };

    if (typeof THREE.GLTFLoader !== 'undefined') {
      const loader = new THREE.GLTFLoader();
      loader.load(
        './assets/character.glb',
        (gltf) => setupModel(gltf.scene),
        handleProgress,
        (err) => console.error("GLB Load error:", err)
      );
    } else {
      console.error("THREE.GLTFLoader not found!");
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
      const startFn = (e) => {
        if (e) {
          e.preventDefault();
          e.stopPropagation();
        }
        this.requestSensorsAndStart();
      };
      elem.addEventListener('click', startFn);
      elem.addEventListener('pointerdown', startFn);
      elem.addEventListener('touchstart', startFn);
    };

    bindStartButton(this.dom.btnStart);
    bindStartButton(this.dom.btnRestart);
    bindStartButton(this.dom.btnEnableSensor);

    if (this.dom.startModal) {
      this.dom.startModal.addEventListener('pointerdown', (e) => {
        if (this.state === GAME_STATE.START) {
          this.requestSensorsAndStart();
        }
      });
    }

    if (this.dom.btnCalibrate) {
      this.dom.btnCalibrate.addEventListener('click', () => {
        this.calibrationGamma = this.rawGamma || 0;
        this.showToast("Gyro Nulllage gespeichert!");
      });
    }

    this.bindGyro();
  }

  requestSensorsAndStart() {
    this.startGame();

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
    this.camera.position.set(0, 3.1, 5.2);
    this.camera.lookAt(0, 1.7, -10);

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
    this.jumpVY = this.jumpPower;
    this.playAudioTone(300, 'sine', 0.12, 0.12);
  }

  triggerTrick() {
    if (this.state !== GAME_STATE.PLAYING || !this.isJumping || this.inAirTrick) return;
    
    const tricks = [
      { name: '360 SPAGAT-SPIN', points: 300, type: 'spin' },
      { name: 'SALTO MORTALE', points: 500, type: 'flip' },
      { name: 'HERO POSE', points: 400, type: 'hero' }
    ];

    const trick = tricks[Math.floor(Math.random() * tricks.length)];
    this.inAirTrick = trick;
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

    setTimeout(() => {
      if (this.dom.gameoverModal) {
        this.dom.gameoverModal.style.display = 'flex';
        this.dom.gameoverModal.classList.remove('hidden');
      }
    }, 1000);
  }

  /* -------------------------------------------------- */
  /* ANIMATION & REALISTIC ORGANIC BALANCING TICK       */
  /* -------------------------------------------------- */
  animate(timestamp) {
    requestAnimationFrame((t) => this.animate(t));

    const dt = Math.min(this.clock.getDelta(), 0.1);

    if (this.state === GAME_STATE.PLAYING) {
      this.updatePhysics(dt);
      this.updateWorld(dt);
    } else if (this.state === GAME_STATE.FALLING) {
      this.updateFalling(dt);
    }

    this.renderer.render(this.scene, this.camera);
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

    if (this.windSoundGain) {
      this.windSoundGain.gain.value = 0.05 + Math.abs(this.windForce) * 0.15;
    }

    // 3. Balance Physics Equations
    const userControlTorque = -input * 4.2;
    const windTorque = this.windForce * 0.85;

    const autoRestoreTorque = (!this.windForce && Math.abs(input) < 0.15) ? -this.balance * 3.0 : 0;
    const gravityTorque = Math.abs(this.balance) > 0.28 ? Math.sign(this.balance) * (Math.abs(this.balance) - 0.28) * 4.5 : 0;

    this.balanceVelocity += (userControlTorque + windTorque + autoRestoreTorque + gravityTorque) * dt;
    this.balance += this.balanceVelocity * dt;

    this.balanceVelocity *= 0.90;

    // HUD Needle Sync
    const needlePos = 50 + (this.balance * 50);
    this.dom.balanceNeedle.style.left = `${Math.max(0, Math.min(100, needlePos))}%`;
    if (Math.abs(this.balance) > 0.65) {
      this.dom.balanceNeedle.classList.add('balance-warning');
    } else {
      this.dom.balanceNeedle.classList.remove('balance-warning');
    }

    // 4. Fall Check
    if (Math.abs(this.balance) > 1.0) {
      this.state = GAME_STATE.FALLING;
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

    // 6. Jump & Acrobatics Physics
    if (this.isJumping) {
      this.jumpY += this.jumpVY * dt;
      this.jumpVY += this.gravity * dt;
      this.airGroup.position.y = this.jumpY;

      if (this.inAirTrick) {
        if (this.inAirTrick.type === 'spin') {
          this.airGroup.rotation.y += 12 * dt;
        } else if (this.inAirTrick.type === 'flip') {
          this.airGroup.rotation.x += 12 * dt;
        } else if (this.inAirTrick.type === 'hero') {
          this.airGroup.rotation.z = Math.sin(this.jumpY * 2) * 0.8;
        }
      }

      // Landing Check
      if (this.jumpY <= 0) {
        this.jumpY = 0;
        this.isJumping = false;
        this.airGroup.position.y = 0;
        this.airGroup.rotation.set(0, 0, 0);

        if (Math.abs(this.balance) > 0.4) {
          this.balance += Math.sign(this.balance) * 0.35;
          this.showToast("Wackelige Landung!");
        } else {
          this.showToast("Perfekte Landung!");
        }

        this.inAirTrick = null;
      }
    }

    // 7. AUTHENTIC TIGHTROPE GAIT & FOOT ALIGNMENT (X = 0 Centerline)
    this.walkCycle += dt * 7.5;
    if (Math.sin(this.walkCycle) > 0.95 && !this.isJumping) {
      this.playStepSound();
    }

    const stepAngle = Math.sin(this.walkCycle) * 0.35;

    // Direct skeletal leg walking stride & inward stance on wire line X = 0
    if (this.leftUpLegBone && this.rightUpLegBone && this.leftUpLegBone.userData.initRotation && this.rightUpLegBone.userData.initRotation) {
      const initL = this.leftUpLegBone.userData.initRotation;
      const initR = this.rightUpLegBone.userData.initRotation;

      this.leftUpLegBone.rotation.x = initL.x + stepAngle;
      this.rightUpLegBone.rotation.x = initR.x - stepAngle;

      if (this.leftLegBone && this.leftLegBone.userData.initRotation) {
        this.leftLegBone.rotation.x = this.leftLegBone.userData.initRotation.x + Math.max(0, stepAngle) * 0.45;
      }
      if (this.rightLegBone && this.rightLegBone.userData.initRotation) {
        this.rightLegBone.rotation.x = this.rightLegBone.userData.initRotation.x + Math.max(0, -stepAngle) * 0.45;
      }

      this.leftUpLegBone.rotation.z = initL.z - 0.10;
      this.rightUpLegBone.rotation.z = initR.z + 0.10;
    }

    // 8. REAL-TIME SMARTPHONE TILT & SKELETAL TORSO KINEMATICS:
    const phoneTilt = input; // Real-time filtered tilt angle from smartphone gyro sensor (-1.0 to +1.0)
    const spineTiltAngle = -phoneTilt * 0.45;
    
    // Spine container curvature & real-time torso sway
    this.spineGroup.rotation.z = -this.balance * 0.32 + spineTiltAngle * 0.6;
    this.spineGroup.rotation.x = Math.abs(phoneTilt) * 0.12;

    if (this.spine1Bone && this.spine1Bone.userData.initRotation) {
      this.spine1Bone.rotation.z = this.spine1Bone.userData.initRotation.z + spineTiltAngle * 0.45;
    }
    if (this.spine2Bone && this.spine2Bone.userData.initRotation) {
      this.spine2Bone.rotation.z = this.spine2Bone.userData.initRotation.z + spineTiltAngle * 0.45;
    }

    if (this.femaleModel) {
      this.femaleModel.position.x = 0;
      const stepTwist = Math.sin(this.walkCycle) * 0.12;
      this.femaleModel.rotation.y = Math.PI + stepTwist;
      this.femaleModel.rotation.z = -this.balance * 0.20 + spineTiltAngle * 0.35;
    }

    // Hips shift laterally as counter-weight center of mass
    this.hipsGroup.position.x = this.balance * 0.14 - phoneTilt * 0.09;
    
    // Arms and Balance Pole tip OPPOSITE as a heavy counterweight!
    this.armsGroup.rotation.z = this.balance * 1.45 + phoneTilt * 0.70;

    // Balance Pole Endtip Flexing
    if (this.poleTipLeft && this.poleTipRight) {
      const bend = Math.sin(this.clock.getElapsedTime() * 5.0) * 0.04 - (this.balance * 0.15);
      this.poleTipLeft.position.y = bend;
      this.poleTipRight.position.y = -bend;
    }

    this.characterGroup.position.set(0, 0, 0);
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
