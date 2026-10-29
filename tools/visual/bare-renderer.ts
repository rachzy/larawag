import { BoxGeometry, Mesh, MeshStandardMaterial, PerspectiveCamera, PointLight, Scene, WebGLRenderer } from 'three';

/** A bare renderer disposed the way the library does; its leftovers are three's own per-renderer internals. */
export function bareRenderer(): void {
  const r = new WebGLRenderer({ antialias: true });
  // A lit standard material: three uploads its shared placeholder textures to every renderer that draws one.
  const scene = new Scene();
  const geometry = new BoxGeometry();
  const material = new MeshStandardMaterial();
  scene.add(new Mesh(geometry, material), new PointLight());
  r.render(scene, new PerspectiveCamera());
  geometry.dispose();
  material.dispose();
  r.dispose();
  r.forceContextLoss();
}
