import { h } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import { store } from './state';
import { SketchViewer } from './viewer';
import { Header } from './components/Header';
import { CanvasView } from './components/CanvasView';
import { Sidebar } from './components/Sidebar';
import { Modals } from './components/modals';

export function App() {
  const viewerRef = useRef<SketchViewer | null>(null);
  const [, setTick] = useState(0);

  useEffect(() => {
    // Re-render when store updates
    const unsubscribe = store.subscribe(() => setTick((t) => t + 1));
    return unsubscribe;
  }, []);

  const handleRedraw = () => {
    viewerRef.current?.draw();
  };

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Header />
      <div class="main-layout">
        <CanvasView viewerRef={viewerRef} />
        <Sidebar onRedraw={handleRedraw} />
      </div>
      <Modals onRedraw={handleRedraw} />
    </div>
  );
}