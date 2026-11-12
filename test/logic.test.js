'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');
const {
  parsePairs, formatPairs, parseImportedList, splitAnswer, createMatch,
  advanceMatch, undoMatch, availableBricks, toggleBrick, nextBrickPlacement, placeNextBrick,
  solutionBricks, toggleAnswer, validMatch, restoreMatch, buildPrompt
} = require('../logic');

const fixtures = Array.from({ length: 8 }, (_, index) => ({
  answer: `Ein langer Satz über Thema ${index + 1}.`,
  cue: `Indice ${index + 1}`
}));

test('accepts the old list format, spreadsheet tabs and quotes with internal separators', () => {
  const text = '\uFEFFAllemand ; Français\r\nIch spiele gern Tennis.; J’aime jouer au tennis.\r\n'
    + 'Wir schwimmen.\tNous nageons.\r\n'
    + '"Ja; natürlich" ; "Oui; « bien sûr »"\r\n';
  const parsed = parsePairs(text);
  assert.deepEqual(parsed.issues, []);
  assert.equal(parsed.pairs.length, 3);
  assert.deepEqual(parsed.pairs[2], { answer: 'Ja; natürlich', cue: 'Oui; « bien sûr »' });
  const pairs = [...parsed.pairs, { answer: 'a', cue: 'b\tc' }, { answer: '"Mot cité"', cue: 'Exemple' }];
  assert.deepEqual(parsePairs(formatPairs(pairs)).pairs, pairs);
});

test('reports original line numbers and ignores exact duplicates', () => {
  const parsed = parsePairs('\nEins; Un\n\tIndice sans réponse; autre texte\n\nEins; Un\nZwei; Deux');
  assert.equal(parsed.issues[0].line, 3);
  assert.equal(parsed.duplicates, 1);
  assert.deepEqual(parsed.pairs.map(pair => pair.answer), ['Eins', 'Zwei']);
});

test('imports comma CSV with quoted commas and semicolons', () => {
  const parsed = parseImportedList('"La Terre, notre planète","Un astre ; lequel ?"\n"Le Soleil","Une étoile ; laquelle ?"', 'liste.csv');
  assert.deepEqual(parsed.issues, []);
  assert.equal(parsed.pairs[0].answer, 'La Terre, notre planète');
  assert.equal(parsed.pairs[1].cue, 'Une étoile ; laquelle ?');
});

test('produces the requested number of bricks without breaking long words', () => {
  const answer = 'Heute schreiben wir Donaudampfschifffahrtsgesellschaft gemeinsam an die Tafel.';
  const parts = splitAnswer(answer, 5);
  assert.equal(parts.length, 5);
  assert.equal(parts.join(' '), answer);
  assert.ok(parts.some(part => part.includes('Donaudampfschifffahrtsgesellschaft')));
  assert.deepEqual(splitAnswer('Quel plaisir !', 5), ['Quel', 'plaisir !']);
  assert.equal(splitAnswer('我喜欢和朋友一起学习。', 3).join(''), '我喜欢和朋友一起学习。');
});

test('a point advances only its team and undo restores the previous bricks and score', () => {
  const original = createMatch(fixtures, { goal: 3, parts: 5 }, () => .4);
  const next = advanceMatch(original, 0, true, () => .4);
  assert.equal(next.teams[0].score, 1);
  assert.notEqual(next.teams[0].index, original.teams[0].index);
  assert.strictEqual(next.teams[1], original.teams[1]);
  assert.deepEqual(undoMatch(next), original);
  assert.ok(validMatch(JSON.parse(JSON.stringify(next))));
});

