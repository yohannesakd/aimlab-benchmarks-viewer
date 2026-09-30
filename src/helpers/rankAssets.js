const vtMedals = new Set(['Unranked', 'Master', 'Grandmaster', 'Nova', 'Astra', 'Celestial']);
const raRanks = new Set(['Unranked', 'Silver', 'Gold', 'Platinum', 'Ace', 'Legend', 'Sentinel', 'Valour', 'Mythic', 'Immortal', 'Archon', 'Ethereal', 'Divine', 'Divinity']);

export function rankImage(community, rank, presentation = 'badge') {
  if (community === 'revosect') {
    // Revosect Bronze has no supplied artwork; use the existing Bronze badge.
    if (rank === 'Bronze') return '/rank-img/bronze_badge.png';
    return `/rank-img/ra/${raRanks.has(rank) ? rank.toLowerCase() : 'unranked'}.png`;
  }
  const filename = rank.replaceAll(' ', '').toLowerCase();
  return `/rank-img/${filename}${presentation === 'medal' && vtMedals.has(rank) ? '' : '_badge'}.png`;
}
