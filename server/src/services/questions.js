// ENEM API integration + fallback
// Docs: https://docs.enem.dev/introduction
// Base URL: https://api.enem.dev/v1

import { fetch as undiciFetch } from 'undici';

const ENEM_BASE = process.env.ENEM_API_BASE || 'https://api.enem.dev/v1';
const httpFetch = (...args) => (typeof fetch === 'function' ? fetch(...args) : undiciFetch(...args));

// Cache of questionId -> { correctLetter, correctText, options: [{letter,text,imageUrl}], discipline, year }
const ANSWER_CACHE = new Map();

// Map incoming topics to ENEM disciplines
const DISCIPLINE_MAP = new Map([
  ['Math', 'matematica'],
  ['Mathematics', 'matematica'],
  ['matematica', 'matematica'],
  ['Linguagens', 'linguagens'],
  ['linguagens', 'linguagens'],
  ['Humanas', 'ciencias-humanas'],
  ['ciencias-humanas', 'ciencias-humanas'],
  ['Natureza', 'ciencias-natureza'],
  ['ciencias-natureza', 'ciencias-natureza']
]);

function topicToDiscipline(topic) {
  return DISCIPLINE_MAP.get(topic) || topic || 'matematica';
}

function extractImageUrlsFromMarkdown(md) {
  if (!md) return [];
  const regex = /!\[[^\]]*\]\(([^)]+)\)/g;
  const urls = [];
  let m;
  while ((m = regex.exec(md)) !== null) {
    urls.push(m[1]);
  }
  return urls;
}

async function pickRandomExamYear() {
  const res = await httpFetch(`${ENEM_BASE}/exams`);
  if (!res.ok) throw new Error(`ENEM exams ${res.status}`);
  const arr = await res.json();
  const exams = Array.isArray(arr) ? arr : arr.value || [];
  if (!exams.length) throw new Error('No exams');
  const years = exams.map((e) => e.year).filter(Boolean);
  return years[Math.floor(Math.random() * years.length)];
}

async function fetchQuestionsPage(year, offset = 0, limit = 25) {
  const url = `${ENEM_BASE}/exams/${year}/questions?limit=${limit}&offset=${offset}`;
  const res = await httpFetch(url);
  if (!res.ok) throw new Error(`ENEM questions ${res.status}`);
  return res.json();
}

function toInternalQuestion(q, disciplineWanted) {
  const id = `enem-${q.year}-${q.index}`;
  const imageUrls = extractImageUrlsFromMarkdown(q.context) || [];
  const options = (q.alternatives || []).map((a) => ({
    letter: a.letter,
    text: a.text,
    imageUrl: a.file || null
  }));
  const correct = q.correctAlternative;
  const correctText = (q.alternatives || []).find((a) => a.letter === correct)?.text || null;

  // Cache answer details
  ANSWER_CACHE.set(id, {
    correctLetter: correct,
    correctText,
    options,
    discipline: q.discipline,
    year: q.year
  });

  return {
    id,
    topic: q.discipline || disciplineWanted,
    text: q.alternativesIntroduction || q.title || '',
    context: q.context || '',
    imageUrls,
    options
  };
}

export async function fetchQuestion(topic = 'matematica', { strictApi = false } = {}) {
  // Try ENEM API a limited number of times with random years/offsets to avoid rate limits
  const discipline = topicToDiscipline(topic);
  for (let attempt = 0; attempt < 6; attempt++) {
    try {
      const year = await pickRandomExamYear();
      const metaPage = await fetchQuestionsPage(year, 0, 1);
      const total = metaPage?.metadata?.total || 180;
      const limit = Math.min(50, total);
      const offset = Math.max(0, Math.floor(Math.random() * Math.max(1, total - limit)));
      const page = await fetchQuestionsPage(year, offset, limit);
      const list = page?.questions || [];
      const filtered = list.filter((q) => q.discipline === discipline);
      if (filtered.length) {
        const chosen = filtered[Math.floor(Math.random() * filtered.length)];
        if (chosen) return toInternalQuestion(chosen, discipline);
      }
    } catch (err) {
      // try next year
    }
  }
  // Fallback simple question if API fails or none found for discipline
  if (strictApi) {
    throw new Error('ENEM_API_UNAVAILABLE');
  }
  const fallback = {
    id: `local-${Date.now()}`,
    text: 'Qual a derivada de x^2?',
    context: '',
    imageUrls: [],
    options: [
      { letter: 'A', text: '1' },
      { letter: 'B', text: 'x' },
      { letter: 'C', text: '2x' },
      { letter: 'D', text: 'x^2' }
    ],
    topic: discipline
  };
  ANSWER_CACHE.set(fallback.id, { correctLetter: 'C', correctText: '2x', options: fallback.options, discipline, year: null });
  return fallback;
}

export function getCorrectAnswer(questionId) {
  const entry = ANSWER_CACHE.get(questionId);
  return entry?.correctText || null;
}

export function getAnswerDetail(questionId) {
  const entry = ANSWER_CACHE.get(questionId);
  if (!entry) return null;
  return { correctLetter: entry.correctLetter, correctText: entry.correctText, options: entry.options };
}
