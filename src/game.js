// SPOONS: pure game logic. No three.js, no DOM. Deterministic from a seed.
// Spoon theory credit: Christine Miserandino (butyoudontlooksick.com).

export const DAY_SECONDS = 420; // one in-game day = 7 real minutes
export const REST_SECONDS = 6; // hold rest this long to recover one spoon
export const MAX_ACTIVE = 3;
export const BORROW_INTEREST = 2; // each borrowed spoon costs this many tomorrow

export const READS = {
  green: { spoons: 12, flares: 1, label: 'Good-ish day' },
  yellow: { spoons: 8, flares: 2, label: 'Careful day' },
  red: { spoons: 5, flares: 3, label: 'Flare day' },
};

// kind: must (consequence if missed), should (costs you later), want (joy)
const POOL = [
  { title: 'Eat something real', kind: 'must', cost: 1, life: 70, miss: 'Running on empty.' },
  { title: 'Take your meds', kind: 'must', cost: 1, life: 60, miss: 'Pain tomorrow.' },
  { title: 'Shower', kind: 'must', cost: 2, life: 90, miss: 'Skipped. Again.' },
  { title: 'Answer the DHS letter', kind: 'must', cost: 3, life: 80, miss: 'Benefits paused.' },
  { title: 'Call Medicaid about the denial', kind: 'must', cost: 4, life: 85, miss: 'Denial stands.' },
  { title: 'Pay rent in the portal', kind: 'must', cost: 2, life: 75, miss: 'Late fee.' },
  { title: 'Refill prescription', kind: 'must', cost: 2, life: 70, miss: 'Rationing pills.' },
  { title: 'Job application', kind: 'should', cost: 3, life: 80, miss: 'Posting closed.' },
  { title: 'Reply to the recruiter', kind: 'should', cost: 1, life: 55, miss: 'They moved on.' },
  { title: 'Book the dentist', kind: 'should', cost: 3, life: 70, miss: 'Tooth still hurts.' },
  { title: 'Laundry', kind: 'should', cost: 2, life: 80, miss: 'Wearing it twice.' },
  { title: 'Dishes', kind: 'should', cost: 2, life: 80, miss: 'Sink wins.' },
  { title: 'Text a friend back', kind: 'want', cost: 1, life: 60, miss: 'Left on read.' },
  { title: 'Work on your project', kind: 'want', cost: 3, life: 80, miss: 'Another day, maybe.' },
  { title: 'Go outside for ten minutes', kind: 'want', cost: 2, life: 70, miss: 'Saw the sun through glass.' },
  { title: 'Read something for fun', kind: 'want', cost: 1, life: 60, miss: 'Book still waiting.' },
];

const SELAH = [
  'Rest was on the list too. You just could not see it.',
  'You did not fail the day. The day was priced wrong.',
  'Every spoon you saved was a decision, not a weakness.',
  'Tomorrow does not owe you more spoons. Plan like it.',
  'Choosing is the work. You did the work.',
];

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function dailySeed(date = new Date()) {
  return date.getFullYear() * 10000 + (date.getMonth() + 1) * 100 + date.getDate();
}

function shuffle(arr, rnd) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function createDay({ seed = dailySeed(), read = 'yellow', carry = [], owed = 0 } = {}) {
  const rnd = mulberry32(seed);
  const cfg = READS[read] || READS.yellow;
  const start = Math.max(2, cfg.spoons - owed);
  // Deck: carried-over items first (they come back), then a seeded pick of 10.
  const picks = shuffle(POOL, rnd).slice(0, 10 - Math.min(carry.length, 4));
  const deck = [...carry.slice(0, 4), ...picks].map((d, i) => ({
    id: `d${i}`,
    title: d.title,
    kind: d.kind,
    cost: d.cost,
    life: d.life,
    miss: d.miss,
    paid: 0,
    age: 0,
    carried: carry.includes(d),
  }));
  // Spread spawns over the first ~85% of the day.
  const spawnTimes = deck.map((_, i) => Math.round((i / deck.length) * DAY_SECONDS * 0.85 + rnd() * 12));
  const flareTimes = Array.from({ length: cfg.flares }, () => Math.round(40 + rnd() * (DAY_SECONDS - 80))).sort((a, b) => a - b);
  return {
    seed, read, rnd,
    t: 0,
    phase: 'play',
    maxSpoons: start,
    spoons: Array.from({ length: start }, (_, i) => ({ id: `s${i}`, bent: false })),
    nextSpoonId: start,
    deck, spawnTimes, flareTimes,
    active: [], done: [], tomorrow: [], missed: [], dropped: [],
    borrowed: 0, restProgress: 0, rested: 0,
  };
}

export const usableSpoons = (s) => s.spoons.filter((x) => !x.bent).length;

