export function init() {
  console.log("✅ complex.js init() 호출됨");

  document.body.classList.add('loaded');

  const emmaBtn = document.querySelector('[data-teacher="emma"]');
  const oliviaBtn = document.querySelector('[data-teacher="olivia"]');
  const mikeBtn = document.querySelector('[data-teacher="mike"]');

  if (emmaBtn) emmaBtn.onclick = () => selectTeacher('emma');
  if (oliviaBtn) oliviaBtn.onclick = () => selectTeacher('olivia');
  if (mikeBtn) mikeBtn.onclick = () => selectTeacher('mike');

  const homeBtn = document.querySelector('.home-button');
  if (homeBtn) homeBtn.onclick = (e) => {
    e.preventDefault();
    loadPage('index');
  };
}

function selectTeacher(name) {
  sessionStorage.setItem('selectedTeacher', name);
  document.body.classList.remove('loaded');
  document.body.classList.add('fade-out');
  setTimeout(() => {
    loadPage('complex_fit');
  }, 400);
}
