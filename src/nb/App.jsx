/* Nation Builder (Flashpoint History), 2026. GNU GPL v3 with additional terms — see LICENSE and NOTICE.md.
 *
 * The teaching layer's screens, drawn over the game: the opening disclaimer, founding a town (scenario and
 * government), continuing one (city file, this computer's copy, or a code), a teacher's code check, and the in-game
 * year in review and save dialog. The game canvas and its tools stay the original's.
 */

import { useEffect, useRef, useState } from 'react';

import { decodeSaveCode } from './saveCode.js';
import { decodeSaveFile, encodeSaveFile, saveFileName, SAVE_EXTENSION } from './saveFile.js';
import { governanceChoices } from './scenario.js';
import { readAutosave } from './session.js';

const TOWN_NAME_MAX = 15;


export function App({ content, onFound, onContinue, bindDialogs }) {
  const [screen, setScreen] = useState({ name: 'title' });
  const [session, setSession] = useState(null);
  const [saving, setSaving] = useState(false);
  const [review, setReview] = useState(null);
  const [news, setNews] = useState(null);

  // Each dialog pauses the game; Escape closes it through the close function handed to openExternalDialog.
  const openSave = s => {
    setSession(s);
    setReview(null);
    setSaving(true);
    s.game.openExternalDialog(() => setSaving(false));
  };

  useEffect(() => {
    bindDialogs({
      save: openSave,
      yearReview: (s, r) => {
        setSession(s);
        setReview(r);
        s.game.openExternalDialog(() => setReview(null));
      },
      // The news does not pause the game: it is read while the town keeps running.
      news: story => setNews({ ...story, at: Date.now() }),
    });
  }, [bindDialogs]);

  const found = async choice => {
    setScreen({ name: 'playing' });
    setSession(await onFound(choice));
  };
  const resume = async record => {
    setScreen({ name: 'playing' });
    setSession(await onContinue(record));
  };

  if (screen.name === 'playing') {
    return (
      <>
        {session && <HeaderBadge session={session} />}
        {session && <MapTools strings={content.strings.map} />}
        {news && !review && !saving && <NewsVignette story={news} onDismiss={() => setNews(null)} />}
        {review && session && (
          <YearReview review={review} strings={content.strings.year_review}
                      onClose={() => { setReview(null); session.game.closeExternalDialog(); }}
                      onSave={() => openSave(session)} />
        )}
        {saving && session && (
          <SaveDialog session={session} onClose={() => { setSaving(false); session.game.closeExternalDialog(); }} />
        )}
      </>
    );
  }

  return (
    <div className="nb-overlay">
      <section className="nb-panel" aria-live="polite">
        {screen.name === 'title' && <Title strings={content.strings} go={setScreen} />}
        {screen.name === 'found' && <Found content={content} preset={screen.preset} go={setScreen} onFound={found} />}
        {screen.name === 'continue' && <Continue content={content} go={setScreen} onContinue={resume} />}
        {screen.name === 'check' && <CheckCode content={content} go={setScreen} />}
      </section>
    </div>
  );
}


function Title({ strings, go }) {
  return (
    <>
      <p className="nb-kicker">Flashpoint History</p>
      <h1 className="nb-title">Nation Builder</h1>
      <p className="nb-disclaimer">{strings.disclaimer}</p>
      <div className="nb-actions">
        <button className="nb-primary" onClick={() => go({ name: 'found' })}>Start a new town</button>
        <button className="nb-secondary" onClick={() => go({ name: 'continue' })}>Continue my town</button>
      </div>
      <p className="nb-quiet"><button className="nb-link" onClick={() => go({ name: 'check' })}>Teachers: check a student’s code</button></p>
    </>
  );
}