// Advance time. Returns a list of events for the presentation layer.
export function step(s, dt) {
  const ev = [];
  if (s.phase !== 'play') return ev;
  s.t += dt;
  while (s.spawnTimes.length && s.t >= s.spawnTimes[0] && s.active.length < MAX_ACTIVE) {
    s.spawnTimes.shift();
    const d = s.deck.shift();
    s.active.push(d);
    ev.push({ type: 'spawn', demand: d });
  }
  for (const d of s.active.slice()) {
    d.age += dt;
    if (d.age >= d.life) {
      remove(s.active, d);
      s.missed.push(d);
      ev.push({ type: 'missed', demand: d });
    }
  }
  while (s.flareTimes.length && s.t >= s.flareTimes[0]) {
    s.flareTimes.shift();
    const straight = s.spoons.filter((x) => !x.bent);
    const n = Math.min(straight.length, 1 + Math.floor(s.rnd() * 2));
    const hit = [];
    for (let i = 0; i < n; i++) { straight[i].bent = true; hit.push(straight[i].id); }
    ev.push({ type: 'flare', spoonIds: hit });
  }
  const outOfDeck = !s.deck.length && !s.active.length;
  if (s.t >= DAY_SECONDS || outOfDeck) {
    for (const d of s.active) s.tomorrow.push(d);
    s.active = [];
    s.phase = 'end';
    ev.push({ type: 'end', summary: summary(s) });
  }
  return ev;
}

// Spend one usable spoon on a demand. Returns events.
export function pay(s, demandId, spoonId) {
  const d = s.active.find((x) => x.id === demandId);
  const sp = s.spoons.find((x) => x.id === spoonId);
  if (!d || !sp || sp.bent) return [{ type: 'reject', demandId, spoonId }];
  remove(s.spoons, sp);
  d.paid += 1;
  const ev = [{ type: 'paid', demand: d, spoonId }];
  if (d.paid >= d.cost) {
    remove(s.active, d);
    s.done.push(d);
    ev.push({ type: 'done', demand: d });
  }
  return ev;
}

export function defer(s, demandId) {
  const d = s.active.find((x) => x.id === demandId);
  if (!d) return [];
  remove(s.active, d);
  s.tomorrow.push(d);
  return [{ type: 'deferred', demand: d }];
}

export function drop(s, demandId) {
  const d = s.active.find((x) => x.id === demandId);
  if (!d) return [];
  remove(s.active, d);
  s.dropped.push(d);
  return [{ type: 'dropped', demand: d }];
}

// Call every frame while the player holds the rest pillow. Time keeps moving.
// Rest is a gamble: each cycle takes a different amount of time, and sometimes it
// just doesn't help. Worse days make rest less reliable.
export const REST_ODDS = { green: 0.7, yellow: 0.55, red: 0.42 };
export function restNeed(s) {
  if (!s.restNeed) s.restNeed = REST_SECONDS * (0.65 + s.rnd() * 0.9); // ~4 to ~9 seconds
  return s.restNeed;
}
export function rest(s, dt) {
  if (s.phase !== 'play') return [];
  s.restProgress += dt;
  if (s.restProgress < restNeed(s)) return [];
  s.restProgress = 0;
  s.restNeed = 0;
  s.rested += 1;
  const roll = s.rnd();
  if (roll > (REST_ODDS[s.read] ?? 0.55)) { s.restMisses = (s.restMisses || 0) + 1; return [{ type: 'rest-nothing' }]; }
  const ev = [];
  const gains = roll < 0.1 ? 2 : 1; // now and then rest gives back more than you asked
  for (let i = 0; i < gains; i++) {
    const bent = s.spoons.find((x) => x.bent);
    if (bent) { bent.bent = false; ev.push({ type: 'straightened', spoonId: bent.id }); continue; }
    if (s.spoons.length < s.maxSpoons) {
      const sp = { id: `s${s.nextSpoonId++}`, bent: false };
      s.spoons.push(sp);
      ev.push({ type: 'recovered', spoonId: sp.id });
    }
  }
  return ev.length ? ev : [{ type: 'rested-full' }];
}

export function stopRest(s) { s.restProgress = 0; }
export const restFraction = (s) => s.restProgress / restNeed(s);

// Pull a spoon from tomorrow. Always works. Always costs.
export function borrow(s) {
  if (s.phase !== 'play') return [];
  const sp = { id: `s${s.nextSpoonId++}`, bent: false, borrowed: true };
  s.spoons.push(sp);
  s.borrowed += 1;
  return [{ type: 'borrowed', spoonId: sp.id }];
}

export function clock(s) {
  // 8:00 AM to 10:00 PM mapped across the day
  const mins = 8 * 60 + Math.floor((Math.min(s.t, DAY_SECONDS) / DAY_SECONDS) * 14 * 60);
  const h = Math.floor(mins / 60), m = mins % 60;
  const h12 = ((h + 11) % 12) + 1;
  return `${h12}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
}

export function summary(s) {
  const mustMissed = [...s.missed, ...s.dropped].filter((d) => d.kind === 'must');
  const joy = s.done.filter((d) => d.kind === 'want').length;
  const owed = s.borrowed * BORROW_INTEREST;
  return {
    done: s.done.length,
    tomorrow: s.tomorrow.length,
    missed: s.missed.length,
    dropped: s.dropped.length,
    joy,
    rested: s.rested,
    restMisses: s.restMisses || 0,
    borrowed: s.borrowed,
    owed,
    consequences: mustMissed.map((d) => d.miss),
    selah: SELAH[s.seed % SELAH.length],
  };
}

// Build the next day from this one: deferred work comes back, borrowing is repaid.
export function nextDay(s, read) {
  return createDay({ seed: s.seed + 1, read, carry: s.tomorrow, owed: s.borrowed * BORROW_INTEREST });
}

function remove(arr, x) { const i = arr.indexOf(x); if (i >= 0) arr.splice(i, 1); }
