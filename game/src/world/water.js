// The sea and the inlet: one large plane with a shader that layers moving wave normals, a
// fresnel blend from deep teal to the sky colour, a sun glitter path and the scene fog.
import * as THREE from 'three';
import { WATER_LEVEL } from '../config.js';

const vertexShader = /* glsl */`
  #include <common>
  #include <fog_pars_vertex>
  varying vec3 vWorld;
  void main() {
    vec4 world = modelMatrix * vec4(position, 1.0);
    vWorld = world.xyz;
    vec4 mvPosition = viewMatrix * world;
    gl_Position = projectionMatrix * mvPosition;
    #include <fog_vertex>
  }
`;

const fragmentShader = /* glsl */`
  #include <common>
  #include <fog_pars_fragment>
  uniform float uTime;
  uniform vec3 uSunDir;
  uniform vec3 uSunColor;
  uniform vec3 uSkyColor;
  uniform vec3 uDeep;
  uniform vec3 uShallow;
  uniform float uNight;
  varying vec3 vWorld;

  float waveHeight(vec2 p) {
    float h = 0.0;
    h += sin(dot(p, vec2(0.12, 0.05)) + uTime * 1.1) * 0.5;
    h += sin(dot(p, vec2(-0.07, 0.15)) + uTime * 1.6) * 0.35;
    h += sin(dot(p, vec2(0.31, -0.22)) + uTime * 2.3) * 0.16;
    h += sin(dot(p, vec2(-0.5, -0.41)) + uTime * 3.1) * 0.08;
    h += sin(dot(p, vec2(0.9, 0.7)) + uTime * 4.0) * 0.04;
    return h;
  }

  void main() {
    vec2 p = vWorld.xz;
    float e = 0.35;
    float h = waveHeight(p);
    vec3 n = normalize(vec3(waveHeight(p - vec2(e, 0.0)) - waveHeight(p + vec2(e, 0.0)), 2.2, waveHeight(p - vec2(0.0, e)) - waveHeight(p + vec2(0.0, e))));
    vec3 viewDir = normalize(cameraPosition - vWorld);
    float fresnel = pow(1.0 - max(dot(viewDir, n), 0.0), 4.0);
    vec3 base = mix(uDeep, uShallow, clamp(h * 0.25 + 0.4, 0.0, 1.0));
    vec3 color = mix(base, uSkyColor, clamp(fresnel * 0.9 + 0.08, 0.0, 1.0));
    vec3 halfDir = normalize(uSunDir + viewDir);
    float spec = pow(max(dot(n, halfDir), 0.0), 220.0);
    float glitter = pow(max(dot(n, halfDir), 0.0), 40.0) * 0.25;
    color += uSunColor * (spec * 3.0 + glitter) * step(0.0, uSunDir.y);
    color += vec3(0.9, 0.6, 1.0) * uNight * 0.02;
    gl_FragColor = vec4(color, 0.96);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
    #include <fog_fragment>
  }
`;

export function createWater(scene) {
  const uniforms = THREE.UniformsUtils.merge([
    THREE.UniformsLib.fog,
    {
      uTime: { value: 0 },
      uSunDir: { value: new THREE.Vector3(0.5, 0.4, 0.2) },
      uSunColor: { value: new THREE.Color('#ffd8a0') },
      uSkyColor: { value: new THREE.Color('#9cc8ea') },
      uDeep: { value: new THREE.Color('#0b4f6c') },
      uShallow: { value: new THREE.Color('#1aa3a8') },
      uNight: { value: 0 },
    },
  ]);
  const material = new THREE.ShaderMaterial({ uniforms, vertexShader, fragmentShader, fog: true, transparent: true });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(4000, 4000).rotateX(-Math.PI / 2), material);
  mesh.position.y = WATER_LEVEL;
  mesh.receiveShadow = false;
  mesh.renderOrder = -1;
  scene.add(mesh);
  return {
    mesh,
    uniforms,
    update(time, camera) {
      uniforms.uTime.value = time;
      mesh.position.x = Math.round(camera.position.x / 50) * 50;
      mesh.position.z = Math.round(camera.position.z / 50) * 50;
    },
  };
}
