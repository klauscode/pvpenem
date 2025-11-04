export function expectedScore(ratingA, ratingB) {
  return 1 / (1 + Math.pow(10, (ratingB - ratingA) / 400));
}

export function newRating(oldRating, score, expected, kFactor) {
  return Math.round(oldRating + kFactor * (score - expected));
}

export function kFactorForGames(gamesPlayed) {
  return gamesPlayed < 25 ? 32 : 16;
}

