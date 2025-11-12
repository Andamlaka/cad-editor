import React, { useState, useEffect } from 'react';
import UIControls from './components/UIControls';
import ThreeCanvas from './components/ThreeCanvas';
import PropertiesPanel from './components/PropertiesPanel';
import SketchControls from './components/SketchControls';
import './App.css';

export default function App() {
  const [selectedEntity, setSelectedEntity] = useState(null);
  const [selectedType, setSelectedType] = useState(null);

  useEffect(() => {
    const handleSelectionChange = (e) => {
      setSelectedEntity(e.detail.entity);
      setSelectedType(e.detail.type);
    };

    window.addEventListener('selectionChanged', handleSelectionChange);

    return () => {
      window.removeEventListener('selectionChanged', handleSelectionChange);
    };
  }, []);

  return (
    <div className='app-container'>
      <UIControls />
      <ThreeCanvas />
      <PropertiesPanel
        selectedEntity={selectedEntity}
        selectedType={selectedType}
      />
      <SketchControls />
    </div>
  );
}
