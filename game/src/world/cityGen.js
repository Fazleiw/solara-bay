// Builds Solara Bay: ground and roads, every block's buildings (merged per block so the
// renderer can cull whole blocks), the landmarks, instanced props, water, sky and the
// day/night lighting. Returns the world object the rest of the game queries.
import * as THREE from 'three';
import { CITY_SEED, GRID } from '../config.js';
import { createRandom } from '../core/random.js';
import { createCollisionWorld } from './collision.js';
import { createRoadNetwork } from './roadNetwork.js';
import { blockCenter, districtOf, LANDMARKS } from './cityLayout.js';
import { createTextures } from './textures.js';
import { createMaterials } from './materials.js';
import { buildGroundAndRoads } from './roads.js';
import { createChunk, createSignRegistry, finishChunk } from './buildKit.js';
import * as districts from './buildings.js';
import * as landmarks from './landmarks.js';
import { buildProps } from './props.js';
import { createWater } from './water.js';
import { createSky } from './sky.js';
import { createDayNight } from './dayNight.js';

const DISTRICT_BUILDERS = {
  downtown: districts.buildDowntownBlock,
  midtown: districts.buildMidtownBlock,
  deco: districts.buildDecoBlock,
  residential: districts.buildResidentialBlock,
  port: districts.buildPortBlock,
  park: districts.buildParkBlock,
  beach: districts.buildBeachBlock,
  island: districts.buildIslandBlock,
};

const LANDMARK_BUILDERS = {
  safehouse: landmarks.buildSafehouse,
  tavoGarage: landmarks.buildTavoGarage,
  hospital: landmarks.buildHospital,
  policeHQ: landmarks.buildPoliceHQ,
  showroom: landmarks.buildShowroom,
  warehouse: landmarks.buildWarehouseYard,
  gunShop: landmarks.buildGunShopBlock,
};

export function buildCity(scene, renderer) {
  const rng = createRandom(CITY_SEED);
  const textures = createTextures();
  const materials = createMaterials(textures);
  const collision = createCollisionWorld();
  const network = createRoadNetwork();
  const signs = createSignRegistry();
  const props = { palms: [], trees: [], lamps: [] };
  const city = new THREE.Group();
  city.name = 'city';
  scene.add(city);

  city.add(buildGroundAndRoads(materials));

  const landmarkByBlock = new Map();
  for (const [key, mark] of Object.entries(LANDMARKS)) landmarkByBlock.set(`${mark.block[0]},${mark.block[1]}`, key);

  let lighthouseLamp = null;
  for (let i = 0; i < GRID.cols; i += 1) {
    for (let j = 0; j < GRID.rows; j += 1) {
      const district = districtOf(i, j);
      if (district === 'water' || district === 'out') continue;
      const { x, z } = blockCenter(i, j);
      const chunk = createChunk();
      const ctx = { chunk, collision, signs, props, rng };
      const special = landmarkByBlock.get(`${i},${j}`);
      if (special && LANDMARK_BUILDERS[special]) {
        LANDMARK_BUILDERS[special](ctx, x, z);
      } else {
        DISTRICT_BUILDERS[district](ctx, x, z, i, j);
        if (special === 'cocoShack') landmarks.buildCocoShack(ctx, x, z);
        if (special === 'lighthouse') lighthouseLamp = landmarks.buildLighthouse(ctx, x, z);
      }
      const block = new THREE.Group();
      block.name = `block-${i}-${j}`;
      finishChunk(chunk, materials, block);
      city.add(block);
    }
  }

  // Structures that span blocks or stand over the water.
  const extra = createChunk();
  const extraCtx = { chunk: extra, collision, signs, props, rng };
  const wheel = landmarks.buildPierAndWheel(extraCtx, city, materials);
  landmarks.buildCausewayBridge(extraCtx);
  landmarks.buildDocksideCranes(extraCtx);
  landmarks.buildDistantHills(extraCtx);
  finishChunk(extra, materials, city);
  materials.neonSigns = signs.build(city);

  const propSet = buildProps(props, materials, textures, network, scene);
  const water = createWater(scene);
  const sky = createSky(scene);
  const dayNight = createDayNight(scene, renderer, sky, water, materials);

  // The lighthouse's sweeping beam, visible after dark.
  const beamMaterial = new THREE.MeshBasicMaterial({ color: '#fff2c0', transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false });
  const beam = new THREE.Mesh(new THREE.ConeGeometry(9, 160, 16, 1, true).translate(0, -80, 0).rotateZ(Math.PI / 2), beamMaterial);
  if (lighthouseLamp) beam.position.set(lighthouseLamp.x, lighthouseLamp.y, lighthouseLamp.z);
  scene.add(beam);

  let clock = 0;
  return {
    scene,
    textures,
    materials,
    collision,
    network,
    dayNight,
    water,
    sky,
    props: propSet,
    update(dt, focus, camera) {
      clock += dt;
      dayNight.update(dt, focus);
      const night = dayNight.state.night;
      propSet.update(night, clock);
      water.update(clock, camera);
      sky.update(clock, camera);
      wheel.update(clock);
      beam.rotation.y = clock * 0.6;
      beamMaterial.opacity = night * 0.18;
    },
    get time() { return clock; },
  };
}
