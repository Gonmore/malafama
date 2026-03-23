function normalizeText(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

const bebidaKeywords = [
  'bebida',
  'trago',
  'cerveza',
  'vino',
  'coctel',
  'cocktail',
  'cocktel',
  'refresco',
  'jugo',
  'agua',
  'gaseosa',
  'coca',
  'cola',
  'fanta',
  'sprite',
  'seven up',
  'ginger',
  'tonica',
  'tonic',
  'cafe',
  'capuccino',
  'cappuccino',
  'latte',
  'mocca',
  'mocha',
  'espresso',
  'americano',
  'te',
  'mate',
  'whisky',
  'vodka',
  'ron',
  'fernet',
  'gin',
  'singani',
  'shot'
];

const comidaKeywords = [
  'comida',
  'plato',
  'entrada',
  'postre',
  'snack',
  'pizza',
  'hamburguesa',
  'hamburguesa',
  'sandwich',
  'menu',
  'picoteo',
  'nacho',
  'papas',
  'alitas',
  'empanada',
  'pique',
  'salchipapa',
  'milanesa',
  'pollo',
  'carne',
  'choripan',
  'taco',
  'burrito'
];

function includesKeyword(text, keywords) {
  return keywords.some((keyword) => text.includes(keyword));
}

function resolveOperationalProductType(producto) {
  const explicitType = normalizeText(producto?.tipo);
  if (explicitType === 'comida' || explicitType === 'bebida') {
    return explicitType;
  }

  const categoria = normalizeText(producto?.categoria);
  const nombre = normalizeText(producto?.nombre);
  const combined = `${categoria} ${nombre}`.trim();

  if (includesKeyword(combined, bebidaKeywords)) {
    return 'bebida';
  }

  if (includesKeyword(combined, comidaKeywords)) {
    return 'comida';
  }

  return 'otros';
}

module.exports = {
  resolveOperationalProductType,
};