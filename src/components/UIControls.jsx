import React, { useState } from 'react';
import './UIControls.css';

export default function UIControls() {
  const [sketchMode, setSketchMode] = useState(false);
  const [transformMode, setTransformMode] = useState(null);
  const [snapToGrid, setSnapToGrid] = useState(true);
  const [gridSize, setGridSize] = useState(0.5);

  const fireShape = (type) => {
    window.dispatchEvent(new CustomEvent('createShape', { detail: type }));
  };

  const handleTransform = (mode) => {
    const newMode = transformMode === mode ? null : mode;
    setTransformMode(newMode);
    window.dispatchEvent(
      new CustomEvent('setTransformMode', { detail: newMode })
    );
  };

  const toggleSketchMode = () => {
    const newMode = !sketchMode;
    setSketchMode(newMode);
    window.dispatchEvent(new CustomEvent('setSketchMode', { detail: newMode }));
  };

  const handleSketchTool = (tool) => {
    window.dispatchEvent(new CustomEvent('setSketchTool', { detail: tool }));
  };

  const handleExport = () => {
    window.dispatchEvent(new CustomEvent('exportScene'));
  };

  const handleImport = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e) => {
      const file = e.target.files[0];
      if (file) {
        window.dispatchEvent(
          new CustomEvent('importScene', { detail: { file } })
        );
      }
    };
    input.click();
  };

  const handleUndo = () => {
    window.dispatchEvent(new CustomEvent('undo'));
  };

  const handleRedo = () => {
    window.dispatchEvent(new CustomEvent('redo'));
  };

  const handleGroup = () => {
    window.dispatchEvent(new CustomEvent('groupSelected'));
  };

  const handleUngroup = () => {
    window.dispatchEvent(new CustomEvent('ungroupSelected'));
  };

  const toggleSnapToGrid = () => {
    const next = !snapToGrid;
    setSnapToGrid(next);
    window.dispatchEvent(new CustomEvent('setSnapToGrid', { detail: next }));
  };

  const changeGridSize = (e) => {
    const value = parseFloat(e.target.value);
    const next = Number.isFinite(value) && value > 0 ? value : 0.5;
    setGridSize(next);
    window.dispatchEvent(new CustomEvent('setGridSize', { detail: next }));
  };

  return (
    <div className='ui-controls'>
      <div className='control-section'>
        <h3>Primitives</h3>
        <div className='button-group'>
          <button onClick={() => fireShape('box')} className='btn-primary'>
            Box
          </button>
          <button onClick={() => fireShape('sphere')} className='btn-primary'>
            Sphere
          </button>
          <button onClick={() => fireShape('cylinder')} className='btn-primary'>
            Cylinder
          </button>
        </div>
        <p style={{ fontSize: '11px', color: '#aaa', marginTop: '4px' }}>
          Click a button, then click on the canvas to place
        </p>
      </div>

      <div className='control-section'>
        <h3>Transform</h3>
        <div className='button-group'>
          <button
            onClick={() => handleTransform('translate')}
            className={
              transformMode === 'translate' ? 'btn-active' : 'btn-secondary'
            }
            title='Move (G)'
          >
            Move
          </button>
          <button
            onClick={() => handleTransform('rotate')}
            className={
              transformMode === 'rotate' ? 'btn-active' : 'btn-secondary'
            }
            title='Rotate (R)'
          >
            Rotate
          </button>
          <button
            onClick={() => handleTransform('scale')}
            className={
              transformMode === 'scale' ? 'btn-active' : 'btn-secondary'
            }
            title='Scale (S)'
          >
            Scale
          </button>
        </div>
      </div>

      <div className='control-section'>
        <h3>Sketch Mode</h3>
        <button
          onClick={toggleSketchMode}
          className={sketchMode ? 'btn-active' : 'btn-secondary'}
        >
          {sketchMode ? 'Exit Sketch' : 'Enter Sketch'}
        </button>
        {sketchMode && (
          <div className='button-group' style={{ marginTop: '8px' }}>
            <button
              onClick={() => handleSketchTool('rectangle')}
              className='btn-primary'
            >
              Rectangle
            </button>
            <button
              onClick={() => handleSketchTool('circle')}
              className='btn-primary'
            >
              Circle
            </button>
          </div>
        )}
      </div>

      <div className='control-section'>
        <h3>Selection</h3>
        <div className='button-group'>
          <button onClick={handleGroup} className='btn-secondary'>
            Group (Shift+Click to multi-select)
          </button>
          <button onClick={handleUngroup} className='btn-secondary'>
            Ungroup
          </button>
        </div>
      </div>

      <div className='control-section'>
        <h3>Snap</h3>
        <div className='button-group' style={{ alignItems: 'center', gap: 8 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <input
              type='checkbox'
              checked={snapToGrid}
              onChange={toggleSnapToGrid}
            />
            Snap to Grid
          </label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 12, color: '#bbb' }}>Size</span>
            <input
              type='number'
              min='0.1'
              step='0.1'
              value={gridSize}
              onChange={changeGridSize}
              style={{
                width: 72,
                padding: '6px',
                background: '#3a3a3a',
                border: '1px solid #555',
                borderRadius: '4px',
                color: '#fff',
              }}
            />
          </div>
        </div>
      </div>

      <div className='control-section'>
        <h3>File</h3>
        <div className='button-group'>
          <button onClick={handleExport} className='btn-secondary'>
            Export JSON
          </button>
          <button onClick={handleImport} className='btn-secondary'>
            Import JSON
          </button>
          <button onClick={handleUndo} className='btn-secondary'>
            Undo
          </button>
          <button onClick={handleRedo} className='btn-secondary'>
            Redo
          </button>
        </div>
      </div>

      <div className='control-section'>
        <h3>Controls</h3>
        <div className='help-text'>
          <p>
            <strong>Camera:</strong>
          </p>
          <p>• Left Click + Drag: Rotate</p>
          <p>• Mouse Wheel: Zoom</p>
          <p>
            <strong>Selection:</strong>
          </p>
          <p>• Click: Select shape/face/edge</p>
          <p>• G: Move mode</p>
          <p>• R: Rotate mode</p>
          <p>• S: Scale mode</p>
          <p>• Delete: Remove selected</p>
        </div>
      </div>
    </div>
  );
}
