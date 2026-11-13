import {t, fieldName} from './i18n.js';
const ids = ['age','sbp','dbp','bs','temp','hr'];
const helpKeys = ['ageHelp','sbpHelp','dbpHelp','bsHelp','tempHelp','hrHelp'];
export function initGuided({validate, onErrors, onSubmit}) {
  const form = document.getElementById('form-section');
  const groups = ids.map(id => document.getElementById(id).closest('.input-group'));
  let active = false, step = 0, touched = false, started = false;
  form.addEventListener('input', () => { touched = true; });
  form.querySelectorAll('[data-preset]').forEach(button => button.addEventListener('click', () => { touched = true; }));
  const render = (focus = false) => {
    form.classList.toggle('guided-mode', active);
    groups.forEach((group,i) => group.classList.toggle('guided-hidden', active && i !== step));
    document.getElementById('guided-controls').classList.toggle('hidden', !active);
    document.getElementById('guided-help').classList.toggle('hidden', !active);
    document.getElementById('guided-toggle').textContent = t(active ? 'full' : 'guided');
    document.getElementById('guided-progress').textContent = t('step',{step:step+1});
    document.getElementById('guided-progress-bar').value = step+1;
    document.getElementById('guided-reading-help').textContent = t(helpKeys[step]);
    document.getElementById('guided-previous').disabled = step === 0;
    document.getElementById('guided-next').textContent = t(step === 5 ? 'predict' : 'next');
    if (focus && active) document.getElementById(ids[step]).focus();
  };
  document.getElementById('guided-toggle').addEventListener('click', () => {
    active = !active;
    if (active && !started) {
      if (!touched && !location.hash.includes('assessment=')) ids.forEach(id => { document.getElementById(id).value = ''; });
      started = true;
    }
    render(true);
  });
  document.getElementById('guided-previous').addEventListener('click', () => {
    step = Math.max(0,step-1); document.getElementById('unknown-help').classList.add('hidden'); render(true);
  });
  document.getElementById('guided-next').addEventListener('click', () => {
    const errors = validate().filter(error => error.index === step || (error.code === 'reversed' && step === 2))
      .map(error => error.code === 'reversed' && step === 2 ? {...error,index:2} : error);
    onErrors(errors);
    if (errors.length) return;
    if (step === 5) { onSubmit(); return; }
    step++; document.getElementById('unknown-help').classList.add('hidden'); render(true);
  });
  document.getElementById('guided-unknown').addEventListener('click', () => {
    document.getElementById(ids[step]).value = '';
    document.getElementById('unknown-help').classList.remove('hidden');
    onErrors([]); touched = true;
  });
  document.addEventListener('languagechange', () => render());
  render();
  return {
    showField(index) { if (active) { step = index; render(); } },
    refresh() { render(); },
  };
}
