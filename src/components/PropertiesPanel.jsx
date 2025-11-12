import React, { useState } from 'react';
import './PropertiesPanel.css';
import {
  rebuildBoxGeometry,
  rebuildSphereGeometry,
  rebuildCylinderGeometry,
} from '../utils/shapeUtils';

export default function PropertiesPanel({ selectedEntity, selectedType }) {
  const [tick, setTick] = useState(0); // force local re-render after in-place geometry updates

  const parsePositive = (value, fallback) => {
    const v = parseFloat(value);
    return Number.isFinite(v) && v > 0 ? v : fallback;
  };

  const applyBoxDims = (entity, next) => {
    const dims = entity.userData.dimensions || {
      width: 1,
      height: 1,
      depth: 1,
    };
    const width = next.width ?? dims.width;
    const height = next.height ?? dims.height;
    const depth = next.depth ?? dims.depth;
    rebuildBoxGeometry(entity, width, height, depth);
    setTick((t) => t + 1);
  };

  const applySphereRadius = (entity, radius) => {
    rebuildSphereGeometry(entity, radius);
    setTick((t) => t + 1);
  };

  const applyCylinderDims = (entity, next) => {
    const radius = next.radius ?? selectedEntity.userData.radius ?? 0.5;
    const height = next.height ?? selectedEntity.userData.height ?? 1;
    rebuildCylinderGeometry(entity, radius, height);
    setTick((t) => t + 1);
  };

  if (!selectedEntity) {
    return (
      <div className='properties-panel'>
        <h3>Properties</h3>
        <p className='no-selection'>No selection</p>
      </div>
    );
  }

  const renderShapeProperties = () => {
    if (selectedType !== 'shape') return null;

    const entity = selectedEntity;
    const position = entity.position;
    const rotation = entity.rotation;
    const scale = entity.scale;

    let typeInfo = '';
    if (entity.userData.type === 'box') {
      const dims = entity.userData.dimensions || {};
      typeInfo = `Box (${dims.width?.toFixed(2) || 1} × ${
        dims.height?.toFixed(2) || 1
      } × ${dims.depth?.toFixed(2) || 1})`;
    } else if (entity.userData.type === 'sphere') {
      typeInfo = `Sphere (r: ${entity.userData.radius?.toFixed(2) || 0.7})`;
    } else if (entity.userData.type === 'cylinder') {
      typeInfo = `Cylinder (r: ${
        entity.userData.radius?.toFixed(2) || 0.5
      }, h: ${entity.userData.height?.toFixed(2) || 1})`;
    } else if (entity.userData.type === 'extruded') {
      typeInfo = `Extruded Shape (h: ${
        entity.userData.extrusionHeight?.toFixed(2) || 2
      })`;
    } else {
      typeInfo = 'Shape';
    }

    return (
      <div className='properties-content'>
        <div className='property-group'>
          <h4>Type</h4>
          <p>{typeInfo}</p>
        </div>

        {entity.userData.type === 'box' && (
          <div className='property-group'>
            <h4>Dimensions</h4>
            <div className='property-row'>
              <label>Width</label>
              <input
                type='number'
                min='0.01'
                step='0.01'
                value={entity.userData.dimensions?.width ?? 1}
                onChange={(e) =>
                  applyBoxDims(entity, {
                    width: parsePositive(e.target.value, 1),
                  })
                }
              />
            </div>
            <div className='property-row'>
              <label>Height</label>
              <input
                type='number'
                min='0.01'
                step='0.01'
                value={entity.userData.dimensions?.height ?? 1}
                onChange={(e) =>
                  applyBoxDims(entity, {
                    height: parsePositive(e.target.value, 1),
                  })
                }
              />
            </div>
            <div className='property-row'>
              <label>Depth</label>
              <input
                type='number'
                min='0.01'
                step='0.01'
                value={entity.userData.dimensions?.depth ?? 1}
                onChange={(e) =>
                  applyBoxDims(entity, {
                    depth: parsePositive(e.target.value, 1),
                  })
                }
              />
            </div>
          </div>
        )}

        {entity.userData.type === 'sphere' && (
          <div className='property-group'>
            <h4>Radius</h4>
            <div className='property-row'>
              <label>Radius</label>
              <input
                type='number'
                min='0.01'
                step='0.01'
                value={entity.userData.radius ?? 0.7}
                onChange={(e) =>
                  applySphereRadius(entity, parsePositive(e.target.value, 0.7))
                }
              />
            </div>
          </div>
        )}

        {entity.userData.type === 'cylinder' && (
          <div className='property-group'>
            <h4>Dimensions</h4>
            <div className='property-row'>
              <label>Radius</label>
              <input
                type='number'
                min='0.01'
                step='0.01'
                value={entity.userData.radius ?? 0.5}
                onChange={(e) =>
                  applyCylinderDims(entity, {
                    radius: parsePositive(e.target.value, 0.5),
                  })
                }
              />
            </div>
            <div className='property-row'>
              <label>Height</label>
              <input
                type='number'
                min='0.01'
                step='0.01'
                value={entity.userData.height ?? 1}
                onChange={(e) =>
                  applyCylinderDims(entity, {
                    height: parsePositive(e.target.value, 1),
                  })
                }
              />
            </div>
          </div>
        )}

        <div className='property-group'>
          <h4>Position</h4>
          <div className='property-row'>
            <label>X:</label>
            <span>{position.x.toFixed(3)}</span>
          </div>
          <div className='property-row'>
            <label>Y:</label>
            <span>{position.y.toFixed(3)}</span>
          </div>
          <div className='property-row'>
            <label>Z:</label>
            <span>{position.z.toFixed(3)}</span>
          </div>
        </div>
        <div className='property-group'>
          <h4>Rotation</h4>
          <div className='property-row'>
            <label>X:</label>
            <span>{((rotation.x * 180) / Math.PI).toFixed(1)}°</span>
          </div>
          <div className='property-row'>
            <label>Y:</label>
            <span>{((rotation.y * 180) / Math.PI).toFixed(1)}°</span>
          </div>
          <div className='property-row'>
            <label>Z:</label>
            <span>{((rotation.z * 180) / Math.PI).toFixed(1)}°</span>
          </div>
        </div>
        <div className='property-group'>
          <h4>Scale</h4>
          <div className='property-row'>
            <label>X:</label>
            <span>{scale.x.toFixed(3)}</span>
          </div>
          <div className='property-row'>
            <label>Y:</label>
            <span>{scale.y.toFixed(3)}</span>
          </div>
          <div className='property-row'>
            <label>Z:</label>
            <span>{scale.z.toFixed(3)}</span>
          </div>
        </div>
        {entity.userData.faces && (
          <div className='property-group'>
            <h4>Geometry</h4>
            <p>Faces: {entity.userData.faces.length}</p>
            <p>Edges: {entity.userData.edges?.length || 0}</p>
          </div>
        )}
      </div>
    );
  };

  const renderFaceProperties = () => {
    if (selectedType !== 'face') return null;

    const face = selectedEntity;
    const normal = face.normal;

    return (
      <div className='properties-content'>
        <div className='property-group'>
          <h4>Face</h4>
          <p>Area: {face.area?.toFixed(4) || 'N/A'}</p>
        </div>
        <div className='property-group'>
          <h4>Normal</h4>
          <div className='property-row'>
            <label>X:</label>
            <span>{normal.x.toFixed(3)}</span>
          </div>
          <div className='property-row'>
            <label>Y:</label>
            <span>{normal.y.toFixed(3)}</span>
          </div>
          <div className='property-row'>
            <label>Z:</label>
            <span>{normal.z.toFixed(3)}</span>
          </div>
        </div>
        <div className='property-group'>
          <h4>Center</h4>
          <div className='property-row'>
            <label>X:</label>
            <span>{face.center.x.toFixed(3)}</span>
          </div>
          <div className='property-row'>
            <label>Y:</label>
            <span>{face.center.y.toFixed(3)}</span>
          </div>
          <div className='property-row'>
            <label>Z:</label>
            <span>{face.center.z.toFixed(3)}</span>
          </div>
        </div>
      </div>
    );
  };

  const renderEdgeProperties = () => {
    if (selectedType !== 'edge') return null;

    const edge = selectedEntity;
    const length = edge.start.distanceTo(edge.end);

    return (
      <div className='properties-content'>
        <div className='property-group'>
          <h4>Edge</h4>
          <p>Length: {length.toFixed(4)}</p>
        </div>
        <div className='property-group'>
          <h4>Start</h4>
          <div className='property-row'>
            <label>X:</label>
            <span>{edge.start.x.toFixed(3)}</span>
          </div>
          <div className='property-row'>
            <label>Y:</label>
            <span>{edge.start.y.toFixed(3)}</span>
          </div>
          <div className='property-row'>
            <label>Z:</label>
            <span>{edge.start.z.toFixed(3)}</span>
          </div>
        </div>
        <div className='property-group'>
          <h4>End</h4>
          <div className='property-row'>
            <label>X:</label>
            <span>{edge.end.x.toFixed(3)}</span>
          </div>
          <div className='property-row'>
            <label>Y:</label>
            <span>{edge.end.y.toFixed(3)}</span>
          </div>
          <div className='property-row'>
            <label>Z:</label>
            <span>{edge.end.z.toFixed(3)}</span>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className='properties-panel'>
      <h3>Properties</h3>
      {selectedType === 'shape' && renderShapeProperties()}
      {selectedType === 'face' && renderFaceProperties()}
      {selectedType === 'edge' && renderEdgeProperties()}
    </div>
  );
}
