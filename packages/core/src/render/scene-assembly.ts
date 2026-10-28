import { Group } from 'three';
import type { Mesh } from 'three';
import type { DerivedPlanet, DerivedSystem } from '../physics/derive.js';
import { createHzMesh, type HzPiece } from './hz-mesh.js';
import { createOrbit, type OrbitPiece } from './orbits.js';
import { createPlanet, type PlanetPiece } from './planets.js';
import { hzRadius, orbitRadius, planetRadius, starScene, type ScaleMode } from './scales.js';
import { createStar, type StarPiece } from './star.js';

/** One planet as drawn: its mesh, data and current orbit radius in scene units. */
export interface SystemBody {
  mesh: Mesh;
  planet: DerivedPlanet;
  orbitRadius: number;
}

/** Star, planets, orbits and habitable zone for one system, under a single group. */
export interface SystemScene {
  root: Group;
  bodies: SystemBody[];
  /** Largest orbit radius in scene units (0 without planets). */
  outerOrbit: number;
  /** Rescales star, orbits and planets and rebuilds the habitable-zone ring. */
  applyScale(mode: ScaleMode): void;
  setHabitableZoneVisible(visible: boolean): void;
  dispose(): void;
}

/** Builds the scene contents of a derived system at the given scale mode. */
export function buildSystemScene(
  system: DerivedSystem,
  mode: ScaleMode,
  showHabitableZone: boolean,
): SystemScene {
  const root = new Group();
  const star: StarPiece = createStar(system.star.colour);
  root.add(star.object);
  const planets: PlanetPiece[] = [];
  const orbits: OrbitPiece[] = [];
  const bodies: SystemBody[] = system.planets.map((planet) => {
    const orbit = createOrbit(planet.colour);
    const piece = createPlanet(planet);
    orbits.push(orbit);
    planets.push(piece);
    root.add(orbit.line, piece.mesh);
    return { mesh: piece.mesh, planet, orbitRadius: 1 };
  });
  let hz: HzPiece | null = null;
  let hzVisible = showHabitableZone;

  const scene: SystemScene = {
    root,
    bodies,
    outerOrbit: 0,
    applyScale(m) {
      const s = starScene(m);
      star.mesh.scale.setScalar(s.starRadius);
      star.glow.scale.setScalar(s.glowScale);
      let outer = 0;
      bodies.forEach((b, i) => {
        b.orbitRadius = orbitRadius(m, b.planet.aAu, b.planet.aOverRs);
        orbits[i]!.line.scale.set(b.orbitRadius, 1, b.orbitRadius);
        b.mesh.scale.setScalar(planetRadius(m, b.planet.radiusEarth, b.planet.rpOverRs, 0));
        outer = Math.max(outer, b.orbitRadius);
      });
      scene.outerOrbit = outer;
      if (hz) {
        root.remove(hz.mesh);
        hz.dispose();
      }
      const zone = system.habitableZone;
      hz = createHzMesh(hzRadius(m, zone.inner, system.star.radius), hzRadius(m, zone.outer, system.star.radius));
      hz.mesh.visible = hzVisible;
      root.add(hz.mesh);
    },
    setHabitableZoneVisible(v) {
      hzVisible = v;
      if (hz) hz.mesh.visible = v;
    },
    dispose() {
      root.removeFromParent();
      root.clear();
      star.dispose();
      for (const p of planets) p.dispose();
      for (const o of orbits) o.dispose();
      hz?.dispose();
      hz = null;
      planets.length = orbits.length = bodies.length = 0;
    },
  };
  scene.applyScale(mode);
  return scene;
}
