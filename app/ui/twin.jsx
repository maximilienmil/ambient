// The Twin — a React component drawing the commitment field on a Canvas 2D
// surface. Positions come from d3-force. No WebGL, no glow, no particles.
//
// Encoding (the brief, one line each):
//   node radius        stakes, when the decision layer recorded them
//   distance           days the commitment has been open
//   thin ring          current tier colour — the only tier colour in the canvas
//   node opacity       confidence p; unscored nodes use a stated default
//   two thin arcs      Jev and d1, each spanning the probability of the chosen
//                      tier. Overlapping arcs mean agreement; split means not.
//   dashed ring        the four-week norm for open load
//   edges              two commitments sharing a person or a conversation
//
// Everything the canvas draws comes from a row or from a field the decision
// layer wrote. When a value is missing the node is drawn at a stated default and
// the legend says so; nothing here invents a number.

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { forceCenter, forceCollide, forceLink, forceManyBody, forceRadial, forceSimulation } from 'd3-force';

const OPTIONS = ['ignore', 'remember', 'ask', 'draft', 'execute'];
const MAX_NODES = 500;
const MAX_EDGES = 1500;
const ENTRY_MS = 400;
const FADE_MS = 600;
/** Unscored rows are drawn at this opacity and the legend says so. */
const UNSCORED_OPACITY = 0.4;
/** Radius used when stakes are unknown. Also stated in the legend. */
const DEFAULT_STAKES = 1;
const RING_HIT = 24;
/** How much of a bead you see when its week is not the selected one. */
const GHOST = 0.16;

function readTokens() {
  const styles = getComputedStyle(document.documentElement);
  const read = (name) => styles.getPropertyValue(name).trim();
  /* The canvas draws on the hero, which keeps its saturated field in both
     themes, so these values are the same in light and in dark. Ink is the
     structure; the six tier colours are the fills and nothing else. */
  return {
    ink: read('--canvas-ink'),
    hairline: read('--canvas-hairline'),
    edge: read('--canvas-edge'),
    norm: read('--canvas-norm'),
    arc: read('--canvas-arc'),
    spec: read('--canvas-spec'),
    tiers: {
      ignore: read('--tier-ignore'),
      remember: read('--tier-remember'),
      ask: read('--tier-ask'),
      draft: read('--tier-draft'),
      execute: read('--tier-execute'),
      unscored: read('--tier-unscored'),
    },
  };
}

function probabilityOf(item) {
  const value = item.confidence;
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  return value > 1 ? Math.min(1, value / 100) : Math.max(0, Math.min(1, value));
}

/** The four week labels the strip uses, from the ledger when it has them. */
function weekLabels(weeks) {
  if (Array.isArray(weeks) && weeks.length) return weeks.map((entry) => entry.label);
  return ['This week', 'Last week', '2 weeks ago', '3 weeks ago'];
}

function nodeFrom(item) {
  const tier = item.decision === 'unscored' ? null : item.decision;
  const days = Math.max(0, item.age || 0);
  return {
    id: item.id,
    title: item.title,
    tier,
    state: item.state,
    stakes: typeof item.stakes === 'number' && item.stakes > 0 ? item.stakes : null,
    p: probabilityOf(item),
    days,
    /* Which week the promise was made in. Four buckets, and anything older than
       three weeks sits in the last one, so every node belongs somewhere. */
    week: Math.min(3, Math.floor(days / 7)),
    jev: tier && item.jevDist ? item.jevDist[tier] ?? null : null,
    d1: tier && item.d1Dist ? item.d1Dist[tier] ?? null : null,
    hasModels: Boolean(item.jevDist || item.d1Dist),
    person: item.person || null,
    conversation: item.sourceId || null,
    closed: item.state === 'done',
    retired: item.state === 'obsolete' || item.state === 'forgotten',
  };
}

