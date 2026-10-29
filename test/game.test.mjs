import test from 'node:test';
import assert from 'node:assert/strict';
import * as G from '../src/game.js';

test('day starts with the spoons for the body read', () => {
  assert.equal(G.createDay({ seed: 1, read: 'green' }).spoons.length, 12);
  assert.equal(G.createDay({ seed: 1, read: 'red' }).spoons.length, 5);
});

test('same seed, same day', () => {
  const a = G.createDay({ seed: 42 }), b = G.createDay({ seed: 42 });
  assert.deepEqual(a.deck.map((d) => d.title), b.deck.map((d) => d.title));
  assert.deepEqual(a.flareTimes, b.flareTimes);
});

test('demands spawn, cap at MAX_ACTIVE, and expire into missed', () => {
  const s = G.createDay({ seed: 3 });
  for (let i = 0; i < 2000 && s.phase === 'play'; i++) G.step(s, 0.25);
  assert.equal(s.phase, 'end');
  assert.ok(s.missed.length > 0);
  assert.ok(s.active.length === 0);
});

test('paying cost completes a demand and consumes spoons', () => {
  const s = G.createDay({ seed: 5, read: 'green' });
  G.step(s, 15);
  const d = s.active[0];
  assert.ok(d, 'a demand spawned');
  const before = s.spoons.length;
  let ev = [];
  for (let i = 0; i < d.cost; i++) ev = G.pay(s, d.id, s.spoons.find((x) => !x.bent).id);
  assert.equal(s.spoons.length, before - d.cost);
  assert.ok(ev.some((e) => e.type === 'done'));
  assert.ok(s.done.includes(d));
});

test('bent spoons cannot pay; rest straightens them first', () => {
  const s = G.createDay({ seed: 7 });
  G.step(s, 15);
  s.spoons[0].bent = true;
  const d = s.active[0];
  assert.equal(G.pay(s, d.id, s.spoons[0].id)[0].type, 'reject');
  const ev = G.rest(s, G.REST_SECONDS);
  assert.equal(ev[0].type, 'straightened');
  assert.equal(s.spoons[0].bent, false);
});

test('rest recovers up to max only', () => {
  const s = G.createDay({ seed: 8, read: 'red' });
  G.step(s, 15);
  const d = s.active[0];
  G.pay(s, d.id, s.spoons[0].id);
  assert.equal(G.rest(s, G.REST_SECONDS)[0].type, 'recovered');
  assert.equal(G.rest(s, G.REST_SECONDS)[0].type, 'rested-full');
});

test('borrowing costs tomorrow with interest, deferred work carries over', () => {
  const s = G.createDay({ seed: 9, read: 'yellow' });
  G.step(s, 15);
  G.borrow(s);
  const d = s.active[0];
  G.defer(s, d.id);
  for (let i = 0; i < 4000 && s.phase === 'play'; i++) G.step(s, 0.25);
  const sum = G.summary(s);
  assert.equal(sum.owed, G.BORROW_INTEREST);
  const t = G.nextDay(s, 'yellow');
  assert.equal(t.spoons.length, G.READS.yellow.spoons - G.BORROW_INTEREST);
  assert.equal(t.deck[0].title, d.title);
  assert.ok(t.deck[0].carried);
});

test('dropping a must records its consequence', () => {
  const s = G.createDay({ seed: 11 });
  for (let i = 0; i < 400 && s.phase === 'play'; i++) {
    G.step(s, 0.5);
    for (const d of s.active.slice()) if (d.kind === 'must') G.drop(s, d.id);
  }
  for (let i = 0; i < 4000 && s.phase === 'play'; i++) G.step(s, 0.25);
  assert.ok(G.summary(s).consequences.length > 0);
});

test('clock runs 8 AM to 10 PM', () => {
  const s = G.createDay({ seed: 1 });
  assert.equal(G.clock(s), '8:00 AM');
  s.t = G.DAY_SECONDS;
  assert.equal(G.clock(s), '10:00 PM');
});