test('validating remixes the shared pool, including the relative order of the other team', () => {
  const original = createMatch(fixtures, { parts: 4 }, () => .4);
  const advanced = advanceMatch(original, 0, true, () => .7);
  assert.notDeepEqual(advanced.order.map(slot => slot.side), original.order.map(slot => slot.side));
  assert.notDeepEqual(advanced.order.filter(slot => slot.side === 1), original.order.filter(slot => slot.side === 1));
  assert.ok(validMatch(advanced));

  const minimal = createMatch([{ answer: 'Oui', cue: 'Ja' }, { answer: 'Non', cue: 'Nein' }], {}, () => .9);
  const flipped = advanceMatch(minimal, 0, true, () => .9);
  assert.deepEqual(flipped.order.map(slot => slot.side), minimal.order.map(slot => slot.side).reverse());
});

test('click placement keeps the selection order, allows removal, and preserves the opponent’s work', () => {
  const initial = createMatch(fixtures, { clickToBuild: true, parts: 4 }, () => .4);
  let match = toggleBrick(initial, 0, 2);
  match = toggleBrick(match, 0, 0);
  match = toggleBrick(match, 1, 1);
  assert.deepEqual(match.teams[0].placed, [2, 0]);
  assert.deepEqual(availableBricks(match).filter(slot => slot.side === 0).map(slot => slot.index).sort(), [1, 3]);
  match = toggleBrick(match, 0, 2);
  assert.deepEqual(match.teams[0].placed, [0]);
  const advanced = advanceMatch(match, 0, true, () => .6);
  assert.deepEqual(advanced.teams[0].placed, []);
  assert.deepEqual(advanced.teams[1].placed, [1]);
  const morePlaced = toggleBrick(advanced, 1, 0);
  const undone = undoMatch(morePlaced);
  assert.deepEqual(undone.teams[0].placed, [0]);
  assert.deepEqual(undone.teams[1].placed, [1, 0]);
  assert.ok(validMatch(JSON.parse(JSON.stringify(undone))));
  const oral = createMatch(fixtures);
  assert.strictEqual(toggleBrick(oral, 0, 0), oral);
});

test('the hint places one correct brick at a time for either team', () => {
  const original = createMatch(fixtures, { clickToBuild: true, parts: 4 }, () => .4);
  const first = placeNextBrick(original, 1);
  assert.deepEqual(first.teams[1].placed, [solutionBricks(original, 1)[0].index]);
  assert.strictEqual(first.teams[0], original.teams[0]);
  assert.equal(first.teams[1].score, 0);
  assert.strictEqual(first.history, original.history);
  let completed = first;
  for (let i = 1; i < 4; i++) completed = placeNextBrick(completed, 1);
  assert.deepEqual(completed.teams[1].placed, solutionBricks(original, 1).map(brick => brick.index));
  assert.equal(nextBrickPlacement(completed, 1), null);
  assert.strictEqual(placeNextBrick(completed, 1), completed);
  const oral = createMatch(fixtures);
  assert.strictEqual(placeNextBrick(oral, 1), oral);
});

test('the hint fixes the first wrong position and preserves the other placements', () => {
  const original = createMatch(fixtures, { clickToBuild: true, parts: 4 }, () => .4);
  const [first, second, third, fourth] = solutionBricks(original, 0).map(brick => brick.index);
  let match = toggleBrick(original, 0, first);
  match = toggleBrick(match, 0, fourth);
  match = toggleBrick(match, 0, third);
  const corrected = placeNextBrick(match, 0);
  assert.deepEqual(corrected.teams[0].placed, [first, second, third]);
  assert.ok(availableBricks(corrected).some(slot => slot.side === 0 && slot.index === fourth));

  const misordered = toggleBrick(toggleBrick(original, 0, second), 0, first);
  const swapped = placeNextBrick(misordered, 0);
  assert.deepEqual(swapped.teams[0].placed, [first, second]);
  assert.ok(validMatch(swapped));
});

test('the hint recognizes a correct prefix that uses interchangeable identical bricks', () => {
  const original = createMatch([{ answer: 'la la la', cue: 'Un refrain' }, { answer: 'da da da', cue: 'Un autre' }], { clickToBuild: true }, () => .4);
  const last = solutionBricks(original, 0).at(-1).index;
  const placed = toggleBrick(original, 0, last);
  const hinted = placeNextBrick(placed, 0);
  assert.equal(hinted.teams[0].placed[0], last);
  assert.equal(new Set(hinted.teams[0].placed).size, 2);
});