function buildGraph(items) {
  const open = items.filter((item) => item.state === 'live' || item.state === 'blocked');
  const closed = items.filter((item) => item.state === 'done');
  const retired = items.filter((item) => item.state === 'obsolete' || item.state === 'forgotten');
  const nodes = [...open, ...closed, ...retired].slice(0, MAX_NODES).map(nodeFrom);
  const byId = new Map(nodes.map((node) => [node.id, node]));

  const byPerson = new Map();
  const byConversation = new Map();
  for (const node of nodes) {
    if (node.person) {
      if (!byPerson.has(node.person)) byPerson.set(node.person, []);
      byPerson.get(node.person).push(node.id);
    }
    if (node.conversation) {
      if (!byConversation.has(node.conversation)) byConversation.set(node.conversation, []);
      byConversation.get(node.conversation).push(node.id);
    }
  }

  const links = [];
  const seen = new Set();
  const add = (a, b) => {
    if (links.length >= MAX_EDGES) return;
    const key = a < b ? `${a}|${b}` : `${b}|${a}`;
    if (seen.has(key)) return;
    seen.add(key);
    links.push({ source: a, target: b });
  };
  for (const group of [...byPerson.values(), ...byConversation.values()]) {
    // Chain rather than fully connect: a busy person must not create a mesh.
    for (let index = 1; index < group.length && links.length < MAX_EDGES; index += 1) {
      add(group[0], group[index]);
    }
  }
  return { nodes: nodes.filter((node) => byId.has(node.id)), links };
}

export function useTwin() {
  const [state, setState] = useState({ items: [], norms: null, weeks: [], loading: true, error: null });
  const load = useCallback(async () => {
    setState((previous) => ({ ...previous, loading: true }));
    try {
      const session = await (await fetch('/api/session')).json();
      const response = await fetch('/api/ledger', { headers: { 'X-Latent-Token': session.token } });
      if (!response.ok) throw new Error('The ledger could not be read.');
      const ledger = await response.json();
      setState({
        items: ledger.items,
        norms: ledger.norms,
        weeks: ledger.today?.weeks || [],
        loading: false,
        error: null,
      });
    } catch (error) {
      setState({ items: [], norms: null, weeks: [], loading: false, error: error.message });
    }
  }, []);
  useEffect(() => {
    load();
  }, [load]);
  return { ...state, reload: load };
}

