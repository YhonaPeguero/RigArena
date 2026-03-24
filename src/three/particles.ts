import * as THREE from "three";

interface CoinFlight {
  active: boolean;
  start: THREE.Vector3;
  control: THREE.Vector3;
  end: THREE.Vector3;
  startedAt: number;
  duration: number;
  spin: number;
}

export class CoinParticleSystem {
  private readonly mesh: THREE.InstancedMesh;
  private readonly dummy = new THREE.Object3D();
  private readonly flights: CoinFlight[];
  private readonly curvePoint = new THREE.Vector3();
  private readonly tangentA = new THREE.Vector3();
  private readonly tangentB = new THREE.Vector3();
  private readonly lookTarget = new THREE.Vector3();

  constructor(
    scene: THREE.Scene,
    private readonly maxCoins = 100
  ) {
    const geometry = new THREE.CylinderGeometry(0.18, 0.18, 0.05, 18);
    geometry.rotateX(Math.PI / 2);

    const material = new THREE.MeshStandardMaterial({
      color: new THREE.Color("#F7C948"),
      emissive: new THREE.Color("#7A4A00"),
      emissiveIntensity: 1.15,
      metalness: 1,
      roughness: 0.18,
    });

    this.mesh = new THREE.InstancedMesh(geometry, material, maxCoins);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false;
    scene.add(this.mesh);

    this.flights = Array.from({ length: maxCoins }, () => ({
      active: false,
      start: new THREE.Vector3(),
      control: new THREE.Vector3(),
      end: new THREE.Vector3(),
      startedAt: 0,
      duration: 800,
      spin: 0,
    }));

    for (let index = 0; index < maxCoins; index += 1) {
      this.dummy.position.set(999, 999, 999);
      this.dummy.scale.setScalar(0);
      this.dummy.updateMatrix();
      this.mesh.setMatrixAt(index, this.dummy.matrix);
    }

    this.mesh.instanceMatrix.needsUpdate = true;
  }

  emit(from: THREE.Vector3, to: THREE.Vector3) {
    const slot = this.flights.find((flight) => !flight.active);
    if (!slot) {
      return;
    }

    slot.active = true;
    slot.start.copy(from);
    slot.end.copy(to);
    slot.control
      .copy(from)
      .lerp(to, 0.5)
      .add(new THREE.Vector3(0, 3.4 + Math.random() * 1.4, 0));
    slot.startedAt = performance.now();
    slot.duration = 800;
    slot.spin = (Math.random() * 2 - 1) * 10;
  }

  update(now: number) {
    for (let index = 0; index < this.flights.length; index += 1) {
      const flight = this.flights[index];

      if (!flight.active) {
        continue;
      }

      const elapsed = now - flight.startedAt;
      const t = Math.min(elapsed / flight.duration, 1);
      const inv = 1 - t;

      this.curvePoint
        .copy(flight.start)
        .multiplyScalar(inv * inv)
        .addScaledVector(flight.control, 2 * inv * t)
        .addScaledVector(flight.end, t * t);

      this.tangentA.copy(flight.control).sub(flight.start).multiplyScalar(2 * inv);
      this.tangentB.copy(flight.end).sub(flight.control).multiplyScalar(2 * t);
      this.lookTarget.copy(this.curvePoint).add(this.tangentA.add(this.tangentB).normalize());

      const scale = 0.55 + Math.sin(t * Math.PI) * 0.35;
      this.dummy.position.copy(this.curvePoint);
      this.dummy.lookAt(this.lookTarget);
      this.dummy.rotateZ(elapsed * 0.01 * flight.spin);
      this.dummy.scale.setScalar(scale);
      this.dummy.updateMatrix();
      this.mesh.setMatrixAt(index, this.dummy.matrix);

      if (t >= 1) {
        flight.active = false;
        this.dummy.position.set(999, 999, 999);
        this.dummy.scale.setScalar(0);
        this.dummy.updateMatrix();
        this.mesh.setMatrixAt(index, this.dummy.matrix);
      }
    }

    this.mesh.instanceMatrix.needsUpdate = true;
  }

  dispose() {
    this.mesh.geometry.dispose();
    if (Array.isArray(this.mesh.material)) {
      for (const material of this.mesh.material) {
        material.dispose();
      }
    } else {
      this.mesh.material.dispose();
    }
  }
}
