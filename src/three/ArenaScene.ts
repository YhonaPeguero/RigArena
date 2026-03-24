import * as THREE from "three";
import { BloomEffect, EffectComposer, EffectPass, RenderPass } from "postprocessing";
import { CoinParticleSystem } from "./particles";
import type { AgentRole } from "../types/arena";

interface RobotRig {
  group: THREE.Group;
  coreMaterial: THREE.MeshStandardMaterial;
  shellMaterial: THREE.MeshStandardMaterial;
  haloMaterial: THREE.MeshBasicMaterial;
  halo: THREE.Mesh;
  anchorPosition: THREE.Vector3;
  pulseOffset: number;
}

const ROLE_POSITIONS: Record<AgentRole, THREE.Vector3> = {
  tutor: new THREE.Vector3(-4.4, 0.2, -2.2),
  coder: new THREE.Vector3(4.4, 0.2, -2.2),
  tester: new THREE.Vector3(-4.8, 0.2, 3.1),
  deployer: new THREE.Vector3(0, 0.2, 4.9),
};

const ROLE_COLORS: Record<AgentRole, string> = {
  tutor: "#67E8F9",
  coder: "#F7C948",
  tester: "#8B5CF6",
  deployer: "#FF8A3D",
};

export class ArenaScene {
  private scene: THREE.Scene | null = null;
  private camera: THREE.PerspectiveCamera | null = null;
  private renderer: THREE.WebGLRenderer | null = null;
  private composer: EffectComposer | null = null;
  private floorMaterial: THREE.ShaderMaterial | null = null;
  private coinSystem: CoinParticleSystem | null = null;
  private explosionMaterial: THREE.ShaderMaterial | null = null;
  private explosionPoints: THREE.Points | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private robots: Partial<Record<AgentRole, RobotRig>> = {};
  private activeRole: AgentRole | null = null;
  private explosionStartedAt = -1;
  private clock = new THREE.Clock();
  private canvas: HTMLCanvasElement | null = null;

  init(canvas: HTMLCanvasElement): void {
    this.dispose();
    this.canvas = canvas;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#050b14");
    scene.fog = new THREE.Fog("#050b14", 14, 32);
    this.scene = scene;

    const camera = new THREE.PerspectiveCamera(42, 16 / 9, 0.1, 100);
    camera.position.set(0, 7.6, 14.8);
    camera.lookAt(0, 1.2, 0.4);
    this.camera = camera;

    const context = canvas.getContext("webgl2", {
      antialias: true,
      alpha: true,
      powerPreference: "high-performance",
    });

    if (typeof navigator !== "undefined" && "gpu" in navigator) {
      canvas.dataset.rendererPreference = "webgpu-ready";
    }

    const renderer = new THREE.WebGLRenderer({
      canvas,
      context: context ?? undefined,
      antialias: true,
      alpha: true,
      powerPreference: "high-performance",
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    renderer.shadowMap.enabled = true;
    this.renderer = renderer;

    const composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));
    composer.addPass(
      new EffectPass(
        camera,
        new BloomEffect({
          intensity: 1.1,
          mipmapBlur: true,
          luminanceThreshold: 0.18,
          radius: 0.72,
        })
      )
    );
    this.composer = composer;

    this.buildEnvironment();
    this.buildRobots();
    this.coinSystem = new CoinParticleSystem(scene);
    this.buildExplosion();
    this.resize();

    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(canvas);

    renderer.setAnimationLoop(() => this.render());
  }

  activateAgent(role: AgentRole): void {
    this.activeRole = role;
  }

