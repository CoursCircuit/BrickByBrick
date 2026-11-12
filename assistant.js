'use strict';

(function (root) {
  const ui = root.BrickUI;
  const logic = root.BrickLogic;

  function init(app) {
    const dialog = ui.byId('assistant-dialog');
    const form = ui.byId('prompt-form');
    const prompt = ui.byId('prompt-text');
    const result = ui.byId('assistant-result');
    const use = ui.byId('use-assistant-result');

    function renderPrompt() {
      prompt.value = logic.buildPrompt(Object.fromEntries(new FormData(form)));
      ui.setStatus(ui.byId('prompt-status'), '');
    }

    function validate() {
      const parsed = logic.parsePairs(result.value);
      const issue = parsed.issues[0];
      ui.setStatus(ui.byId('assistant-status'), issue ? ui.issueText(issue) : result.value.trim() ? ui.parseSummary(parsed) : '', Boolean(issue));
      use.disabled = Boolean(issue) || !parsed.pairs.length;
      return parsed;
    }

    async function copyPrompt() {
      const status = ui.byId('prompt-status');
      try {
        await navigator.clipboard.writeText(prompt.value);
        ui.setStatus(status, 'Prompt copié. Collez-le dans l’IA de votre choix.');
      } catch {
        prompt.select();
        if (document.execCommand('copy')) ui.setStatus(status, 'Prompt copié. Collez-le dans l’IA de votre choix.');
        else ui.setStatus(status, 'Le prompt est sélectionné. Utilisez le raccourci de copie.');
      }
    }

    ui.byId('open-assistant').addEventListener('click', () => {
      renderPrompt();
      dialog.showModal();
    });
    form.addEventListener('input', renderPrompt);
    form.addEventListener('submit', event => event.preventDefault());
    ui.byId('copy-prompt').addEventListener('click', copyPrompt);
    result.addEventListener('input', validate);
    use.addEventListener('click', async () => {
      const parsed = validate();
      if (!parsed.pairs.length || parsed.issues.length) return;
      if (await app.replaceDraft(logic.formatPairs(parsed.pairs), null, `${ui.phraseCount(parsed.pairs.length)} dans la préparation.`)) {
        result.value = '';
        validate();
        dialog.close();
        app.focusDraft();
      }
    });
  }

  root.BrickAssistant = { init };
})(globalThis);
