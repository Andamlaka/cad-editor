import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import {
  createBox,
  createSphere,
  createCylinder,
  updateShapeGeometry,
} from '../utils/shapeUtils';
import { saveSceneToJSON, loadSceneFromJSON } from '../utils/ioUtils';

export default function ThreeCanvas() {
  const mountRef = useRef(null);
  const sceneRef = useRef(null);
  const cameraRef = useRef(null);
  const rendererRef = useRef(null);
  const raycasterRef = useRef(null);

  const [selectedEntity, setSelectedEntity] = useState(null);
  const [selectedType, setSelectedType] = useState(null); // 'shape', 'face', 'edge'
  const [transformMode, setTransformMode] = useState(null); // 'translate', 'rotate', 'scale'
  const [sketchMode, setSketchMode] = useState(false);
  const [sketchTool, setSketchTool] = useState(null); // 'rectangle', 'circle'
  const [snapToGrid, setSnapToGrid] = useState(true);
  const [gridSize, setGridSize] = useState(0.5);

  const objectsRef = useRef([]);
  const sketchesRef = useRef([]);
  const highlightedRef = useRef(null);
  const previewRef = useRef(null);
  const isDraggingRef = useRef(false);
  const dragStartRef = useRef(null);
  const currentSketchRef = useRef(null);
  const planeRef = useRef(null);
  const pendingShapeTypeRef = useRef(null); // Track which shape to create (use ref for immediate access)

  // Refs for state used inside event handlers to avoid re-initting scene
  const sketchModeRef = useRef(false);
  const sketchToolRef = useRef(null);
  const snapToGridRef = useRef(true);
  const gridSizeRef = useRef(0.5);
  const selectedEntityRef = useRef(null);
  const selectedTypeRef = useRef(null);
  const transformModeRef = useRef(null);
  const isTransformDraggingRef = useRef(false);
  const transformStartRef = useRef({
    pointer: null, // THREE.Vector3 for translate, {x,y} for rotate/scale
    entityPosition: null,
    entityRotationY: 0,
    entityScale: null,
  });
  const transformEntityRef = useRef(null);
  const undoStackRef = useRef([]);
  const redoStackRef = useRef([]);
  const multiSelectedRef = useRef(new Set());
  const multiHighlightsRef = useRef(new Map());

  useEffect(() => {
    if (!mountRef.current) return;
    const mountEl = mountRef.current;

    // Scene setup
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf0f0f0);
    sceneRef.current = scene;

    // Camera setup
    const camera = new THREE.PerspectiveCamera(
      75,
      window.innerWidth / window.innerHeight,
      0.1,
      1000
    );
    camera.position.set(15, 15, 15);
    camera.lookAt(0, 0, 0);
    cameraRef.current = camera;

    // Renderer setup
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    mountEl.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // OrbitControls (simple implementation)
    let isDragging = false;
    let isMouseDown = false; // Track if mouse button is actually pressed
    let previousMousePosition = { x: 0, y: 0 };
    let mouseDownPosition = { x: 0, y: 0 };
    const DRAG_THRESHOLD = 5; // pixels

    const onMouseDown = (e) => {
      if (e.button === 0) {
        // Left mouse button
        // If there's a pending shape, handle shape creation
        if (pendingShapeTypeRef.current) {
          handleSelection(e);
          return;
        }
        // Don't start camera rotation if actively sketching or transforming
        if (
          (sketchModeRef.current && sketchToolRef.current) ||
          (transformModeRef.current && selectedEntityRef.current)
        ) {
          return;
        }

        // Call handleSelection immediately for click selection
        // This will select if it's a click, and camera rotation will start if mouse moves
        handleSelection(e);

        isMouseDown = true;
        isDragging = false; // Will be set to true only after movement
        mouseDownPosition = { x: e.clientX, y: e.clientY };
        previousMousePosition = { x: e.clientX, y: e.clientY };
      }
    };

    const onMouseMove = (e) => {
      // Only process camera rotation if mouse button is actually down
      if (!isMouseDown) return;

      if (!isDraggingRef.current && !pendingShapeTypeRef.current) {
        // Allow camera rotation if not actively sketching
        if (
          (sketchModeRef.current && sketchToolRef.current) ||
          (transformModeRef.current && selectedEntityRef.current)
        )
          return;
        const deltaX = Math.abs(e.clientX - mouseDownPosition.x);
        const deltaY = Math.abs(e.clientY - mouseDownPosition.y);

        // Only start dragging if mouse has moved beyond threshold
        if (
          !isDragging &&
          (deltaX > DRAG_THRESHOLD || deltaY > DRAG_THRESHOLD)
        ) {
          isDragging = true;
        }

        if (isDragging) {
          const moveDeltaX = e.clientX - previousMousePosition.x;
          const moveDeltaY = e.clientY - previousMousePosition.y;

          const spherical = new THREE.Spherical();
          spherical.setFromVector3(camera.position);
          spherical.theta -= moveDeltaX * 0.01;
          spherical.phi += moveDeltaY * 0.01;
          spherical.phi = Math.max(0.1, Math.min(Math.PI - 0.1, spherical.phi));

          camera.position.setFromSpherical(spherical);
          camera.lookAt(0, 0, 0);

          previousMousePosition = { x: e.clientX, y: e.clientY };
        }
      }
    };

    const onMouseUp = () => {
      // If mouse was pressed but didn't drag, it was a click
      // Selection was already handled in onMouseDown
      // If it was a drag, we don't want to select

      isMouseDown = false;
      isDragging = false;
      mouseDownPosition = { x: 0, y: 0 };
    };

    renderer.domElement.addEventListener('mousedown', onMouseDown);
    renderer.domElement.addEventListener('mousemove', onMouseMove);
    renderer.domElement.addEventListener('mouseup', onMouseUp);
    renderer.domElement.addEventListener('wheel', (e) => {
      e.preventDefault();
      const scale = e.deltaY > 0 ? 1.1 : 0.9;
      camera.position.multiplyScalar(scale);
      camera.lookAt(0, 0, 0);
    });

    // Grid helper
    const grid = new THREE.GridHelper(50, 50, 0x888888, 0xcccccc);
    scene.add(grid);

    // Sketch plane (XZ plane at y=0)
    const planeGeo = new THREE.PlaneGeometry(100, 100);
    const planeMat = new THREE.MeshBasicMaterial({
      color: 0x999999,
      opacity: 0.1,
      transparent: true,
      side: THREE.DoubleSide,
    });
    const plane = new THREE.Mesh(planeGeo, planeMat);
    plane.rotateX(-Math.PI / 2);
    plane.position.y = 0;
    // Make sure plane is raycastable
    plane.raycast = THREE.Mesh.prototype.raycast;
    planeRef.current = plane;
    scene.add(plane);

    // Create a THREE.Plane for more reliable raycasting
    const mathPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

    // Raycaster
    const raycaster = new THREE.Raycaster();
    raycasterRef.current = raycaster;

    // Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
    dirLight.position.set(20, 30, 20);
    dirLight.castShadow = true;
    scene.add(dirLight);

    // History helpers (within effect to access scene and helpers)
    function snapshotScene() {
      try {
        const sceneData = saveSceneToJSON(
          objectsRef.current,
          sketchesRef.current
        );
        return JSON.stringify(sceneData);
      } catch (e) {
        console.error('Snapshot failed', e);
        return null;
      }
    }

    function restoreSceneFromSnapshot(snapshot) {
      try {
        const data = JSON.parse(snapshot);
        loadSceneFromJSON(data, scene, objectsRef, sketchesRef);
        clearHighlight();
        setSelectedEntity(null);
        setSelectedType(null);
        selectedEntityRef.current = null;
        selectedTypeRef.current = null;
        window.dispatchEvent(
          new CustomEvent('selectionChanged', {
            detail: { entity: null, type: null },
          })
        );
        window.dispatchEvent(
          new CustomEvent('sketchesUpdated', {
            detail: [...sketchesRef.current],
          })
        );
      } catch (e) {
        console.error('Restore failed', e);
      }
    }

    function pushHistory() {
      const snap = snapshotScene();
      if (snap) {
        undoStackRef.current.push(snap);
        // Clear redo on new action
        redoStackRef.current = [];
      }
    }

    // Helper: Get mouse position on plane
    function getMouseOnPlane(event) {
      const rect = renderer.domElement.getBoundingClientRect();
      const pointer = new THREE.Vector2();
      pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);

      // Try intersecting with the mesh first
      const intersects = raycaster.intersectObject(plane);

      if (intersects.length > 0) {
        let point = intersects[0].point.clone();
        if (snapToGridRef.current) {
          point.x =
            Math.round(point.x / gridSizeRef.current) * gridSizeRef.current;
          point.z =
            Math.round(point.z / gridSizeRef.current) * gridSizeRef.current;
        }
        return point;
      }

      // Fallback: use mathematical plane intersection
      const ray = raycaster.ray;
      const intersection = new THREE.Vector3();
      const result = ray.intersectPlane(mathPlane, intersection);
      if (result !== null) {
        let point = intersection.clone();
        if (snapToGridRef.current) {
          point.x =
            Math.round(point.x / gridSizeRef.current) * gridSizeRef.current;
          point.z =
            Math.round(point.z / gridSizeRef.current) * gridSizeRef.current;
        }
        return point;
      }

      return null;
    }

    // Helper: Clear highlight
    function clearHighlight() {
      // Clear single highlight
      if (highlightedRef.current) {
        if (highlightedRef.current.parent) {
          highlightedRef.current.parent.remove(highlightedRef.current);
        }
        if (highlightedRef.current.geometry) {
          highlightedRef.current.geometry.dispose();
        }
        if (highlightedRef.current.material) {
          highlightedRef.current.material.dispose();
        }
        highlightedRef.current = null;
      }
      // Clear multi highlights
      if (multiHighlightsRef.current.size > 0) {
        multiHighlightsRef.current.forEach((hl) => {
          if (hl && hl.parent) {
            hl.parent.remove(hl);
          }
          if (hl && hl.geometry) hl.geometry.dispose();
          if (hl && hl.material) hl.material.dispose();
        });
        multiHighlightsRef.current.clear();
      }
    }

    // Helper: Highlight entity
    function highlightEntity(entity, type) {
      clearHighlight();

      if (type === 'shape') {
        // Outline the shape using its edges, attached as a child so it follows transforms
        if (!entity.geometry) return;
        const edgesGeom = new THREE.EdgesGeometry(entity.geometry);
        const outlineMat = new THREE.LineBasicMaterial({
          color: 0x00ff00,
          linewidth: 2,
          depthTest: false,
          depthWrite: false,
          transparent: true,
          opacity: 1,
        });
        const outline = new THREE.LineSegments(edgesGeom, outlineMat);
        outline.renderOrder = 999; // draw on top
        entity.add(outline);
        highlightedRef.current = outline;
      } else if (type === 'face') {
        // Highlight face with a semi-transparent overlay
        const parentObj = entity.parentObject;
        let faceCenter = entity.center
          ? entity.center.clone()
          : new THREE.Vector3();
        let faceNormal = entity.normal
          ? entity.normal.clone()
          : new THREE.Vector3(0, 1, 0);
        let faceSize = entity.size || 1;

        // Apply world transform if parent exists
        if (parentObj) {
          parentObj.updateMatrixWorld();
          faceCenter.applyMatrix4(parentObj.matrixWorld);
          faceNormal.transformDirection(parentObj.matrixWorld);
        }

        // Use the face vertices to create a proper overlay
        if (entity.vertices && entity.vertices.length >= 3) {
          const positions = [];
          entity.vertices.forEach((v) => {
            const vertex = v.clone();
            if (parentObj) {
              vertex.applyMatrix4(parentObj.matrixWorld);
            }
            positions.push(vertex.x, vertex.y, vertex.z);
          });

          const indices = [];
          for (let i = 1; i < entity.vertices.length - 1; i++) {
            indices.push(0, i, i + 1);
          }

          const faceGeometry = new THREE.BufferGeometry();
          faceGeometry.setAttribute(
            'position',
            new THREE.Float32BufferAttribute(positions, 3)
          );
          faceGeometry.setIndex(indices);
          faceGeometry.computeVertexNormals();

          const faceMaterial = new THREE.MeshBasicMaterial({
            color: 0xffff00, // Yellow for face selection
            opacity: 0.6,
            transparent: true,
            side: THREE.DoubleSide,
            depthWrite: false,
            depthTest: true,
          });
          const faceMesh = new THREE.Mesh(faceGeometry, faceMaterial);
          scene.add(faceMesh);
          highlightedRef.current = faceMesh;
        } else {
          // Fallback: simple plane
          const faceGeometry = new THREE.PlaneGeometry(faceSize, faceSize);
          const faceMaterial = new THREE.MeshBasicMaterial({
            color: 0xffff00, // Yellow for face selection
            opacity: 0.6,
            transparent: true,
            side: THREE.DoubleSide,
            depthWrite: false,
            depthTest: true,
          });
          const faceMesh = new THREE.Mesh(faceGeometry, faceMaterial);

          faceMesh.position.copy(faceCenter);
          const lookAtPoint = faceCenter.clone().add(faceNormal);
          faceMesh.lookAt(lookAtPoint);

          scene.add(faceMesh);
          highlightedRef.current = faceMesh;
        }
      } else if (type === 'edge') {
        // Highlight edge with a thick line
        // Get parent object to apply world transform
        const parentObj = entity.parentObject;
        let edgeStart = entity.start.clone();
        let edgeEnd = entity.end.clone();

        // Apply world transform if parent exists
        if (parentObj) {
          parentObj.updateMatrixWorld();
          edgeStart.applyMatrix4(parentObj.matrixWorld);
          edgeEnd.applyMatrix4(parentObj.matrixWorld);
        }

        const edgeGeometry = new THREE.BufferGeometry().setFromPoints([
          edgeStart,
          edgeEnd,
        ]);
        const edgeMaterial = new THREE.LineBasicMaterial({
          color: 0xff00ff, // Magenta/pink for edge selection - more distinct
          linewidth: 10, // Thicker line for edge
          depthTest: true,
          depthWrite: false,
        });
        const edgeLine = new THREE.Line(edgeGeometry, edgeMaterial);
        scene.add(edgeLine);
        highlightedRef.current = edgeLine;
      }
    }

    // Helper: highlight for multiselect shapes (outline child per object)
    function addMultiHighlightForShape(obj) {
      if (!obj || !obj.geometry) {
        // Groups: use BoxHelper attached to scene (update not needed during static multiselect)
        const box = new THREE.BoxHelper(obj, 0x00ff00);
        scene.add(box);
        multiHighlightsRef.current.set(obj, box);
        return;
      }
      const edgesGeom = new THREE.EdgesGeometry(obj.geometry);
      const outlineMat = new THREE.LineBasicMaterial({
        color: 0x00ff00,
        linewidth: 2,
        depthTest: false,
        depthWrite: false,
        transparent: true,
        opacity: 1,
      });
      const outline = new THREE.LineSegments(edgesGeom, outlineMat);
      outline.renderOrder = 998;
      obj.add(outline);
      multiHighlightsRef.current.set(obj, outline);
    }

    // Helper: remove multi highlight for an object
    function removeMultiHighlightForShape(obj) {
      const hl = multiHighlightsRef.current.get(obj);
      if (!hl) return;
      if (hl.parent) hl.parent.remove(hl);
      if (hl.geometry) hl.geometry.dispose();
      if (hl.material) hl.material.dispose();
      multiHighlightsRef.current.delete(obj);
    }

    // Selection handler
    function handleSelection(event) {
      if (isDraggingRef.current) return;
      // Only block selection while actively sketching
      if (sketchModeRef.current && sketchToolRef.current) return;

      const isFaceSelectionMode = event.ctrlKey || event.metaKey;
      const isMultiMode = event.shiftKey === true;

      // If there's a pending shape to create, place it at click position
      if (pendingShapeTypeRef.current) {
        const pos = getMouseOnPlane(event);
        if (pos) {
          const shapeType = pendingShapeTypeRef.current;
          pendingShapeTypeRef.current = null; // Clear immediately
          createShapeAtPosition(shapeType, pos);
          return; // Don't do selection when placing shape
        } else {
          // If we can't get position, clear pending shape
          pendingShapeTypeRef.current = null;
        }
      }

      const rect = renderer.domElement.getBoundingClientRect();
      const pointer = new THREE.Vector2();
      pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(pointer, camera);

      let selected = null;
      let selectedType = null;

      // Precompute nearest hit and its parent object in our list
      const recursiveIntersects = raycaster.intersectObjects(
        objectsRef.current,
        true
      );
      let candidateObject = null;
      if (recursiveIntersects.length > 0) {
        let current = recursiveIntersects[0].object;
        while (current && current !== scene) {
          if (objectsRef.current.includes(current)) {
            candidateObject = current;
            break;
          }
          current = current.parent;
        }
      }

      // 1) If Ctrl/Cmd held: prefer face selection on the nearest hit
      if (!selected && isFaceSelectionMode && candidateObject) {
        const intersect = recursiveIntersects[0];
        const faceIndex = intersect?.faceIndex;
        if (
          candidateObject.userData.faces &&
          faceIndex != null &&
          faceIndex >= 0 &&
          faceIndex < candidateObject.userData.faces.length
        ) {
          selected = candidateObject.userData.faces[faceIndex];
          selectedType = 'face';
          selected.parentObject = candidateObject;
        }
      }

      // 2) On normal click: try precise edge on candidate object first
      if (!selected && !isFaceSelectionMode && candidateObject) {
        let closestEdgeDistance = Infinity;
        const EDGE_SELECTION_PIXEL_THRESHOLD = 3; // precise edge picking

        const obj = candidateObject;
        if (obj.userData.edges && obj.userData.edges.length > 0) {
          obj.updateMatrixWorld();
          const worldMatrix = obj.matrixWorld.clone();

          for (const edge of obj.userData.edges) {
            const edgeStart = edge.start.clone().applyMatrix4(worldMatrix);
            const edgeEnd = edge.end.clone().applyMatrix4(worldMatrix);
            const edgeVec = new THREE.Vector3().subVectors(edgeEnd, edgeStart);
            const edgeLength = edgeVec.length();
            if (edgeLength < 0.001) continue;

            const startNDC = edgeStart.clone().project(camera);
            const endNDC = edgeEnd.clone().project(camera);

            const startPx = new THREE.Vector2(
              (startNDC.x + 1) * 0.5 * rect.width,
              (-startNDC.y + 1) * 0.5 * rect.height
            );
            const endPx = new THREE.Vector2(
              (endNDC.x + 1) * 0.5 * rect.width,
              (-endNDC.y + 1) * 0.5 * rect.height
            );

            const mousePx = new THREE.Vector2(
              event.clientX - rect.left,
              event.clientY - rect.top
            );

            const ab = new THREE.Vector2().subVectors(endPx, startPx);
            const ap = new THREE.Vector2().subVectors(mousePx, startPx);
            const abLenSq = ab.lengthSq();
            let t = abLenSq > 0 ? ap.dot(ab) / abLenSq : 0;
            t = Math.max(0, Math.min(1, t));
            const closestPx = new THREE.Vector2(
              startPx.x + ab.x * t,
              startPx.y + ab.y * t
            );
            const distancePx = closestPx.distanceTo(mousePx);

            if (
              distancePx <= EDGE_SELECTION_PIXEL_THRESHOLD &&
              distancePx < closestEdgeDistance
            ) {
              closestEdgeDistance = distancePx;
              selected = edge;
              selectedType = 'edge';
              selected.parentObject = obj;
            }
          }
        }
      }

      // 3) If still nothing (or not edge), select the body of the nearest object
      if (!selected && candidateObject) {
        selected = candidateObject;
        selectedType = 'shape';
      }

      // Apply selection
      if (selected) {
        if (isMultiMode) {
          // For multi-select, always toggle the shape (promote face/edge to parent shape)
          let shapeToToggle = selected;
          if (selectedType !== 'shape') {
            if (selected.parentObject) {
              shapeToToggle = selected.parentObject;
            } else if (candidateObject) {
              shapeToToggle = candidateObject;
            }
          }
          // Toggle in multiselect set
          const set = multiSelectedRef.current;
          // Ensure the primary currently selected shape is included
          const primary = selectedEntityRef.current;
          if (
            primary &&
            objectsRef.current.includes(primary) &&
            !set.has(primary)
          ) {
            set.add(primary);
            addMultiHighlightForShape(primary);
          }
          if (set.has(shapeToToggle)) {
            set.delete(shapeToToggle);
            removeMultiHighlightForShape(shapeToToggle);
          } else {
            set.add(shapeToToggle);
            addMultiHighlightForShape(shapeToToggle);
          }
          // Keep primary selection as last clicked for properties
          setSelectedEntity(shapeToToggle);
          setSelectedType('shape');
          selectedEntityRef.current = shapeToToggle;
          selectedTypeRef.current = 'shape';
          // Do not use single highlight overlay in multiselect
        } else {
          // Clear multiselect when single-selecting
          if (multiSelectedRef.current.size > 0) {
            multiSelectedRef.current.forEach((obj) =>
              removeMultiHighlightForShape(obj)
            );
            multiSelectedRef.current.clear();
          }
          setSelectedEntity(selected);
          setSelectedType(selectedType);
          selectedEntityRef.current = selected;
          selectedTypeRef.current = selectedType;
          highlightEntity(selected, selectedType);
        }
        window.dispatchEvent(
          new CustomEvent('selectionChanged', {
            detail: { entity: selected, type: selectedType },
          })
        );
      } else {
        setSelectedEntity(null);
        setSelectedType(null);
        clearHighlight();
        window.dispatchEvent(
          new CustomEvent('selectionChanged', {
            detail: { entity: null, type: null },
          })
        );
      }
    }

    // Shape creation handler
    function handleShapeCreation(type) {
      if (sketchModeRef.current) return;

      // Set pending shape type - user will click on canvas to place it
      pendingShapeTypeRef.current = type;
      console.log('Shape creation mode activated:', type);
    }

    // Create shape at specific position
    function createShapeAtPosition(type, position) {
      console.log('Creating shape:', type, 'at position:', position);
      let shape;
      switch (type) {
        case 'box':
          shape = createBox();
          break;
        case 'sphere':
          shape = createSphere();
          break;
        case 'cylinder':
          shape = createCylinder();
          break;
        default:
          console.error('Unknown shape type:', type);
          return null;
      }

      if (!shape) {
        console.error('Failed to create shape');
        return null;
      }

      // Position the shape on the ground plane
      // Calculate proper Y position based on shape height
      let yPos = 0.5;
      if (type === 'box') {
        yPos = 0.5; // Box height is 1, so center at 0.5
      } else if (type === 'sphere') {
        yPos = 0.7; // Sphere radius
      } else if (type === 'cylinder') {
        yPos = 0.5; // Cylinder height is 1, so center at 0.5
      }

      shape.position.set(position.x, yPos, position.z);
      console.log('Shape positioned at:', shape.position);

      scene.add(shape);
      objectsRef.current.push(shape);
      console.log(
        'Shape added to scene. Total objects:',
        objectsRef.current.length
      );

      // Update selection
      setSelectedEntity(shape);
      setSelectedType('shape');
      highlightEntity(shape, 'shape');
      window.dispatchEvent(
        new CustomEvent('selectionChanged', {
          detail: { entity: shape, type: 'shape' },
        })
      );

      return shape;
    }

    // Sketch handlers
    function handleSketchStart(event) {
      if (!sketchModeRef.current || !sketchToolRef.current) return;

      const pos = getMouseOnPlane(event);
      if (!pos) return;

      isDraggingRef.current = true;
      dragStartRef.current = pos;

      if (sketchToolRef.current === 'rectangle') {
        currentSketchRef.current = {
          type: 'rectangle',
          start: pos,
          end: pos,
        };
      } else if (sketchToolRef.current === 'circle') {
        currentSketchRef.current = {
          type: 'circle',
          center: pos,
          radius: 0,
        };
      }
    }

    function handleSketchMove(event) {
      if (!isDraggingRef.current || !currentSketchRef.current) return;

      const pos = getMouseOnPlane(event);
      if (!pos) return;

      // Update preview
      if (previewRef.current) {
        scene.remove(previewRef.current);
        if (previewRef.current.geometry) previewRef.current.geometry.dispose();
        if (previewRef.current.material) previewRef.current.material.dispose();
      }

      if (currentSketchRef.current.type === 'rectangle') {
        currentSketchRef.current.end = pos;
        const width = Math.abs(pos.x - dragStartRef.current.x);
        const height = Math.abs(pos.z - dragStartRef.current.z);

        if (width > 0.01 && height > 0.01) {
          const geometry = new THREE.PlaneGeometry(width, height);
          const material = new THREE.MeshBasicMaterial({
            color: 0x00ff00,
            opacity: 0.5,
            transparent: true,
            side: THREE.DoubleSide,
          });
          const preview = new THREE.Mesh(geometry, material);
          preview.rotateX(-Math.PI / 2);
          preview.position.set(
            (dragStartRef.current.x + pos.x) / 2,
            0.01,
            (dragStartRef.current.z + pos.z) / 2
          );
          scene.add(preview);
          previewRef.current = preview;
        }
      } else if (currentSketchRef.current.type === 'circle') {
        const radius = dragStartRef.current.distanceTo(pos);
        currentSketchRef.current.radius = radius;

        if (radius > 0.01) {
          const geometry = new THREE.CircleGeometry(radius, 32);
          const material = new THREE.MeshBasicMaterial({
            color: 0x00ff00,
            opacity: 0.5,
            transparent: true,
            side: THREE.DoubleSide,
          });
          const preview = new THREE.Mesh(geometry, material);
          preview.rotateX(-Math.PI / 2);
          preview.position.set(
            dragStartRef.current.x,
            0.01,
            dragStartRef.current.z
          );
          scene.add(preview);
          previewRef.current = preview;
        }
      }
    }

    function handleSketchEnd(event) {
      if (!isDraggingRef.current || !currentSketchRef.current) return;

      const pos = getMouseOnPlane(event);
      if (!pos) return;
      pushHistory();

      // Remove preview
      if (previewRef.current) {
        scene.remove(previewRef.current);
        if (previewRef.current.geometry) previewRef.current.geometry.dispose();
        if (previewRef.current.material) previewRef.current.material.dispose();
        previewRef.current = null;
      }

      // Create sketch
      if (currentSketchRef.current.type === 'rectangle') {
        const width = Math.abs(pos.x - dragStartRef.current.x);
        const height = Math.abs(pos.z - dragStartRef.current.z);

        if (width > 0.01 && height > 0.01) {
          const sketch = {
            ...currentSketchRef.current,
            width,
            height,
            center: new THREE.Vector3(
              (dragStartRef.current.x + pos.x) / 2,
              0,
              (dragStartRef.current.z + pos.z) / 2
            ),
          };
          sketchesRef.current.push(sketch);

          // Visualize sketch
          const geometry = new THREE.PlaneGeometry(width, height);
          const material = new THREE.MeshBasicMaterial({
            color: 0x00aa00,
            opacity: 0.3,
            transparent: true,
            side: THREE.DoubleSide,
          });
          const mesh = new THREE.Mesh(geometry, material);
          mesh.rotateX(-Math.PI / 2);
          mesh.position.copy(sketch.center);
          mesh.userData.sketch = sketch;
          scene.add(mesh);

          // Update sketches list
          window.dispatchEvent(
            new CustomEvent('sketchesUpdated', {
              detail: [...sketchesRef.current],
            })
          );
        }
      } else if (currentSketchRef.current.type === 'circle') {
        const radius = dragStartRef.current.distanceTo(pos);

        if (radius > 0.01) {
          const sketch = {
            ...currentSketchRef.current,
            radius,
            center: dragStartRef.current.clone(),
          };
          sketchesRef.current.push(sketch);

          // Visualize sketch
          const geometry = new THREE.CircleGeometry(radius, 32);
          const material = new THREE.MeshBasicMaterial({
            color: 0x00aa00,
            opacity: 0.3,
            transparent: true,
            side: THREE.DoubleSide,
          });
          const mesh = new THREE.Mesh(geometry, material);
          mesh.rotateX(-Math.PI / 2);
          mesh.position.set(dragStartRef.current.x, 0, dragStartRef.current.z);
          mesh.userData.sketch = sketch;
          scene.add(mesh);

          // Update sketches list
          window.dispatchEvent(
            new CustomEvent('sketchesUpdated', {
              detail: [...sketchesRef.current],
            })
          );
        }
      }

      isDraggingRef.current = false;
      dragStartRef.current = null;
      currentSketchRef.current = null;
    }

    // Extrusion handler
    function handleExtrude(sketchIndex, height = 2) {
      if (sketchIndex < 0 || sketchIndex >= sketchesRef.current.length) return;
      pushHistory();

      const sketch = sketchesRef.current[sketchIndex];
      let shape;

      if (sketch.type === 'rectangle') {
        const shape2D = new THREE.Shape();
        shape2D.moveTo(-sketch.width / 2, -sketch.height / 2);
        shape2D.lineTo(sketch.width / 2, -sketch.height / 2);
        shape2D.lineTo(sketch.width / 2, sketch.height / 2);
        shape2D.lineTo(-sketch.width / 2, sketch.height / 2);
        shape2D.lineTo(-sketch.width / 2, -sketch.height / 2);

        const extrudeSettings = {
          depth: height,
          bevelEnabled: false,
        };
        const geometry = new THREE.ExtrudeGeometry(shape2D, extrudeSettings);
        const material = new THREE.MeshStandardMaterial({ color: 0x00aa00 });
        shape = new THREE.Mesh(geometry, material);
        shape.position.copy(sketch.center);
        shape.position.y = height / 2;
      } else if (sketch.type === 'circle') {
        const shape2D = new THREE.Shape();
        shape2D.absarc(0, 0, sketch.radius, 0, Math.PI * 2, false);

        const extrudeSettings = {
          depth: height,
          bevelEnabled: false,
        };
        const geometry = new THREE.ExtrudeGeometry(shape2D, extrudeSettings);
        const material = new THREE.MeshStandardMaterial({ color: 0x00aa00 });
        shape = new THREE.Mesh(geometry, material);
        shape.position.set(sketch.center.x, height / 2, sketch.center.z);
      }

      if (shape) {
        shape.userData.type = 'extruded';
        shape.userData.extrusionHeight = height;
        shape.userData.sketchData = sketch;

        // Update geometry
        updateShapeGeometry(shape);

        // Improve selection reliability on all faces
        if (shape.material && shape.material.side !== undefined) {
          shape.material.side = THREE.DoubleSide;
        }

        scene.add(shape);
        objectsRef.current.push(shape);

        // Remove sketch visualization
        scene.children.forEach((child) => {
          if (child.userData.sketch === sketch) {
            scene.remove(child);
            if (child.geometry) child.geometry.dispose();
            if (child.material) child.material.dispose();
          }
        });

        sketchesRef.current.splice(sketchIndex, 1);

        // Update sketches list
        window.dispatchEvent(
          new CustomEvent('sketchesUpdated', {
            detail: [...sketchesRef.current],
          })
        );

        // Clear active sketch tool so user can select/rotate newly created mesh
        setSketchTool(null);
        sketchToolRef.current = null;

        // Auto-select the extruded mesh
        setSelectedEntity(shape);
        setSelectedType('shape');
        selectedEntityRef.current = shape;
        selectedTypeRef.current = 'shape';
        highlightEntity(shape, 'shape');
        window.dispatchEvent(
          new CustomEvent('selectionChanged', {
            detail: { entity: shape, type: 'shape' },
          })
        );
      }
    }

    // Transformation handlers
    function applyTransformation(entity, type, delta) {
      if (!entity) return;

      if (type === 'translate') {
        if (selectedTypeRef.current === 'shape') {
          entity.position.add(delta);
        } else if (selectedTypeRef.current === 'face') {
          // Move the parent shape
          const parentShape = objectsRef.current.find(
            (obj) => obj.userData.faces && obj.userData.faces.includes(entity)
          );
          if (parentShape) {
            parentShape.position.add(delta);
          }
        } else if (selectedTypeRef.current === 'edge') {
          // Move the parent shape
          const parentShape = objectsRef.current.find(
            (obj) => obj.userData.edges && obj.userData.edges.includes(entity)
          );
          if (parentShape) {
            parentShape.position.add(delta);
          }
        }
      } else if (type === 'rotate') {
        if (selectedTypeRef.current === 'shape') {
          entity.rotation.y += delta.y;
        }
      } else if (type === 'scale') {
        if (selectedTypeRef.current === 'shape') {
          entity.scale.multiplyScalar(1 + delta.x * 0.1);
        }
      }
    }

    // Event listeners
    const handlePointerDown = (event) => {
      // If there's a pending shape, prevent camera rotation
      if (pendingShapeTypeRef.current) {
        event.stopPropagation();
      }

      // If in a transform mode and an entity is selected, start transform dragging
      if (transformModeRef.current && selectedEntityRef.current) {
        event.preventDefault();
        event.stopPropagation();
        // push snapshot at transform start
        pushHistory();
        // Determine which entity to transform (shape or parent of face/edge)
        let target = selectedEntityRef.current;
        if (
          selectedTypeRef.current === 'face' ||
          selectedTypeRef.current === 'edge'
        ) {
          const parentShape = objectsRef.current.find(
            (obj) =>
              (obj.userData.faces &&
                obj.userData.faces.includes(selectedEntityRef.current)) ||
              (obj.userData.edges &&
                obj.userData.edges.includes(selectedEntityRef.current))
          );
          if (parentShape) target = parentShape;
        }
        transformEntityRef.current = target;
        // If a face/edge is selected, switch selection to its parent shape for transforms
        if (selectedTypeRef.current !== 'shape') {
          const parentShape = objectsRef.current.find(
            (obj) =>
              (obj.userData.faces &&
                obj.userData.faces.includes(selectedEntityRef.current)) ||
              (obj.userData.edges &&
                obj.userData.edges.includes(selectedEntityRef.current))
          );
          if (parentShape) {
            setSelectedEntity(parentShape);
            setSelectedType('shape');
            selectedEntityRef.current = parentShape;
            selectedTypeRef.current = 'shape';
            highlightEntity(parentShape, 'shape');
          }
        }
        if (transformModeRef.current === 'translate') {
          const start = getMouseOnPlane(event);
          if (!start) return;
          isTransformDraggingRef.current = true;
          transformStartRef.current.pointer = start.clone();
          transformStartRef.current.entityPosition = target.position.clone();
        } else if (transformModeRef.current === 'rotate') {
          isTransformDraggingRef.current = true;
          transformStartRef.current.pointer = {
            x: event.clientX,
            y: event.clientY,
          };
          transformStartRef.current.entityRotationY = target.rotation.y;
        } else if (transformModeRef.current === 'scale') {
          isTransformDraggingRef.current = true;
          transformStartRef.current.pointer = {
            x: event.clientX,
            y: event.clientY,
          };
          transformStartRef.current.entityScale = target.scale.clone();
        }
        return;
      }

      if (sketchModeRef.current && sketchToolRef.current) {
        handleSketchStart(event);
      } else {
        handleSelection(event);
      }
    };

    const handlePointerMove = (event) => {
      // Perform transform drag if active
      if (isTransformDraggingRef.current && selectedEntityRef.current) {
        const target = transformEntityRef.current || selectedEntityRef.current;
        if (!target) return;
        if (transformModeRef.current === 'translate') {
          const current = getMouseOnPlane(event);
          const start = transformStartRef.current.pointer;
          if (!current || !start) return;
          const delta = new THREE.Vector3().copy(current).sub(start);
          // Move only in XZ plane
          const newPos = transformStartRef.current.entityPosition
            .clone()
            .add(new THREE.Vector3(delta.x, 0, delta.z));
          target.position.copy(newPos);
          // Outline is a child of target, so it follows automatically
        } else if (transformModeRef.current === 'rotate') {
          const dx = event.clientX - transformStartRef.current.pointer.x;
          const angle = dx * 0.02; // more sensitive rotation for small objects
          target.rotation.y = transformStartRef.current.entityRotationY + angle;
          // Outline is a child of target, so it follows automatically; BoxHelper needs update
          if (highlightedRef.current && highlightedRef.current.isBoxHelper) {
            highlightedRef.current.update();
          }
        } else if (transformModeRef.current === 'scale') {
          const dy = event.clientY - transformStartRef.current.pointer.y;
          const factor = Math.max(0.01, 1 + dy * -0.01); // more responsive scaling
          const baseScale = transformStartRef.current.entityScale;
          target.scale.set(
            baseScale.x * factor,
            baseScale.y * factor,
            baseScale.z * factor
          );
          // Outline is a child of target, so it follows automatically; BoxHelper needs update
          if (highlightedRef.current && highlightedRef.current.isBoxHelper) {
            highlightedRef.current.update();
          }
        }
        return;
      }

      if (sketchModeRef.current && isDraggingRef.current) {
        handleSketchMove(event);
      }
    };

    const handlePointerUp = (event) => {
      if (isTransformDraggingRef.current) {
        isTransformDraggingRef.current = false;
        transformEntityRef.current = null;
        return;
      }
      if (sketchModeRef.current && isDraggingRef.current) {
        handleSketchEnd(event);
      }
      isDraggingRef.current = false;
    };

    renderer.domElement.addEventListener('pointerdown', handlePointerDown);
    renderer.domElement.addEventListener('pointermove', handlePointerMove);
    renderer.domElement.addEventListener('pointerup', handlePointerUp);

    // Keyboard shortcuts
    const handleKeyDown = (event) => {
      if (
        event.target.tagName === 'INPUT' ||
        event.target.tagName === 'TEXTAREA'
      )
        return;

      const key = event.key.toLowerCase();

      // Undo/Redo
      const isCtrl = event.ctrlKey || event.metaKey;
      if (isCtrl && key === 'z') {
        event.preventDefault();
        if (undoStackRef.current.length > 0) {
          const snap = undoStackRef.current.pop();
          const current = snapshotScene();
          if (current) redoStackRef.current.push(current);
          restoreSceneFromSnapshot(snap);
        }
        return;
      } else if (isCtrl && (key === 'y' || (key === 'z' && event.shiftKey))) {
        event.preventDefault();
        if (redoStackRef.current.length > 0) {
          const snap = redoStackRef.current.pop();
          const current = snapshotScene();
          if (current) undoStackRef.current.push(current);
          restoreSceneFromSnapshot(snap);
        }
        return;
      }

      // Transform mode shortcuts
      if (key === 'g') {
        event.preventDefault();
        const newMode =
          transformModeRef.current === 'translate' ? null : 'translate';
        setTransformMode(newMode);
        transformModeRef.current = newMode;
        window.dispatchEvent(
          new CustomEvent('setTransformMode', { detail: newMode })
        );
      } else if (key === 'r') {
        event.preventDefault();
        const newMode = transformModeRef.current === 'rotate' ? null : 'rotate';
        setTransformMode(newMode);
        transformModeRef.current = newMode;
        window.dispatchEvent(
          new CustomEvent('setTransformMode', { detail: newMode })
        );
      } else if (key === 's') {
        event.preventDefault();
        const newMode = transformModeRef.current === 'scale' ? null : 'scale';
        setTransformMode(newMode);
        transformModeRef.current = newMode;
        window.dispatchEvent(
          new CustomEvent('setTransformMode', { detail: newMode })
        );
      } else if (key === 'delete' || key === 'backspace') {
        if (selectedEntityRef.current && selectedTypeRef.current === 'shape') {
          event.preventDefault();
          pushHistory();
          scene.remove(selectedEntityRef.current);
          objectsRef.current = objectsRef.current.filter(
            (obj) => obj !== selectedEntityRef.current
          );
          setSelectedEntity(null);
          selectedEntityRef.current = null;
          setSelectedType(null);
          selectedTypeRef.current = null;
          clearHighlight();
          window.dispatchEvent(
            new CustomEvent('selectionChanged', {
              detail: { entity: null, type: null },
            })
          );
        }
      } else if (transformModeRef.current && selectedEntityRef.current) {
        // Transformation controls
        const delta = 0.1;
        let transformDelta = new THREE.Vector3();

        if (transformModeRef.current === 'translate') {
          if (key === 'arrowup' || key === 'w') {
            transformDelta.set(0, delta, 0);
          } else if (key === 'arrowdown' || key === 's') {
            transformDelta.set(0, -delta, 0);
          } else if (key === 'arrowleft' || key === 'a') {
            transformDelta.set(-delta, 0, 0);
          } else if (key === 'arrowright' || key === 'd') {
            transformDelta.set(delta, 0, 0);
          } else if (key === 'q') {
            transformDelta.set(0, 0, delta);
          } else if (key === 'e') {
            transformDelta.set(0, 0, -delta);
          }

          if (transformDelta.length() > 0) {
            event.preventDefault();
            pushHistory();
            applyTransformation(
              selectedEntityRef.current,
              'translate',
              transformDelta
            );
            if (highlightedRef.current && highlightedRef.current.isBoxHelper) {
              highlightedRef.current.update();
            } else if (selectedEntityRef.current) {
              highlightEntity(selectedEntityRef.current, 'shape');
            }
          }
        } else if (transformModeRef.current === 'rotate') {
          if (key === 'arrowleft' || key === 'a') {
            transformDelta.set(0, -0.2, 0);
          } else if (key === 'arrowright' || key === 'd') {
            transformDelta.set(0, 0.2, 0);
          }

          if (transformDelta.length() > 0) {
            event.preventDefault();
            pushHistory();
            applyTransformation(
              selectedEntityRef.current,
              'rotate',
              transformDelta
            );
            if (highlightedRef.current && highlightedRef.current.isBoxHelper) {
              highlightedRef.current.update();
            } else if (selectedEntityRef.current) {
              highlightEntity(selectedEntityRef.current, 'shape');
            }
          }
        } else if (transformModeRef.current === 'scale') {
          if (key === 'arrowup' || key === 'w') {
            transformDelta.set(0.1, 0.1, 0.1);
          } else if (key === 'arrowdown' || key === 's') {
            transformDelta.set(-0.1, -0.1, -0.1);
          }

          if (transformDelta.length() > 0) {
            event.preventDefault();
            pushHistory();
            applyTransformation(
              selectedEntityRef.current,
              'scale',
              transformDelta
            );
            if (highlightedRef.current && highlightedRef.current.isBoxHelper) {
              highlightedRef.current.update();
            } else if (selectedEntityRef.current) {
              highlightEntity(selectedEntityRef.current, 'shape');
            }
          }
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    // Global event listeners
    const createShapeHandler = (e) => {
      pushHistory();
      handleShapeCreation(e.detail);
    };
    const setTransformModeHandler = (e) => {
      setTransformMode(e.detail);
      transformModeRef.current = e.detail;
    };
    const setSketchModeHandler = (e) => {
      setSketchMode(e.detail);
      sketchModeRef.current = e.detail;
    };
    const setSketchToolHandler = (e) => {
      setSketchTool(e.detail);
      sketchToolRef.current = e.detail;
    };
    const extrudeHandler = (e) =>
      handleExtrude(e.detail.index, e.detail.height);
    const undoHandler = () => {
      if (undoStackRef.current.length > 0) {
        const snap = undoStackRef.current.pop();
        const current = snapshotScene();
        if (current) redoStackRef.current.push(current);
        restoreSceneFromSnapshot(snap);
      }
    };
    const redoHandler = () => {
      if (redoStackRef.current.length > 0) {
        const snap = redoStackRef.current.pop();
        const current = snapshotScene();
        if (current) undoStackRef.current.push(current);
        restoreSceneFromSnapshot(snap);
      }
    };
    const groupSelectedHandler = () => {
      const set = multiSelectedRef.current;
      // If only one or zero items in set, try to include current single selection
      if (set.size < 2) {
        const primary = selectedEntityRef.current;
        if (
          primary &&
          objectsRef.current.includes(primary) &&
          !set.has(primary)
        ) {
          set.add(primary);
        }
      }
      if (set.size < 2) return;
      // Create group and attach selected shapes
      const group = new THREE.Group();
      group.userData.type = 'group';
      scene.add(group);
      // snapshot before change
      pushHistory();
      set.forEach((obj) => {
        // remove highlight child
        removeMultiHighlightForShape(obj);
        group.attach(obj);
        // remove from objectsRef list
        objectsRef.current = objectsRef.current.filter((o) => o !== obj);
      });
      // Add group to objectsRef
      objectsRef.current.push(group);
      set.clear();
      // Select the group
      setSelectedEntity(group);
      setSelectedType('shape');
      selectedEntityRef.current = group;
      selectedTypeRef.current = 'shape';
      // Use BoxHelper for group
      clearHighlight();
      const box = new THREE.BoxHelper(group, 0x00ff00);
      scene.add(box);
      highlightedRef.current = box;
      window.dispatchEvent(
        new CustomEvent('selectionChanged', {
          detail: { entity: group, type: 'shape' },
        })
      );
    };
    const ungroupSelectedHandler = () => {
      const entity = selectedEntityRef.current;
      if (!entity || !(entity instanceof THREE.Group)) return;
      // snapshot before change
      pushHistory();
      const children = [...entity.children];
      children.forEach((child) => {
        scene.attach(child);
        objectsRef.current.push(child);
      });
      scene.remove(entity);
      objectsRef.current = objectsRef.current.filter((o) => o !== entity);
      clearHighlight();
      // Select nothing
      setSelectedEntity(null);
      setSelectedType(null);
      selectedEntityRef.current = null;
      selectedTypeRef.current = null;
      window.dispatchEvent(
        new CustomEvent('selectionChanged', {
          detail: { entity: null, type: null },
        })
      );
    };
    const exportHandler = () => {
      try {
        const data = saveSceneToJSON(objectsRef.current, sketchesRef.current);
        const blob = new Blob([JSON.stringify(data, null, 2)], {
          type: 'application/json',
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `cad-scene-${Date.now()}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      } catch (error) {
        console.error('Export failed:', error);
        alert('Failed to export scene. Please check the console for details.');
      }
    };
    const importHandler = (e) => {
      const file = e.detail.file;
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const data = JSON.parse(event.target.result);
          loadSceneFromJSON(data, scene, objectsRef, sketchesRef);
          clearHighlight();
          setSelectedEntity(null);
          setSelectedType(null);
          window.dispatchEvent(
            new CustomEvent('selectionChanged', {
              detail: { entity: null, type: null },
            })
          );
          window.dispatchEvent(
            new CustomEvent('sketchesUpdated', {
              detail: [...sketchesRef.current],
            })
          );
        } catch (error) {
          console.error('Failed to import scene:', error);
          alert('Failed to import scene. Please check the file format.');
        }
      };
      reader.readAsText(file);
    };

    window.addEventListener('createShape', createShapeHandler);
    window.addEventListener('setTransformMode', setTransformModeHandler);
    window.addEventListener('setSketchMode', setSketchModeHandler);
    window.addEventListener('setSketchTool', setSketchToolHandler);
    window.addEventListener('extrude', extrudeHandler);
    window.addEventListener('exportScene', exportHandler);
    window.addEventListener('importScene', importHandler);
    window.addEventListener('undo', undoHandler);
    window.addEventListener('redo', redoHandler);
    window.addEventListener('groupSelected', groupSelectedHandler);
    window.addEventListener('ungroupSelected', ungroupSelectedHandler);

    // Snap/grid controls
    const setSnapToGridHandler = (e) => setSnapToGrid(!!e.detail);
    const setGridSizeHandler = (e) => {
      const value = parseFloat(e.detail);
      if (Number.isFinite(value) && value > 0) {
        setGridSize(value);
      }
    };
    window.addEventListener('setSnapToGrid', setSnapToGridHandler);
    window.addEventListener('setGridSize', setGridSizeHandler);

    // Update sketch handler
    const updateSketchHandler = (e) => {
      const { index, width, height, radius } = e.detail || {};
      if (index == null || index < 0 || index >= sketchesRef.current.length) {
        return;
      }
      pushHistory();
      const sketch = sketchesRef.current[index];
      if (!sketch) return;

      if (sketch.type === 'rectangle') {
        if (Number.isFinite(width) && width > 0) sketch.width = width;
        if (Number.isFinite(height) && height > 0) sketch.height = height;
      } else if (sketch.type === 'circle') {
        if (Number.isFinite(radius) && radius > 0) sketch.radius = radius;
      }

      // Rebuild visualization mesh
      // Remove old mesh
      const oldMeshes = [];
      scene.children.forEach((child) => {
        if (child.userData && child.userData.sketch === sketch) {
          oldMeshes.push(child);
        }
      });
      oldMeshes.forEach((m) => {
        scene.remove(m);
        if (m.geometry) m.geometry.dispose();
        if (m.material) m.material.dispose();
      });

      // Create new mesh
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

      // Notify UI
      window.dispatchEvent(
        new CustomEvent('sketchesUpdated', {
          detail: [...sketchesRef.current],
        })
      );
    };
    window.addEventListener('updateSketch', updateSketchHandler);

    // Initial sketches update
    window.dispatchEvent(
      new CustomEvent('sketchesUpdated', {
        detail: [...sketchesRef.current],
      })
    );

    // Animation loop
    function animate() {
      requestAnimationFrame(animate);
      renderer.render(scene, camera);
    }
    animate();

    // Resize handler
    const handleResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    };
    window.addEventListener('resize', handleResize);

    // Cleanup
    return () => {
      renderer.domElement.removeEventListener('pointerdown', handlePointerDown);
      renderer.domElement.removeEventListener('pointermove', handlePointerMove);
      renderer.domElement.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('createShape', createShapeHandler);
      window.removeEventListener('setTransformMode', setTransformModeHandler);
      window.removeEventListener('setSketchMode', setSketchModeHandler);
      window.removeEventListener('setSketchTool', setSketchToolHandler);
      window.removeEventListener('extrude', extrudeHandler);
      window.removeEventListener('exportScene', exportHandler);
      window.removeEventListener('importScene', importHandler);
      window.removeEventListener('undo', undoHandler);
      window.removeEventListener('redo', redoHandler);
      window.removeEventListener('groupSelected', groupSelectedHandler);
      window.removeEventListener('ungroupSelected', ungroupSelectedHandler);
      window.removeEventListener('setSnapToGrid', setSnapToGridHandler);
      window.removeEventListener('setGridSize', setGridSizeHandler);
      window.removeEventListener('updateSketch', updateSketchHandler);

      if (mountEl && renderer.domElement.parentElement === mountEl) {
        mountEl.removeChild(renderer.domElement);
      }
      renderer.dispose();
    };
  }, []);

  // Keep refs in sync with state
  useEffect(() => {
    sketchModeRef.current = sketchMode;
  }, [sketchMode]);
  useEffect(() => {
    sketchToolRef.current = sketchTool;
  }, [sketchTool]);
  useEffect(() => {
    snapToGridRef.current = snapToGrid;
  }, [snapToGrid]);
  useEffect(() => {
    gridSizeRef.current = gridSize;
  }, [gridSize]);
  useEffect(() => {
    selectedEntityRef.current = selectedEntity;
  }, [selectedEntity]);
  useEffect(() => {
    selectedTypeRef.current = selectedType;
  }, [selectedType]);
  useEffect(() => {
    transformModeRef.current = transformMode;
  }, [transformMode]);

  return <div ref={mountRef} style={{ width: '100%', height: '100%' }} />;
}
