document.addEventListener(
  'wheel',
  (e) => {
    if (e.target.tagName === 'INPUT' && e.target.type === 'number') {
      e.preventDefault();
      window.scrollBy(0, e.deltaY);
    }
  },
  { passive: false }
);
