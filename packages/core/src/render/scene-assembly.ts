import { Group } from 'three';
import { AU_PER_RSUN } from '../physics/constants.js';
import type { Mesh } from 'three';
import type { DerivedPlanet, DerivedSystem } from '../physics/derive.js';
import { createHzMesh, type HzPiece } from './hz-mesh.js';
import { createOrbit, type OrbitPiece } from './orbits.js';
import { createPlanet, type PlanetPiece, type PlanetStyle } from './planets.js';
import { hzRadius, orbitRadius, planetRadius, starScene, type ScaleMode } from './scales.js';
import { createStar, type StarPiece } from './star.js';

/** One planet as drawn: its mesh, data and current orbit radius in scene units. */
export interface SystemBody {
  mesh: Mesh;
  planet: DerivedPlanet;
  orbitRadius: number;
}

/** Distance between two stars in compressed scale, scene units: inside the innermost possible orbit (5). */
export const BINARY_SCENE_SEPARATION = 3.2;

/** Star, planets, orbits and habitable zone for one system, under a single group. */
export interface SystemScene {
  root: Group;
  /** One star, or two circling their centre of mass. */
  stars: StarPiece[];
  /** Moves the stars of a binary to their places after `days`; no-op for one star. */
  setTime(days: number): void;
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
  planetStyle: PlanetStyle = 'inferred',
): SystemScene {
  const root = new Group();
  const stars: StarPiece[] = system.stars.map((st, i) => createStar(st.colour, i === 0));
  for (const st of stars) root.add(st.object);
  const binary = system.binary;
  const unit = system.stars[0]!.radius;
  const largest = Math.max(...system.stars.map((st) => st.radius));
  // Each star's distance from the centre of mass, scene units, for the current mode.
  let offsets: number[] = [0];
  const planets: PlanetPiece[] = [];
  const orbits: OrbitPiece[] = [];
  const bodies: SystemBody[] = system.planets.map((planet) => {
    const orbit = createOrbit(planet.colour);
    const piece = createPlanet(planet, planetStyle);
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
    stars,
    setTime(days) {
      if (!binary) return;
      const th = binary.phase + (2 * Math.PI * days) / binary.periodDays;
      stars.forEach((st, i) => {
        const r = (i === 0 ? -1 : 1) * offsets[i]!;
        st.object.position.set(r * Math.cos(th), 0, r * Math.sin(th));
      });
    },
    applyScale(m) {
      const s = starScene(m);
      stars.forEach((st, i) => {
        const radius = system.stars[i]!.radius;
        // Two stars in compressed scale shrink to fit inside the innermost orbit.
        const k = !binary ? 1 : m === 'compressed' ? 0.6 * Math.sqrt(radius / largest) : radius / unit;
        st.mesh.scale.setScalar(s.starRadius * k);
        st.glow.scale.setScalar(s.glowScale * k);
      });
      offsets = !binary
        ? [0]
        : binary.distances.map((d) =>
            m === 'compressed' ? (BINARY_SCENE_SEPARATION * d) / binary.separation : (d * AU_PER_RSUN) / unit,
          );
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
      for (const st of stars) st.dispose();
      for (const p of planets) p.dispose();
      for (const o of orbits) o.dispose();
      hz?.dispose();
      hz = null;
      planets.length = orbits.length = bodies.length = 0;
    },
  };
  scene.applyScale(mode);
  scene.setTime(0);
  return scene;
}
