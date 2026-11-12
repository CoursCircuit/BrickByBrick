'use strict';

(function (root) {
  const svg = 'http://www.w3.org/2000/svg';
  const icons = {
    brand: '<rect x="3" y="15" width="8" height="5" rx="1"/><rect x="12.5" y="15" width="8" height="5" rx="1"/><rect x="7.7" y="9" width="8" height="5" rx="1"/><rect x="12.4" y="3" width="8" height="5" rx="1"/>',
    book: '<path d="M12 6v14m0-14C9 3 5 3 2 5v14c3-2 7-2 10 1 3-3 7-3 10-1V5c-3-2-7-2-10 1Z"/>',
    users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2m20 0v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/><circle cx="9" cy="7" r="4"/>',
    sparkles: '<path d="M12 2c.8 5.9 3.1 8.2 9 9-5.9.8-8.2 3.1-9 9-.8-5.9-3.1-8.2-9-9 5.9-.8 8.2-3.1 9-9ZM20 16v5m-2.5-2.5h5M4 2v4M2 4h4"/>',
    help: '<circle cx="12" cy="12" r="9"/><path d="M9.1 9a2.9 2.9 0 1 1 4.7 2.3c-1.3.9-1.8 1.4-1.8 2.7m0 3.2h.01"/>',
    folder: '<path d="M3 6a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z"/>',
    upload: '<path d="M12 16V3m-5 5 5-5 5 5M4 15v5a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-5"/>',
    download: '<path d="M12 3v13m-5-5 5 5 5-5M4 16v4a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-4"/>',
    save: '<path d="M5 3h12l4 4v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Zm2 0v6h10V3M7 21v-7h10v7"/>',
    'arrow-right': '<path d="M4 12h16m-6-6 6 6-6 6"/>',
    'arrow-left': '<path d="M20 12H4m6-6-6 6 6 6"/>',
    expand: '<path d="M9 3H3v6m12-6h6v6m0 6v6h-6M3 15v6h6"/>',
    minimize: '<path d="M3 9h6V3m6 0v6h6m0 6h-6v6m-6 0v-6H3"/>',
    play: '<path d="m7 4 13 8-13 8V4Z"/>',
    undo: '<path d="M4 10h10a5 5 0 0 1 0 10h-3m-2-5-5-5 5-5"/>',
    x: '<path d="m6 6 12 12M18 6 6 18"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    search: '<circle cx="10.8" cy="10.8" r="6.3"/><path d="m16 16 4 4"/>',
    edit: '<path d="m13 6 5 5M4 20l1-5L16.5 3.5a1.4 1.4 0 0 1 2 0l2 2a1.4 1.4 0 0 1 0 2L9 19l-5 1Z"/>',
    trash: '<path d="M3 6h18m-2 0-1 14H6L5 6m4 0V3h6v3m-5 4v6m4-6v6"/>',
    file: '<path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9Zm0 0v6h6M8 13h8m-8 4h8"/>',
    copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 4H6a2 2 0 0 0-2 2v10"/>',
    eye: '<path d="M2 12s3.6-6 10-6 10 6 10 6-3.6 6-10 6-10-6-10-6Z"/><circle cx="12" cy="12" r="2.4"/>',
    skip: '<path d="m5 5 11 7-11 7V5Zm14 0v14"/>',
    replay: '<path d="M3 12a9 9 0 1 1 2.6 6.4M3 6v6h6"/>',
    trophy: '<path d="M8 3h8v7a4 4 0 0 1-8 0V3Zm0 2H4v2a4 4 0 0 0 4 4m8-6h4v2a4 4 0 0 1-4 4m-4 3v6m-4 0h8"/>'
  };
  const byId = id => document.getElementById(id);

  function element(tag, className = '', content) {
    const node = document.createElement(tag);
    node.className = className;
    if (content !== undefined) node.textContent = content;
    return node;
  }

  function icon(name) {
    const node = document.createElementNS(svg, 'svg');
    node.setAttribute('viewBox', '0 0 24 24');
    node.setAttribute('aria-hidden', 'true');
    node.setAttribute('focusable', 'false');
    if (name === 'brand') {
      node.setAttribute('fill', 'currentColor');
    } else {
      node.setAttribute('fill', 'none');
      node.setAttribute('stroke', 'currentColor');
      node.setAttribute('stroke-width', '1.7');
      node.setAttribute('stroke-linecap', 'round');
      node.setAttribute('stroke-linejoin', 'round');
    }
    node.innerHTML = icons[name];
    return node;
  }

  function button(label, className, iconName, iconOnly = false) {
    const node = element('button', className);
    node.type = 'button';
    if (iconName) node.append(icon(iconName));
    if (iconOnly) {
      node.title = label;
      node.setAttribute('aria-label', label);
    } else {
      node.append(label);
    }
    return node;
  }

  function options(select, items, value) {
    select.replaceChildren(...items.map(([id, label]) => {
      const option = element('option', '', label);
      option.value = id;
      return option;
    }));
    select.value = value;
  }

  function setStatus(node, message, error = false) {
    node.textContent = message;
    node.hidden = !message;
    node.classList.toggle('error', error);
  }

  let toastTimer;
  function toast(message, error) {
    const node = byId('toast');
    setStatus(node, message, error);
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { node.hidden = true; }, 4200);
  }

  function confirmAction(title, message, label, { danger = false } = {}) {
    const dialog = byId('confirm-dialog');
    if (dialog.open) return Promise.resolve(false);
    byId('confirm-title').textContent = title;
    byId('confirm-text').textContent = message;
    const submit = byId('confirm-action');
    submit.textContent = label;
    submit.classList.toggle('danger', danger);
    submit.classList.toggle('primary', !danger);
    dialog.returnValue = 'cancel';
    dialog.showModal();
    return new Promise(resolve => {
      dialog.addEventListener('close', () => resolve(dialog.returnValue === 'confirm'), { once: true });
    });
  }

  function phraseCount(count) {
    return `${count} phrase${count === 1 ? '' : 's'}`;
  }

  function issueText(issue) {
    return issue.line ? `Ligne ${issue.line} — ${issue.message}` : issue.message;
  }

  function parseSummary(parsed) {
    let message = phraseCount(parsed.pairs.length);
    if (parsed.duplicates) {
      const plural = parsed.duplicates > 1;
      message += ` · ${parsed.duplicates} doublon${plural ? 's écartés' : ' écarté'}`;
    }
    return message;
  }

  async function readTextFile(file, byteLimit) {
    if (file.size > byteLimit) throw new Error('Ce fichier dépasse la taille autorisée.');
    const bytes = new Uint8Array(await file.arrayBuffer());
    if (bytes[0] === 255 && bytes[1] === 254) return new TextDecoder('utf-16le').decode(bytes);
    if (bytes[0] === 254 && bytes[1] === 255) return new TextDecoder('utf-16be').decode(bytes);
    try {
      return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    } catch {
      return new TextDecoder('windows-1252').decode(bytes);
    }
  }

  function downloadFile(filename, data, type) {
    const url = URL.createObjectURL(new Blob([data], { type }));
    const link = element('a');
    link.href = url;
    link.download = filename;
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  document.querySelectorAll('[data-icon]').forEach(node => node.append(icon(node.dataset.icon)));
  document.addEventListener('click', event => {
    const closer = event.target.closest('button[data-close]');
    if (closer) closer.closest('dialog')?.close();
  });

  root.BrickUI = { byId, element, icon, button, options, setStatus, toast, confirmAction,
    phraseCount, issueText, parseSummary, readTextFile, downloadFile };
})(globalThis);
