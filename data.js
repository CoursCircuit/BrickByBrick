'use strict';

(function (root, logic) {
  const WORKSPACE_KEY = 'brick-by-brick.workspace.v1';
  const MATCH_KEY = 'brick-by-brick.match.v1';
  const BACKUP_FORMAT = 'brick-by-brick';
  const MAX_BACKUP_SIZE = 8_000_000;
  const MAX_TITLE = 70;
  const MAX_GROUPS = 24;
  const MAX_NAME = 36;
  const MAX_MEMBERS = 2500;

  const demoSport = [
    ['Ich spiele gern Tennis.', 'J’aime jouer au tennis.'],
    ['Wir schwimmen nach der Schule.', 'Nous nageons après l’école.'],
    ['Am Samstag fahre ich Rad.', 'Le samedi, je fais du vélo.'],
    ['Meine Schwester spielt Volleyball.', 'Ma sœur joue au volley.'],
    ['Im Winter laufen wir Ski.', 'En hiver, nous faisons du ski.'],
    ['Ich trainiere zweimal pro Woche.', 'Je m’entraîne deux fois par semaine.'],
    ['Unser Team hat heute gewonnen.', 'Notre équipe a gagné aujourd’hui.'],
    ['Nach dem Training trinke ich Wasser.', 'Après l’entraînement, je bois de l’eau.'],
    ['Zum Spielen brauche ich einen Ball.', 'Pour jouer, j’ai besoin d’un ballon.'],
    ['Beim Basketball muss ich hoch springen.', 'Au basket, je dois sauter haut.'],
    ['Mein Bruder läuft sehr schnell.', 'Mon frère court très vite.'],
    ['Vor dem Spiel wärmen wir uns auf.', 'Avant le match, nous nous échauffons.']
  ];

  const demoScience = [
    ['La Terre tourne autour du Soleil.', 'Quel mouvement de la Terre dure environ un an ?'],
    ['La Lune est le satellite naturel de la Terre.', 'Quel astre tourne autour de notre planète ?'],
    ['Le Soleil est une étoile.', 'De quel type d’astre vient notre lumière ?'],
    ['Mars est appelée la planète rouge.', 'Quel surnom donne-t-on à Mars ?'],
    ['Jupiter est la plus grande planète du système solaire.', 'Quel record détient Jupiter ?'],
    ['Les anneaux de Saturne contiennent des morceaux de glace.', 'Que trouve-t-on dans les anneaux de Saturne ?']
  ];

  function defaultWorkspace() {
    const folders = [{ id: 'demo-de', name: 'Allemand' }, { id: 'demo-sc', name: 'Sciences' }];
    const lists = [
      { id: 'demo-sport', name: 'Le sport', folderId: folders[0].id, pairs: demoSport.map(([answer, cue]) => ({ answer, cue })) },
      { id: 'demo-soleil', name: 'Le système solaire', folderId: folders[1].id, pairs: demoScience.map(([answer, cue]) => ({ answer, cue })) }
    ];
    return {
      version: 1, folders, lists, classes: [],
      draft: { listId: lists[0].id, text: logic.formatPairs(lists[0].pairs) },
      settings: { classId: null, guestNames: [...logic.DEFAULT_NAMES], goal: 6, parts: 3, clickToBuild: false }
    };
  }

  function newId() {
    return root.crypto.randomUUID();
  }

  function validText(value, limit) {
    return typeof value === 'string' && value.length <= limit && Boolean(value.trim()) && !/[\r\n]/u.test(value);
  }

  function validId(value) {
    return typeof value === 'string' && /^[a-z0-9-]{1,80}$/iu.test(value);
  }

  function validEntries(items, limit, predicate) {
    return Array.isArray(items) && items.length <= limit
      && items.every(item => item && validId(item.id) && predicate(item))
      && new Set(items.map(item => item.id)).size === items.length;
  }

  function selectedGroups(classroom) {
    const valid = classroom.selected?.filter(id => classroom.groups.some(group => group.id === id)) || [];
    return [...new Set([...valid, ...classroom.groups.map(group => group.id)])].slice(0, 2);
  }

  function readCatalog(data) {
    if (!data || data.version !== 1
      || !validEntries(data.folders, 500, folder => validText(folder.name, MAX_TITLE))
      || !validEntries(data.lists, 2500, list => validText(list.name, MAX_TITLE)
        && (list.folderId === null || data.folders.some(folder => folder.id === list.folderId))
        && Array.isArray(list.pairs) && list.pairs.length > 0 && list.pairs.length <= logic.MAX_PAIRS
        && list.pairs.every(logic.validPair))
      || !validEntries(data.classes, 1000, classroom => validText(classroom.name, MAX_TITLE)
        && validEntries(classroom.groups, MAX_GROUPS, group => validText(group.name, MAX_NAME)
          && typeof group.members === 'string' && group.members.length <= MAX_MEMBERS)
        && classroom.groups.length >= 2
        && Array.isArray(classroom.selected) && classroom.selected.length <= 2 && classroom.selected.every(validId))) {
      throw new Error('Le fichier est incomplet ou utilise un format de sauvegarde incompatible.');
    }
    return {
      folders: data.folders.map(({ id, name }) => ({ id, name })),
      lists: data.lists.map(({ id, name, folderId, pairs }) => ({
        id, name, folderId, pairs: pairs.map(({ answer, cue }) => ({ answer, cue }))
      })),
      classes: data.classes.map(classroom => ({
        id: classroom.id,
        name: classroom.name,
        groups: classroom.groups.map(({ id, name, members }) => ({ id, name, members })),
        selected: selectedGroups(classroom)
      }))
    };
  }

  function readWorkspace(storage) {
    const raw = storage.getItem(WORKSPACE_KEY);
    if (raw === null) return defaultWorkspace();
    const saved = JSON.parse(raw);
    const catalog = readCatalog(saved);
    const text = saved.draft?.text;
    const listId = catalog.lists.some(list => list.id === saved.draft?.listId) ? saved.draft.listId : null;
    const settings = saved.settings || {};
    const guestNames = Array.isArray(settings.guestNames) && settings.guestNames.length === 2
      && settings.guestNames.every(name => validText(name, MAX_NAME)) ? settings.guestNames : [...logic.DEFAULT_NAMES];
    return {
      version: 1,
      ...catalog,
      draft: { listId, text: typeof text === 'string' && text.length <= logic.MAX_DRAFT ? text : '' },
      settings: {
        guestNames,
        classId: catalog.classes.some(classroom => classroom.id === settings.classId) ? settings.classId : null,
        goal: logic.GOALS.includes(settings.goal) ? settings.goal : 6,
        parts: logic.PARTS.includes(settings.parts) ? settings.parts : 3,
        clickToBuild: settings.clickToBuild === true
      }
    };
  }

  function backupContents(workspace) {
    return {
      format: BACKUP_FORMAT, version: 1,
      folders: workspace.folders, lists: workspace.lists, classes: workspace.classes
    };
  }

  function readBackup(text) {
    if (text.length > MAX_BACKUP_SIZE) throw new Error('Ce fichier de sauvegarde est trop volumineux.');
    let backup;
    try {
      backup = JSON.parse(text.replace(/^\uFEFF/u, ''));
    } catch {
      throw new Error('Ce fichier n’est pas un document JSON valide.');
    }
    if (backup?.format !== BACKUP_FORMAT) throw new Error('Sélectionnez une sauvegarde exportée par Brick by Brick.');
    return readCatalog(backup);
  }

  function normalizedName(name) {
    return name.trim().normalize().toLocaleLowerCase('fr');
  }

  function mergeBackup(workspace, backup, makeId = newId) {
    const folders = [...workspace.folders];
    const lists = [...workspace.lists];
    const classes = [...workspace.classes];
    const folderIds = new Map();
    const foldersByName = new Map(folders.map(folder => [normalizedName(folder.name), folder]));
    const uniqueId = (items, id) => items.some(item => item.id === id) ? makeId() : id;

    for (const folder of backup.folders) {
      const key = normalizedName(folder.name);
      let match = foldersByName.get(key);
      if (!match) {
        match = { ...folder, id: uniqueId(folders, folder.id) };
        folders.push(match);
        foldersByName.set(key, match);
      }
      folderIds.set(folder.id, match.id);
    }

    const listKey = ({ name, folderId, pairs }) => JSON.stringify([normalizedName(name), folderId, pairs]);
    const classKey = ({ name, groups }) => JSON.stringify([
      normalizedName(name), groups.map(group => [normalizedName(group.name), group.members])
    ]);
    const listKeys = new Set(lists.map(listKey));
    const classKeys = new Set(classes.map(classKey));

    for (const list of backup.lists) {
      const moved = { ...list, folderId: folderIds.get(list.folderId) ?? null };
      const key = listKey(moved);
      if (listKeys.has(key)) continue;
      listKeys.add(key);
      lists.push({ ...moved, id: uniqueId(lists, list.id) });
    }

    for (const classroom of backup.classes) {
      const key = classKey(classroom);
      if (classKeys.has(key)) continue;
      classKeys.add(key);
      classes.push({ ...classroom, id: uniqueId(classes, classroom.id) });
    }

    const merged = { ...workspace, folders, lists, classes };
    readCatalog(merged);
    return merged;
  }

  const api = {
    WORKSPACE_KEY, MATCH_KEY, MAX_BACKUP_SIZE, MAX_TITLE, MAX_NAME, MAX_GROUPS, MAX_MEMBERS,
    defaultWorkspace, newId, readWorkspace, selectedGroups, backupContents, readBackup, mergeBackup, normalizedName
  };
  if (typeof module === 'object') module.exports = api;
  else root.BrickData = api;
})(globalThis, typeof module === 'object' ? require('./logic.js') : globalThis.BrickLogic);