function TwinCanvas({ items, norms, week, onOpen, onCounts }) {
  const holder = useRef(null);
  const canvas = useRef(null);
  const graph = useMemo(() => buildGraph(items), [items]);
  const weekRef = useRef(week);
  weekRef.current = week;
  /** The last draw, so changing the week can repaint without a resize. */
  const drawRef = useRef(null);

  useEffect(() => {
    const element = canvas.current;
    const parent = holder.current;
    if (!element || !parent) return undefined;

    const palette = readTokens();
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const context = element.getContext('2d');
    let width = 0;
    let height = 0;
    let frame = 0;
    let running = true;
    let lastFrame = 0;
    const born = new Map();

    const nodes = graph.nodes.map((node, index) => {
      const angle = (index * 2.39996) % (Math.PI * 2);
      return {
        ...node,
        index,
        spawnX: Math.cos(angle) * 1.6,
        spawnY: Math.sin(angle) * 1.6,
        bornAt: performance.now() + index * 2,
        x: Math.cos(angle) * 1.6,
        y: Math.sin(angle) * 1.6,
      };
    });
    const links = graph.links.map((link) => ({ ...link }));

    const simulation = forceSimulation(nodes)
      .force('charge', forceManyBody().strength(-26).theta(1.2).distanceMax(240))
      .force('radial', forceRadial((node) => radialOf(node), 0, 0).strength(0.75))
      .force('collide', forceCollide((node) => radiusOf(node) + 2).iterations(1))
      .force('link', forceLink(links).id((node) => node.id).strength(0.08).distance(38))
      .force('center', forceCenter(0, 0))
      .alphaDecay(0.035)
      .stop();

    function radiusOf(node) {
      const stakes = node.stakes ?? DEFAULT_STAKES;
      return 3 + stakes * 1.5;
    }
    function radialOf(node) {
      const span = Math.min(width, height) / 2;
      const inner = span * 0.18;
      const outer = span * 0.82;
      if (node.closed) return outer * 1.1;
      return inner + (Math.min(node.days, 30) / 30) * (outer - inner);
    }
    function normRadius() {
      if (!norms || !norms.load) return null;
      const span = Math.min(width, height) / 2;
      const ratio = Math.max(0.25, Math.min(1, norms.norm / Math.max(1, norms.load)));
      return span * 0.82 * ratio;
    }

    /**
     * d3's radial force precomputes one target radius per node when it is
     * initialised, and `forceSimulation` initialises every force the moment it
     * is built — before the first resize has measured the holder. So the radii
     * were all read off a span of zero and the field collapsed to the centre.
     * Whenever the span changes, the radii have to be read again.
     */
    function syncRadial() {
      const radial = simulation.force('radial');
      if (radial && typeof radial.initialize === 'function') radial.initialize(nodes);
    }

    function resize() {
      const rect = parent.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = Math.max(240, Math.round(rect.width));
      height = Math.max(200, Math.round(rect.height));
      element.width = Math.round(width * dpr);
      element.height = Math.round(height * dpr);
      element.style.width = `${width}px`;
      element.style.height = `${height}px`;
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
      syncRadial();
      draw();
    }

    /**
     * The week buttons select, they do not filter. Every promise stays in the
     * field, because a field that empties when you pick a week tells you nothing
     * about the three weeks around it. The selected week is drawn solid and the
     * rest are ghosts.
     */
    function selected(node) {
      const limit = weekRef.current;
      if (limit === null || limit === undefined) return true;
      return node.week === limit;
    }

    /** How much of a bead you see: solid in the selected week, faint outside it. */
    function weightOf(node) {
      return selected(node) ? 1 : GHOST;
    }

    function draw() {
      const now = performance.now();
      context.clearRect(0, 0, width, height);
      const cx = width / 2;
      const cy = height / 2;
      context.save();
      context.translate(cx, cy);

      // The four-week norm for open load. Drawn before the nodes so the field
      // sits on top of its own baseline.
      const normR = normRadius();
      if (normR) {
        context.beginPath();
        context.setLineDash([3, 5]);
        context.strokeStyle = palette.norm;
        context.lineWidth = 1;
        context.arc(0, 0, normR, 0, Math.PI * 2);
        context.stroke();
        context.setLineDash([]);
      }

      /* Retired promises stay in the field. The note under the field and the
         week strip on Today count the same promises, so skipping them here made
         the two screens disagree. */
      const field = nodes;
      const lit = field.filter((node) => selected(node));

      // Edges say "these two share a person or a conversation". Only the short
      // ones are drawn: a line that crosses the whole field carries no readable
      // relationship and, at 500 nodes, buries the field itself. An edge inside
      // the selected week is drawn solid; one reaching out of it is faint.
      const maxEdge = Math.max(width, height) * 0.3;
      context.lineWidth = 0.6;
      const index = new Map(field.map((node) => [node.id, node]));
      const near = [];
      const far = [];
      for (const link of links) {
        const a = index.get(typeof link.source === 'object' ? link.source.id : link.source);
        const b = index.get(typeof link.target === 'object' ? link.target.id : link.target);
        if (!a || !b) continue;
        if (Math.hypot(a.x - b.x, a.y - b.y) > maxEdge) continue;
        (selected(a) && selected(b) ? near : far).push([a, b]);
      }
      for (const [group, stroke, alpha] of [
        [far, palette.edge, GHOST * 0.7],
        [near, palette.edge, 1],
      ]) {
        if (!group.length) continue;
        context.globalAlpha = alpha;
        context.strokeStyle = stroke;
        context.beginPath();
        for (const [a, b] of group) {
          context.moveTo(a.x, a.y);
          context.lineTo(b.x, b.y);
        }
        context.stroke();
      }
      context.globalAlpha = 1;
      window.__twinEdges = near.length + far.length;

      for (const node of field) {
        const elapsed = reduced ? ENTRY_MS : now - node.bornAt;
        const t = Math.max(0, Math.min(1, elapsed / ENTRY_MS));
        const ease = 1 - (1 - t) ** 3;
        const x = node.spawnX * (width / 2) + (node.x - node.spawnX * (width / 2)) * ease;
        const y = node.spawnY * (height / 2) + (node.y - node.spawnY * (height / 2)) * ease;
        node.drawX = x;
        node.drawY = y;

        const alpha =
          (node.p === null ? UNSCORED_OPACITY : node.p) *
          (node.closed ? 0.55 : 1) *
          (0.35 + ease * 0.65) *
          weightOf(node);
        const radius = radiusOf(node);

        context.globalAlpha = alpha;
        context.beginPath();
        context.fillStyle = node.tier ? palette.tiers[node.tier] : palette.tiers.unscored;
        context.arc(x, y, radius, 0, Math.PI * 2);
        context.fill();
        // A hairline keeps a white bead visible on a pale field, so "remembered"
        // and "retired" are still two different nodes.
        context.strokeStyle = palette.hairline;
        context.lineWidth = 1;
        context.stroke();

        // The specular. One white ellipse, up and to the left, the way a light
        // sits on a rounded surface.
        if (radius > 2.6) {
          context.globalAlpha = alpha * 0.55;
          context.beginPath();
          context.fillStyle = palette.spec;
          context.ellipse(x - radius * 0.3, y - radius * 0.4, radius * 0.45, radius * 0.22, -0.5, 0, Math.PI * 2);
          context.fill();
          context.globalAlpha = alpha;
        }

        // Two arcs over the same bead. Both start at the top and run clockwise
        // for as much of the circle as that model gives the chosen tier. The
        // second is drawn lighter rather than in a second colour.
        if (node.tier && (node.jev !== null || node.d1 !== null)) {
          const base = -Math.PI / 2;
          if (node.jev !== null) {
            context.beginPath();
            context.strokeStyle = palette.arc;
            context.lineWidth = 1.2;
            context.arc(x, y, radius + 3.2, base, base + node.jev * Math.PI * 2);
            context.stroke();
          }
          if (node.d1 !== null) {
            context.globalAlpha = alpha * 0.5;
            context.beginPath();
            context.strokeStyle = palette.arc;
            context.lineWidth = 1.2;
            context.setLineDash([2, 2]);
            context.arc(x, y, radius + 5.6, base, base + node.d1 * Math.PI * 2);
            context.stroke();
            context.setLineDash([]);
            context.globalAlpha = alpha;
          }
        }
        context.globalAlpha = 1;
      }

      context.restore();
      onCounts({ shown: lit.length, total: nodes.length });
    }

    function tick(time) {
      if (!running) return;
      simulation.tick();
      draw();
      if (time - lastFrame > 0) {
        const fps = 1000 / (time - lastFrame);
        lastFrame = time;
        window.__twinFps = window.__twinFps
          ? window.__twinFps * 0.9 + fps * 0.1
          : fps;
      }
      window.__twinStats = {
        nodes: nodes.length,
        links: links.length,
        alpha: simulation.alpha(),
        ring: normRadius(),
        span: Math.min(width, height) / 2,
        radii: (() => {
          const values = nodes.filter((node) => selected(node)).map((node) => Math.hypot(node.x, node.y));
          if (!values.length) return null;
          return {
            min: Math.round(Math.min(...values)),
            max: Math.round(Math.max(...values)),
            mean: Math.round(values.reduce((sum, value) => sum + value, 0) / values.length),
          };
        })(),
      };
      if (simulation.alpha() > 0.008) frame = requestAnimationFrame(tick);
      else frame = 1;
    }

    function restart() {
      if (frame === 1) {
        simulation.alpha(0.5);
        frame = requestAnimationFrame(tick);
      }
    }

    /**
     * Frame cost, measured by calling tick + draw directly instead of waiting on
     * requestAnimationFrame, so a background or occluded tab cannot throttle the
     * reading into meaninglessness. This measures the machine it runs on. It is
     * not an iPhone measurement, and it is not presented as one.
     */
    window.__twinBench = (frameCount = 90) => {
      const times = [];
      for (let index = 0; index < frameCount; index += 1) {
        const start = performance.now();
        simulation.tick();
        draw();
        times.push(performance.now() - start);
      }
      times.sort((a, b) => a - b);
      return {
        frames: frameCount,
        nodes: nodes.length,
        links: links.length,
        medianMs: Math.round(times[Math.floor(frameCount / 2)] * 100) / 100,
        p95Ms: Math.round(times[Math.floor(frameCount * 0.95)] * 100) / 100,
        maxMs: Math.round(times[frameCount - 1] * 100) / 100,
        under17ms: times.filter((value) => value < 16.7).length,
      };
    };

    function onPointer(event) {
      const rect = element.getBoundingClientRect();
      const x = event.clientX - rect.left - width / 2;
      const y = event.clientY - rect.top - height / 2;
      let best = null;
      let bestDistance = RING_HIT;
      for (const node of nodes) {
        // only a bead in the selected week is a target; a ghost is decoration
        if (!selected(node)) continue;
        const distance = Math.hypot((node.drawX ?? 0) - x, (node.drawY ?? 0) - y);
        if (distance < bestDistance) {
          bestDistance = distance;
          best = node;
        }
      }
      if (best) onOpen(best.id);
    }

    const observer = new ResizeObserver(() => {
      resize();
      restart();
    });
    observer.observe(parent);
    resize();
    drawRef.current = draw;
    simulation.alpha(1);
    frame = requestAnimationFrame(tick);
    element.addEventListener('click', onPointer);

    return () => {
      running = false;
      cancelAnimationFrame(frame);
      observer.disconnect();
      element.removeEventListener('click', onPointer);
      simulation.stop();
      born.clear();
      drawRef.current = null;
      delete window.__twinBench;
    };
  }, [graph, norms, onOpen, onCounts]);

  // A week button is an immediate repaint, not a new simulation: the beads stay
  // where the force put them and the selection only changes which ones are drawn.
  useEffect(() => {
    if (drawRef.current) drawRef.current();
  }, [week]);

  return (
    <div className="twin-holder" ref={holder}>
      <canvas id="twin-canvas" ref={canvas} role="img" aria-label="Your open commitments, arranged by how long they have been open" />
    </div>
  );
}

