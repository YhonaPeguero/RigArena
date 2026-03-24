import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { BloomEffect, EffectComposer, EffectPass, RenderPass } from "postprocessing";
import { CoinParticleSystem } from "./particles";
import type { AgentRole, AgentStatus } from "../types/arena";

interface RobotRig {
  group: THREE.Group;
  shellMaterial: THREE.MeshStandardMaterial;
  coreMaterial: THREE.MeshStandardMaterial;
  haloMaterial: THREE.MeshBasicMaterial;
  halo: THREE.Mesh;
  pointLight: THREE.PointLight;
  label: THREE.Sprite;
  labelTexture: THREE.CanvasTexture;
  orbiters: THREE.Group;
  anchorPosition: THREE.Vector3;
  pulseOffset: number;
}

interface ConnectionTrail {
  mesh: THREE.Mesh;
  material: THREE.MeshBasicMaterial;
  startedAt: number;
  duration: number;
}

const ROLE_ORDER: AgentRole[] = ["tutor", "coder", "tester", "deployer"];
const ROLE_COLORS: Record<AgentRole, string> = {
  tutor: "#9945FF",
  coder: "#00C2FF",
  tester: "#14F195",
  deployer: "#FFB800",
};
const ROLE_ICONS: Record<AgentRole, string> = {
  tutor: "[?]",
  coder: "</>",
  tester: "[ok]",
  deployer: "[=>]",
};
const ROLE_NAMES: Record<AgentRole, string> = {
  tutor: "Tutor",
  coder: "Coder",
  tester: "Tester",
  deployer: "Deployer",
};
const ROLE_POSITIONS: Record<AgentRole, THREE.Vector3> = {
  tutor: new THREE.Vector3(-3.9, 0.3, -3.9),
  coder: new THREE.Vector3(3.9, 0.3, -3.9),
  deployer: new THREE.Vector3(3.9, 0.3, 3.9),
  tester: new THREE.Vector3(-3.9, 0.3, 3.9),
};

export class ArenaScene {
  private scene: THREE.Scene | null = null;
  private camera: THREE.PerspectiveCamera | null = null;
  private renderer: THREE.WebGLRenderer | null = null;
  private composer: EffectComposer | null = null;
  private controls: OrbitControls | null = null;
  private floorMaterial: THREE.ShaderMaterial | null = null;
  private ringMaterials: THREE.MeshBasicMaterial[] = [];
  private coinSystem: CoinParticleSystem | null = null;
  private explosionMaterial: THREE.ShaderMaterial | null = null;
  private explosionPoints: THREE.Points | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private robots: Partial<Record<AgentRole, RobotRig>> = {};
  private statuses: Record<AgentRole, AgentStatus> = {
    tutor: "idle",
    coder: "idle",
    tester: "idle",
    deployer: "idle",
  };
  private activeRole: AgentRole | null = null;
  private connections: ConnectionTrail[] = [];
  private explosionStartedAt = -1;
  private idleMode = true;
  private clock = new THREE.Clock();
  private canvas: HTMLCanvasElement | null = null;

