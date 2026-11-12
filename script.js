'use strict';

(function () {
  const logic = globalThis.BrickLogic;
  const data = globalThis.BrickData;
  const ui = globalThis.BrickUI;
  const { byId } = ui;
  const setup = byId('setup');
  const game = byId('game');
  const draftInput = byId('phrase-input');
  const classSelect = byId('class-select');
  const goalSelect = byId('goal-select');
  const clickToBuildInput = byId('click-to-build');
  const help = byId('game-help');
  const victory = byId('winner-dialog');
  const solution = byId('solution-dialog');
  const solutionDuration = 2000;
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const sides = ['jade', 'amber'];
  const hintKeys = ['q', 'w'];
  let workspace;
  let match = null;
  let parsed;
  let draftTimer;
  let matchStorageWarning = false;

  function reportStorage(message) {
    ui.setStatus(byId('storage-notice'), message, Boolean(message));
  }

  try {
    workspace = data.readWorkspace(localStorage);
  } catch {
    workspace = data.defaultWorkspace();
    reportStorage('Les données locales n’ont pas pu être lues. Les listes d’exemple sont disponibles.');
  }

  try {
    const saved = localStorage.getItem(data.MATCH_KEY);
    if (saved) match = logic.restoreMatch(JSON.parse(saved));
  } catch {
    // The preparation workspace remains usable if the last match cannot be read.
  }

  function writeWorkspace(next = workspace) {
    try {
      localStorage.setItem(data.WORKSPACE_KEY, JSON.stringify(next));
      reportStorage('');
      return true;
    } catch {
      reportStorage('Impossible d’écrire dans le stockage local. Vérifiez l’espace disponible ou exportez une sauvegarde.');
      return false;
    }
  }

  function commit(next) {
    if (!writeWorkspace(next)) return false;
    clearTimeout(draftTimer);
    draftTimer = undefined;
    workspace = next;
    renderSetup();
    return true;
  }

  function saveDraft() {
    clearTimeout(draftTimer);
    draftTimer = undefined;
    writeWorkspace();
  }

  function currentClass() {
    return workspace.classes.find(classroom => classroom.id === workspace.settings.classId);
  }

  function activeList() {
    return workspace.lists.find(list => list.id === workspace.draft.listId);
  }

  function renderDraft() {
    const { text } = workspace.draft;
    if (draftInput.value !== text) draftInput.value = text;
    parsed = logic.parsePairs(text);
    const list = activeList();
    const source = byId('active-list');
    const modified = list && text !== logic.formatPairs(list.pairs);
    source.textContent = list ? list.name + (modified ? ' · modifiée' : '') : '';
    source.hidden = !list;
    const status = byId('phrase-status');
    status.textContent = ui.parseSummary(parsed);
    const errors = byId('phrase-errors');
    errors.hidden = !parsed.issues.length;
    draftInput.setAttribute('aria-invalid', String(Boolean(parsed.issues.length)));
    draftInput.setAttribute('aria-describedby', parsed.issues.length ? 'phrase-status phrase-error-count' : 'phrase-status');
    if (parsed.issues.length) {
      const count = parsed.issues.length;
      byId('phrase-error-count').textContent = count === 1 ? '1 ligne à corriger' : `${count} lignes à corriger`;
      const items = parsed.issues.slice(0, 8).map(issue => ui.element('li', '', ui.issueText(issue)));
      if (count > items.length) items.push(ui.element('li', '', `… et ${count - items.length} autres.`));
      byId('phrase-error-list').replaceChildren(...items);
    } else {
      errors.open = false;
    }

    const playable = parsed.pairs.length >= 2 && !parsed.issues.length;
    byId('start-game').disabled = !playable;
    byId('save-list').disabled = !parsed.pairs.length || Boolean(parsed.issues.length);
    const note = byId('play-note');
    if (parsed.issues.length) ui.setStatus(note, 'Corrigez les lignes signalées pour lancer la partie.', true);
    else if (!playable) ui.setStatus(note, 'Ajoutez au moins deux paires pour jouer.');
    else if (Math.floor(parsed.pairs.length / 2) < workspace.settings.goal) ui.setStatus(note, 'Les phrases se répètent en fin de pioche.');
    else ui.setStatus(note, '');
  }

  function renderSettings() {
    const { classId, guestNames, parts, goal, clickToBuild } = workspace.settings;
    const sorted = [...workspace.classes].sort((left, right) => left.name.localeCompare(right.name, 'fr'));
    ui.options(classSelect, [['', 'Partie libre'], ...sorted.map(item => [item.id, item.name])], classId ?? '');
    const classroom = currentClass();
    byId('guest-fields').hidden = Boolean(classroom);
    byId('group-fields').hidden = !classroom;
    if (classroom) {
      const selected = data.selectedGroups(classroom);
      sides.forEach((side, index) => {
        ui.options(byId('group-' + side), classroom.groups.map(group => [group.id, group.name]), selected[index]);
      });
    } else {
      sides.forEach((side, index) => { byId('guest-' + side).value = guestNames[index]; });
    }
    document.querySelectorAll('input[name="parts"]').forEach(input => { input.checked = Number(input.value) === parts; });
    goalSelect.value = String(goal);
    clickToBuildInput.checked = clickToBuild;
    byId('resume-game').hidden = !match || match.winner !== null;
  }

  function renderSetup() {
    renderSettings();
    renderDraft();
  }

  function updateSettings(settings) {
    if (!commit({ ...workspace, settings: { ...workspace.settings, ...settings } })) renderSettings();
  }

  async function replaceDraft(text, listId, message) {
    const previous = workspace.draft;
    const saved = activeList();
    const dirty = previous.text.trim() && (!saved || previous.text !== logic.formatPairs(saved.pairs));
    if (dirty && previous.text !== text && !await ui.confirmAction(
      'Remplacer les phrases en cours ?',
      'Vous pouvez enregistrer ces phrases dans la bibliothèque avant d’en charger d’autres.',
      'Remplacer'
    )) return false;
    if (!commit({ ...workspace, draft: { text, listId } })) {
      // Keep the new text available for this session if storage has reached its quota.
      workspace = { ...workspace, draft: { text, listId } };
      renderDraft();
    }
    if (message) ui.toast(message);
    return true;
  }

  function focusDraft() {
    requestAnimationFrame(() => draftInput.focus({ preventScroll: true }));
  }

  const controllers = { get workspace() { return workspace; }, commit, replaceDraft, focusDraft };
  globalThis.BrickLibrary.init(controllers);
  globalThis.BrickClasses.init(controllers);
  globalThis.BrickAssistant.init(controllers);

  ui.options(goalSelect, logic.GOALS.map(goal => [goal, `${goal} points`]), workspace.settings.goal);
  renderSetup();

  draftInput.addEventListener('input', () => {
    workspace = { ...workspace, draft: { ...workspace.draft, text: draftInput.value } };
    renderDraft();
    clearTimeout(draftTimer);
    draftTimer = setTimeout(saveDraft, 280);
  });
  window.addEventListener('pagehide', () => {
    if (draftTimer) saveDraft();
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && draftTimer) saveDraft();
  });
  byId('open-help').addEventListener('click', () => byId('help-dialog').showModal());
  classSelect.addEventListener('change', () => updateSettings({ classId: classSelect.value || null }));
  goalSelect.addEventListener('change', () => updateSettings({ goal: Number(goalSelect.value) }));
  clickToBuildInput.addEventListener('change', () => updateSettings({ clickToBuild: clickToBuildInput.checked }));
  document.querySelectorAll('input[name="parts"]').forEach(input => {
    input.addEventListener('change', () => updateSettings({ parts: Number(input.value) }));
  });
  sides.forEach((side, index) => {
    const guest = byId('guest-' + side);
    guest.addEventListener('change', () => {
      const guestNames = [...workspace.settings.guestNames];
      guestNames[index] = guest.value.trim() || logic.DEFAULT_NAMES[index];
      updateSettings({ guestNames });
    });
    const select = byId('group-' + side);
    select.addEventListener('change', () => {
      const classroom = currentClass();
      if (!classroom) return;
      const selected = data.selectedGroups(classroom);
      const other = 1 - index;
      if (selected[other] === select.value) selected[other] = selected[index];
      selected[index] = select.value;
      const classes = workspace.classes.map(item => item.id === classroom.id ? { ...item, selected } : item);
      if (!commit({ ...workspace, classes })) renderSettings();
    });
  });

  const listFile = byId('list-file');
  byId('import-list').addEventListener('click', () => listFile.click());
  listFile.addEventListener('change', async () => {
    const file = listFile.files[0];
    listFile.value = '';
    if (!file) return;
    try {
      const imported = logic.parseImportedList(await ui.readTextFile(file, logic.MAX_DRAFT * 4), file.name);
      if (imported.issues.length) throw new Error(ui.issueText(imported.issues[0]));
      if (!imported.pairs.length) throw new Error('Ce fichier ne contient aucune paire.');
      if (await replaceDraft(logic.formatPairs(imported.pairs), null, `${ui.parseSummary(imported)} · fichier importé.`)) focusDraft();
    } catch (error) {
      ui.toast(error.message || 'Impossible de lire ce fichier.', true);
    }
  });

  const brickPool = byId('brick-area');
  const assemblyGrid = byId('assembly-grid');
  const template = byId('team-card-template');
  const assemblyTemplate = byId('assembly-template');
  const teamElements = sides.map((side, index) => {
    const teamClass = index === 0 ? 'team-jade' : 'team-amber';
    const card = template.content.firstElementChild.cloneNode(true);
    card.classList.add(teamClass);
    byId('team-cues').append(card);
    const lane = assemblyTemplate.content.firstElementChild.cloneNode(true);
    lane.classList.add(teamClass);
    assemblyGrid.append(lane);
    const laneHint = lane.querySelector('.assembly-hint');
    const shortcut = hintKeys[index].toUpperCase();
    laneHint.firstElementChild.textContent = shortcut;
    laneHint.setAttribute('aria-keyshortcuts', shortcut);
    laneHint.title = `Placer la prochaine brique correcte (${shortcut})`;
    laneHint.addEventListener('click', () => placeHintedBrick(index));
    const expandCue = card.querySelector('.cue-expand');
    expandCue.append(ui.icon('expand'));
    expandCue.addEventListener('click', () => {
      const team = match.teams[index];
      const pair = match.pairs[team.index];
      updateText(byId('clue-title'), (team.revealed ? 'Réponse' : 'Indice') + ' · ' + team.name);
      updateText(byId('clue-copy'), team.revealed ? pair.answer : pair.cue);
      byId('clue-dialog').showModal();
    });
    const validate = byId('validate-' + side);
    const undoAnswer = byId('reveal-' + side);
    const skip = byId('skip-' + side);
    validate.addEventListener('click', () => playMove(index, true));
    skip.addEventListener('click', () => {
      help.close();
      playMove(index, false);
      byId('arena').focus({ preventScroll: true });
    });
    undoAnswer.addEventListener('click', () => {
      if (!match || game.hidden) return;
      help.close();
      saveMatch(logic.toggleAnswer(match, index));
      byId('arena').focus({ preventScroll: true });
    });
    return {
      card, validate,
      name: card.querySelector('.team-name'),
      score: card.querySelector('.team-score strong'),
      goal: card.querySelector('.team-score span'),
      cue: card.querySelector('.team-clue'),
      cueText: card.querySelector('.team-clue span'),
      expandCue,
      wall: byId('wall-' + side),
      helpName: byId('help-' + side + '-name'),
      reveal: undoAnswer.lastElementChild,
      laneHint,
      laneSlots: lane.querySelector('.assembly-slots'),
      brickTexts: null,
      brickNodes: []
    };
  });

  function updateText(node, text) {
    if (node.textContent === text) return false;
    node.textContent = text;
    return true;
  }

  function saveMatch(next, render = true) {
    match = next;
    try {
      localStorage.setItem(data.MATCH_KEY, JSON.stringify(match));
      matchStorageWarning = false;
    } catch {
      if (!matchStorageWarning) ui.toast('Impossible de sauvegarder la progression de cette partie.', true);
      matchStorageWarning = true;
    }
    if (render && !game.hidden) renderGame();
  }

  function fitClue({ cue, expandCue }) {
    cue.style.removeProperty('font-size');
    const fits = () => cue.scrollHeight <= cue.clientHeight + 1;
    if (!fits()) {
      const styles = getComputedStyle(cue);
      let high = Math.floor(parseFloat(styles.fontSize));
      let low = Math.min(high, parseFloat(styles.getPropertyValue('--min-clue-font')));
      while (low < high) {
        const size = Math.ceil((low + high) / 2);
        cue.style.fontSize = `${size}px`;
        if (fits()) low = size;
        else high = size - 1;
      }
      cue.style.fontSize = `${low}px`;
    }
    const clipped = !fits();
    expandCue.hidden = !clipped;
    if (clipped) cue.tabIndex = 0;
    else cue.removeAttribute('tabindex');
  }

  let clueFrame = 0;
  function scheduleClueFit() {
    if (clueFrame) return;
    clueFrame = requestAnimationFrame(() => {
      clueFrame = 0;
      if (!game.hidden) teamElements.forEach(fitClue);
    });
  }

  const clueObserver = new ResizeObserver(scheduleClueFit);
  teamElements.forEach(view => clueObserver.observe(view.card));
  document.fonts.ready.then(scheduleClueFit);

  function makeWordBrick(text, side, index) {
    const interactive = index !== undefined;
    const brick = ui.element(interactive ? 'button' : 'div', `word-brick ${side === 0 ? 'team-jade' : 'team-amber'}`);
    if (interactive) {
      brick.type = 'button';
      brick.dataset.side = side;
      brick.dataset.index = index;
    }
    const words = ui.element('span', 'brick-text', text);
    words.dir = 'auto';
    if (text.length > 48 || /\S{25}/u.test(text)) brick.dataset.dense = 'true';
    brick.append(words);
    return brick;
  }

  function syncBricks(container, nodes) {
    const current = new Set(nodes);
    for (const child of [...container.children]) {
      if (!current.has(child)) child.remove();
    }
    nodes.forEach((brick, index) => {
      if (container.children[index] !== brick) container.insertBefore(brick, container.children[index] ?? null);
    });
  }

  function renderBricks() {
    assemblyGrid.hidden = !match.clickToBuild;
    game.dataset.clickBuild = String(match.clickToBuild);
    match.teams.forEach((team, side) => {
      const view = teamElements[side];
      if (view.brickTexts !== team.bricks) {
        view.brickTexts = team.bricks;
        view.brickNodes = team.bricks.map((text, index) => makeWordBrick(text, side, match.clickToBuild ? index : undefined));
      }
      if (match.clickToBuild) {
        view.laneHint.disabled = !logic.nextBrickPlacement(match, side);
        view.laneHint.setAttribute('aria-label', `Placer la prochaine brique correcte · ${team.name} (${hintKeys[side].toUpperCase()})`);
        view.laneSlots.setAttribute('aria-label', `Briques posées · ${team.name}`);
        view.brickNodes.forEach((brick, index) => {
          const placed = team.placed.includes(index);
          brick.setAttribute('aria-label', `${placed ? 'Retirer' : 'Placer'} « ${team.bricks[index]} » · ${team.name}`);
          brick.disabled = match.winner !== null;
        });
      }
    });
    syncBricks(brickPool, logic.availableBricks(match).map(({ side, index }) => teamElements[side].brickNodes[index]));
    match.teams.forEach((team, side) => {
      const view = teamElements[side];
      syncBricks(view.laneSlots, team.placed.map(index => view.brickNodes[index]));
    });
  }

  byId('brick-zone').addEventListener('click', event => {
    const brick = event.target.closest('button.word-brick');
    if (!brick || !match || game.hidden || solution.open) return;
    const next = logic.toggleBrick(match, Number(brick.dataset.side), Number(brick.dataset.index));
    if (next === match) return;
    const wasFocused = document.activeElement === brick;
    saveMatch(next);
    if (wasFocused) brick.focus({ preventScroll: true });
  });

  function placeHintedBrick(side) {
    if (!match || game.hidden || solution.open) return;
    const next = logic.placeNextBrick(match, side);
    if (next === match) return;
    const before = match.teams[side].placed;
    const moved = next.teams[side].placed.find((index, position) => index !== before[position]);
    const view = teamElements[side];
    const brick = view.brickNodes[moved];
    const origin = reducedMotion.matches ? null : brick.getBoundingClientRect();
    const hintWasFocused = document.activeElement === view.laneHint;
    saveMatch(next);
    if (origin) animateBrick(brick, origin, 230);
    updateText(byId('game-announcer'), `${next.teams[side].name} · ${brick.textContent} en place.`);
    if (hintWasFocused && view.laneHint.disabled) byId('arena').focus({ preventScroll: true });
  }

  function renderWall(wall, score) {
    const previous = Number(wall.dataset.score);
    if (previous === score) return;
    wall.dataset.score = score;
    wall.style.backgroundPosition = `${(score % 4) * 100 / 3}% ${Math.floor(score / 4) * 100 / 3}%`;
    if (previous === score - 1 && !reducedMotion.matches) {
      wall.getAnimations().forEach(animation => animation.cancel());
      wall.animate([{ transform: 'translateY(3px)' }, { transform: 'translateY(-3px)' }, { transform: 'translateY(0)' }], { duration: 250 });
    }
  }

  function renderGame() {
    match.teams.forEach((team, side) => {
      const view = teamElements[side];
      const pair = match.pairs[team.index];
      updateText(view.name, team.name);
      view.name.title = team.name;
      updateText(view.helpName, team.name);
      updateText(view.score, String(team.score).padStart(2, '0'));
      updateText(view.goal, '/ ' + String(match.goal).padStart(2, '0'));
      if (updateText(view.cueText, team.revealed ? pair.answer : pair.cue)) {
        view.cue.scrollTop = 0;
        scheduleClueFit();
      }
      view.cue.classList.toggle('is-answer', team.revealed);
      const expandLabel = `Agrandir ${team.revealed ? 'la réponse' : 'l’indice'} · ${team.name}`;
      view.expandCue.setAttribute('aria-label', expandLabel);
      view.expandCue.title = expandLabel;
      updateText(view.reveal, team.revealed ? 'Masquer la réponse' : 'Voir la réponse');
      view.validate.setAttribute('aria-label', `${side + 1} — Valider : ${team.name}`);
      view.validate.disabled = match.winner !== null;
      renderWall(view.wall, team.score);
    });
    renderBricks();
    byId('undo-game').disabled = !match.history.length;
    byId('game-help-button').disabled = match.winner !== null;

    if (match.winner !== null) {
      const winner = match.teams[match.winner];
      updateText(byId('winner-title'), `Victoire pour ${winner.name} !`);
      updateText(byId('winner-score'), match.teams.map(team => `${team.name} · ${team.score}`).join('   /   '));
      victory.classList.toggle('team-jade', match.winner === 0);
      victory.classList.toggle('team-amber', match.winner === 1);
      if (!victory.open) victory.showModal();
    } else if (victory.open) {
      victory.close();
    }
  }

  function showGame() {
    if (!match) return;
    setup.hidden = true;
    game.hidden = false;
    window.scrollTo(0, 0);
    byId('arena').focus({ preventScroll: true });
    renderGame();
  }

  function showSetup() {
    if (victory.open) victory.close();
    game.hidden = true;
    setup.hidden = false;
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    renderSetup();
    window.scrollTo(0, 0);
    byId('setup-title').focus({ preventScroll: true });
  }

  async function startMatch() {
    if (parsed.pairs.length < 2 || parsed.issues.length) return;
    if (match && match.winner === null && !await ui.confirmAction(
      'Lancer une nouvelle partie ?',
      'La partie en cours sera remplacée. Vous pouvez la reprendre depuis la préparation.',
      'Nouvelle partie'
    )) return;
    const { goal, parts, guestNames, clickToBuild } = workspace.settings;
    const classroom = currentClass();
    const names = classroom ? data.selectedGroups(classroom).map(id => classroom.groups.find(group => group.id === id).name) : guestNames;
    saveMatch(logic.createMatch(parsed.pairs, { goal, parts, names, clickToBuild, title: activeList()?.name ?? 'Partie libre' }));
    showGame();
  }

  function animateBrick(brick, origin, duration, delay = 0) {
    if (!origin?.width || !origin.height) return;
    const target = brick.getBoundingClientRect();
    if (!target.width || !target.height) return;
    const x = origin.left - target.left;
    const y = origin.top - target.top;
    const sx = origin.width / target.width;
    const sy = origin.height / target.height;
    if (Math.abs(x) < 1 && Math.abs(y) < 1 && Math.abs(sx - 1) < .01 && Math.abs(sy - 1) < .01) return;
    brick.getAnimations().forEach(animation => animation.cancel());
    brick.animate([
      { transformOrigin: 'top left', transform: `translate(${x}px, ${y}px) scale(${sx}, ${sy})` },
      { transformOrigin: 'top left', transform: 'none' }
    ], { duration, delay, easing: 'cubic-bezier(.2, .75, .28, 1)', fill: 'backwards' });
  }

  function presentSolution(previous, side) {
    const team = previous.teams[side];
    const sources = teamElements[side].brickNodes;
    const origins = reducedMotion.matches ? [] : sources.map(brick => brick.getBoundingClientRect());
    const otherBricks = teamElements[1 - side].brickNodes;
    const solved = logic.solutionBricks(previous, side);
    const bricks = solved.map(({ text }) => makeWordBrick(text, side));
    const row = byId('solution-bricks');
    solution.classList.toggle('team-jade', side === 0);
    solution.classList.toggle('team-amber', side === 1);
    updateText(byId('solution-answer'), previous.pairs[team.index].answer);
    row.replaceChildren(...bricks);
    sources.forEach(brick => brick.classList.add('solution-source'));
    solution.showModal();
    if (!reducedMotion.matches) bricks.forEach((brick, index) => animateBrick(brick, origins[solved[index].index], 370, index * 30));

    setTimeout(() => {
      const otherOrigins = reducedMotion.matches ? [] : otherBricks.map(brick => brick.getBoundingClientRect());
      sources.forEach(brick => brick.classList.remove('solution-source'));
      solution.close();
      row.replaceChildren();
      renderGame();
      if (match.winner === null && !reducedMotion.matches) {
        otherBricks.forEach((brick, index) => animateBrick(brick, otherOrigins[index], 260));
      }
      const { name, score } = match.teams[side];
      updateText(byId('game-announcer'), `${name} : ${score} point${score === 1 ? '' : 's'}.`);
      if (!victory.open && document.activeElement === document.body) byId('arena').focus({ preventScroll: true });
    }, solutionDuration);
  }

  function playMove(side, point) {
    if (game.hidden || !match || match.winner !== null || solution.open) return;
    const previous = match;
    const next = logic.advanceMatch(previous, side, point);
    saveMatch(next, !point);
    if (point) presentSolution(previous, side);
    else updateText(byId('game-announcer'), `${next.teams[side].name} : phrase suivante.`);
  }

  function undo() {
    if (game.hidden || !match?.history.length || solution.open) return;
    saveMatch(logic.undoMatch(match));
    updateText(byId('game-announcer'), 'Dernière action annulée.');
    if (document.activeElement === document.body) byId('arena').focus({ preventScroll: true });
  }

  async function fullscreen() {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
    } catch {
      ui.toast('Le plein écran est indisponible dans cette fenêtre.', true);
    }
  }

  byId('start-game').addEventListener('click', startMatch);
  byId('resume-game').addEventListener('click', showGame);
  byId('home-button').addEventListener('click', showSetup);
  byId('winner-home').addEventListener('click', showSetup);
  byId('undo-game').addEventListener('click', undo);
  byId('undo-win').addEventListener('click', undo);
  byId('replay-game').addEventListener('click', () => {
    const { pairs, teams, goal, parts, title, clickToBuild } = match;
    saveMatch(logic.createMatch(pairs, { names: teams.map(team => team.name), goal, parts, title, clickToBuild }));
    byId('arena').focus({ preventScroll: true });
  });
  byId('game-help-button').addEventListener('click', () => help.showModal());
  byId('fullscreen').addEventListener('click', fullscreen);
  document.addEventListener('fullscreenchange', () => {
    const expanded = Boolean(document.fullscreenElement);
    updateText(byId('fullscreen-label'), expanded ? 'Quitter le plein écran' : 'Plein écran');
    byId('fullscreen').firstElementChild.replaceChildren(ui.icon(expanded ? 'minimize' : 'expand'));
  });
  victory.addEventListener('cancel', event => event.preventDefault());
  solution.addEventListener('cancel', event => event.preventDefault());
  document.addEventListener('keydown', event => {
    if (game.hidden || event.defaultPrevented || event.repeat || event.isComposing || event.altKey || event.shiftKey) return;
    if (event.target instanceof Element && event.target.closest('textarea,input,select,[contenteditable]')) return;
    const key = event.key.toLowerCase();
    const openDialog = document.querySelector('dialog[open]');
    if (openDialog && !(openDialog === victory && key === 'z')) return;
    if (key === 'z') {
      event.preventDefault();
      undo();
      return;
    }
    if (event.metaKey || event.ctrlKey) return;
    const hintSide = hintKeys.indexOf(key);
    if (hintSide >= 0 && match?.clickToBuild) {
      event.preventDefault();
      placeHintedBrick(hintSide);
    } else if (key === '1' || key === '2' || key === 'f') {
      event.preventDefault();
      if (key === 'f') void fullscreen();
      else playMove(Number(key) - 1, true);
    }
  });
})();