function Found({ content, preset, go, onFound }) {
  const [scenarioIndex, setScenarioIndex] = useState(preset ? preset.scenarioIndex : 0);
  const scenario = content.scenarios[scenarioIndex];
  const { available, reserved } = governanceChoices(scenario);
  const [poleId, setPoleId] = useState(preset ? preset.poleId : null);
  const [townName, setTownName] = useState('');
  const ready = poleId && townName.trim() !== '';

  return (
    <>
      <BackLink go={go} />
      <h2 className="nb-heading">Found your town</h2>
      {preset && <p className="nb-note">{preset.note}</p>}

      {content.scenarios.length > 1 && (
        <fieldset className="nb-field">
          <legend>Where and when</legend>
          <div className="nb-cards">
            {content.scenarios.map((s, i) => (
              <Card key={s.scenario_id} selected={i === scenarioIndex}
                    onSelect={() => { setScenarioIndex(i); setPoleId(null); }}
                    title={s.title} detail={`Starts ${s.start_year}`} />
            ))}
          </div>
        </fieldset>
      )}
      {content.scenarios.length === 1 && (
        <p className="nb-scenario">{scenario.title} · starts {scenario.start_year}</p>
      )}
      {scenario.dev_fixture && <p className="nb-beta">{content.strings.beta_notice}</p>}

      <fieldset className="nb-field">
        <legend>Choose how your town is governed</legend>
        <p className="nb-hint">You choose once. Watch how it shapes your town as the years pass.</p>
        <div className="nb-cards">
          {available.map(pole => (
            <Card key={pole.id} selected={pole.id === poleId} onSelect={() => setPoleId(pole.id)}
                  title={pole.label} detail={pole.summary} />
          ))}
          {reserved.map(id => (
            <Card key={id} disabled title={content.strings.reserved_pole_title}
                  detail={content.strings.reserved_pole_detail} />
          ))}
        </div>
      </fieldset>

      <label className="nb-field nb-label">
        Name your town
        <input className="nb-input" value={townName} maxLength={TOWN_NAME_MAX} autoComplete="off"
               onChange={e => setTownName(e.target.value)} placeholder="Make up a name, not your own" />
      </label>

      <div className="nb-actions">
        <button className="nb-primary" disabled={!ready}
                onClick={() => onFound({ scenarioIndex, poleId, townName: townName.trim() })}>
          Found {townName.trim() || 'the town'}
        </button>
      </div>
    </>
  );
}


function Continue({ content, go, onContinue }) {
  const [error, setError] = useState(null);
  const [dragging, setDragging] = useState(false);
  const [code, setCode] = useState('');
  const fileInput = useRef(null);
  const autosave = readAutosave();

  const open = async file => {
    setError(null);
    try {
      const record = await decodeSaveFile(await file.arrayBuffer());
      if (!content.scenarios.some(s => s.scenario_id === record.teaching.scenario_id))
        throw new Error('That city is from a scenario this version of Nation Builder doesn’t have.');
      onContinue(record);
    } catch (e) {
      setError(e.message);
    }
  };

  const fromCode = () => {
    setError(null);
    try {
      const decoded = decodeSaveCode(code);
      const scenario = content.scenarios[decoded.scenarioIndex];
      if (!scenario)
        throw new Error('That code is for a scenario this version of Nation Builder doesn’t have.');
      const poleId = decoded.poleIndex === null ? null : Object.keys(scenario.governance_poles)[decoded.poleIndex];
      go({ name: 'found', preset: {
        scenarioIndex: decoded.scenarioIndex,
        poleId: poleId && scenario.governance_poles[poleId] ? poleId : null,
        note: `A code can’t rebuild a city, only your choices. You’re starting fresh in ${scenario.start_year} with the ` +
              `same government. Your last checkpoint was ${decoded.year}.`,
      } });
    } catch (e) {
      setError(e.message);
    }
  };

  return (
    <>
      <BackLink go={go} />
      <h2 className="nb-heading">Continue your town</h2>

      <div className={'nb-drop' + (dragging ? ' nb-drop-active' : '')}
           onDragOver={e => { e.preventDefault(); setDragging(true); }}
           onDragLeave={() => setDragging(false)}
           onDrop={e => { e.preventDefault(); setDragging(false); if (e.dataTransfer.files[0]) open(e.dataTransfer.files[0]); }}>
        <button className="nb-primary" onClick={() => fileInput.current.click()}>Open my city file</button>
        <p className="nb-hint">It ends in <code>{SAVE_EXTENSION}</code>. Check your Google Drive or Downloads. You can drag it here too.</p>
        <input ref={fileInput} type="file" accept={`${SAVE_EXTENSION},.json`} hidden
               onChange={e => { if (e.target.files[0]) open(e.target.files[0]); e.target.value = ''; }} />
      </div>

      {autosave && autosave.teaching && (
        <div className="nb-field">
          <button className="nb-secondary" onClick={() => onContinue(autosave)}>
            Continue {autosave.teaching.town_name}, {cityYear(autosave.city)}
          </button>
          <p className="nb-hint">The copy saved on this computer. School computers can erase it, so keep your file too.</p>
        </div>
      )}

      <details className="nb-field">
        <summary>Lost your file? Start again from your code</summary>
        <div className="nb-code-row">
          <input className="nb-input nb-code-input" value={code} onChange={e => setCode(e.target.value)}
                 placeholder="XXXX-XXXX-XXXX-XX" aria-label="Your code" autoComplete="off" spellCheck={false} />
          <button className="nb-secondary" onClick={fromCode} disabled={code.trim() === ''}>Use code</button>
        </div>
      </details>

      {error && <p className="nb-error" role="alert">{error}</p>}
    </>
  );
}