test('the solution assigns distinct brick positions even for repeated words', () => {
  const match = createMatch([{ answer: 'la la la', cue: 'Un refrain' }, { answer: 'da da da', cue: 'Un autre' }], {}, () => .4);
  const solved = solutionBricks(match, 0);
  assert.equal(new Set(solved.map(brick => brick.index)).size, 3);
  assert.ok(solved.every(brick => brick.text === match.teams[0].bricks[brick.index]));
  assert.equal(solved.map(brick => brick.text).join(' '), match.pairs[match.teams[0].index].answer);
});

test('restores a 2.0 match and its undo history from the old color-only order', () => {
  const original = createMatch(fixtures, { parts: 3 }, () => .4);
  const advanced = advanceMatch(original, 0, true, () => .6);
  function legacyBoard(board) {
    return {
      teams: board.teams.map((team, side) => {
        const { placed, ...saved } = team;
        return { ...saved, bricks: board.order.filter(slot => slot.side === side).map(slot => team.bricks[slot.index]) };
      }),
      order: board.order.map(slot => slot.side),
      winner: board.winner
    };
  }
  const restored = restoreMatch({ ...advanced, ...legacyBoard(advanced), version: 1, history: advanced.history.map(legacyBoard) });
  assert.ok(validMatch(restored));
  assert.equal(restored.clickToBuild, false);
  assert.deepEqual(restored.teams.map(team => team.score), [1, 0]);
  const text = board => board.order.map(({ side, index }) => board.teams[side].bricks[index]);
  assert.deepEqual(text(restored), text(advanced));
  assert.deepEqual(text(undoMatch(restored)), text(original));
  assert.equal(restoreMatch({ ...restored, order: Array(restored.order.length).fill(restored.order[0]) }), null);
});

test('exhausts each team deck before repeating and can skip or show an answer', () => {
  let match = createMatch(fixtures, { goal: 12 }, () => .5);
  const seen = new Set([match.teams[0].index]);
  const other = match.teams[1].index;
  match = toggleAnswer(match, 0);
  assert.equal(match.teams[0].revealed, true);
  while (match.teams[0].queue.length) {
    match = advanceMatch(match, 0, false, () => .5);
    assert.ok(!seen.has(match.teams[0].index));
    seen.add(match.teams[0].index);
  }
  assert.equal(seen.size, 4);
  assert.equal(match.teams[0].score, 0);
  assert.equal(match.teams[0].revealed, false);
  assert.equal(match.teams[1].index, other);
  const next = advanceMatch(match, 0, false, () => .5);
  assert.notEqual(next.teams[0].index, match.teams[0].index);
});

test('reaching the chosen goal ends the match and undo reopens it', () => {
  let match = createMatch(fixtures, { goal: 3 });
  for (let point = 0; point < 3; point++) match = advanceMatch(match, 1, true);
  assert.equal(match.winner, 1);
  assert.equal(match.teams[1].score, 3);
  assert.strictEqual(advanceMatch(match, 0, true), match);
  const undone = undoMatch(match);
  assert.equal(undone.teams[1].score, 2);
  assert.equal(undone.winner, null);
  assert.ok(validMatch(match));
  assert.ok(!validMatch({ ...match, winner: 0 }));
});

test('prompt reflects the subject, theme, level and activity type', () => {
  const prompt = buildPrompt({
    subject: 'Sciences', theme: 'Cycle de l’eau', level: '11e', count: '8', mode: 'clue',
    answerLanguage: 'français', cueLanguage: 'français', instructions: 'Employer le vocabulaire du chapitre'
  });
  assert.match(prompt, /exactement 8 paires/);
  assert.match(prompt, /Sciences.*Cycle de l’eau.*11e/u);
  assert.match(prompt, /question ou une reformulation/);
  assert.match(prompt, /Réponse ; Indice/);
});
