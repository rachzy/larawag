import { useRef, useState } from 'react';
import { LarawagValidationError } from '@larawag/core';
import { StarSystem, type StarSystemHandle } from '@larawag/react';
import { PRESETS } from '../../vanilla/systems.js';

const reducedMotion = (): boolean => matchMedia('(prefers-reduced-motion: reduce)').matches;

function messages(error: unknown): string[] {
  if (error instanceof LarawagValidationError) return error.issues.map((i) => `${i.path}: ${i.message}`);
  return [String(error)];
}

export function App() {
  const view = useRef<StarSystemHandle>(null);
  const [preset, setPreset] = useState(PRESETS[0]!);
  const [playing, setPlaying] = useState(() => !reducedMotion());
  const [speed, setSpeed] = useState(preset.rateSlider);
  const [trueScale, setTrueScale] = useState(false);
  const [hz, setHz] = useState(true);
  const [errors, setErrors] = useState<string[]>([]);

  const choose = (id: string): void => {
    const next = PRESETS.find((p) => p.id === id);
    if (!next) return;
    setPreset(next);
    setSpeed(next.rateSlider);
    setTrueScale(false);
    setHz(true);
    setErrors([]);
    view.current?.setTime(0);
    view.current?.resetView();
  };

  return (
    <>
      <header>
        <h1>Larawag React demo</h1>
        <p className="sub">The same scene as the vanilla demo, drawn through the &lt;StarSystem&gt; component. Drag to rotate, scroll to zoom, click a planet to follow it.</p>
      </header>

      <div className="ctl">
        <label htmlFor="preset">
          System{' '}
          <select id="preset" value={preset.id} onChange={(e) => choose(e.target.value)}>
            {PRESETS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div id="stage" role="group" aria-label="3D view of the star system">
        <StarSystem
          ref={view}
          system={preset.input}
          overlays={{ labels: true, clock: true, badge: true, ...preset.options?.overlays }}
          playing={playing}
          rate={10 ** speed}
          scaleMode={trueScale ? 'true' : 'compressed'}
          showHabitableZone={hz}
          followOnClick
          onError={(e) => setErrors(messages(e))}
        />
      </div>

      <div className="ctl">
        <button id="play" type="button" aria-pressed={playing} onClick={() => setPlaying(!playing)}>
          {playing ? 'Pause' : 'Play'}
        </button>
        <label htmlFor="speed">
          Speed{' '}
          <input
            id="speed"
            type="range"
            min="-1"
            max="2"
            step="0.05"
            value={speed}
            onChange={(e) => setSpeed(Number(e.target.value))}
          />{' '}
          <span className="note mono">{(10 ** speed).toFixed(1)} d/s</span>
        </label>
        <button id="scale" type="button" aria-pressed={trueScale} onClick={() => setTrueScale(!trueScale)}>
          True scale: {trueScale ? 'on' : 'off'}
        </button>
        <button id="hz" type="button" aria-pressed={hz} onClick={() => setHz(!hz)}>
          Habitable zone: {hz ? 'on' : 'off'}
        </button>
        <button id="transit" type="button" onClick={() => view.current?.setView('transit')}>
          Transit view
        </button>
        <button id="reset" type="button" onClick={() => view.current?.resetView()}>
          Reset view
        </button>
      </div>

      <ul id="errors" role="alert">
        {errors.map((m) => (
          <li key={m}>{m}</li>
        ))}
      </ul>
    </>
  );
}