// The in-game year a saved city stands at (48 ticks to the year).
function cityYear(city) {
  return Math.floor(city._cityTime / 48) + (city._startingYear || 1900);
}


function CheckCode({ content, go }) {
  const [code, setCode] = useState('');
  const [result, setResult] = useState(null);

  const check = () => {
    try {
      const d = decodeSaveCode(code);
      const scenario = content.scenarios[d.scenarioIndex];
      const pole = scenario && d.poleIndex !== null ? Object.values(scenario.governance_poles)[d.poleIndex] : null;
      setResult({ ok: true, d, scenario, pole });
    } catch (e) {
      setResult({ ok: false, message: e.message });
    }
  };

  return (
    <>
      <BackLink go={go} />
      <h2 className="nb-heading">Check a student’s code</h2>
      <p className="nb-hint">Codes are checkpoints: the numbers are rounded, and nothing in them identifies a student.</p>
      <div className="nb-code-row">
        <input className="nb-input nb-code-input" value={code} onChange={e => setCode(e.target.value)}
               placeholder="XXXX-XXXX-XXXX-XX" aria-label="Student code" autoComplete="off" spellCheck={false} />
        <button className="nb-secondary" onClick={check} disabled={code.trim() === ''}>Check</button>
      </div>
      {result && !result.ok && <p className="nb-error" role="alert">{result.message}</p>}
      {result && result.ok && (
        <dl className="nb-stats">
          <dt>Scenario</dt><dd>{result.scenario ? result.scenario.title : `Unknown (#${result.d.scenarioIndex})`}</dd>
          <dt>Government</dt><dd>{result.pole ? result.pole.label : 'Not chosen'}</dd>
          <dt>Checkpoint year</dt><dd>{result.d.year}</dd>
          <dt>Population</dt><dd>about {result.d.population.toLocaleString()}</dd>
          <dt>City score</dt><dd>about {result.d.score} of 1000</dd>
          <dt>Approval</dt><dd>{result.d.approval}%</dd>
          <dt>Funds</dt><dd>about ${result.d.funds.toLocaleString()}</dd>
        </dl>
      )}
    </>
  );
}


