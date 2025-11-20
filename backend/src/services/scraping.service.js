const puppeteer = require('puppeteer');
const cheerio = require('cheerio');
const axios = require('axios');

// Servicio de web scraping genérico
const scrapeMenu = async (url) => {
  try {
    console.log(`Iniciando scraping de: ${url}`);
    
    // Intentar con Puppeteer (más robusto para SPAs)
    const browser = await puppeteer.launch({
      headless: process.env.SCRAPING_HEADLESS !== 'false',
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');
    
    await page.goto(url, {
      waitUntil: 'networkidle2',
      timeout: parseInt(process.env.SCRAPING_TIMEOUT) || 30000
    });

    // Esperar a que cargue el contenido inicial
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Hacer clic en las pestañas para cargar todo el contenido
    let todosLosProductos = [];
    
    try {
      console.log('Buscando pestañas de menú...');
      
      // Buscar todas las pestañas (TabsControlItem)
      const tabs = await page.$$('div[class*="TabsControlItem"]');
      console.log(`Encontradas ${tabs.length} pestañas`);
      
      // Hacer clic en cada pestaña y extraer productos
      for (let i = 0; i < tabs.length; i++) {
        try {
          const tabText = await page.evaluate(el => el.textContent, tabs[i]);
          const categoria = tabText.trim();
          console.log(`\nProcesando pestaña: ${categoria}`);
          
          await tabs[i].click();
          await new Promise(resolve => setTimeout(resolve, 2000));
          
          // Extraer el HTML de esta pestaña
          const content = await page.content();
          const $ = cheerio.load(content);
          
          // Extraer productos de esta pestaña específica
          const productosDeCategoria = extractProductsFromTab($, categoria);
          
          console.log(`  → ${productosDeCategoria.length} productos encontrados en ${categoria}`);
          todosLosProductos = todosLosProductos.concat(productosDeCategoria);
          
        } catch (err) {
          console.log(`Error al procesar pestaña ${i}:`, err.message);
        }
      }
      
      console.log(`\n✅ Total de productos de todas las pestañas: ${todosLosProductos.length}`);
      
    } catch (error) {
      console.log('Error al procesar pestañas:', error.message);
    }

    await browser.close();

    console.log(`Scraping completado. ${todosLosProductos.length} productos encontrados.`);
    
    return {
      success: true,
      productos: removeDuplicates(todosLosProductos),
      url
    };
  } catch (error) {
    console.error('Error en scraping:', error);
    throw error;
  }
};

// Extractor de productos de una pestaña específica
const extractProductsFromTab = ($, categoria) => {
  const productos = [];
  
  // Buscar todos los divs con clase que contiene "NameComponent"
  const nombresDivs = $('div[class*="NameComponent"], div[class*="Name__"]');
  
  nombresDivs.each((index, elem) => {
    const $nombre = $(elem);
    const nombre = $nombre.text().trim();
    
    // Filtrar si el texto es similar a la categoría (evitar duplicados)
    if (nombre === categoria || nombre.length < 3) {
      return; // Skip
    }
    
    // Buscar el precio asociado
    let precio = 0;
    
    // 1. Hermano siguiente
    let $precio = $nombre.next('div[class*="PriceComponent"], div[class*="Price__"]');
    
    // 2. En el mismo contenedor padre
    if ($precio.length === 0) {
      $precio = $nombre.parent().find('div[class*="PriceComponent"], div[class*="Price__"]').first();
    }
    
    // 3. En el contenedor abuelo
    if ($precio.length === 0) {
      $precio = $nombre.parent().parent().find('div[class*="PriceComponent"], div[class*="Price__"]').first();
    }
    
    if ($precio.length > 0) {
      const precioTexto = $precio.text().trim();
      precio = extractPrice(precioTexto);
    }
    
    if (nombre.length > 2 && precio > 0) {
      const producto = {
        nombre: cleanText(nombre),
        descripcion: null,
        precio: precio,
        foto: null,
        categoria: categoria,
        costo: 0,
        proveedorId: null
      };
      
      productos.push(producto);
      console.log(`    ✓ ${producto.nombre} - Bs. ${producto.precio}`);
    }
  });
  
  return productos;
};

// Extractor de productos (estrategias múltiples) - DEPRECADO, usar extractProductsFromTab
const extractProducts = ($) => {
  const productos = [];
  
  console.log('Intentando extracción con selectores específicos de malafamacomedia.com...');
  
  // Primero intentar detectar las categorías disponibles
  const categorias = [];
  $('div[class*="TabsControlItem"] div[class*="Name"]').each((index, elem) => {
    const categoria = $(elem).text().trim();
    if (categoria) {
      categorias.push(categoria);
      console.log(`Categoría detectada: ${categoria}`);
    }
  });
  
  // Estrategia 1: Usar selectores específicos para nombre y precio
  // Buscar todos los divs con clase que contiene "NameComponent"
  const nombresDivs = $('div[class*="NameComponent"], div[class*="Name__"]');
  console.log(`Encontrados ${nombresDivs.length} elementos de nombre`);
  
  nombresDivs.each((index, elem) => {
    const $nombre = $(elem);
    const nombre = $nombre.text().trim();
    
    // Filtrar si el texto es una categoría
    if (categorias.includes(nombre)) {
      return; // Skip, esto es una categoría no un producto
    }
    
    // Buscar el precio asociado (siguiente elemento o hermano)
    let precio = 0;
    
    // Intentar varias estrategias para encontrar el precio
    // 1. Hermano siguiente
    let $precio = $nombre.next('div[class*="PriceComponent"], div[class*="Price__"]');
    
    // 2. En el mismo contenedor padre
    if ($precio.length === 0) {
      $precio = $nombre.parent().find('div[class*="PriceComponent"], div[class*="Price__"]').first();
    }
    
    // 3. En el contenedor abuelo
    if ($precio.length === 0) {
      $precio = $nombre.parent().parent().find('div[class*="PriceComponent"], div[class*="Price__"]').first();
    }
    
    if ($precio.length > 0) {
      const precioTexto = $precio.text().trim();
      precio = extractPrice(precioTexto);
    }
    
    // Intentar detectar categoría del contexto más amplio
    let categoria = 'Menú';
    
    // Buscar la pestaña activa o el contenedor de productos
    const contenedorCompleto = $nombre.parents().map((i, el) => $(el).text()).get().join(' ');
    
    // Buscar en el contenedor completo cuál categoría aparece
    for (const cat of categorias) {
      if (contenedorCompleto.includes(cat)) {
        categoria = cat;
        break;
      }
    }
    
    // Si no se encontró en el contenedor, buscar en el orden del DOM
    if (categoria === 'Menú' && categorias.length > 0) {
      // Asignar una categoría basada en la posición relativa
      const indexRatio = index / nombresDivs.length;
      const catIndex = Math.floor(indexRatio * categorias.length);
      categoria = categorias[Math.min(catIndex, categorias.length - 1)];
    }
    
    if (nombre.length > 2 && precio > 0) {
      const producto = {
        nombre: cleanText(nombre),
        descripcion: null,
        precio: precio,
        foto: null,
        categoria: categoria,
        costo: 0,
        proveedorId: null
      };
      
      productos.push(producto);
      console.log(`✓ ${producto.nombre} - Bs. ${producto.precio} (${categoria})`);
    }
  });
  
  console.log(`✅ Extracción con selectores: ${productos.length} productos encontrados`);
  
  // Si no encontramos productos con selectores, intentar estrategia de texto
  if (productos.length === 0) {
    console.log('Intentando estrategia de texto como fallback...');
    return extractProductsFromText($);
  }

  return removeDuplicates(productos);
};

// Estrategia de fallback: extracción por texto
const extractProductsFromText = ($) => {
  const productos = [];
  const textoCompleto = $('body').text();
  
  console.log(`Texto completo (primeros 500 chars): ${textoCompleto.substring(0, 500)}`);
  
  // El sitio concatena todo en una línea, necesitamos dividir por "Bs. XX"
  const patronPrecio = /Bs\.\s*(\d+)/g;
  let match;
  const posicionesPrecios = [];
  
  while ((match = patronPrecio.exec(textoCompleto)) !== null) {
    posicionesPrecios.push({
      posicion: match.index,
      precio: parseFloat(match[1]),
      textoCompleto: match[0]
    });
  }
  
  console.log(`Encontrados ${posicionesPrecios.length} precios en el texto`);
  
  // Extraer categorías conocidas
  const categorias = ['Menú de Picoteo', 'Bebidas', 'Pizzas', 'Nachos', 'Sandwiches', 'Platillos'];
  const posicionesCategorias = [];
  
  categorias.forEach(cat => {
    const index = textoCompleto.indexOf(cat);
    if (index !== -1) {
      posicionesCategorias.push({ categoria: cat, posicion: index });
      console.log(`Categoría encontrada: ${cat} en posición ${index}`);
    }
  });
  
  // Ordenar posiciones de precios
  posicionesPrecios.sort((a, b) => a.posicion - b.posicion);
  
  // Para cada precio, extraer el nombre del producto
  for (let i = 0; i < posicionesPrecios.length; i++) {
    const precioActual = posicionesPrecios[i];
    
    // Determinar inicio del producto
    const inicioProducto = i > 0 ? posicionesPrecios[i - 1].posicion + posicionesPrecios[i - 1].textoCompleto.length : 0;
    
    // Extraer texto del producto
    const textoProducto = textoCompleto.substring(inicioProducto, precioActual.posicion).trim();
    
    // Extraer nombre (últimas palabras antes del precio)
    const palabras = textoProducto.split(/\s+/);
    let nombreProducto = '';
    
    if (textoProducto.length < 50) {
      nombreProducto = textoProducto;
    } else {
      nombreProducto = palabras.slice(-6).join(' ');
    }
    
    // Limpiar nombre
    categorias.forEach(cat => {
      nombreProducto = nombreProducto.replace(cat, '').trim();
    });
    
    // Determinar categoría
    let categoria = 'Menú';
    for (let j = posicionesCategorias.length - 1; j >= 0; j--) {
      if (posicionesCategorias[j].posicion < precioActual.posicion) {
        categoria = posicionesCategorias[j].categoria;
        break;
      }
    }
    
    if (nombreProducto.length > 3 && nombreProducto.length < 100) {
      const producto = {
        nombre: cleanText(nombreProducto),
        descripcion: null,
        precio: precioActual.precio,
        foto: null,
        categoria: categoria,
        costo: 0,
        proveedorId: null
      };
      
      productos.push(producto);
      console.log(`✓ ${producto.nombre} - Bs. ${producto.precio} (${categoria})`);
    }
  }

  console.log(`✅ Total: ${productos.length} productos encontrados`);
  
  // Si encontramos productos con la estrategia especial, devolverlos
  if (productos.length > 0) {
    return removeDuplicates(productos);
  }

  // Si no funcionó, intentar estrategias genéricas con selectores CSS
  const selectors = [
    // Estrategia 1: Estructura específica de Elementor
    {
      container: '.elementor-widget-wrap .elementor-element',
      name: '.elementor-heading-title, h2, h3, h4',
      price: '.elementor-text-editor p, .elementor-widget-text-editor p, p',
      description: '.elementor-text-editor p',
      image: 'img'
    },
    // Estrategia 2: Menús comunes con clases "menu-item", "product", etc.
    {
      container: '.menu-item, .product-item, .dish, .food-item, article.product',
      name: '.name, .title, h3, h4, .product-name',
      price: '.price, .cost, .amount, span[class*="price"]',
      description: '.description, .desc, p',
      image: 'img',
      category: '.category, .cat, [class*="category"]'
    },
    // Estrategia 3: Estructura de tabla
    {
      container: 'tr, .table-row',
      name: 'td:first-child, .item-name',
      price: 'td:last-child, .item-price',
      description: 'td:nth-child(2)',
      image: 'img'
    },
    // Estrategia 4: Cards o divs con data attributes
    {
      container: '[data-product], [data-item], .card',
      name: '[data-name], .card-title',
      price: '[data-price], .card-price',
      description: '[data-description], .card-text',
      image: '[data-image], .card-img-top'
    }
  ];

  // Intentar cada estrategia genérica
  for (const strategy of selectors) {
    const items = $(strategy.container);
    
    if (items.length > 0) {
      items.each((i, elem) => {
        const $item = $(elem);
        
        const nombre = $item.find(strategy.name).first().text().trim();
        const precioText = $item.find(strategy.price).first().text().trim();
        const descripcion = $item.find(strategy.description).first().text().trim();
        const imagen = $item.find(strategy.image).first().attr('src') || $item.find(strategy.image).first().attr('data-src');
        const categoria = strategy.category ? $item.find(strategy.category).first().text().trim() : null;

        // Extraer precio numérico
        const precio = extractPrice(precioText);

        // Solo agregar si tiene nombre y precio válido
        if (nombre && precio > 0) {
          productos.push({
            nombre: cleanText(nombre),
            descripcion: cleanText(descripcion) || null,
            precio,
            foto: cleanUrl(imagen),
            categoria: cleanText(categoria) || 'Sin categoría',
            costo: 0,
            proveedorId: null
          });
        }
      });
    }

    // Si encontramos productos, no intentar otras estrategias
    if (productos.length > 0) break;
  }

  return removeDuplicates(productos);
};

// Remover duplicados por nombre
const removeDuplicates = (productos) => {
  return Array.from(
    new Map(productos.map(p => [p.nombre.toLowerCase(), p])).values()
  );
};

// Extraer precio de texto
const extractPrice = (text) => {
  if (!text) return 0;
  
  // Buscar patrones de precio
  const patterns = [
    /Bs\.\s*(\d+(?:\.\d{2})?)/,         // Bs. 50, Bs. 10.50 (Bolivia)
    /\$\s*(\d+(?:\.\d{2})?)/,           // $10.00, $10
    /(\d+(?:\.\d{2})?)\s*\$/,           // 10.00$, 10$
    /(\d+(?:,\d{3})*(?:\.\d{2})?)/,     // 10,000.00
    /(\d+(?:\.\d{2})?)\s*(?:USD|MXN|EUR|soles|pesos|bs)/i  // 10.00 USD, 50 bs
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      const precio = parseFloat(match[1].replace(/,/g, ''));
      if (!isNaN(precio) && precio > 0) {
        return precio;
      }
    }
  }

  return 0;
};

// Limpiar texto
const cleanText = (text) => {
  if (!text) return '';
  return text
    .replace(/\s+/g, ' ')
    .replace(/\n+/g, ' ')
    .trim()
    .substring(0, 500); // Limitar longitud
};

// Limpiar URL de imagen
const cleanUrl = (url) => {
  if (!url) return null;
  
  // Si es una URL relativa, necesitaríamos la URL base
  if (url.startsWith('//')) {
    return 'https:' + url;
  }
  
  if (url.startsWith('/')) {
    return null; // Necesitaríamos la URL base
  }

  return url;
};

// Scraping simple con Cheerio (para sitios estáticos)
const scrapeMenuSimple = async (url) => {
  try {
    console.log(`Scraping simple de: ${url}`);
    
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      timeout: 10000
    });

    const $ = cheerio.load(response.data);
    const productos = extractProducts($);

    // Si encontramos productos, devolver resultado
    if (productos.length > 0) {
      console.log(`Scraping simple exitoso: ${productos.length} productos`);
      return {
        success: true,
        productos,
        url
      };
    }
    
    // Si no encontramos productos, es probable que sea un sitio con JavaScript
    // Usar Puppeteer para renderizar el contenido
    console.log('No se encontraron productos con scraping simple, usando Puppeteer...');
    return await scrapeMenu(url);

  } catch (error) {
    console.error('Error en scraping simple:', error.message);
    // Si falla el scraping simple, intentar con Puppeteer
    console.log('Intentando con Puppeteer debido a error...');
    return await scrapeMenu(url);
  }
};

// Validar URL antes de scraping
const validateUrl = (url) => {
  try {
    const urlObj = new URL(url);
    return urlObj.protocol === 'http:' || urlObj.protocol === 'https:';
  } catch {
    return false;
  }
};

module.exports = {
  scrapeMenu,
  scrapeMenuSimple,
  validateUrl,
  extractProducts,
  extractPrice
};
