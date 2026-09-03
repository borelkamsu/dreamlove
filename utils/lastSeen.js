function formatLastSeen(date) {
  if (!date) return 'Vu recemment';
  const diffMs = Date.now() - new Date(date).getTime();
  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;
  const week = 7 * day;

  if (diffMs < minute) return "Vu a l'instant";
  if (diffMs < hour) return `Vu il y a ${Math.floor(diffMs / minute)} min`;
  if (diffMs < day) return `Vu il y a ${Math.floor(diffMs / hour)} h`;
  if (diffMs < week) return `Vu il y a ${Math.floor(diffMs / day)} j`;
  return `Vu il y a ${Math.floor(diffMs / week)} sem`;
}

module.exports = { formatLastSeen };
