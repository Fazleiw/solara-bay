// The sky dome: a three-stop gradient, the sun disc with its glow, drifting stratus clouds
// that catch the sunset colour, and stars that come out at night. It follows the camera.
import * as THREE from 'three';

const vertexShader = /* glsl */`
  varying vec3 vDir;
  void main() {
    vDir = normalize(position);
    vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    gl_Position = p.xyww;
  }
`;

const fragmentShader = /* glsl */`
  uniform vec3 uTop;
  uniform vec3 uHorizon;
  uniform vec3 uBottom;
  uniform vec3 uSunDir;
  uniform vec3 uSunColor;
  uniform float uNight;
  uniform float uTime;
  uniform float uCloudLight;
  varying vec3 vDir;

  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float noise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
  }
  float fbm(vec2 p) {
    float v = 0.0, a = 0.5;
    for (int i = 0; i < 5; i++) { v += a * noise(p); p *= 2.03; a *= 0.5; }
    return v;
  }

  void main() {
    vec3 dir = normalize(vDir);
    float h = dir.y;
    vec3 color = h > 0.0 ? mix(uHorizon, uTop, smoothstep(0.0, 0.55, pow(clamp(h, 0.0, 1.0), 0.7))) : mix(uHorizon, uBottom, clamp(-h * 4.0, 0.0, 1.0));
    float sunDot = max(dot(dir, normalize(uSunDir)), 0.0);
    float sunVisible = smoothstep(-0.12, 0.02, uSunDir.y);
    color += uSunColor * pow(sunDot, 6.0) * 0.45 * sunVisible;
    color += uSunColor * pow(sunDot, 60.0) * 0.8 * sunVisible;
    color += uSunColor * smoothstep(0.9993, 0.9997, sunDot) * 6.0 * sunVisible;
    // Clouds: stretched fbm projected onto a high plane.
    if (h > 0.0) {
      vec2 uv = dir.xz / (h + 0.18) * 1.6 + vec2(uTime * 0.004, uTime * 0.0015);
      float c = smoothstep(0.52, 0.85, fbm(uv * vec2(1.0, 2.6)));
      vec3 cloudColor = mix(vec3(1.0), uSunColor * 1.2 + uHorizon * 0.4, uCloudLight) * (1.0 - uNight * 0.85);
      cloudColor += uSunColor * pow(sunDot, 4.0) * 0.6 * sunVisible;
      color = mix(color, cloudColor, c * smoothstep(0.0, 0.12, h) * 0.75);
      // Stars.
      vec2 sp = dir.xz / (h + 0.4) * 140.0;
      float star = step(0.9965, hash(floor(sp))) * smoothstep(0.08, 0.3, h);
      color += vec3(star) * uNight * (0.6 + 0.4 * sin(uTime * 3.0 + hash(floor(sp)) * 40.0));
    }
    gl_FragColor = vec4(color, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

export function createSky(scene) {
  const uniforms = {
    uTop: { value: new THREE.Color('#3a7bd5') },
    uHorizon: { value: new THREE.Color('#ffd6a5') },
    uBottom: { value: new THREE.Color('#5a7f99') },
    uSunDir: { value: new THREE.Vector3(0.6, 0.2, 0.1) },
    uSunColor: { value: new THREE.Color('#ffb46b') },
    uNight: { value: 0 },
    uTime: { value: 0 },
    uCloudLight: { value: 0.5 },
  };
  const material = new THREE.ShaderMaterial({ uniforms, vertexShader, fragmentShader, side: THREE.BackSide, depthWrite: false, depthTest: true, fog: false });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(1800, 32, 16), material);
  mesh.renderOrder = -10;
  mesh.frustumCulled = false;
  scene.add(mesh);
  return {
    mesh,
    uniforms,
    update(time, camera) {
      uniforms.uTime.value = time;
      mesh.position.copy(camera.position);
    },
  };
}
