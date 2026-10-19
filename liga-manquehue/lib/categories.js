export const CATEGORIES = [
  { slug: 'todo-competidor', key: 'tc', name: 'Todo Competidor' },
  { slug: 'senior', key: 'senior', name: 'Senior' },
];

export function bySlug(slug) {
  return CATEGORIES.find((c) => c.slug === slug);
}

export function byKey(key) {
  return CATEGORIES.find((c) => c.key === key) ?? CATEGORIES[0];
}
