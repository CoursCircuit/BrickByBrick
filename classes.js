'use strict';

(function (root) {
  const ui = root.BrickUI;
  const data = root.BrickData;

  function init(app) {
    const dialog = ui.byId('classes-dialog');
    const form = ui.byId('class-form');
    const className = ui.byId('class-name');
    const groupsContainer = ui.byId('class-groups');
    const status = ui.byId('class-status');
    let editingId = null;
    let dirty = false;

    function renderClasses() {
      const sorted = [...app.workspace.classes].sort((left, right) => left.name.localeCompare(right.name, 'fr'));
      const rows = sorted.map(classroom => {
        const item = ui.button(classroom.name, 'side-button', 'users');
        item.setAttribute('aria-pressed', String(editingId === classroom.id));
        item.addEventListener('click', async () => {
          if (editingId === classroom.id || !await canLeave()) return;
          openEditor(classroom);
        });
        return item;
      });
      if (!rows.length) rows.push(ui.element('p', 'muted aside-empty', 'Aucune classe enregistrée.'));
      ui.byId('class-list').replaceChildren(...rows);
    }

    function markDirty() {
      dirty = true;
      ui.setStatus(status, 'Modifications à enregistrer.');
    }

    function readGroups() {
      return [...groupsContainer.children].map(row => ({
        id: row.dataset.id,
        name: row.querySelector('.group-name').value.trim(),
        members: row.querySelector('.group-members').value.trim()
      }));
    }

    function renderGroups(groups, keepOpen = []) {
      groupsContainer.replaceChildren(...groups.map((group, index) => {
        const row = ui.element('div', 'group-editor');
        row.dataset.id = group.id;
        const groupHead = ui.element('div', 'group-editor-head');
        const name = ui.element('input', 'group-name');
        name.value = group.name;
        name.required = true;
        name.maxLength = data.MAX_NAME;
        name.setAttribute('aria-label', `Nom du groupe ${index + 1}`);
        const remove = ui.button(`Retirer le groupe ${index + 1}`, 'button icon-button quiet', 'trash', true);
        remove.disabled = groups.length <= 2;
        remove.addEventListener('click', () => {
          const updated = readGroups().filter(item => item.id !== group.id);
          renderGroups(updated, openMembers());
          markDirty();
          groupsContainer.children[Math.min(index, updated.length - 1)].querySelector('.group-name').focus();
        });
        groupHead.append(name, remove);
        const details = ui.element('details', 'member-list');
        details.open = keepOpen.includes(group.id);
        const summary = ui.element('summary', '', 'Élèves (facultatif)');
        const members = ui.element('textarea', 'group-members');
        members.setAttribute('aria-label', `Élèves du groupe ${index + 1}`);
        members.placeholder = 'Un prénom par ligne';
        members.rows = 3;
        members.maxLength = data.MAX_MEMBERS;
        members.value = group.members;
        details.append(summary, members);
        row.append(groupHead, details);
        return row;
      }));
      ui.byId('add-group').disabled = groups.length >= data.MAX_GROUPS;
    }

    function openMembers() {
      return [...groupsContainer.children].filter(row => row.querySelector('details').open).map(row => row.dataset.id);
    }

    function newGroup(name) {
      return { id: data.newId(), name, members: '' };
    }

    function openEditor(classroom, focus = true) {
      editingId = classroom?.id ?? null;
      dirty = false;
      className.value = classroom?.name ?? '';
      ui.byId('class-empty').hidden = true;
      form.hidden = false;
      ui.byId('delete-class').hidden = !classroom;
      renderGroups(classroom?.groups ?? [newGroup('Groupe 1'), newGroup('Groupe 2')]);
      renderClasses();
      ui.setStatus(status, '');
      if (focus) className.focus();
    }

    function showEmpty() {
      editingId = null;
      dirty = false;
      ui.byId('class-empty').hidden = false;
      form.hidden = true;
      renderClasses();
    }

    function openClasses() {
      const { workspace } = app;
      const classroom = workspace.classes.find(item => item.id === workspace.settings.classId) ?? workspace.classes[0];
      if (classroom) openEditor(classroom, false);
      else showEmpty();
      dialog.showModal();
      (classroom ? className : ui.byId('create-first-class')).focus();
    }

    async function canLeave() {
      return !dirty || await ui.confirmAction('Quitter cet éditeur ?', 'Les modifications de la classe n’ont pas été enregistrées.', 'Quitter');
    }

    async function close() {
      if (await canLeave()) dialog.close();
    }

    async function createClass() {
      if (await canLeave()) openEditor();
    }

    function saveClass(event) {
      event.preventDefault();
      const { workspace } = app;
      const name = className.value.trim();
      const groups = readGroups();
      if (!name || groups.some(group => !group.name)) return ui.setStatus(status, 'Saisissez un nom pour la classe et chacun des groupes.', true);
      if (!editingId && workspace.classes.length >= 1000) return ui.setStatus(status, 'Vous avez atteint la limite de 1 000 classes.', true);
      if (workspace.classes.some(item => item.id !== editingId && data.normalizedName(item.name) === data.normalizedName(name))) {
        return ui.setStatus(status, 'Une classe porte déjà ce nom.', true);
      }
      if (new Set(groups.map(group => data.normalizedName(group.name))).size !== groups.length) {
        return ui.setStatus(status, 'Choisissez des noms différents pour les groupes.', true);
      }

      const current = workspace.classes.find(item => item.id === editingId);
      const classroom = { id: editingId ?? data.newId(), name, groups, selected: current?.selected ?? [] };
      classroom.selected = data.selectedGroups(classroom);
      const classes = editingId ? workspace.classes.map(item => item.id === editingId ? classroom : item) : [...workspace.classes, classroom];
      const settings = editingId ? workspace.settings : { ...workspace.settings, classId: classroom.id };
      if (!app.commit({ ...workspace, classes, settings })) return ui.setStatus(status, 'Impossible d’enregistrer cette classe dans le stockage local.', true);

      openEditor(classroom, false);
      ui.byId('class-list').querySelector('[aria-pressed="true"]')?.focus();
      ui.setStatus(status, `Classe « ${name} » enregistrée.`);
    }

    async function deleteClass() {
      const current = app.workspace.classes.find(item => item.id === editingId);
      if (!current || !await ui.confirmAction(`Supprimer « ${current.name} » ?`, 'Ses groupes et leurs listes d’élèves seront supprimés.', 'Supprimer la classe', { danger: true })) return;
      const { workspace } = app;
      const classes = workspace.classes.filter(item => item.id !== current.id);
      const settings = workspace.settings.classId === current.id ? { ...workspace.settings, classId: null } : workspace.settings;
      if (!app.commit({ ...workspace, classes, settings })) return ui.setStatus(status, 'La suppression a échoué.', true);
      if (classes.length) {
        openEditor(classes[0]);
        ui.setStatus(status, `Classe « ${current.name} » supprimée.`);
      } else {
        showEmpty();
        ui.byId('create-first-class').focus();
      }
    }

    ui.byId('open-classes').addEventListener('click', openClasses);
    ui.byId('close-classes').addEventListener('click', close);
    dialog.addEventListener('cancel', event => {
      if (!dirty) return;
      event.preventDefault();
      void close();
    });
    ui.byId('new-class').addEventListener('click', createClass);
    ui.byId('create-first-class').addEventListener('click', createClass);
    ui.byId('add-group').addEventListener('click', () => {
      const groups = readGroups();
      let number = groups.length + 1;
      while (groups.some(group => group.name === `Groupe ${number}`)) number++;
      renderGroups([...groups, newGroup(`Groupe ${number}`)], openMembers());
      markDirty();
      groupsContainer.lastElementChild.querySelector('.group-name').select();
    });
    ui.byId('delete-class').addEventListener('click', deleteClass);
    form.addEventListener('input', markDirty);
    form.addEventListener('submit', saveClass);
  }

  root.BrickClasses = { init };
})(globalThis);
