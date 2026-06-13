import { useEffect, useState } from 'react';
import { useStore } from './state/store';
import { sim } from './state/sim';
import { Onboarding } from './components/Onboarding';
import { TopBar } from './components/TopBar';
import { Watchlist } from './components/Watchlist';
import { Chart } from './components/Chart';
import { OrderPanel } from './components/OrderPanel';
import { Hud } from './components/Hud';
import { SettingsModal } from './components/SettingsModal';
import { StatsModal } from './components/StatsModal';
import { OptionsChain } from './components/OptionsChain';
import { MobileShell } from './components/MobileShell';
import { useIsMobile } from './hooks/useIsMobile';
import { loadGame } from './state/persistence';

export function App() {
  const phase = useStore((s) => s.phase);
  const theme = useStore((s) => s.settings.theme);
  const toast = useStore((s) => s.toast);
  const resume = useStore((s) => s.resume);
  const saveNow = useStore((s) => s.saveNow);
  const [booted, setBooted] = useState(false);
  const [hasSave, setHasSave] = useState(false);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  // On first load, offer to resume an existing world.
  useEffect(() => {
    setHasSave(loadGame() !== null);
    setBooted(true);
  }, []);

  // Persist on tab hide / unload so an ephemeral session isn't lost.
  useEffect(() => {
    const onHide = () => {
      if (useStore.getState().phase === 'trading') saveNow();
    };
    document.addEventListener('visibilitychange', onHide);
    window.addEventListener('beforeunload', onHide);
    const interval = setInterval(onHide, 15000);
    return () => {
      document.removeEventListener('visibilitychange', onHide);
      window.removeEventListener('beforeunload', onHide);
      clearInterval(interval);
    };
  }, [saveNow]);

  useEffect(() => () => sim.stop(), []);

  if (!booted) return null;

  if (phase === 'onboarding') {
    return <Onboarding canResume={hasSave} onResume={() => resume()} />;
  }

  return <Workspace />;
}

function Workspace() {
  const [showSettings, setShowSettings] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const [showChain, setShowChain] = useState(false);
  const toast = useStore((s) => s.toast);
  const isMobile = useIsMobile();

  const modals = (
    <>
      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} onStats={() => { setShowSettings(false); setShowStats(true); }} />}
      {showStats && <StatsModal onClose={() => setShowStats(false)} />}
      {showChain && <OptionsChain onClose={() => setShowChain(false)} />}
      {toast && <div className="toast">{toast}</div>}
    </>
  );

  if (isMobile) {
    return (
      <>
        <MobileShell
          onSettings={() => setShowSettings(true)}
          onStats={() => setShowStats(true)}
          onOpenChain={() => setShowChain(true)}
        />
        {modals}
      </>
    );
  }

  return (
    <div className="app">
      <TopBar onSettings={() => setShowSettings(true)} onStats={() => setShowStats(true)} />
      <div className="workspace">
        <Watchlist />
        <div className="chart-area">
          <Chart />
          <Hud />
        </div>
        <OrderPanel onOpenChain={() => setShowChain(true)} />
      </div>
      {modals}
    </div>
  );
}
