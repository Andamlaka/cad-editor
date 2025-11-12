import * as THREE from 'three';

// Helper: Create edges from geometry
function createEdgesFromGeometry(geometry, transform) {
  const edges = [];
  const positions = geometry.attributes.position;
  const index = geometry.index;

  // Handle indexed and non-indexed geometries
  if (!positions) return edges;

  // Get all edges from faces
  const edgeMap = new Map();

  const pushTriangleEdges = (i0, i1, i2) => {
    const v0 = new THREE.Vector3(
      positions.getX(i0),
      positions.getY(i0),
      positions.getZ(i0)
    );
    const v1 = new THREE.Vector3(
      positions.getX(i1),
      positions.getY(i1),
      positions.getZ(i1)
    );
    const v2 = new THREE.Vector3(
      positions.getX(i2),
      positions.getY(i2),
      positions.getZ(i2)
    );

    // Create edges (avoid duplicates)
    const addEdge = (start, end) => {
      const key1 = `${start.x.toFixed(3)},${start.y.toFixed(
        3
      )},${start.z.toFixed(3)}-${end.x.toFixed(3)},${end.y.toFixed(
        3
      )},${end.z.toFixed(3)}`;
      const key2 = `${end.x.toFixed(3)},${end.y.toFixed(3)},${end.z.toFixed(
        3
      )}-${start.x.toFixed(3)},${start.y.toFixed(3)},${start.z.toFixed(3)}`;

      if (!edgeMap.has(key1) && !edgeMap.has(key2)) {
        edgeMap.set(key1, { start: start.clone(), end: end.clone() });
      }
    };

    addEdge(v0, v1);
    addEdge(v1, v2);
    addEdge(v2, v0);
  };

  if (index && index.count >= 3) {
    for (let i = 0; i < index.count; i += 3) {
      const i0 = index.getX(i);
      const i1 = index.getX(i + 1);
      const i2 = index.getX(i + 2);
      pushTriangleEdges(i0, i1, i2);
    }
  } else {
    // Non-indexed: positions are laid out sequentially per triangle
    const triCount = Math.floor(positions.count / 3);
    for (let t = 0; t < triCount; t++) {
      const base = t * 3;
      pushTriangleEdges(base, base + 1, base + 2);
    }
  }

  return Array.from(edgeMap.values());
}

// Helper: Create faces from geometry
function createFacesFromGeometry(geometry, transform) {
  const faces = [];
  const positions = geometry.attributes.position;
  const normals = geometry.attributes.normal;
  const index = geometry.index;

  if (!positions) return faces;

  const pushFace = (i0, i1, i2) => {
    const v0 = new THREE.Vector3(
      positions.getX(i0),
      positions.getY(i0),
      positions.getZ(i0)
    );
    const v1 = new THREE.Vector3(
      positions.getX(i1),
      positions.getY(i1),
      positions.getZ(i1)
    );
    const v2 = new THREE.Vector3(
      positions.getX(i2),
      positions.getY(i2),
      positions.getZ(i2)
    );

    let normal;
    if (normals) {
      normal = new THREE.Vector3(
        normals.getX(i0),
        normals.getY(i0),
        normals.getZ(i0)
      );
    } else {
      // Compute normal from geometry if not provided
      normal = v1.clone().sub(v0).cross(v2.clone().sub(v0)).normalize();
    }

    // Calculate face center
    const center = new THREE.Vector3()
      .add(v0)
      .add(v1)
      .add(v2)
      .multiplyScalar(1 / 3);

    // Calculate area
    const area = v0.clone().sub(v1).cross(v1.clone().sub(v2)).length() / 2;

    faces.push({
      center: center,
      normal: normal.normalize(),
      vertices: [v0, v1, v2],
      area: area,
      size: Math.max(v0.distanceTo(v1), v1.distanceTo(v2), v2.distanceTo(v0)),
    });
  };

  if (index && index.count >= 3) {
    for (let i = 0; i < index.count; i += 3) {
      const i0 = index.getX(i);
      const i1 = index.getX(i + 1);
      const i2 = index.getX(i + 2);
      pushFace(i0, i1, i2);
    }
  } else {
    // Non-indexed: positions are laid out sequentially per triangle
    const triCount = Math.floor(positions.count / 3);
    for (let t = 0; t < triCount; t++) {
      const base = t * 3;
      pushFace(base, base + 1, base + 2);
    }
  }

  return faces;
}

export function createBox(width = 1, height = 1, depth = 1) {
  const geometry = new THREE.BoxGeometry(width, height, depth);
  const material = new THREE.MeshStandardMaterial({
    color: 0x2194ce,
    flatShading: true,
  });
  const box = new THREE.Mesh(geometry, material);
  box.castShadow = true;
  box.receiveShadow = true;

  // Create faces and edges in local space
  box.userData.faces = createFacesFromGeometry(geometry);
  box.userData.edges = createEdgesFromGeometry(geometry);
  box.userData.type = 'box';
  box.userData.dimensions = { width, height, depth };

  return box;
}

export function createSphere(radius = 0.7, segments = 32) {
  const geometry = new THREE.SphereGeometry(radius, segments, segments);
  const material = new THREE.MeshStandardMaterial({
    color: 0xcc221a,
    flatShading: true,
  });
  const sphere = new THREE.Mesh(geometry, material);
  sphere.castShadow = true;
  sphere.receiveShadow = true;

  // Create faces and edges in local space
  sphere.userData.faces = createFacesFromGeometry(geometry);
  sphere.userData.edges = createEdgesFromGeometry(geometry);
  sphere.userData.type = 'sphere';
  sphere.userData.radius = radius;

  return sphere;
}

export function createCylinder(radius = 0.5, height = 1, segments = 32) {
  const geometry = new THREE.CylinderGeometry(radius, radius, height, segments);
  const material = new THREE.MeshStandardMaterial({
    color: 0x22cc77,
    flatShading: true,
  });
  const cylinder = new THREE.Mesh(geometry, material);
  cylinder.castShadow = true;
  cylinder.receiveShadow = true;

  // Create faces and edges in local space
  cylinder.userData.faces = createFacesFromGeometry(geometry);
  cylinder.userData.edges = createEdgesFromGeometry(geometry);
  cylinder.userData.type = 'cylinder';
  cylinder.userData.radius = radius;
  cylinder.userData.height = height;

  return cylinder;
}

// Helper to update faces and edges after transformation
export function updateShapeGeometry(shape) {
  if (!shape.geometry) return;

  // Recompute faces/edges in local space; world transform applied at usage time
  shape.userData.faces = createFacesFromGeometry(shape.geometry);
  shape.userData.edges = createEdgesFromGeometry(shape.geometry);
}