function SaveDialog({ session, onClose }) {
  const [code] = useState(() => session.code());
  const [status, setStatus] = useState(null);
  const year = session.checkpoint().year;

  const download = async () => {
    const record = session.saveRecord();
    const bytes = await encodeSaveFile(record);
    const name = saveFileName(session.game.name, year);
    try {
      await writeFile(name, bytes);
      setStatus({ ok: true, text: `Saved ${name}.` });
    } catch (e) {
      if (e.name !== 'AbortError')
        setStatus({ ok: false, text: 'That didn’t save. Try again, or ask your teacher.' });
    }
  };

  return (
    <div className="nb-overlay nb-overlay-dialog" role="dialog" aria-modal="true" aria-labelledby="nb-save-title">
      <div className="nb-panel nb-panel-narrow">
        <h2 id="nb-save-title" className="nb-heading">Save {session.game.name}</h2>
        <ol className="nb-steps">
          <li>
            <strong>Write this code on your worksheet.</strong>
            <p className="nb-code" aria-label="Your code">{code}</p>
            <p className="nb-hint">It records your choices and your {year} checkpoint.</p>
          </li>
          <li>
            <strong>Save your city file.</strong>
            <p className="nb-hint">The file is your whole city. Put it in your Google Drive so you can open it on any Chromebook.</p>
            <button className="nb-primary" onClick={download}>Save city file</button>
            {status && <p className={status.ok ? 'nb-ok' : 'nb-error'} role="status">{status.text}</p>}
          </li>
        </ol>
        <div className="nb-actions">
          <button className="nb-secondary" onClick={onClose}>Back to my town</button>
        </div>
      </div>
    </div>
  );
}


// Moving around the map, and getting the engine's panels out of the way of it. The map is far bigger than the
// window, and upstream's only way to move it is the arrow keys.
function MapTools({ strings }) {
  const [hidden, setHidden] = useState(false);
  const [hintSeen, setHintSeen] = useState(() => {
    try {
      return window.sessionStorage.getItem('nbMapHintSeen') === 'yes';
    } catch (e) {
      return false;
    }
  });

  const dismissHint = () => {
    setHintSeen(true);
    try {
      window.sessionStorage.setItem('nbMapHintSeen', 'yes');
    } catch (e) {
      // Private windows and locked-down profiles: the hint simply shows again next visit.
    }
  };

  useEffect(() => {
    document.body.classList.toggle('nb-panels-hidden', hidden);
    return () => document.body.classList.remove('nb-panels-hidden');
  }, [hidden]);

  return (
    <>
      <button className="nb-panel-toggle" onClick={() => setHidden(!hidden)}
              title={hidden ? strings.show_panels : strings.hide_panels}>
        {hidden ? strings.show_panels : strings.hide_panels}
      </button>
      {!hintSeen && (
        <aside className="nb-map-hint" role="status">
          <h3 className="nb-map-hint-title">{strings.hint_title}</h3>
          <p className="nb-map-hint-line">{strings.hint}</p>
          <button className="nb-news-dismiss" onClick={dismissHint}>{strings.hint_dismiss}</button>
        </aside>
      )}
    </>
  );
}


// A change of government, in the year-in-review panel. It says plainly what happened and why — BK's ruling that an
// event a student would not understand cold gets explained, not left to the clue ladder — and only then asks the
// ungraded question the curriculum desks wrote.
function ChangeOfGovernment({ change }) {
  return (
    <section className="nb-government">
      <h3 className="nb-government-title">{change.title}</h3>
      <p className="nb-government-took-office">{change.took_office}</p>
      <p className="nb-government-summary">{change.summary}</p>
      <p className="nb-government-explain">{change.explain}</p>
      {change.prompt && (
        <p className="nb-government-prompt">
          <span className="nb-government-prompt-heading">{change.debriefHeading}</span>
          {change.prompt}
        </p>
      )}
    </section>
  );
}


// The advisor's news: a clipping that arrives over the running map and sees itself out.
const NEWS_SECONDS = 16;

function NewsVignette({ story, onDismiss }) {
  useEffect(() => {
    const timer = window.setTimeout(onDismiss, NEWS_SECONDS * 1000);
    return () => window.clearTimeout(timer);
  }, [story.key, story.at, onDismiss]);

  return (
    <aside className="nb-news" role="status" aria-live="polite">
      <p className="nb-news-masthead">
        <span>{story.masthead}</span>
        <span className="nb-news-dateline">{story.dateline}</span>
      </p>
      <h3 className="nb-news-headline">{story.headline}</h3>
      <div className="nb-news-counsel">
        <img className="nb-news-portrait" src="content/images/advisor-guide-bk.webp" alt="" width="48" height="48" />
        <div>
          <p className="nb-news-line">{story.counsel}</p>
          <p className="nb-news-byline">
            — {story.byline}
          </p>
        </div>
      </div>
      <button className="nb-news-dismiss" onClick={onDismiss}>Noted</button>
    </aside>
  );
}


