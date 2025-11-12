import React, { useState, useEffect } from 'react';

export default function SketchControls() {
  const [sketches, setSketches] = useState([]);
  const [extrusionHeight, setExtrusionHeight] = useState(2);

  useEffect(() => {
    const sketchesUpdatedHandler = (e) => {
      setSketches(e.detail);
    };
    window.addEventListener('sketchesUpdated', sketchesUpdatedHandler);

    return () => {
      window.removeEventListener('sketchesUpdated', sketchesUpdatedHandler);
    };
  }, []);

  const handleExtrude = (index) => {
    window.dispatchEvent(
      new CustomEvent('extrude', {
        detail: { index, height: extrusionHeight },
      })
    );
  };

  const updateSketch = (index, partial) => {
    window.dispatchEvent(
      new CustomEvent('updateSketch', {
        detail: { index, ...partial },
      })
    );
  };

  if (sketches.length === 0) {
    return null;
  }

  return (
    <div
      style={{
        position: 'absolute',
        bottom: 12,
        left: 12,
        background: 'rgba(45, 45, 45, 0.95)',
        padding: '12px',
        borderRadius: '8px',
        zIndex: 100,
        color: '#fff',
        minWidth: '200px',
      }}
    >
      <h3 style={{ margin: '0 0 12px 0', fontSize: '14px' }}>Sketches</h3>
      <div style={{ marginBottom: '12px' }}>
        <label
          style={{ display: 'block', marginBottom: '4px', fontSize: '12px' }}
        >
          Extrusion Height:
        </label>
        <input
          type='number'
          value={extrusionHeight}
          onChange={(e) => setExtrusionHeight(parseFloat(e.target.value) || 2)}
          min='0.1'
          step='0.1'
          style={{
            width: '100%',
            padding: '6px',
            background: '#3a3a3a',
            border: '1px solid #555',
            borderRadius: '4px',
            color: '#fff',
          }}
        />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {sketches.map((sketch, index) => (
          <div
            key={index}
            style={{
              display: 'flex',
              flexDirection: 'column',
              padding: '8px',
              background: '#3a3a3a',
              borderRadius: '4px',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 8,
              }}
            >
              <span style={{ fontSize: '12px' }}>
                {sketch.type === 'rectangle'
                  ? `Rectangle (${sketch.width?.toFixed(2) || 0} × ${
                      sketch.height?.toFixed(2) || 0
                    })`
                  : `Circle (r: ${sketch.radius?.toFixed(2) || 0})`}
              </span>
              <button
                onClick={() => handleExtrude(index)}
                style={{
                  padding: '4px 8px',
                  background: '#2194ce',
                  border: 'none',
                  borderRadius: '4px',
                  color: '#fff',
                  cursor: 'pointer',
                  fontSize: '11px',
                }}
              >
                Extrude
              </button>
            </div>

            {sketch.type === 'rectangle' ? (
              <div style={{ display: 'flex', gap: 8 }}>
                <div style={{ flex: 1 }}>
                  <label
                    style={{
                      display: 'block',
                      fontSize: 11,
                      color: '#bbb',
                      marginBottom: 4,
                    }}
                  >
                    Width
                  </label>
                  <input
                    type='number'
                    min='0.1'
                    step='0.1'
                    value={sketch.width ?? 0}
                    onChange={(e) =>
                      updateSketch(index, {
                        width: Math.max(0.1, parseFloat(e.target.value) || 0),
                      })
                    }
                    style={{
                      width: '100%',
                      padding: '6px',
                      background: '#2f2f2f',
                      border: '1px solid #555',
                      borderRadius: '4px',
                      color: '#fff',
                    }}
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <label
                    style={{
                      display: 'block',
                      fontSize: 11,
                      color: '#bbb',
                      marginBottom: 4,
                    }}
                  >
                    Height
                  </label>
                  <input
                    type='number'
                    min='0.1'
                    step='0.1'
                    value={sketch.height ?? 0}
                    onChange={(e) =>
                      updateSketch(index, {
                        height: Math.max(0.1, parseFloat(e.target.value) || 0),
                      })
                    }
                    style={{
                      width: '100%',
                      padding: '6px',
                      background: '#2f2f2f',
                      border: '1px solid #555',
                      borderRadius: '4px',
                      color: '#fff',
                    }}
                  />
                </div>
              </div>
            ) : (
              <div>
                <label
                  style={{
                    display: 'block',
                    fontSize: 11,
                    color: '#bbb',
                    marginBottom: 4,
                  }}
                >
                  Radius
                </label>
                <input
                  type='number'
                  min='0.1'
                  step='0.1'
                  value={sketch.radius ?? 0}
                  onChange={(e) =>
                    updateSketch(index, {
                      radius: Math.max(0.1, parseFloat(e.target.value) || 0),
                    })
                  }
                  style={{
                    width: '100%',
                    padding: '6px',
                    background: '#2f2f2f',
                    border: '1px solid #555',
                    borderRadius: '4px',
                    color: '#fff',
                  }}
                />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