  init(canvas: HTMLCanvasElement): void {
    this.dispose();
    this.canvas = canvas;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#070711");
    scene.fog = new THREE.Fog("#070711", 14, 28);
    this.scene = scene;

    const camera = new THREE.PerspectiveCamera(42, 16 / 9, 0.1, 100);
    camera.position.set(0, 8.7, 10.4);
    camera.lookAt(0, 1.4, 0);
    this.camera = camera;

    const renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true,
      powerPreference: "high-performance",
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    this.renderer = renderer;

    const composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));
    composer.addPass(
      new EffectPass(
        camera,
        new BloomEffect({
          intensity: 1.25,
          mipmapBlur: true,
          luminanceThreshold: 0.12,
          radius: 0.8,
        })
      )
    );
    this.composer = composer;

    const controls = new OrbitControls(camera, canvas);
    controls.enableDamping = true;
    controls.dampingFactor = 0.06;
    controls.autoRotate = true;
    controls.autoRotateSpeed = 0.35;
    controls.maxPolarAngle = Math.PI / 2.1;
    controls.minDistance = 8;
    controls.maxDistance = 15;
    controls.target.set(0, 1.6, 0);
    this.controls = controls;

    this.buildEnvironment();
    this.buildRobots();
    this.coinSystem = new CoinParticleSystem(scene);
    this.buildExplosion();
    this.resize();

    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(canvas);

    renderer.setAnimationLoop(() => this.render());
  }

  syncAgents(agents: Record<AgentRole, AgentStatus>, isRunning: boolean): void {
    this.statuses = { ...agents };
    this.activeRole =
      (Object.keys(agents) as AgentRole[]).find((role) => agents[role] === "active") ?? null;
    this.idleMode = !isRunning;

    if (this.controls) {
      this.controls.autoRotate = this.idleMode;
    }
  }

  activateAgent(role: AgentRole): void {
    this.activeRole = role;
    if (this.controls) {
      this.controls.autoRotate = false;
    }
  }

  addFlyingCoin(from: AgentRole, to: AgentRole): void {
    this.coinSystem?.emit(ROLE_POSITIONS[from], ROLE_POSITIONS[to]);
    this.createConnection(from, to);
  }

  mintNFTExplosion(): void {
    if (!this.explosionPoints || !this.explosionMaterial) {
      return;
    }

    this.explosionStartedAt = performance.now();
    this.explosionMaterial.uniforms.uProgress.value = 0;
    this.explosionPoints.visible = true;
  }

  dispose(): void {
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
    this.controls?.dispose();
    this.controls = null;

    if (this.renderer) {
      this.renderer.setAnimationLoop(null);
    }

    this.coinSystem?.dispose();
    this.coinSystem = null;

    for (const connection of this.connections) {
      connection.mesh.geometry.dispose();
      connection.material.dispose();
      this.scene?.remove(connection.mesh);
    }
    this.connections = [];

    if (this.scene) {
      this.scene.traverse((object) => {
        const mesh = object as THREE.Mesh;
        if (mesh.geometry) {
          mesh.geometry.dispose();
        }

        if (mesh instanceof THREE.Sprite) {
          mesh.material.dispose();
        }

        const material = mesh.material;
        if (Array.isArray(material)) {
          for (const entry of material) {
            entry.dispose();
          }
        } else if (material) {
          material.dispose();
        }
      });
    }

    this.ringMaterials.forEach((material) => material.dispose());
    this.ringMaterials = [];
    this.composer?.dispose();
    this.renderer?.dispose();

    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.composer = null;
    this.floorMaterial = null;
    this.explosionMaterial = null;
    this.explosionPoints = null;
    this.robots = {};
    this.canvas = null;
    this.activeRole = null;
    this.explosionStartedAt = -1;
  }

  private buildEnvironment() {
    if (!this.scene) {
      return;
    }

    const ambient = new THREE.AmbientLight("#b9c3ff", 0.55);
    const keyLight = new THREE.SpotLight("#ffffff", 2.2, 40, Math.PI / 5, 0.4, 1.2);
    keyLight.position.set(0, 16, 4);

    const rimA = new THREE.PointLight("#9945FF", 8, 20, 2);
    rimA.position.set(-6, 4, -6);
    const rimB = new THREE.PointLight("#00C2FF", 8, 20, 2);
    rimB.position.set(6, 5, 6);

    const floorGeometry = new THREE.PlaneGeometry(26, 26, 1, 1);
    const floorMaterial = new THREE.ShaderMaterial({
      transparent: true,
      side: THREE.DoubleSide,
      uniforms: {
        uTime: { value: 0 },
        uAccent: { value: new THREE.Color(ROLE_COLORS.tutor) },
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform float uTime;
        uniform vec3 uAccent;
        varying vec2 vUv;

        float grid(vec2 uv, float scale) {
          vec2 cell = abs(fract(uv * scale - 0.5) - 0.5) / fwidth(uv * scale);
          float line = min(cell.x, cell.y);
          return 1.0 - min(line, 1.0);
        }

        void main() {
          vec2 uv = vUv;
          float perspective = pow(1.0 - uv.y, 2.0);
          float lineA = grid(vec2(uv.x, uv.y + uTime * 0.02), 18.0);
          float lineB = grid(vec2(uv.x, uv.y + uTime * 0.01), 8.0) * 0.4;
          vec3 base = vec3(0.03, 0.03, 0.08);
          vec3 tron = base + uAccent * (lineA * 0.22 + lineB * 0.18) * perspective;
          float fade = smoothstep(0.98, 0.18, uv.y);
          gl_FragColor = vec4(tron, 0.92 * fade);
        }
      `,
    });
    this.floorMaterial = floorMaterial;

    const floor = new THREE.Mesh(floorGeometry, floorMaterial);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -0.02;

    const ringRadii = [2.8, 4.1, 5.4];
    ringRadii.forEach((radius, index) => {
      const material = new THREE.MeshBasicMaterial({
        color: ROLE_COLORS.tutor,
        transparent: true,
        opacity: 0.22 - index * 0.04,
      });
      const mesh = new THREE.Mesh(
        new THREE.TorusGeometry(radius, 0.04, 20, 120),
        material
      );
      mesh.rotation.x = Math.PI / 2;
      mesh.position.y = 0.02 + index * 0.02;
      this.ringMaterials.push(material);
      this.scene?.add(mesh);
    });

    this.scene.add(ambient, keyLight, rimA, rimB, floor);
  }

  private buildRobots() {
    if (!this.scene) {
      return;
    }

    ROLE_ORDER.forEach((role, index) => {
      const robot = this.createRobot(role, index);
      this.robots[role] = robot;
      this.scene?.add(robot.group);
    });
  }

  private createRobot(role: AgentRole, index: number): RobotRig {
    const group = new THREE.Group();
    const accent = new THREE.Color(ROLE_COLORS[role]);
    const shellMaterial = new THREE.MeshStandardMaterial({
      color: "#1b1b2d",
      metalness: 0.48,
      roughness: 0.36,
      transparent: true,
      opacity: 1,
    });
    const coreMaterial = new THREE.MeshStandardMaterial({
      color: "#f6f2ff",
      emissive: accent,
      emissiveIntensity: 0.2,
      metalness: 0.22,
      roughness: 0.18,
      transparent: true,
      opacity: 1,
    });
    const haloMaterial = new THREE.MeshBasicMaterial({
      color: accent,
      transparent: true,
      opacity: 0.08,
      side: THREE.DoubleSide,
    });

    const pedestal = new THREE.Mesh(
      new THREE.CylinderGeometry(1.1, 1.4, 0.28, 18),
      new THREE.MeshStandardMaterial({
        color: "#111322",
        emissive: accent,
        emissiveIntensity: 0.05,
        metalness: 0.7,
        roughness: 0.28,
      })
    );
    pedestal.position.y = 0.14;

    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.98, 1.45, 0.7), shellMaterial);
    torso.position.y = 1.45;
    const core = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.8, 0.16), coreMaterial);
    core.position.set(0, 1.46, 0.38);
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.78, 0.66, 0.72), shellMaterial);
    head.position.y = 2.52;
    const eyeBar = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.12, 0.15), coreMaterial);
    eyeBar.position.set(0, 2.55, 0.38);
    const armL = new THREE.Mesh(new THREE.BoxGeometry(0.24, 1.08, 0.24), shellMaterial);
    armL.position.set(-0.72, 1.42, 0);
    const armR = armL.clone();
    armR.position.x = 0.72;
    const legL = new THREE.Mesh(new THREE.BoxGeometry(0.26, 1.1, 0.26), shellMaterial);
    legL.position.set(-0.28, 0.58, 0);
    const legR = legL.clone();
    legR.position.x = 0.28;
    const halo = new THREE.Mesh(new THREE.RingGeometry(0.92, 1.32, 48), haloMaterial);
    halo.rotation.x = -Math.PI / 2;
    halo.position.y = 0.5;

    const pointLight = new THREE.PointLight(accent, 0, 7, 2);
    pointLight.position.set(0, 0.7, 0);

    const orbiters = new THREE.Group();
    for (let orbiterIndex = 0; orbiterIndex < 8; orbiterIndex += 1) {
      const cube = new THREE.Mesh(
        new THREE.BoxGeometry(0.1, 0.1, 0.1),
        new THREE.MeshBasicMaterial({ color: accent, transparent: true, opacity: 0.8 })
      );
      const angle = (orbiterIndex / 8) * Math.PI * 2;
      cube.position.set(Math.cos(angle) * 1.1, 2.2 + Math.sin(angle * 2) * 0.1, Math.sin(angle) * 1.1);
      orbiters.add(cube);
    }

    const labelTexture = this.createLabelTexture(role, ROLE_COLORS[role]);
    const label = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: labelTexture,
        transparent: true,
        opacity: 0.95,
      })
    );
    label.scale.set(2.4, 0.9, 1);
    label.position.set(0, 3.8, 0);

    group.add(
      pedestal,
      torso,
      core,
      head,
      eyeBar,
      armL,
      armR,
      legL,
      legR,
      halo,
      pointLight,
      orbiters,
      label
    );
    group.position.copy(ROLE_POSITIONS[role]);

    return {
      group,
      shellMaterial,
      coreMaterial,
      haloMaterial,
      halo,
      pointLight,
      label,
      labelTexture,
      orbiters,
      anchorPosition: ROLE_POSITIONS[role].clone(),
      pulseOffset: index * 0.7,
    };
  }

  private createLabelTexture(role: AgentRole, color: string): THREE.CanvasTexture {
    const canvas = document.createElement("canvas");
    canvas.width = 360;
    canvas.height = 140;
    const context = canvas.getContext("2d");

    if (!context) {
      return new THREE.CanvasTexture(canvas);
    }

    context.clearRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = "rgba(15, 15, 30, 0.92)";
    context.strokeStyle = color;
    context.lineWidth = 4;
    context.beginPath();
    context.roundRect(8, 10, 344, 120, 26);
    context.fill();
    context.stroke();

    context.fillStyle = color;
    context.font = "700 34px JetBrains Mono";
    context.fillText(ROLE_ICONS[role], 28, 58);
    context.font = "700 34px Space Grotesk";
    context.fillText(ROLE_NAMES[role], 110, 58);
    context.fillStyle = "#8888AA";
    context.font = "500 18px Inter";
    context.fillText("RigArena Agent", 110, 92);

    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;
    return texture;
  }

  private createConnection(from: AgentRole, to: AgentRole) {
    if (!this.scene) {
      return;
    }

    const start = ROLE_POSITIONS[from].clone().add(new THREE.Vector3(0, 2.4, 0));
    const end = ROLE_POSITIONS[to].clone().add(new THREE.Vector3(0, 2.4, 0));
    const curve = new THREE.CatmullRomCurve3([
      start,
      start.clone().lerp(end, 0.5).add(new THREE.Vector3(0, 1.8, 0)),
      end,
    ]);
    const geometry = new THREE.TubeGeometry(curve, 24, 0.045, 10, false);
    const material = new THREE.MeshBasicMaterial({
      color: ROLE_COLORS[to],
      transparent: true,
      opacity: 0.9,
    });
    const mesh = new THREE.Mesh(geometry, material);
    this.scene.add(mesh);
    this.connections.push({
      mesh,
      material,
      startedAt: performance.now(),
      duration: 900,
    });
  }

  private buildExplosion() {
    if (!this.scene) {
      return;
    }

    const count = 480;
    const positions = new Float32Array(count * 3);
    const directions = new Float32Array(count * 3);
    const offsets = new Float32Array(count);

    for (let index = 0; index < count; index += 1) {
      const stride = index * 3;
      const direction = new THREE.Vector3(
        Math.random() * 2 - 1,
        Math.random() * 2 - 0.2,
        Math.random() * 2 - 1
      ).normalize();

      directions[stride] = direction.x;
      directions[stride + 1] = direction.y;
      directions[stride + 2] = direction.z;
      offsets[index] = Math.random();
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute("aDirection", new THREE.BufferAttribute(directions, 3));
    geometry.setAttribute("aOffset", new THREE.BufferAttribute(offsets, 1));

    const material = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uProgress: { value: 0 },
      },
      vertexShader: `
        uniform float uProgress;
        attribute vec3 aDirection;
        attribute float aOffset;
        varying float vAlpha;
        void main() {
          float progress = clamp(uProgress - aOffset * 0.1, 0.0, 1.2);
          vec3 displaced = aDirection * (progress * 5.8);
          vec4 mvPosition = modelViewMatrix * vec4(displaced, 1.0);
          gl_Position = projectionMatrix * mvPosition;
          gl_PointSize = (18.0 - progress * 8.0) * (260.0 / -mvPosition.z);
          vAlpha = max(0.0, 1.0 - progress);
        }
      `,
      fragmentShader: `
        varying float vAlpha;
        void main() {
          vec2 uv = gl_PointCoord - 0.5;
          float strength = smoothstep(0.34, 0.0, length(uv));
          vec3 color = mix(vec3(0.60, 0.27, 1.0), vec3(1.0, 0.72, 0.1), gl_PointCoord.y);
          gl_FragColor = vec4(color, strength * vAlpha);
        }
      `,
    });

    const points = new THREE.Points(geometry, material);
    points.position.set(0, 2.8, 0);
    points.visible = false;

    this.explosionMaterial = material;
    this.explosionPoints = points;
    this.scene.add(points);
  }

  private resize() {
    if (!this.canvas || !this.camera || !this.renderer || !this.composer) {
      return;
    }

    const width = this.canvas.clientWidth || 1280;
    const height = this.canvas.clientHeight || 720;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, false);
    this.composer.setSize(width, height);
  }

  private render() {
    if (!this.scene || !this.camera || !this.composer) {
      return;
    }

    const elapsed = this.clock.getElapsedTime();
    const activeColor = new THREE.Color(
      this.activeRole ? ROLE_COLORS[this.activeRole] : "#9945FF"
    );

    if (this.floorMaterial) {
      this.floorMaterial.uniforms.uTime.value = elapsed;
      this.floorMaterial.uniforms.uAccent.value.lerp(activeColor, 0.08);
    }

    this.ringMaterials.forEach((material, index) => {
      material.color.lerp(activeColor, 0.08);
      material.opacity = 0.16 + Math.sin(elapsed * 1.3 + index) * 0.03;
    });

    ROLE_ORDER.forEach((role) => {
      const robot = this.robots[role];
      if (!robot) {
        return;
      }

      const status = this.statuses[role] ?? "idle";
      const accent = new THREE.Color(ROLE_COLORS[role]);
      const waitColor = new THREE.Color("#3a3a4d");
      const targetScale = status === "active" ? 1.3 : status === "complete" ? 1 : 0.85;
      const lift = status === "active" ? 0.3 : 0;
      const targetCore = status === "active" ? 2.9 : status === "complete" ? 0.65 : 0.08;
      const targetLight = status === "active" ? 4.5 : status === "complete" ? 0.9 : 0;
      const targetOpacity = status === "complete" ? 0.6 : status === "idle" ? 0.72 : 1;
      const shellTarget = status === "idle" ? waitColor : accent.clone().multiplyScalar(0.32);

      robot.group.position.y =
        robot.anchorPosition.y +
        Math.sin(elapsed * 1.4 + robot.pulseOffset) * 0.1 +
        lift;
      robot.group.scale.lerp(new THREE.Vector3(targetScale, targetScale, targetScale), 0.12);
      robot.shellMaterial.color.lerp(shellTarget, 0.1);
      robot.shellMaterial.opacity = THREE.MathUtils.lerp(robot.shellMaterial.opacity, targetOpacity, 0.12);
      robot.coreMaterial.opacity = THREE.MathUtils.lerp(robot.coreMaterial.opacity, targetOpacity, 0.12);
      robot.coreMaterial.emissiveIntensity = THREE.MathUtils.lerp(
        robot.coreMaterial.emissiveIntensity,
        targetCore,
        0.12
      );
      robot.haloMaterial.opacity = THREE.MathUtils.lerp(
        robot.haloMaterial.opacity,
        status === "active" ? 0.4 : status === "complete" ? 0.12 : 0.04,
        0.12
      );
      robot.pointLight.intensity = THREE.MathUtils.lerp(robot.pointLight.intensity, targetLight, 0.12);
      robot.orbiters.visible = status === "active";
      robot.orbiters.rotation.y += status === "active" ? 0.04 : 0.005;
      robot.label.position.y = status === "active" ? 4.15 : 3.8;
      (robot.label.material as THREE.SpriteMaterial).opacity = status === "idle" ? 0.65 : 0.95;
    });

    this.coinSystem?.update(performance.now());

    this.connections = this.connections.filter((connection) => {
      const progress = (performance.now() - connection.startedAt) / connection.duration;
      connection.material.opacity = Math.max(0, 0.9 - progress);
      if (progress >= 1) {
        connection.mesh.geometry.dispose();
        connection.material.dispose();
        this.scene?.remove(connection.mesh);
        return false;
      }
      return true;
    });

    if (this.explosionMaterial && this.explosionPoints && this.explosionStartedAt > 0) {
      const progress = (performance.now() - this.explosionStartedAt) / 1100;
      this.explosionMaterial.uniforms.uProgress.value = progress;
      this.explosionPoints.visible = progress <= 1.12;
      if (progress > 1.12) {
        this.explosionStartedAt = -1;
      }
    }

    this.controls?.update();
    this.composer.render();
  }
}
