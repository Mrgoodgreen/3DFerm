import * as THREE from 'three';

export class Stage {
  renderer: THREE.WebGLRenderer;
  scene = new THREE.Scene();
  camera: THREE.PerspectiveCamera;
  sun: THREE.DirectionalLight;
  hemi: THREE.HemisphereLight;
  camTarget = new THREE.Vector3();
  private camOffset = new THREE.Vector3(0, 17, 12.5);
  private zoom = 1;
  shakeT = 0;

  constructor(container: HTMLElement, mobile: boolean) {
    this.renderer = new THREE.WebGLRenderer({
      antialias: !mobile || window.devicePixelRatio < 2,
      powerPreference: 'high-performance',
      alpha: false,
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, mobile ? 1.6 : 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.12;
    container.appendChild(this.renderer.domElement);

    const sky = new THREE.Color(0x8ed9f2);
    this.scene.background = sky;
    this.scene.fog = new THREE.Fog(sky, 45, 95);

    this.camera = new THREE.PerspectiveCamera(42, 1, 0.5, 200);

    this.hemi = new THREE.HemisphereLight(0xfff6e0, 0x7fb069, 1.55);
    this.scene.add(this.hemi);
    const amb = new THREE.AmbientLight(0xffffff, 0.35);
    this.scene.add(amb);

    this.sun = new THREE.DirectionalLight(0xfff1d6, 2.3);
    this.sun.castShadow = true;
    const size = mobile ? 1024 : 2048;
    this.sun.shadow.mapSize.set(size, size);
    const sc = this.sun.shadow.camera;
    sc.left = -24;
    sc.right = 24;
    sc.top = 24;
    sc.bottom = -24;
    sc.near = 1;
    sc.far = 70;
    this.sun.shadow.bias = -0.0006;
    this.sun.shadow.normalBias = 0.03;
    this.sun.shadow.radius = 3;
    this.scene.add(this.sun);
    this.scene.add(this.sun.target);

    this.resize();
  }

  resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    const portrait = h > w;
    this.zoom = portrait ? Math.min(1.75, 1 + (h / w - 1) * 0.65) : 1;
    this.camera.fov = portrait ? 46 : 40;
    this.camera.updateProjectionMatrix();
  }

  follow(pos: THREE.Vector3, dt: number, snap = false) {
    const k = snap ? 1 : 1 - Math.exp(-dt * 5);
    this.camTarget.lerp(pos, k);
    const off = this.camOffset;
    this.camera.position.set(
      this.camTarget.x + off.x * this.zoom,
      this.camTarget.y + off.y * this.zoom,
      this.camTarget.z + off.z * this.zoom,
    );
    if (this.shakeT > 0) {
      this.shakeT -= dt;
      const s = this.shakeT * 0.25;
      this.camera.position.x += (Math.random() - 0.5) * s;
      this.camera.position.y += (Math.random() - 0.5) * s;
    }
    this.camera.lookAt(this.camTarget.x, this.camTarget.y + 0.6, this.camTarget.z);
    this.sun.position.set(this.camTarget.x + 10, this.camTarget.y + 22, this.camTarget.z + 8);
    this.sun.target.position.copy(this.camTarget);
  }

  render() {
    this.renderer.render(this.scene, this.camera);
  }
}
