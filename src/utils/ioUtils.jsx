import * as THREE from 'three';
import {
  createBox,
  createSphere,
  createCylinder,
  updateShapeGeometry,
} from './shapeUtils';

export function saveSceneToJSON(objects, sketches) {
  const sceneData = {
    version: '1.0',
    objects: [],
    sketches: [],
  };

  // Serialize objects
  objects.forEach((obj, index) => {
    const objData = {
      id: index,
      type: obj.userData.type || 'unknown',
      position: {
        x: obj.position.x,
        y: obj.position.y,
        z: obj.position.z,
      },
      rotation: {
        x: obj.rotation.x,
        y: obj.rotation.y,
        z: obj.rotation.z,
      },
      scale: {
        x: obj.scale.x,
        y: obj.scale.y,
        z: obj.scale.z,
      },
      material: {
        color: obj.material.color.getHex(),
      },
    };

    // Add type-specific data
    if (obj.userData.type === 'box') {
      objData.dimensions = obj.userData.dimensions || {
        width: 1,
        height: 1,
        depth: 1,
      };
    } else if (obj.userData.type === 'sphere') {
      objData.radius = obj.userData.radius || 0.7;
    } else if (obj.userData.type === 'cylinder') {
      objData.radius = obj.userData.radius || 0.5;
      objData.height = obj.userData.height || 1;
    } else if (obj.userData.type === 'extruded') {
      objData.type = 'extruded';
      objData.extrusionHeight = obj.userData.extrusionHeight || 2;
      if (obj.userData.sketchData) {
        objData.sketchData = {
          type: obj.userData.sketchData.type,
          ...(obj.userData.sketchData.width !== undefined && {
            width: obj.userData.sketchData.width,
          }),
          ...(obj.userData.sketchData.height !== undefined && {
            height: obj.userData.sketchData.height,
          }),
          ...(obj.userData.sketchData.radius !== undefined && {
            radius: obj.userData.sketchData.radius,
          }),
          ...(obj.userData.sketchData.center && {
            center: {
              x: obj.userData.sketchData.center.x || 0,
              y: obj.userData.sketchData.center.y || 0,
              z: obj.userData.sketchData.center.z || 0,
            },
          }),
        };
      }
    }

    sceneData.objects.push(objData);
  });

  // Serialize sketches
  sketches.forEach((sketch, index) => {
    const sketchData = {
      id: index,
      type: sketch.type,
    };

    if (sketch.type === 'rectangle') {
      sketchData.width = sketch.width;
      sketchData.height = sketch.height;
      if (sketch.center) {
        sketchData.center = {
          x: sketch.center.x || 0,
          y: sketch.center.y || 0,
          z: sketch.center.z || 0,
        };
      }
    } else if (sketch.type === 'circle') {
      sketchData.radius = sketch.radius;
      if (sketch.center) {
        sketchData.center = {
          x: sketch.center.x || 0,
          y: sketch.center.y || 0,
          z: sketch.center.z || 0,
        };
      }
    }

    sceneData.sketches.push(sketchData);
  });

  return sceneData;
}