  addFlyingCoin(from: AgentRole, to: AgentRole): void {
    this.coinSystem?.emit(ROLE_POSITIONS[from], ROLE_POSITIONS[to]);
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

    if (this.renderer) {
      this.renderer.setAnimationLoop(null);
    }

    this.coinSystem?.dispose();
    this.coinSystem = null;

    if (this.scene) {
      this.scene.traverse((object) => {
        const mesh = object as THREE.Mesh;
        if (mesh.geometry) {
          mesh.geometry.dispose();
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

    const ambient = new THREE.AmbientLight("#b0dfff", 0.55);
    const keyLight = new THREE.SpotLight("#fff0cc", 2.2, 48, Math.PI / 6, 0.38, 1.3);
    keyLight.position.set(0, 16, 6);
    keyLight.castShadow = true;

    const rimLeft = new THREE.PointLight("#67E8F9", 14, 18, 2);
    rimLeft.position.set(-8, 4, -1);

    const rimRight = new THREE.PointLight("#FF8A3D", 14, 18, 2);
    rimRight.position.set(8, 5, 1);

    const floorGeometry = new THREE.CircleGeometry(9.5, 72);
    const floorMaterial = new THREE.ShaderMaterial({
      transparent: true,
      side: THREE.DoubleSide,
      uniforms: {
        uTime: { value: 0 },
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
        varying vec2 vUv;

        float ring(vec2 uv, float radius, float width) {
          float dist = distance(uv, vec2(0.5));
          return smoothstep(radius + width, radius, dist) *
                 smoothstep(radius - width, radius, dist);
        }

        void main() {
          float pulse = 0.5 + 0.5 * sin(uTime * 1.25);
          float grid = ring(vUv, 0.38 + pulse * 0.02, 0.01)
                     + ring(vUv, 0.28, 0.008)
                     + ring(vUv, 0.18, 0.006);
          vec3 base = vec3(0.03, 0.07, 0.13);
          vec3 accent = mix(vec3(0.40, 0.91, 0.98), vec3(0.97, 0.79, 0.28), vUv.y);
          float vignette = smoothstep(0.75, 0.15, distance(vUv, vec2(0.5)));
          gl_FragColor = vec4(base + accent * grid * 0.85 + vignette * 0.06, 0.96);
        }
      `,
    });
    this.floorMaterial = floorMaterial;

    const arenaFloor = new THREE.Mesh(floorGeometry, floorMaterial);
    arenaFloor.rotation.x = -Math.PI / 2;
    arenaFloor.receiveShadow = true;
    arenaFloor.position.y = -0.01;

    const outerRing = new THREE.Mesh(
      new THREE.TorusGeometry(9.1, 0.18, 24, 120),
      new THREE.MeshStandardMaterial({
        color: "#122338",
        emissive: "#F7C948",
        emissiveIntensity: 0.2,
        metalness: 0.75,
        roughness: 0.2,
      })
    );
    outerRing.rotation.x = Math.PI / 2;

    this.scene.add(ambient, keyLight, rimLeft, rimRight, arenaFloor, outerRing);
  }

  private buildRobots() {
    if (!this.scene) {
      return;
    }

    (Object.keys(ROLE_POSITIONS) as AgentRole[]).forEach((role, index) => {
      const robot = this.createRobot(role, ROLE_COLORS[role], index);
      this.robots[role] = robot;
      this.scene?.add(robot.group);
    });
  }

  private createRobot(role: AgentRole, color: string, index: number): RobotRig {
    const group = new THREE.Group();
    const shellMaterial = new THREE.MeshStandardMaterial({
      color: "#0e1a2b",
      metalness: 0.55,
      roughness: 0.28,
    });
    const coreMaterial = new THREE.MeshStandardMaterial({
      color: "#f5fbff",
      emissive: new THREE.Color(color),
      emissiveIntensity: 0.45,
      metalness: 0.2,
      roughness: 0.2,
    });
    const haloMaterial = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.08,
      side: THREE.DoubleSide,
    });

    const pedestal = new THREE.Mesh(
      new THREE.CylinderGeometry(1.35, 1.6, 0.4, 18),
      new THREE.MeshStandardMaterial({
        color: "#111f32",
        emissive: new THREE.Color(color),
        emissiveIntensity: 0.08,
        metalness: 0.7,
        roughness: 0.25,
      })
    );
    pedestal.position.y = 0.16;
    pedestal.castShadow = true;
    pedestal.receiveShadow = true;

    const torso = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.6, 0.85), shellMaterial);
    torso.position.y = 1.6;

    const core = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.82, 0.18), coreMaterial);
    core.position.set(0, 1.68, 0.45);

    const head = new THREE.Mesh(new THREE.BoxGeometry(0.84, 0.72, 0.84), shellMaterial);
    head.position.y = 2.74;

    const eyeBar = new THREE.Mesh(new THREE.BoxGeometry(0.54, 0.14, 0.18), coreMaterial);
    eyeBar.position.set(0, 2.78, 0.44);

    const leftArm = new THREE.Mesh(new THREE.BoxGeometry(0.28, 1.24, 0.28), shellMaterial);
    leftArm.position.set(-0.88, 1.55, 0);

    const rightArm = leftArm.clone();
    rightArm.position.x = 0.88;

    const leftLeg = new THREE.Mesh(new THREE.BoxGeometry(0.32, 1.2, 0.32), shellMaterial);
    leftLeg.position.set(-0.36, 0.6, 0);

    const rightLeg = leftLeg.clone();
    rightLeg.position.x = 0.36;

    const halo = new THREE.Mesh(new THREE.RingGeometry(1.0, 1.46, 42), haloMaterial);
    halo.rotation.x = -Math.PI / 2;
    halo.position.y = 0.72;

    group.add(
      pedestal,
      torso,
      core,
      head,
      eyeBar,
      leftArm,
      rightArm,
      leftLeg,
      rightLeg,
      halo
    );
    group.position.copy(ROLE_POSITIONS[role]);

    return {
      group,
      coreMaterial,
      shellMaterial,
      haloMaterial,
      halo,
      anchorPosition: ROLE_POSITIONS[role].clone(),
      pulseOffset: index * 0.85,
    };
  }

  private buildExplosion() {
    if (!this.scene) {
      return;
    }

    const count = 520;
    const positions = new Float32Array(count * 3);
    const directions = new Float32Array(count * 3);
    const offsets = new Float32Array(count);

    for (let index = 0; index < count; index += 1) {
      const stride = index * 3;
      const direction = new THREE.Vector3(
        Math.random() * 2 - 1,
        Math.random() * 2 - 0.15,
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
          float progress = clamp(uProgress - aOffset * 0.12, 0.0, 1.2);
          vec3 displaced = aDirection * (progress * 6.4);
          vec4 mvPosition = modelViewMatrix * vec4(displaced, 1.0);
          gl_Position = projectionMatrix * mvPosition;
          gl_PointSize = (22.0 - progress * 10.0) * (280.0 / -mvPosition.z);
          vAlpha = max(0.0, 1.0 - progress);
        }
      `,
      fragmentShader: `
        varying float vAlpha;
        void main() {
          vec2 uv = gl_PointCoord - 0.5;
          float strength = smoothstep(0.32, 0.0, length(uv));
          vec3 color = mix(vec3(0.54, 0.36, 0.96), vec3(0.97, 0.79, 0.28), gl_PointCoord.y);
          gl_FragColor = vec4(color, strength * vAlpha);
        }
      `,
    });

    const points = new THREE.Points(geometry, material);
    points.position.set(0, 2.5, 0.7);
    points.visible = false;

    this.explosionMaterial = material;
    this.explosionPoints = points;
    this.scene.add(points);
  }

  private resize() {
    if (!this.canvas || !this.camera || !this.renderer || !this.composer) {
      return;
    }

    const width = this.canvas.clientWidth || this.canvas.parentElement?.clientWidth || 1280;
    const height = this.canvas.clientHeight || Math.max(width * 0.5625, 1);

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

    if (this.floorMaterial) {
      this.floorMaterial.uniforms.uTime.value = elapsed;
    }

    for (const role of Object.keys(this.robots) as AgentRole[]) {
      const robot = this.robots[role];
      if (!robot) {
        continue;
      }

      const isActive = this.activeRole === role;
      const targetScale = isActive ? 1.08 : 1;
      const targetGlow = isActive ? 2.25 : 0.35;
      const targetHalo = isActive ? 0.32 : 0.08;

      robot.group.position.y =
        robot.anchorPosition.y +
        Math.sin(elapsed * 1.5 + robot.pulseOffset) * 0.12;
      robot.group.scale.lerp(new THREE.Vector3(targetScale, targetScale, targetScale), 0.14);
      robot.coreMaterial.emissiveIntensity = THREE.MathUtils.lerp(
        robot.coreMaterial.emissiveIntensity,
        targetGlow,
        0.12
      );
      robot.haloMaterial.opacity = THREE.MathUtils.lerp(
        robot.haloMaterial.opacity,
        targetHalo,
        0.12
      );
      robot.halo.rotation.z += 0.005;
      robot.shellMaterial.emissive = new THREE.Color(
        isActive ? ROLE_COLORS[role] : "#101624"
      );
      robot.shellMaterial.emissiveIntensity = isActive ? 0.18 : 0.02;
    }

    this.coinSystem?.update(performance.now());

    if (this.explosionMaterial && this.explosionPoints && this.explosionStartedAt > 0) {
      const progress = (performance.now() - this.explosionStartedAt) / 1200;
      this.explosionMaterial.uniforms.uProgress.value = progress;
      this.explosionPoints.visible = progress <= 1.12;

      if (progress > 1.12) {
        this.explosionStartedAt = -1;
      }
    }

    this.composer.render();
  }
}
