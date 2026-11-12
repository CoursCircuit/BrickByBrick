'use strict';

(function (root) {
  const MAX_PAIRS = 300;
  const MAX_ANSWER = 240;
  const MAX_CUE = 360;
  const MAX_DRAFT = 200_000;
  const GOALS = [3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
  const PARTS = [2, 3, 4, 5];
  const DEFAULT_NAMES = ['Équipe verte', 'Équipe orange'];
  const HISTORY_LIMIT = 20;

  function delimiterIndex(line, delimiter) {
    let quoted = false;
    let fieldStart = true;
    for (let index = 0; index < line.length; index++) {
      const character = line[index];
      if (quoted) {
        if (character === '"' && line[index + 1] === '"') index++;
        else if (character === '"') quoted = false;
      } else {
        if (character === delimiter) return index;
        if (character === '"' && fieldStart) quoted = true;
        if (character === ';' || character === ',' || character === '\t') fieldStart = true;
        else if (/\S/u.test(character)) fieldStart = false;
      }
    }
    return -1;
  }

  function unquote(text) {
    const cell = text.trim();
    if (cell.length > 1 && cell.startsWith('"') && cell.endsWith('"')) {
      return cell.slice(1, -1).replaceAll('""', '"').trim();
    }
    return cell;
  }

  function parsePairs(input, separator) {
    const pairs = [];
    const issues = [];
    let duplicates = 0;
    if (input.length > MAX_DRAFT) {
      return { pairs, issues: [{ message: 'Le texte est trop volumineux.' }], duplicates };
    }

    const lines = input.replace(/^\uFEFF/u, '').split(/\r\n|\n|\r/u);
    const seen = new Set();
    let firstRow = true;
    for (const [index, original] of lines.entries()) {
      const line = original.replace(/^[^\S\t]+|[^\S\t]+$/gu, '');
      if (!line.trim() || /^\x60{3}(?:text|txt|csv|tsv)?$/iu.test(line)) continue;
      const delimiter = separator || (delimiterIndex(line, '\t') >= 0 ? '\t' : ';');
      const split = delimiterIndex(line, delimiter);
      const answer = split < 0 ? '' : unquote(line.slice(0, split));
      const cue = split < 0 ? '' : unquote(line.slice(split + 1));
      const header = firstRow && /^(réponse|reponse|allemand|answer)$/iu.test(answer)
        && /^(indice|français|francais|traduction|clue|translation)$/iu.test(cue);
      firstRow = false;
      if (header) continue;

      if (!answer || !cue) {
        issues.push({ line: index + 1, message: 'Indiquez une réponse et un indice séparés par un point-virgule ou une tabulation.' });
        continue;
      }
      if (answer.length > MAX_ANSWER || cue.length > MAX_CUE) {
        issues.push({ line: index + 1, message: `Limite de ${MAX_ANSWER} caractères pour la réponse et ${MAX_CUE} pour l’indice.` });
        continue;
      }

      const key = JSON.stringify([answer.normalize(), cue.normalize()]);
      if (seen.has(key)) {
        duplicates++;
        continue;
      }
      if (pairs.length === MAX_PAIRS) {
        issues.push({ line: index + 1, message: `Une liste peut contenir jusqu’à ${MAX_PAIRS} phrases.` });
        break;
      }
      seen.add(key);
      pairs.push({ answer, cue });
    }
    return { pairs, issues, duplicates };
  }

  function formatPairs(pairs) {
    const cell = text => /[;"\t]/u.test(text) ? '"' + text.replaceAll('"', '""') + '"' : text;
    return pairs.map(({ answer, cue }) => cell(answer) + ' ; ' + cell(cue)).join('\n');
  }

  function parseImportedList(text, filename) {
    const standard = parsePairs(text);
    if (!/\.csv$/iu.test(filename)) return standard;
    const firstLine = text.replace(/^\uFEFF/u, '').split(/\r\n|\n|\r/u).find(line => line.trim()) ?? '';
    const quotedComma = /^\s*"(?:[^"]|"")*"\s*,/u.test(firstLine);
    const commaHeader = /^\s*(?:réponse|reponse|answer|allemand)\s*,\s*(?:indice|clue|français|francais|traduction|translation)\s*$/iu.test(firstLine);
    if (!quotedComma && !commaHeader && standard.pairs.length && !standard.issues.length) return standard;
    const commaSeparated = parsePairs(text, ',');
    return commaSeparated.pairs.length && !commaSeparated.issues.length ? commaSeparated : standard;
  }

  function shuffle(items, random = Math.random) {
    const copy = [...items];
    for (let index = copy.length - 1; index > 0; index--) {
      const other = Math.floor(random() * (index + 1));
      [copy[index], copy[other]] = [copy[other], copy[index]];
    }
    return copy;
  }

  function wordBoundaries(text) {
    const words = Array.from(text.matchAll(/\S+/gu));
    if (words.length === 1 && /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Thai}\p{Script=Lao}\p{Script=Khmer}]/u.test(text)
      && typeof Intl.Segmenter === 'function') {
      const segments = new Intl.Segmenter(undefined, { granularity: 'word' }).segment(text);
      return [0, ...Array.from(segments).filter(word => word.isWordLike && word.index > 0
        && /[\p{L}\p{N}]/u.test(text.slice(0, word.index))).map(word => word.index)];
    }

    const starts = [0];
    for (let index = 1; index < words.length; index++) {
      const current = words[index][0];
      const previous = words[index - 1][0];
      if (/^[\p{P}\p{S}]+$/u.test(current) && !/^[«“‘(\[{]+$/u.test(current)) continue;
      if (/^[«“‘(\[{]+$/u.test(previous)) continue;
      starts.push(words[index].index);
    }
    return starts;
  }

  function splitAnswer(answer, requestedParts) {
    const text = answer.trim();
    if (!text) return [];
    const boundaries = [...wordBoundaries(text), text.length];
    const wordCount = boundaries.length - 1;
    const count = Math.min(wordCount, requestedParts);
    const target = text.length / count;
    const costs = Array.from({ length: count + 1 }, () => Array(wordCount + 1).fill(Infinity));
    const cuts = Array.from({ length: count + 1 }, () => Array(wordCount + 1).fill(0));
    costs[0][0] = 0;

    // Minimize the variation in brick lengths while keeping words together.
    for (let part = 1; part <= count; part++) {
      for (let end = part; end <= wordCount - (count - part); end++) {
        for (let start = part - 1; start < end; start++) {
          const length = boundaries[end] - boundaries[start];
          const cost = costs[part - 1][start] + (length - target) ** 2;
          if (cost >= costs[part][end]) continue;
          costs[part][end] = cost;
          cuts[part][end] = start;
        }
      }
    }

    const result = [];
    let end = wordCount;
    for (let part = count; part > 0; part--) {
      const start = cuts[part][end];
      result.unshift(text.slice(boundaries[start], boundaries[end]).trim());
      end = start;
    }
    return result;
  }

  function nextPhrase(team, pairs, parts, random) {
    const queue = team.queue.length ? [...team.queue] : shuffle(team.deck, random);
    if (queue.length > 1 && queue[0] === team.index) [queue[0], queue[1]] = [queue[1], queue[0]];
    const index = queue.shift();
    const chunks = splitAnswer(pairs[index].answer, parts);
    const bricks = shuffle(chunks, random);
    const different = chunks.findIndex(chunk => chunk !== chunks[0]);
    if (different >= 0 && bricks.every((brick, position) => brick === chunks[position])) {
      [bricks[0], bricks[different]] = [bricks[different], bricks[0]];
    }
    return { ...team, index, queue, bricks, placed: [], revealed: false };
  }

  function availableBricks({ order, teams }) {
    return order.filter(({ side, index }) => !teams[side].placed.includes(index));
  }

  function mixBricks(teams, random, previous) {
    const order = shuffle(teams.flatMap((team, side) => team.bricks.map((_, index) => ({ side, index }))), random);
    if (!previous) return order;

    const visible = availableBricks({ teams, order });
    if (visible.length === previous.length && visible.every((slot, index) => slot.side === previous[index].side)) {
      // A lucky draw can reproduce the old color pattern. Swap two visible bricks in that case.
      const jade = visible.filter(slot => slot.side === 0);
      const amber = visible.filter(slot => slot.side === 1);
      if (jade.length && amber.length) {
        const left = order.indexOf(jade[Math.floor(random() * jade.length)]);
        const right = order.indexOf(amber[Math.floor(random() * amber.length)]);
        [order[left], order[right]] = [order[right], order[left]];
      }
    }
    return order;
  }

  function createMatch(pairs, { names = DEFAULT_NAMES, goal = 6, parts = 3, title = 'Partie libre', clickToBuild = false } = {}, random = Math.random) {
    if (pairs.length < 2) throw new RangeError('Au moins deux phrases sont nécessaires.');
    const shuffled = shuffle(pairs.map((_, index) => index), random);
    const teams = names.map((name, side) => {
      const deck = shuffled.filter((_, index) => index % 2 === side);
      return nextPhrase({ name, score: 0, deck, queue: [], index: -1 }, pairs, parts, random);
    });
    const order = mixBricks(teams, random);
    return { version: 2, pairs, title, goal, parts, clickToBuild, teams, order, winner: null, history: [] };
  }

  function advanceMatch(match, side, scorePoint, random = Math.random) {
    if (match.winner !== null || (side !== 0 && side !== 1)) return match;
    const { teams, order, winner } = match;
    const history = [...match.history.slice(1 - HISTORY_LIMIT), { teams, order, winner, side }];
    const updated = [...teams];
    const team = teams[side];
    const score = team.score + Number(scorePoint);

    if (score >= match.goal) {
      updated[side] = { ...team, score };
      return { ...match, teams: updated, winner: side, history };
    }
    updated[side] = nextPhrase({ ...team, score }, match.pairs, match.parts, random);
    return { ...match, teams: updated, order: mixBricks(updated, random, availableBricks(match)), history };
  }

  function undoMatch(match) {
    const previous = match.history.at(-1);
    if (!previous) return match;
    const teams = match.clickToBuild && previous.side !== undefined
      ? previous.teams.map((team, side) => side === previous.side ? team : match.teams[side])
      : previous.teams;
    return { ...match, teams, order: previous.order, winner: previous.winner, history: match.history.slice(0, -1) };
  }

  function toggleBrick(match, side, index) {
    if (!match.clickToBuild || match.winner !== null || (side !== 0 && side !== 1)) return match;
    const team = match.teams[side];
    if (!Number.isInteger(index) || index < 0 || index >= team.bricks.length) return match;
    const placed = team.placed.includes(index) ? team.placed.filter(brick => brick !== index) : [...team.placed, index];
    return withPlacedBricks(match, side, placed);
  }

  function withPlacedBricks(match, side, placed) {
    const teams = [...match.teams];
    teams[side] = { ...teams[side], placed };
    return { ...match, teams };
  }

  function nextBrickPlacement(match, side) {
    if (!match.clickToBuild || match.winner !== null || (side !== 0 && side !== 1)) return null;
    const team = match.teams[side];
    const ordered = splitAnswer(match.pairs[team.index].answer, match.parts);
    const position = ordered.findIndex((text, index) => text !== team.bricks[team.placed[index]]);
    if (position < 0) return null;

    const expected = ordered[position];
    const reserve = team.bricks.findIndex((text, index) => text === expected && !team.placed.includes(index));
    const placed = [...team.placed];
    if (reserve >= 0) {
      placed[position] = reserve;
    } else {
      const later = placed.findIndex((index, offset) => offset > position && team.bricks[index] === expected);
      if (later < 0) return null;
      [placed[position], placed[later]] = [placed[later], placed[position]];
    }
    return placed;
  }

  function placeNextBrick(match, side) {
    const placed = nextBrickPlacement(match, side);
    return placed ? withPlacedBricks(match, side, placed) : match;
  }

  function solutionBricks(match, side) {
    const team = match.teams[side];
    const available = team.bricks.map((_, index) => index);
    return splitAnswer(match.pairs[team.index].answer, match.parts).map(text => {
      const offset = available.findIndex(index => team.bricks[index] === text);
      return { text, index: offset < 0 ? -1 : available.splice(offset, 1)[0] };
    });
  }

  function toggleAnswer(match, side) {
    if (match.winner !== null || (side !== 0 && side !== 1)) return match;
    const teams = [...match.teams];
    teams[side] = { ...teams[side], revealed: !teams[side].revealed };
    return { ...match, teams };
  }

  function validPair(pair) {
    return Boolean(pair && typeof pair.answer === 'string' && typeof pair.cue === 'string'
      && pair.answer.trim() && pair.cue.trim() && pair.answer.length <= MAX_ANSWER && pair.cue.length <= MAX_CUE
      && !/[\r\n]/u.test(pair.answer + pair.cue));
  }

  function validMatch(match) {
    if (!match || match.version !== 2 || typeof match.clickToBuild !== 'boolean'
      || !GOALS.includes(match.goal) || !PARTS.includes(match.parts)
      || !Array.isArray(match.pairs) || match.pairs.length < 2 || match.pairs.length > MAX_PAIRS
      || !match.pairs.every(validPair) || typeof match.title !== 'string' || match.title.length > 90
      || !Array.isArray(match.history) || match.history.length > HISTORY_LIMIT) return false;

    const validIndex = index => Number.isInteger(index) && index >= 0 && index < match.pairs.length;
    function validTeam(team) {
      return Boolean(team && typeof team.name === 'string' && team.name.trim() && team.name.length <= 36
        && Number.isInteger(team.score) && team.score >= 0 && team.score <= match.goal
        && validIndex(team.index) && Array.isArray(team.deck) && team.deck.every(validIndex) && team.deck.includes(team.index)
        && Array.isArray(team.queue) && team.queue.every(index => team.deck.includes(index))
        && Array.isArray(team.bricks) && team.bricks.length >= 1 && team.bricks.length <= match.parts
        && team.bricks.every(brick => typeof brick === 'string' && brick.trim() && brick.length <= MAX_ANSWER)
        && Array.isArray(team.placed) && (match.clickToBuild || !team.placed.length)
        && new Set(team.placed).size === team.placed.length
        && team.placed.every(index => Number.isInteger(index) && index >= 0 && index < team.bricks.length)
        && typeof team.revealed === 'boolean');
    }

    function validBoard(board) {
      if (!board || !Array.isArray(board.teams) || board.teams.length !== 2 || !board.teams.every(validTeam)
        || !Array.isArray(board.order) || (board.side !== undefined && board.side !== 0 && board.side !== 1)) return false;
      const slots = new Set();
      for (const slot of board.order) {
        if (!slot || (slot.side !== 0 && slot.side !== 1) || !Number.isInteger(slot.index)
          || slot.index < 0 || slot.index >= board.teams[slot.side].bricks.length) return false;
        slots.add(`${slot.side}:${slot.index}`);
      }
      const winningSide = board.teams.findIndex(team => team.score === match.goal);
      return board.winner === (winningSide === -1 ? null : winningSide)
        && slots.size === board.order.length
        && slots.size === board.teams[0].bricks.length + board.teams[1].bricks.length;
    }
    return validBoard(match) && match.history.every(validBoard);
  }

  function restoreMatch(saved) {
    if (saved?.version !== 1) return validMatch(saved) ? saved : null;
    if (!Array.isArray(saved.history)) return null;

    function migrateBoard(board) {
      if (!board || !Array.isArray(board.teams) || !Array.isArray(board.order)
        || !board.order.every(side => side === 0 || side === 1)) return null;
      const indices = [0, 0];
      return {
        teams: board.teams.map(team => ({ ...team, placed: [] })),
        order: board.order.map(side => ({ side, index: indices[side]++ })),
        winner: board.winner
      };
    }

    const board = migrateBoard(saved);
    if (!board) return null;
    const migrated = { ...saved, ...board, version: 2, clickToBuild: false, history: saved.history.map(migrateBoard) };
    return validMatch(migrated) ? migrated : null;
  }

  function buildPrompt({ subject, theme, level, count, answerLanguage, cueLanguage, mode, instructions }) {
    const quantity = Math.min(60, Math.max(2, Math.round(Number(count) || 12)));
    const language = answerLanguage.trim() || 'français';
    const clues = cueLanguage.trim() || 'français';
    const content = mode === 'translation'
      ? `Chaque réponse est une phrase naturelle en ${language}. Chaque indice en donne une traduction fidèle en ${clues}.`
      : `Chaque réponse est une phrase en ${language} qui exprime un fait ou une notion. L’indice est une question ou une reformulation en ${clues} qui guide vers cette réponse sans la révéler.`;
    return [
      `Crée exactement ${quantity} paires pour Brick by Brick, un jeu où des élèves reconstruisent une phrase à l’oral à partir de ses fragments.`,
      `Matière : ${subject.trim() || 'au choix'}. Thème : ${theme.trim() || 'un thème adapté aux élèves'}. Niveau : ${level.trim() || 'intermédiaire'}.`,
      content,
      'Vise des réponses de 4 à 12 mots et des indices courts, avec une difficulté comparable. Varie les formulations, vérifie les faits et évite les doublons.',
      instructions.trim() ? `Consigne pédagogique : ${instructions.trim()}` : '',
      'Rends uniquement les lignes de données, au format Réponse ; Indice. Une paire par ligne, un seul point-virgule par ligne, sans en-tête, numérotation, liste à puces ni bloc de code.'
    ].filter(Boolean).join('\n\n');
  }

  const api = {
    MAX_PAIRS, MAX_ANSWER, MAX_CUE, MAX_DRAFT, GOALS, PARTS, DEFAULT_NAMES,
    parsePairs, formatPairs, parseImportedList, splitAnswer, createMatch, advanceMatch, undoMatch,
    availableBricks, toggleBrick, nextBrickPlacement, placeNextBrick, solutionBricks, toggleAnswer,
    validPair, validMatch, restoreMatch, buildPrompt
  };
  if (typeof module === 'object') module.exports = api;
  else root.BrickLogic = api;
})(globalThis);