function YearReview({ review, strings, onClose, onSave }) {
  return (
    <div className="nb-overlay nb-overlay-dialog" role="dialog" aria-modal="true" aria-labelledby="nb-review-title">
      <div className="nb-panel nb-panel-narrow">
        <h2 id="nb-review-title" className="nb-heading">{review.title}</h2>
        {review.milestone && <p className="nb-review-milestone">{review.milestone}</p>}
        {review.government && <ChangeOfGovernment change={review.government} />}
        {review.since && <p className="nb-hint nb-review-since">{review.since}</p>}

        <dl className="nb-review-stats">
          {review.stats.map(s => (
            <div key={s.key} className="nb-review-stat">
              <dt>{s.label}</dt>
              <dd>
                <span className="nb-review-value">{formatStat(s.key, s.value)}</span>
                {s.change !== null && <span className="nb-review-change">{formatChange(s.key, s.change)}</span>}
              </dd>
            </div>
          ))}
        </dl>

        <h3 className="nb-subheading">{strings.problems_heading}</h3>
        {review.problems.length > 0
          ? <ol className="nb-review-problems">{review.problems.map(p => <li key={p}>{p}</li>)}</ol>
          : <p className="nb-hint">{strings.no_problems}</p>}

        {review.poleLine && (
          <>
            <h3 className="nb-subheading">{strings.pole_heading}</h3>
            <p>{review.poleLine}</p>
          </>
        )}

        <p className="nb-hint">{strings.checkpoint}</p>
        <div className="nb-actions">
          <button className="nb-primary" onClick={onClose} autoFocus>{strings.keep_building}</button>
          <button className="nb-secondary" onClick={onSave}>{strings.save}</button>
        </div>
      </div>
    </div>
  );
}


function formatStat(key, value) {
  if (key === 'funds')
    return '$' + value.toLocaleString('en-US');
  if (key === 'approval')
    return `${value}%`;
  if (key === 'score')
    return `${value} of 1000`;
  return value.toLocaleString('en-US');
}


function formatChange(key, change) {
  if (change === 0)
    return '±0';
  const magnitude = key === 'funds' ? '$' + Math.abs(change).toLocaleString('en-US') : Math.abs(change).toLocaleString('en-US');
  return (change > 0 ? '+' : '−') + magnitude + (key === 'approval' ? ' pts' : '');
}


// Chrome and ChromeOS let the student pick the folder (Google Drive included); elsewhere it goes to Downloads.
async function writeFile(name, bytes) {
  if (window.showSaveFilePicker) {
    const handle = await window.showSaveFilePicker({
      suggestedName: name,
      types: [{ description: 'Nation Builder city', accept: { 'application/octet-stream': [SAVE_EXTENSION] } }],
    });
    const writable = await handle.createWritable();
    await writable.write(bytes);
    await writable.close();
    return;
  }

  const url = URL.createObjectURL(new Blob([bytes], { type: 'application/octet-stream' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}


function HeaderBadge({ session }) {
  const pole = session.scenario.governance_poles[session.poleId];
  return (
    <div className="nb-header-badge">
      {pole ? pole.label : 'No government chosen'}
    </div>
  );
}


function Card({ title, detail, badge, selected, disabled, onSelect }) {
  return (
    <button className={'nb-card' + (selected ? ' nb-card-selected' : '')} disabled={disabled} aria-pressed={!!selected}
            onClick={onSelect}>
      <span className="nb-card-title">{title}{badge && <span className="nb-badge">{badge}</span>}</span>
      {detail && <span className="nb-card-detail">{detail}</span>}
    </button>
  );
}


function BackLink({ go }) {
  return <button className="nb-link nb-back" onClick={() => go({ name: 'title' })}>← Back</button>;
}
