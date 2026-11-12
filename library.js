'use strict';

(function (root) {
  const ui = root.BrickUI;
  const data = root.BrickData;
  const logic = root.BrickLogic;

  function init(app) {
    const library = ui.byId('library-dialog');
    const folderDialog = ui.byId('folder-dialog');
    const listDialog = ui.byId('list-dialog');
    const search = ui.byId('library-search');
    const listText = ui.byId('list-text');
    let filter = '@all';
    let editingFolder;
    let editingList;
    let fromDraft = false;

    function renderFolders() {
      const folders = [{ id: '@all', name: 'Tous les dossiers' }, { id: '@none', name: 'Sans dossier' }, ...app.workspace.folders];
      ui.byId('folder-list').replaceChildren(...folders.map(folder => {
        const row = ui.element('div', 'side-row');
        const select = ui.button(folder.name, 'side-button', 'folder');
        select.setAttribute('aria-pressed', String(filter === folder.id));
        select.addEventListener('click', () => {
          filter = folder.id;
          renderFolders();
          renderLists();
          ui.byId('folder-list').querySelector('[aria-pressed="true"]')?.focus();
        });
        row.append(select);
        if (folder.id !== '@all' && folder.id !== '@none') {
          const edit = ui.button(`Modifier le dossier ${folder.name}`, 'button icon-button quiet', 'edit', true);
          edit.addEventListener('click', () => openFolder(folder));
          row.append(edit);
        }
        return row;
      }));
    }

    function renderLists() {
      const query = ui.byId('library-search').value.trim().normalize('NFD').replace(/\p{M}/gu, '').toLocaleLowerCase('fr');
      const rows = app.workspace.lists
        .filter(list => filter === '@all' || (list.folderId ?? '@none') === filter)
        .sort((left, right) => left.name.localeCompare(right.name, 'fr'))
        .map(list => {
          const folderName = app.workspace.folders.find(folder => folder.id === list.folderId)?.name ?? 'Sans dossier';
          const searchable = `${list.name} ${folderName}`.normalize('NFD').replace(/\p{M}/gu, '').toLocaleLowerCase('fr');
          if (!searchable.includes(query)) return null;

          const row = ui.element('article', 'record');
          const symbol = ui.element('div', 'record-icon');
          symbol.append(ui.icon('file'));
          const copy = ui.element('div', 'record-copy');
          copy.append(ui.element('h3', '', list.name),
            ui.element('p', 'muted', `${folderName} · ${ui.phraseCount(list.pairs.length)}`));
          const actions = ui.element('div', 'record-actions');
          const load = ui.button('Charger', 'button', 'play');
          load.setAttribute('aria-label', `Charger ${list.name}`);
          load.addEventListener('click', async () => {
            if (await app.replaceDraft(logic.formatPairs(list.pairs), list.id, `Liste « ${list.name} » chargée.`)) {
              library.close();
              app.focusDraft();
            }
          });
          const edit = ui.button(`Modifier ${list.name}`, 'button icon-button', 'edit', true);
          edit.addEventListener('click', () => openList(list));
          const remove = ui.button(`Supprimer ${list.name}`, 'button icon-button quiet', 'trash', true);
          remove.addEventListener('click', () => deleteList(list));
          actions.append(load, edit, remove);
          row.append(symbol, copy, actions);
          return row;
        }).filter(Boolean);
      const listArea = ui.byId('library-list');
      if (rows.length) listArea.replaceChildren(...rows);
      else listArea.replaceChildren(ui.element('p', 'empty-state muted', query ? 'Aucune liste ne correspond à la recherche.' : 'Ce dossier ne contient aucune liste.'));
    }

    function openLibrary() {
      if (library.open) return;
      search.value = '';
      renderFolders();
      renderLists();
      ui.setStatus(ui.byId('backup-status'), '');
      library.showModal();
    }

    function openFolder(folder) {
      editingFolder = folder;
      ui.byId('folder-title').textContent = folder ? 'Modifier le dossier' : 'Nouveau dossier';
      ui.byId('folder-name').value = folder?.name ?? '';
      ui.byId('delete-folder').hidden = !folder;
      ui.setStatus(ui.byId('folder-status'), '');
      folderDialog.showModal();
    }

    function saveFolder(event) {
      event.preventDefault();
      const name = ui.byId('folder-name').value.trim();
      const status = ui.byId('folder-status');
      if (!name) return ui.setStatus(status, 'Saisissez un nom de dossier.', true);
      const { workspace } = app;
      if (workspace.folders.length >= 500 && !editingFolder) return ui.setStatus(status, 'La bibliothèque contient déjà 500 dossiers.', true);
      if (workspace.folders.some(folder => folder.id !== editingFolder?.id && data.normalizedName(folder.name) === data.normalizedName(name))) {
        return ui.setStatus(status, 'Un dossier porte déjà ce nom.', true);
      }
      const id = editingFolder?.id ?? data.newId();
      const folders = editingFolder
        ? workspace.folders.map(folder => folder.id === id ? { id, name } : folder)
        : [...workspace.folders, { id, name }];
      if (!app.commit({ ...workspace, folders })) return ui.setStatus(status, 'L’enregistrement a échoué. Réessayez ou exportez une sauvegarde.', true);
      filter = id;
      search.value = '';
      folderDialog.close();
      renderFolders();
      renderLists();
      ui.byId('folder-list').querySelector('[aria-pressed="true"]')?.focus();
    }

    async function deleteFolder() {
      const folder = editingFolder;
      if (!folder || !await ui.confirmAction(`Supprimer « ${folder.name} » ?`, 'Les listes de ce dossier seront déplacées vers Sans dossier.', 'Supprimer le dossier', { danger: true })) return;
      const { workspace } = app;
      const folders = workspace.folders.filter(item => item.id !== folder.id);
      const lists = workspace.lists.map(list => list.folderId === folder.id ? { ...list, folderId: null } : list);
      if (!app.commit({ ...workspace, folders, lists })) return ui.setStatus(ui.byId('folder-status'), 'La suppression a échoué.', true);
      filter = '@none';
      folderDialog.close();
      renderFolders();
      renderLists();
      ui.byId('folder-list').querySelector('[aria-pressed="true"]')?.focus();
    }

    function openList(list, text) {
      editingList = list;
      fromDraft = text !== undefined;
      ui.byId('list-title').textContent = list ? 'Modifier la liste' : 'Nouvelle liste';
      ui.byId('list-name').value = list?.name ?? '';
      const folderId = list ? list.folderId : app.workspace.folders.find(folder => folder.id === filter)?.id;
      ui.options(ui.byId('list-folder'), [['', 'Sans dossier'], ...app.workspace.folders.map(folder => [folder.id, folder.name])], folderId ?? '');
      listText.value = text ?? (list ? logic.formatPairs(list.pairs) : '');
      ui.byId('save-copy').hidden = !list || !fromDraft;
      validateList();
      listDialog.showModal();
    }

    function validateList() {
      const parsed = logic.parsePairs(listText.value);
      const issue = parsed.issues[0];
      ui.setStatus(ui.byId('list-status'), issue ? ui.issueText(issue) : ui.parseSummary(parsed), Boolean(issue));
      ui.byId('confirm-list').disabled = ui.byId('save-copy').disabled = Boolean(issue) || !parsed.pairs.length;
      return parsed;
    }

    function saveList(event) {
      event.preventDefault();
      const { pairs, issues } = validateList();
      if (!pairs.length || issues.length) return;
      const { workspace } = app;
      const status = ui.byId('list-status');
      const copy = event.submitter?.value === 'copy';
      const id = copy ? data.newId() : editingList?.id ?? data.newId();
      if ((!editingList || copy) && workspace.lists.length >= 2500) return ui.setStatus(status, 'La bibliothèque contient déjà 2 500 listes.', true);
      let name = ui.byId('list-name').value.trim();
      const folderId = ui.byId('list-folder').value || null;
      const nameTaken = candidate => workspace.lists.some(list => list.id !== id && list.folderId === folderId
        && data.normalizedName(list.name) === data.normalizedName(candidate));
      if (!name) return ui.setStatus(status, 'Saisissez un nom de liste.', true);
      if (copy && nameTaken(name)) {
        const original = name;
        for (let version = 1; nameTaken(name); version++) {
          const suffix = version === 1 ? ' — copie' : ` — copie ${version}`;
          name = original.slice(0, data.MAX_TITLE - suffix.length) + suffix;
        }
      }
      if (nameTaken(name)) return ui.setStatus(status, 'Ce dossier contient déjà une liste de ce nom.', true);

      const list = { id, name, folderId, pairs };
      const lists = editingList && !copy ? workspace.lists.map(item => item.id === id ? list : item) : [...workspace.lists, list];
      const wasClean = editingList && workspace.draft.listId === id && workspace.draft.text === logic.formatPairs(editingList.pairs);
      const draft = fromDraft || wasClean ? { listId: id, text: logic.formatPairs(pairs) } : workspace.draft;
      if (!app.commit({ ...workspace, lists, draft })) return ui.setStatus(status, 'Impossible d’enregistrer la liste dans le stockage local.', true);
      listDialog.close();
      if (library.open) {
        filter = folderId ?? '@none';
        search.value = '';
        renderFolders();
        renderLists();
        search.focus();
      } else {
        ui.toast(`Liste « ${name} » enregistrée.`);
      }
    }

    async function deleteList(list) {
      if (!await ui.confirmAction(`Supprimer « ${list.name} » ?`, 'La liste sera retirée de la bibliothèque.', 'Supprimer la liste', { danger: true })) return;
      const { workspace } = app;
      const draft = workspace.draft.listId === list.id ? { ...workspace.draft, listId: null } : workspace.draft;
      if (!app.commit({ ...workspace, lists: workspace.lists.filter(item => item.id !== list.id), draft })) {
        return ui.setStatus(ui.byId('backup-status'), 'Impossible de retirer la liste du stockage local.', true);
      }
      renderLists();
      search.focus();
    }

    async function importBackup(event) {
      const file = event.target.files[0];
      event.target.value = '';
      if (!file) return;
      const status = ui.byId('backup-status');
      try {
        const backup = data.readBackup(await ui.readTextFile(file, data.MAX_BACKUP_SIZE));
        const { workspace } = app;
        const merged = data.mergeBackup(workspace, backup);
        const listCount = merged.lists.length - workspace.lists.length;
        const classCount = merged.classes.length - workspace.classes.length;
        const folderCount = merged.folders.length - workspace.folders.length;
        if (listCount + classCount + folderCount === 0) {
          ui.setStatus(status, 'Cette sauvegarde est déjà présente.');
          return;
        }
        if (!app.commit(merged)) throw new Error('Le stockage local ne peut pas accueillir cette sauvegarde.');
        filter = '@all';
        search.value = '';
        renderFolders();
        renderLists();
        ui.setStatus(status, `Import terminé · ${folderCount} dossier(s), ${listCount} liste(s), ${classCount} classe(s).`);
      } catch (error) {
        ui.setStatus(status, error.message || 'Impossible de lire cette sauvegarde.', true);
      }
    }

    ui.byId('open-library').addEventListener('click', openLibrary);
    ui.byId('open-list').addEventListener('click', openLibrary);
    search.addEventListener('input', renderLists);
    ui.byId('new-folder').addEventListener('click', () => openFolder());
    ui.byId('folder-form').addEventListener('submit', saveFolder);
    ui.byId('delete-folder').addEventListener('click', deleteFolder);
    ui.byId('new-list').addEventListener('click', () => openList());
    ui.byId('save-list').addEventListener('click', () => {
      const { draft, lists } = app.workspace;
      openList(lists.find(list => list.id === draft.listId), draft.text);
    });
    listText.addEventListener('input', validateList);
    ui.byId('list-form').addEventListener('submit', saveList);
    ui.byId('export-backup').addEventListener('click', () => {
      const backup = JSON.stringify(data.backupContents(app.workspace), null, 2);
      ui.downloadFile(`brick-by-brick-${new Date().toISOString().slice(0, 10)}.json`, backup, 'application/json');
    });
    ui.byId('import-backup').addEventListener('click', () => ui.byId('backup-file').click());
    ui.byId('backup-file').addEventListener('change', importBackup);
  }

  root.BrickLibrary = { init };
})(globalThis);