export function loadSceneFromJSON(data, scene, objectsRef, sketchesRef) {
  // Clear existing objects
  objectsRef.current.forEach((obj) => {
    scene.remove(obj);
    if (obj.geometry) obj.geometry.dispose();
    if (obj.material) obj.material.dispose();
  });
  objectsRef.current = [];
  sketchesRef.current = [];

  // Remove sketch visualizations
  const toRemove = [];
  scene.children.forEach((child) => {
    if (child.userData.sketch) {
      toRemove.push(child);
    }
  });
  toRemove.forEach((child) => {
    scene.remove(child);
    if (child.geometry) child.geometry.dispose();
    if (child.material) child.material.dispose();
  });

  // Load objects
  if (data.objects) {
    data.objects.forEach((objData) => {
      let shape;

      switch (objData.type) {
        case 'box':
          const dims = objData.dimensions || { width: 1, height: 1, depth: 1 };
          shape = createBox(dims.width, dims.height, dims.depth);
          break;
        case 'sphere':
          shape = createSphere(objData.radius || 0.7);
          break;
        case 'cylinder':
          shape = createCylinder(objData.radius || 0.5, objData.height || 1);
          break;
        case 'extruded':
          // Recreate extruded shape
          shape = recreateExtrudedShape(objData);
          break;
        default:
          console.warn('Unknown object type:', objData.type);
          return;
      }

      // Apply transforms
      if (objData.position) {
        shape.position.set(
          objData.position.x,
          objData.position.y,
          objData.position.z
        );
      }
      if (objData.rotation) {
        shape.rotation.set(
          objData.rotation.x,
          objData.rotation.y,
          objData.rotation.z
        );
      }
      if (objData.scale) {
        shape.scale.set(objData.scale.x, objData.scale.y, objData.scale.z);
      }
      if (objData.material && objData.material.color) {
        shape.material.color.setHex(objData.material.color);
      }

      // Update geometry after transforms
      updateShapeGeometry(shape);

      scene.add(shape);
      objectsRef.current.push(shape);
    });
  }

  // Load sketches
  if (data.sketches) {
    data.sketches.forEach((sketchData) => {
      const sketch = {
        type: sketchData.type,
      };

      if (sketchData.type === 'rectangle') {
        sketch.width = sketchData.width;
        sketch.height = sketchData.height;
        sketch.center = new THREE.Vector3(
          sketchData.center.x,
          sketchData.center.y,
          sketchData.center.z
        );
      } else if (sketchData.type === 'circle') {
        sketch.radius = sketchData.radius;
        sketch.center = new THREE.Vector3(
          sketchData.center.x,
          sketchData.center.y,
          sketchData.center.z
        );
      }

      sketchesRef.current.push(sketch);

      // Visualize sketch
      let geometry, material, mesh;
      if (sketch.type === 'rectangle') {
        geometry = new THREE.PlaneGeometry(sketch.width, sketch.height);
        material = new THREE.MeshBasicMaterial({
          color: 0x00aa00,
          opacity: 0.3,
          transparent: true,
          side: THREE.DoubleSide,
        });
        mesh = new THREE.Mesh(geometry, material);
        mesh.rotateX(-Math.PI / 2);
        mesh.position.copy(sketch.center);
      } else if (sketch.type === 'circle') {
        geometry = new THREE.CircleGeometry(sketch.radius, 32);
        material = new THREE.MeshBasicMaterial({
          color: 0x00aa00,
          opacity: 0.3,
          transparent: true,
          side: THREE.DoubleSide,
        });
        mesh = new THREE.Mesh(geometry, material);
        mesh.rotateX(-Math.PI / 2);
        mesh.position.copy(sketch.center);
      }

      if (mesh) {
        mesh.userData.sketch = sketch;
        scene.add(mesh);
      }
    });
  }
}

function recreateExtrudedShape(objData) {
  const sketchData = objData.sketchData;
  const height = objData.extrusionHeight || 2;

  let shape2D;
  if (sketchData.type === 'rectangle') {
    shape2D = new THREE.Shape();
    shape2D.moveTo(-sketchData.width / 2, -sketchData.height / 2);
    shape2D.lineTo(sketchData.width / 2, -sketchData.height / 2);
    shape2D.lineTo(sketchData.width / 2, sketchData.height / 2);
    shape2D.lineTo(-sketchData.width / 2, sketchData.height / 2);
    shape2D.lineTo(-sketchData.width / 2, -sketchData.height / 2);
  } else if (sketchData.type === 'circle') {
    shape2D = new THREE.Shape();
    shape2D.absarc(0, 0, sketchData.radius, 0, Math.PI * 2, false);
  } else {
    return null;
  }

  const extrudeSettings = {
    depth: height,
    bevelEnabled: false,
  };
  const geometry = new THREE.ExtrudeGeometry(shape2D, extrudeSettings);
  const material = new THREE.MeshStandardMaterial({ color: 0x00aa00 });
  const shape = new THREE.Mesh(geometry, material);

  shape.userData.type = 'extruded';
  shape.userData.extrusionHeight = height;
  shape.userData.sketchData = sketchData;

  // Create faces and edges
  updateShapeGeometry(shape);

  return shape;
}