function TwinChrome({ items, norms, weeks, loading, error, onOpen }) {
  const [week, setWeek] = useState(0);
  const [counts, setCounts] = useState({ shown: 0, total: 0 });
  /* The canvas reports counts from inside its draw loop, which runs once a
     frame. Keeping the previous object when the numbers have not moved stops a
     sixty-a-second re-render of this subtree. */
  const onCounts = useCallback((next) => {
    setCounts((previous) => (
      previous.shown === next.shown && previous.total === next.total ? previous : next
    ));
  }, []);
  const empty = !loading && !error && items.length === 0;
  const labels = weekLabels(weeks);
  const bucket = Array.isArray(weeks) && weeks[week] ? weeks[week] : null;

  return (
    <>
      <TwinCanvas items={items} norms={norms} week={empty ? null : week} onOpen={onOpen} onCounts={onCounts} />

      {loading ? <p className="twin-note">Reading the ledger…</p> : null}
      {error ? <p className="twin-note">{error}</p> : null}

      {empty ? (
        <p className="twin-note">
          No commitment has been read yet, so the field is empty. The dashed ring is
          your four-week norm for open load
          {norms ? ` (${norms.norm}${norms.provisional ? ', provisional' : ''})` : ''}.
        </p>
      ) : (
        <>
          <div className="wks" role="group" aria-label="Which week the field is showing">
            {labels.map((label, index) => (
              <button
                key={label}
                type="button"
                aria-pressed={index === week}
                onClick={() => setWeek(index)}
              >
                {label}
              </button>
            ))}
          </div>
          <p className="twin-note">
            {counts.shown} of {counts.total} promises were made{' '}
            {bucket ? String(bucket.label).toLowerCase() : String(labels[week]).toLowerCase()}.
          </p>
        </>
      )}
    </>
  );
}

function TwinMount() {
  const { items, norms, weeks, loading, error, reload } = useTwin();
  const onOpen = useCallback((id) => {
    if (window.Latent && typeof window.Latent.openReceipt === 'function') window.Latent.openReceipt(id);
  }, []);

  useEffect(() => {
    window.LatentTwin = { reload };
    return () => {
      if (window.LatentTwin && window.LatentTwin.reload === reload) delete window.LatentTwin;
    };
  }, [reload]);

  return <TwinChrome items={items} norms={norms} weeks={weeks} loading={loading} error={error} onOpen={onOpen} />;
}

const mount = document.getElementById('twin');
if (mount) createRoot(mount).render(<TwinMount />);
