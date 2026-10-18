const RANDOM_MEAL_URL = 'https://www.themealdb.com/api/json/v1/1/random.php';

export const fallbackRecipes = [
  {
    id: 'nyt-one-pan-orzo',
    title: 'One-Pan Orzo with Spinach & Feta',
    cuisine: 'Greek-inspired · 30 min',
    thumbnailUrl: 'https://i.ytimg.com/vi/eZX7l6FhziI/hqdefault.jpg',
    sourceUrl: 'https://www.youtube.com/watch?v=eZX7l6FhziI',
    sourceName: 'NYT Cooking',
    sourceType: 'video',
    prompt: 'Help our group make NYT Cooking’s One-Pan Orzo with Spinach and Feta tonight. Create an original, practical group-sized plan and grocery draft inspired by the dish, using our saved preferences. Keep any substitutions clear.',
  },
  {
    id: 'albanian-leek-bake',
    title: 'Albanian Meatless Leek Bake',
    cuisine: 'Albanian · vegetarian',
    thumbnailUrl: 'https://www.themealdb.com/images/media/meals/p5m3w21779644533.jpg',
    sourceUrl: 'https://www.youtube.com/watch?v=uRAmHFjVMEA',
    sourceName: 'My Albanian Food',
    sourceType: 'video',
    prompt: 'Help our group try an Albanian meatless leek bake tonight. Create an original, practical group-sized plan and grocery draft inspired by the dish, using our saved preferences. Keep any substitutions clear.',
  },
];

function safeHttps(value) {
  try { return new URL(value).protocol === 'https:' ? value : ''; }
  catch { return ''; }
}

function recipeFromMeal(meal) {
  if (!meal || typeof meal.idMeal !== 'string' || typeof meal.strMeal !== 'string') return null;
  const thumbnailUrl = safeHttps(meal.strMealThumb);
  const videoUrl = safeHttps(meal.strYoutube);
  const articleUrl = safeHttps(meal.strSource);
  if (!thumbnailUrl || (!videoUrl && !articleUrl)) return null;

  const ingredients = Array.from({ length: 20 }, (_, index) => {
    const number = index + 1;
    const name = meal[`strIngredient${number}`]?.trim();
    const measure = meal[`strMeasure${number}`]?.trim();
    return name ? [measure, name].filter(Boolean).join(' ') : '';
  }).filter(Boolean).slice(0, 12);
  const cuisine = meal.strArea || meal.strCategory || 'A dish to discover';
  const sourceUrl = videoUrl || articleUrl;
  const sourceName = videoUrl ? 'Cooking video' : (() => {
    try { return new URL(articleUrl).hostname.replace(/^www\./, ''); }
    catch { return 'Recipe source'; }
  })();

  return {
    id: meal.idMeal,
    title: meal.strMeal,
    cuisine,
    thumbnailUrl,
    sourceUrl,
    sourceName,
    sourceType: videoUrl ? 'video' : 'article',
    prompt: `Help our group try ${meal.strMeal}${meal.strArea ? `, a ${meal.strArea} dish` : ''} tonight. Make an original, practical group-sized meal plan and grocery draft inspired by this recipe. Starting ingredients: ${ingredients.join(', ') || 'use the linked recipe as the reference'}. Use our saved preferences and clearly explain substitutions.`,
  };
}

async function getRandomMeal(fetchImpl, signal) {
  const response = await fetchImpl(RANDOM_MEAL_URL, { signal, headers: { Accept: 'application/json' } });
  if (!response.ok) throw new Error('Recipe discovery is unavailable.');
  const payload = await response.json();
  return recipeFromMeal(payload?.meals?.[0]);
}

export async function loadRandomRecipes({ fetchImpl = globalThis.fetch, signal, count = 5 } = {}) {
  const results = await Promise.allSettled(Array.from({ length: count }, () => getRandomMeal(fetchImpl, signal)));
  const seen = new Set();
  const recipes = results.flatMap(result => result.status === 'fulfilled' && result.value ? [result.value] : [])
    .filter(recipe => !seen.has(recipe.id) && seen.add(recipe.id));
  if (!recipes.length) throw new Error('No recipe picks came back.');
  return recipes;
}
