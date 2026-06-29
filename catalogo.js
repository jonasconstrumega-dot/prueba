/* ============================================================
   catalogo.js — Lógica completa del catálogo Construmega
   Vinculado desde tienda.html con:
     <script src="catalogo.js" defer></script>

   Módulos incluidos:
     1. Carrusel dinámico de subcategorías
     2. Catálogo dinámico — Google Sheets via PapaParse
     3. Navbar — menú flotante de categorías
     4. Filtros — toggle de grupos desplegables
     5. Filtros — toggle del panel en mobile
     6. Botón MOSTRAR MÁS — barra de progreso
     7. Cart Drawer + flujo de cotización WhatsApp
     8. Modal de detalle de producto
    10. Auto-filtro por parámetros de URL
============================================================ */

  document.addEventListener('DOMContentLoaded', function () {

  /* ────────────────────────────────────────────────────────────────
     1. CARRUSEL DINÁMICO DE SUBCATEGORÍAS (círculos con imagen real)
        El sc-track se llena por JS según el contexto activo.
        Sin filtro activo → muestra TODAS las subcategorías del catálogo.
        Con filtro/búsqueda → muestra las subcategorías del rubro activo.
  ──────────────────────────────────────────────────────────────── */
  (function () {
    const track    = document.getElementById('sc-track');
    const viewport = document.getElementById('sc-viewport');
    const btnPrev  = document.getElementById('arrow-prev');
    const btnNext  = document.getElementById('arrow-next');
    const secLabel = document.getElementById('sc-section-label');

    let totalItems   = 0;
    let currentIndex = 0;
    let itemW        = 0;
    let activeSub    = null;  /* subcategoría activa en este carrusel */

    /* ── URL base de imágenes (igual que el catálogo) ── */
    const BASE     = 'https://raw.githubusercontent.com/jonasconstrumega-dot/doctor_web/main/img.github/';
    const FALLBACK = 'https://placehold.co/80x80/e0e6ef/1a2e4a?text=';

    /* ── Obtener imagen de portada para una subcategoría ──────────
       Busca el primer producto de esa subcat en _CATALOG_PRODUCTS
       y usa su campo 'imagen' directamente (ya viene limpio del Sheet).
       Esto elimina el diccionario hardcodeado y sincroniza con Google Sheets. */
    function getSubcatImage(sub) {
      var catalog = window._CATALOG_PRODUCTS || [];
      var prod    = catalog.find(function(p) { return p.subcategoria === sub && p.imagen; });
      return prod ? prod.imagen.trim() : '';
    }

    /* ── Construir una tarjeta de círculo ── */
    function buildCard(sub, cat, isActive) {
      const imgFile   = getSubcatImage(sub);
      const imgSrc    = imgFile ? BASE + imgFile : null;
      const initials  = sub.split(/[\s\/]/)[0].substring(0,2).toUpperCase();
      const noImg     = !imgFile ? ' brand-card--no-img' : '';
      const activeClass = isActive ? ' brand-card--active' : '';
      return '<li><button class="brand-card' + noImg + activeClass + '"'
        + ' data-subcat="' + sub + '" data-cat="' + cat + '"'
        + ' aria-label="Ver ' + sub + '" aria-pressed="' + isActive + '">'
        + '<div class="brand-card__circle" aria-hidden="true">'
        + (imgFile
            ? '<img class="brand-card__circle-img" src="' + imgSrc + '" alt="' + sub + '"'
              + ' loading="lazy" onerror="this.closest(\'.brand-card\').classList.add(\'brand-card--no-img\');this.style.display=\'none\'"/>'
            : '')
        + '<span class="brand-card__initials">' + initials + '</span>'
        + '</div>'
        + '<span class="brand-card__name">' + sub + '</span>'
        + '</button></li>';
    }

    /* ── Función pública: rellena el carrusel con subcategorías ──
       Llamada por renderGrid() desde el módulo 2 (catálogo).
       pivotCat: null → todas las subcats; string → subcats de esa cat.
    ─────────────────────────────────────────────────────────────── */
    window.renderSubcatCarousel = function(pivotCat, currentActiveSub) {
      if (!track) return;
      activeSub = currentActiveSub || null;

      /* Construir mapa subcat → primera categoría que la contiene */
      let pool;
      if (pivotCat) {
        pool = (window._CATALOG_PRODUCTS || []).filter(function(p) { return p.categoria === pivotCat; });
        if (secLabel) secLabel.textContent = pivotCat;
      } else {
        pool = window._CATALOG_PRODUCTS || [];
        if (secLabel) secLabel.textContent = 'Explorar por subcategorías';
      }

      const subcatMap = {};  /* sub → cat */
      pool.forEach(function(p) {
        if (!subcatMap[p.subcategoria]) subcatMap[p.subcategoria] = p.categoria;
      });
      const subcats = Object.entries(subcatMap).sort(function(a,b) { return a[0].localeCompare(b[0],'es'); });

      if (subcats.length === 0) {
        track.innerHTML = '';   /* limpieza explícita — evita duplicados */
        totalItems = 0;
        updateArrows(getColsVisible());
        return;
      }

      /* Limpiar SIEMPRE antes de re-renderizar */
      track.innerHTML = '';
      currentIndex = 0;

      track.innerHTML = subcats.map(function(entry) {
        var sub = entry[0], cat = entry[1];
        return buildCard(sub, cat, activeSub === sub);
      }).join('');

      totalItems = track.children.length;

      /* Click en tarjeta */
      track.onclick = function(e) {
        var btn = e.target.closest('.brand-card');
        if (!btn || wasDragging) return;
        var sub = btn.dataset.subcat;
        var cat = btn.dataset.cat;
        if (window.catalogAPI) {
          if (activeSub === sub) {
            activeSub = null;
            window.catalogAPI.filterByCategory(cat);
          } else {
            activeSub = sub;
            window.catalogAPI.filterBySubcat(sub, cat);
          }
        }
        document.getElementById('catalog')
          && document.getElementById('catalog').scrollIntoView({ behavior: 'smooth', block: 'start' });
      };

      /* Esperar un frame para que el DOM pinte los <li> antes de medir anchos */
      requestAnimationFrame(function() { layout(); });
    };

    /* ── Escuchar reset externo ── */
    window.addEventListener('catalogReset', function() {
      activeSub = null;
      window.renderSubcatCarousel(null, null);
    });

    /* ── Layout: ancho píxeles por ítem ── */
    function getColsVisible() {
      var vw = viewport ? viewport.offsetWidth : 800;
      if (vw >= 1100) return 10;
      if (vw >= 900)  return 8;
      if (vw >= 700)  return 6;
      if (vw >= 500)  return 4;
      if (vw >= 360)  return 3;
      return 2;
    }

    var GAP = 8;    /* debe coincidir con gap en CSS del track */

    function layout() {
      if (!track || !viewport || totalItems === 0) return;
      var cols   = getColsVisible();
      var vpW    = viewport.offsetWidth;
      /* Ancho de cada ítem = (viewport - gaps entre items visibles) / cols */
      itemW      = Math.floor((vpW - GAP * (cols - 1)) / cols);
      var items  = Array.from(track.children);
      items.forEach(function(li) {
        li.style.width    = itemW + 'px';
        li.style.minWidth = itemW + 'px';
        li.style.flexShrink = '0';
      });
      /* Ancho total del track = (itemW * n) + gaps entre todos */
      track.style.width = ((itemW * totalItems) + GAP * (totalItems - 1)) + 'px';
      var saved = track.style.transition;
      track.style.transition = 'none';
      var maxIdx = Math.max(0, totalItems - cols);
      currentIndex = Math.min(currentIndex, maxIdx);
      track.style.transform = 'translateX(-' + (currentIndex * (itemW + GAP)) + 'px)';
      void track.offsetWidth;
      track.style.transition = saved;
      updateArrows(cols);
    }

    function updateArrows(cols) {
      var maxIdx = Math.max(0, totalItems - (cols || getColsVisible()));
      if (btnPrev) btnPrev.classList.toggle('subcategories__arrow--hidden', currentIndex <= 0);
      if (btnNext) btnNext.classList.toggle('subcategories__arrow--hidden', currentIndex >= maxIdx);
    }

    function goTo(index) {
      var cols   = getColsVisible();
      var maxIdx = Math.max(0, totalItems - cols);
      currentIndex = Math.min(Math.max(index, 0), maxIdx);
      if (track) track.style.transform = 'translateX(-' + (currentIndex * (itemW + GAP)) + 'px)';
      updateArrows(cols);
    }

    if (btnPrev) btnPrev.addEventListener('click', function() { goTo(currentIndex - 1); });
    if (btnNext) btnNext.addEventListener('click', function() { goTo(currentIndex + 1); });

    /* Touch swipe */
    var touchStartX = 0, touchStartY = 0, touchLocked = false;
    if (viewport) {
      viewport.addEventListener('touchstart', function(e) {
        touchStartX = e.touches[0].clientX; touchStartY = e.touches[0].clientY; touchLocked = false;
      }, { passive: true });
      viewport.addEventListener('touchmove', function(e) {
        if (touchLocked) return;
        var dx = Math.abs(e.touches[0].clientX - touchStartX);
        var dy = Math.abs(e.touches[0].clientY - touchStartY);
        touchLocked = true;
        if (dx > dy) e.preventDefault();
      }, { passive: false });
      viewport.addEventListener('touchend', function(e) {
        var d = e.changedTouches[0].clientX - touchStartX;
        if (Math.abs(d) > 40) { d < 0 ? goTo(currentIndex + 1) : goTo(currentIndex - 1); }
      });
    }

    /* Mouse drag */
    var mouseStartX = 0, mouseDown = false, wasDragging = false;
    if (viewport) {
      viewport.addEventListener('mousedown', function(e) {
        mouseDown = true; mouseStartX = e.clientX; wasDragging = false; e.preventDefault();
      });
      window.addEventListener('mousemove', function(e) {
        if (!mouseDown) return;
        if (Math.abs(e.clientX - mouseStartX) > 6) wasDragging = true;
        if (track) { track.style.transition = 'none'; track.style.transform = 'translateX(' + (-currentIndex * itemW + (e.clientX - mouseStartX)) + 'px)'; }
      });
      window.addEventListener('mouseup', function(e) {
        if (!mouseDown) return;
        if (track) track.style.transition = '';
        var d = e.clientX - mouseStartX;
        Math.abs(d) > 50 ? (d < 0 ? goTo(currentIndex + 1) : goTo(currentIndex - 1)) : goTo(currentIndex);
        mouseDown = false;
      });
    }

    var resizeTimer;
    window.addEventListener('resize', function() { clearTimeout(resizeTimer); resizeTimer = setTimeout(layout, 100); });

    /* Init: cargar todas las subcategorías al inicio */
    requestAnimationFrame(function() {
      requestAnimationFrame(function() {
        window.renderSubcatCarousel(null, null);
      });
    });
  })();



  /* ────────────────────────────────────────────────────────────────
     2. CATÁLOGO DINÁMICO — Google Sheets en vivo via PapaParse
        Columnas exactas del Sheet:
          Nombre del Producto | Marca | Categoria | Subcategoria
          Código Original     | Imagen | Pdf | Pdf-Especiales | Video
        Paginación: 50 por página con botón MOSTRAR MÁS.
  ──────────────────────────────────────────────────────────────── */
  (function () {

    /* ══ CONSTANTES ══════════════════════════════════════════════ */
    const IMG_BASE = 'https://raw.githubusercontent.com/jonasconstrumega-dot/doctor_web/main/img.github/';
    const FB_IMG   = 'https://placehold.co/300x300/f0f4f8/1a2e4a?text=';
    const CSV_URL  = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRBHnAy15oDE6qto93wfiGZGmxfzjsoNH_Rf9S6LVjX4tZ4_xSF_PCnWX1qiAPgJA/pub?output=csv';
    const PAGE_SIZE = 50;

    /* ══ ESTADO ══════════════════════════════════════════════════ */
    let PRODUCTS     = [];
    let activeFilters = { marca: new Set(), categoria: new Set(), subcategoria: new Set() };
    let searchQuery  = '';
    let shownCount   = PAGE_SIZE;   /* cuántos productos están visibles */

    /* ══ REFERENCIAS DOM ═════════════════════════════════════════ */
    const grid        = document.getElementById('products-grid');
    const countEl     = document.querySelector('.products-count strong');
    const listMarca   = document.getElementById('filter-list-marca');
    const listCat     = document.getElementById('filter-list-categoria');
    const listSub     = document.getElementById('filter-list-subcategoria');
    const clearBtn    = document.getElementById('filters-clear');
    const searchInput = document.getElementById('search-input');
    const searchClear = document.querySelector('.search-bar__clear');
    const shownLabel  = document.getElementById('shown-count');
    const progressFill= document.getElementById('progress-fill');
    const loadMoreBtn = document.getElementById('btn-load-more');

    /* ══ SVG HELPERS ═════════════════════════════════════════════ */
    const CHECK_SVG = '<svg class="filter-option__check" viewBox="0 0 10 10"><polyline points="1.5,5 4,7.5 8.5,2.5" stroke="#fff" stroke-width="1.8" fill="none"/></svg>';
    const CART_SVG  = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>';

    /* ══ UI DE CARGA / ERROR ══════════════════════════════════════ */
    function showLoading() {
      if (!grid) return;
      grid.innerHTML =
        '<div style="grid-column:1/-1;text-align:center;padding:60px 20px;color:#aab4c2;">' +
        '<div style="width:36px;height:36px;border:3px solid #e0e6ef;border-top-color:#1a2e4a;' +
        'border-radius:50%;animation:btn-spin .8s linear infinite;margin:0 auto 16px"></div>' +
        '<p style="font-size:13px">Cargando catálogo desde Google Sheets…</p></div>';
    }
    function showError(msg) {
      if (!grid) return;
      grid.innerHTML =
        '<div style="grid-column:1/-1;text-align:center;padding:48px 20px;color:#e2001a;">' +
        '<p style="font-size:14px">⚠️ ' + msg + '</p>' +
        '<p style="font-size:12px;color:#aab4c2;margin-top:8px">Recarga la página para reintentar.</p></div>';
    }

    /* ══ MAPEO CSV → OBJETO PRODUCTO ═════════════════════════════
       Lee columnas EXACTAS del Sheet + aliases de respaldo.       */
    function g(row, keys) {
      for (var i = 0; i < keys.length; i++) {
        var v = (row[keys[i]] || '').toString().trim();
        if (v) return v;
      }
      return '';
    }
    function rowToProduct(row) {
      /* Leer marca cruda y normalizar variantes conocidas de nombre */
      var marcaRaw = g(row, ['Marca', 'marca']);

      /* Diccionario de normalización de nombres de marca.
         Clave: versión lowercase sin tildes tal como puede venir del Sheet.
         Valor: nombre canónico que se mostrará en los filtros y tarjetas.  */
      var MARCA_NORM = {
        'volcan' : 'Volcán',
        'volcan.': 'Volcán',
        'volcan ': 'Volcán',
        /* Agrega aquí otras variantes si aparecen en el Sheet */
      };
      var marcaNorm = MARCA_NORM[marcaRaw.toLowerCase().trim()] || marcaRaw;

      return {
        nombre      : g(row, ['Nombre del Producto', 'Nombre', 'nombre']),
        marca       : marcaNorm,
        categoria   : g(row, ['Categoria', 'Categoría', 'categoria']),
        subcategoria: g(row, ['Subcategoria', 'Subcategoría', 'subcategoria']),
        codigo      : g(row, ['Código Original', 'Codigo Original', 'Codigo', 'codigo', 'Código']),
        imagen      : g(row, ['Imagen', 'imagen', 'Foto', 'foto']),
        pdf         : g(row, ['Pdf', 'pdf']),
        pdfFabrica  : g(row, ['PdfFabrica', 'Pdf-Fabrica', 'pdfFabrica']),
        pdfEspecial : g(row, ['Pdf-Especiales', 'Pdf-Especial', 'PdfEspecial', 'pdfEspecial']),
        video       : g(row, ['Video', 'Video_Link', 'video']),
      };
    }

    /* ══ FILTRADO ════════════════════════════════════════════════ */
    function getFiltered() {
      const q = searchQuery.trim().toLowerCase();
      return PRODUCTS.filter(function(p) {
        var marcaOk = activeFilters.marca.size        === 0 || activeFilters.marca.has(p.marca);
        var catOk   = activeFilters.categoria.size    === 0 || activeFilters.categoria.has(p.categoria);
        var subOk   = activeFilters.subcategoria.size === 0 || activeFilters.subcategoria.has(p.subcategoria);
        var textOk  = q === ''
          || p.nombre.toLowerCase().includes(q)
          || p.codigo.toLowerCase().includes(q);
        return marcaOk && catOk && subOk && textOk;
      });
    }

    /* ══ LISTAS DE FILTRO ════════════════════════════════════════ */
    function buildList(ulEl, entries, filterKey) {
      if (!ulEl) return;
      if (entries.length === 0) {
        ulEl.innerHTML = '<li style="padding:8px 20px;font-size:12px;color:#bbb;font-style:italic;">Sin opciones</li>';
        return;
      }
      ulEl.innerHTML = entries.map(function(entry) {
        var val = entry[0], count = entry[1];
        return '<li><label class="filter-option">' +
          '<input type="checkbox" name="' + filterKey + '" value="' + val + '"' +
          (activeFilters[filterKey].has(val) ? ' checked' : '') + '>' +
          '<span class="filter-option__box">' + CHECK_SVG + '</span>' +
          '<span class="filter-option__label">' + val + '</span>' +
          '<span class="filter-option__count">(' + count + ')</span>' +
          '</label></li>';
      }).join('');
      ulEl.querySelectorAll('input[type="checkbox"]').forEach(function(cb) {
        cb.addEventListener('change', function() {
          if (cb.checked) activeFilters[filterKey].add(cb.value);
          else            activeFilters[filterKey].delete(cb.value);
          if (filterKey === 'categoria') {
            activeFilters.subcategoria = new Set();
            rebuildSubcategories();
          }
          shownCount = PAGE_SIZE;
          renderGrid();
        });
      });
    }

    function countOf(key) {
      var c = {};
      PRODUCTS.forEach(function(p) { c[p[key]] = (c[p[key]] || 0) + 1; });
      return Object.entries(c).sort(function(a,b){ return a[0].localeCompare(b[0],'es'); });
    }

    /* Diccionario de logos por marca */
    function buildMarcas() { buildList(listMarca, countOf('marca'), 'marca'); }
    function buildCategorias() { buildList(listCat,   countOf('categoria'), 'categoria'); }
    function rebuildSubcategories() {
      var subGroup = document.getElementById('filter-group-subcategoria');
      if (activeFilters.categoria.size === 0) {
        if (subGroup) { subGroup.style.display = 'none'; subGroup.setAttribute('aria-hidden','true'); }
        if (listSub)  listSub.innerHTML = '';
        return;
      }
      if (subGroup) { subGroup.style.display = ''; subGroup.removeAttribute('aria-hidden'); }
      var pool = PRODUCTS.filter(function(p){ return activeFilters.categoria.has(p.categoria); });
      var c = {};
      pool.forEach(function(p){ c[p.subcategoria] = (c[p.subcategoria]||0)+1; });
      buildList(listSub,
        Object.entries(c).sort(function(a,b){ return a[0].localeCompare(b[0],'es'); }),
        'subcategoria');
    }

    /* ══ PAGINACIÓN — actualizar barra de progreso y botón ═══════ */
    function updatePagination(total, shown) {
      if (countEl)     countEl.textContent = total;
      if (shownLabel)  shownLabel.textContent = Math.min(shown, total);
      if (progressFill) {
        var pct = total > 0 ? Math.min((shown / total) * 100, 100) : 100;
        progressFill.style.width = pct + '%';
        progressFill.closest('[role="progressbar"]') &&
          progressFill.closest('[role="progressbar"]').setAttribute('aria-valuenow', Math.min(shown, total));
      }
      if (loadMoreBtn) {
        if (shown >= total) {
          loadMoreBtn.style.display = 'none';
        } else {
          loadMoreBtn.style.display = '';
          var btnText = loadMoreBtn.querySelector('.btn-load-more__text');
          if (btnText) btnText.textContent = 'MOSTRAR MÁS';
          loadMoreBtn.disabled = false;
          loadMoreBtn.classList.remove('btn-load-more--loading');
        }
      }
    }

    /* ══ RENDER GRID (muestra solo los primeros shownCount) ══════ */
    function renderGrid() {
      var filtered = getFiltered();
      var total    = filtered.length;
      var visible  = filtered.slice(0, shownCount);

      /* Actualizar carrusel superior de subcategorías */
      var catActiva = activeFilters.categoria.size === 1
        ? [...activeFilters.categoria][0] : null;
      if (window.renderSubcatCarousel) window.renderSubcatCarousel(catActiva, null);

      if (total === 0) {
        grid.innerHTML =
          '<div style="grid-column:1/-1;text-align:center;padding:48px 20px;color:#aab4c2;">' +
          '<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#d0d8e4" stroke-width="1.4"' +
          ' style="display:block;margin:0 auto 12px">' +
          '<circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>' +
          '<p style="font-size:14px">No se encontraron productos con los filtros seleccionados.</p></div>';
        updatePagination(0, 0);
        return;
      }

      grid.innerHTML = visible.map(function(p) {
        /* Imagen: valor literal de la columna "Imagen" del Sheet.
           Los nombres ya vienen limpios (minúsculas, con extensión correcta). */
        var imgSrc  = (p.imagen || '').trim()
          ? IMG_BASE + p.imagen.trim()
          : FB_IMG + encodeURIComponent(p.marca || 'Producto');
        var imgFall = FB_IMG + encodeURIComponent(p.marca || 'Producto');

        return '<article class="product-card" data-codigo="' + p.codigo + '">' +
          '<div class="product-card__img-wrap">' +
          '<img class="product-card__img" src="' + imgSrc + '" alt="' + p.nombre + '"' +
          ' loading="lazy" onerror="this.onerror=null;this.src=\'' + imgFall + '\'"/>' +
          '</div><div class="product-card__body">' +
          '<span class="product-card__brand">' + p.marca.toUpperCase() + '</span>' +
          '<span class="product-card__code">'  + p.codigo + '</span>' +
          '<p class="product-card__name">'     + p.nombre + '</p>' +
          '<div class="product-card__price-wrap">' +
          '<span class="product-card__price">Consultar precio</span></div>' +
          '<button class="product-card__btn" aria-label="Agregar ' + p.nombre + ' al carrito">' +
          CART_SVG + ' AGREGAR</button></div></article>';
      }).join('');

      updatePagination(total, shownCount);
      window.dispatchEvent(new CustomEvent('gridRendered'));
    }

    /* Botón MOSTRAR MÁS: sumar PAGE_SIZE y re-renderizar */
    if (loadMoreBtn) {
      loadMoreBtn.addEventListener('click', function() {
        shownCount += PAGE_SIZE;
        renderGrid();
        /* Animar botón brevemente */
        loadMoreBtn.classList.add('btn-load-more--loading');
        setTimeout(function() {
          loadMoreBtn.classList.remove('btn-load-more--loading');
          var t = loadMoreBtn.querySelector('.btn-load-more__text');
          if (t) t.textContent = 'MOSTRAR MÁS';
        }, 400);
      });
    }

    /* ══ BUSCADOR ════════════════════════════════════════════════ */
    var searchDebounce;
    if (searchInput) {
      searchInput.addEventListener('input', function() {
        clearTimeout(searchDebounce);
        searchDebounce = setTimeout(function() {
          searchQuery = searchInput.value;
          shownCount  = PAGE_SIZE;   /* resetear paginación al buscar */
          renderGrid();
        }, 200);
      });
      searchInput.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
          searchInput.value = ''; searchQuery = '';
          shownCount = PAGE_SIZE; renderGrid();
        }
      });
    }
    if (searchClear) {
      searchClear.addEventListener('click', function() {
        if (searchInput) searchInput.value = '';
        searchQuery = ''; shownCount = PAGE_SIZE;
        renderGrid();
        if (searchInput) searchInput.focus();
      });
    }
    if (clearBtn) {
      clearBtn.addEventListener('click', function() {
        activeFilters = { marca: new Set(), categoria: new Set(), subcategoria: new Set() };
        searchQuery = ''; shownCount = PAGE_SIZE;
        if (searchInput) searchInput.value = '';
        buildMarcas(); buildCategorias(); rebuildSubcategories(); renderGrid();
        window.dispatchEvent(new CustomEvent('catalogReset'));
      });
    }

    /* ══ API GLOBAL ══════════════════════════════════════════════ */
    window.catalogAPI = {
      resetAll: function() {
        activeFilters = { marca: new Set(), categoria: new Set(), subcategoria: new Set() };
        searchQuery = ''; shownCount = PAGE_SIZE;
        if (searchInput) searchInput.value = '';
        buildMarcas(); buildCategorias(); rebuildSubcategories(); renderGrid();
        window.dispatchEvent(new CustomEvent('catalogReset'));
      },
      filterByCategory: function(catValue) {
        activeFilters = { marca: new Set(), categoria: new Set([catValue]), subcategoria: new Set() };
        searchQuery = ''; shownCount = PAGE_SIZE;
        if (searchInput) searchInput.value = '';
        buildMarcas(); buildCategorias(); rebuildSubcategories(); renderGrid();
      },
      filterByMarca: function(marcaValue) {
        activeFilters = { marca: new Set([marcaValue]), categoria: new Set(), subcategoria: new Set() };
        searchQuery = ''; shownCount = PAGE_SIZE;
        if (searchInput) searchInput.value = '';
        buildMarcas(); buildCategorias(); rebuildSubcategories(); renderGrid();
      },
      filterBySubcat: function(subcatValue, catValue) {
        activeFilters = {
          marca: new Set(), categoria: new Set([catValue]), subcategoria: new Set([subcatValue])
        };
        searchQuery = ''; shownCount = PAGE_SIZE;
        if (searchInput) searchInput.value = '';
        buildMarcas(); buildCategorias(); rebuildSubcategories(); renderGrid();
      },
    };

    /* ══ INIT — CSV cargado → renderizar → exponer datos ═════════
       renderGrid() se llama SÓLO desde aquí, después del fetch.
       El modal busca productos por "Código Original" via
       window._CATALOG_PRODUCTS que se llena aquí.                */
    function initCatalog(products) {
      PRODUCTS = products.filter(function(p) { return p.nombre && p.marca; });
      shownCount = PAGE_SIZE;

      /* Exponer para módulos externos (modal, carrusel, navbar) */
      var cats = [...new Set(PRODUCTS.map(function(p){ return p.categoria; }))]
        .sort(function(a,b){ return a.localeCompare(b,'es'); });
      window._CATALOG_CATEGORIES = cats;
      window._CATALOG_PRODUCTS   = PRODUCTS;
      window.dispatchEvent(new CustomEvent('catalogReady'));

      buildMarcas();
      buildCategorias();
      rebuildSubcategories();
      renderGrid();
    }

    function loadData() {
      Papa.parse(CSV_URL, {
        download      : true,
        header        : true,
        skipEmptyLines: true,
        complete: function(results) {
          if (!results.data || results.data.length === 0) {
            showError('El Google Sheet está vacío o no accesible.');
            return;
          }
          initCatalog(results.data.map(rowToProduct));
        },
        error: function(err) {
          console.error('PapaParse error:', err);
          showError('No se pudo leer el catálogo. Verifica que el Sheet esté publicado en CSV.');
        }
      });
    }

    showLoading();

    if (typeof Papa !== 'undefined') {
      loadData();
    } else {
      var s = document.createElement('script');
      s.src     = 'https://cdnjs.cloudflare.com/ajax/libs/PapaParse/5.4.1/papaparse.min.js';
      s.onload  = loadData;
      s.onerror = function() { showError('No se pudo cargar PapaParse. Verifica tu conexión.'); };
      document.head.appendChild(s);
    }

  })();




  /* ────────────────────────────────────────────────────────────────
     3. NAVBAR — Menú flotante de categorías + links estáticos
  ──────────────────────────────────────────────────────────────── */
  (function () {

    const toggleBtn  = document.getElementById('nav-toggle-btn');
    const dropdown   = document.getElementById('cat-dropdown');
    const navLinks   = document.querySelectorAll('[data-nav]');

    /* ── Marcar link activo ── */
    function setActiveLink(targetNav) {
      navLinks.forEach(l => {
        l.classList.toggle('primary-nav__link--active', l.dataset.nav === targetNav);
      });
    }

    /* ── Abrir / cerrar dropdown ── */
    function openDropdown()  {
      dropdown.classList.add('cat-dropdown--open');
      toggleBtn.setAttribute('aria-expanded', 'true');
    }
    function closeDropdown() {
      dropdown.classList.remove('cat-dropdown--open');
      toggleBtn.setAttribute('aria-expanded', 'false');
    }
    function toggleDropdown() {
      dropdown.classList.contains('cat-dropdown--open') ? closeDropdown() : openDropdown();
    }

    toggleBtn.addEventListener('click', e => { e.stopPropagation(); toggleDropdown(); });

    /* Cerrar al hacer clic fuera */
    document.addEventListener('click', e => {
      if (!dropdown.contains(e.target) && e.target !== toggleBtn) closeDropdown();
    });
    document.addEventListener('keydown', e => { if (e.key === 'Escape') closeDropdown(); });

    /* ── Construir los ítems del dropdown desde el array de productos ── */
    function buildCatDropdown() {
      if (!window._CATALOG_CATEGORIES) return;

      /* Íconos SVG dinámicos según el nombre de la categoría */
      function iconForCat(cat) {
        const c = cat.toLowerCase();
        /* Gas → llama/cilindro */
        if (c.includes('gas'))
          return '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2C8 2 4 6 4 10c0 5.5 8 12 8 12s8-6.5 8-12c0-4-4-8-8-8z"/><circle cx="12" cy="10" r="3"/></svg>';
        /* Agua / Desagüe → gota */
        if (c.includes('agua') || c.includes('desague') || c.includes('desagüe'))
          return '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2L5 12a7 7 0 0 0 14 0L12 2z"/></svg>';
        /* Aislante / Climatizacion → copo de nieve */
        if (c.includes('aislante') || c.includes('climatizacion') || c.includes('climatización'))
          return '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="2" x2="12" y2="22"/><line x1="2" y1="12" x2="22" y2="12"/><line x1="5.6" y1="5.6" x2="18.4" y2="18.4"/><line x1="18.4" y1="5.6" x2="5.6" y2="18.4"/><circle cx="12" cy="12" r="2.5"/></svg>';
        /* Coccion / Calentamiento → fuego */
        if (c.includes('coccion') || c.includes('cocción') || c.includes('calentamiento') || c.includes('calefac'))
          return '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22c-4.4 0-8-3.6-8-8 0-2.8 2-5.5 4-7 0 2 1.5 3 3 3-1-3 1-6 4-8 0 4 3 6 3 9 1.5-1 2-2.5 2-4 2 2 2 5-1 7 .5 1 .5 2 .5 2.5C18.3 20.7 15.3 22 12 22z"/></svg>';
        /* Tubos / Conexiones → llave inglesa */
        if (c.includes('tubo') || c.includes('conexion') || c.includes('conexión') || c.includes('cañ'))
          return '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>';
        /* Default → casa */
        return '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>';
      }

      dropdown.innerHTML = window._CATALOG_CATEGORIES
        .map(cat => `
          <div class="cat-dropdown__item" role="menuitem" tabindex="0" data-cat="${cat}">
            ${iconForCat(cat)}
            ${cat}
          </div>`).join('');

      /* Click en ítem → filtrar + cerrar */
      dropdown.querySelectorAll('.cat-dropdown__item').forEach(item => {
        const activate = () => {
          const cat = item.dataset.cat;
          if (window.catalogAPI) window.catalogAPI.filterByCategory(cat);
          setActiveLink('inicio');   /* reset del link activo a Inicio */
          closeDropdown();
          document.getElementById('catalog')
            ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        };
        item.addEventListener('click', activate);
        item.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') activate(); });
      });
    }

    /* ── Links estáticos del nav ── */
    navLinks.forEach(link => {
      link.addEventListener('click', e => {
        e.preventDefault();
        const action = link.dataset.nav;
        switch (action) {
          case 'inicio':
            if (window.catalogAPI) window.catalogAPI.resetAll();
            setActiveLink('inicio');
            document.getElementById('catalog')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            break;
          case 'contacto':
            document.getElementById('site-footer')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            setActiveLink('contacto');
            break;
        }
      });
    });

    /* ── Init ── */
    setActiveLink('inicio');

    /* Intentar construir dropdown (puede que PRODUCTS ya esté listo) */
    buildCatDropdown();

    /* Si aún no está, escuchar el evento que el módulo 2 disparará */
    window.addEventListener('catalogReady', buildCatDropdown);

  })();

  /* ────────────────────────────────────────────────────────────────
     4. FILTROS — Toggle de grupos desplegables
  ──────────────────────────────────────────────────────────────── */
  document.querySelectorAll('.filter-group__toggle').forEach(btn => {
    btn.addEventListener('click', () => {
      const group  = btn.closest('.filter-group');
      const isOpen = group.classList.contains('filter-group--open');
      group.classList.toggle('filter-group--open', !isOpen);
      btn.setAttribute('aria-expanded', !isOpen);
    });
  });

  /* ────────────────────────────────────────────────────────────────
     4. FILTROS — Toggle del panel en mobile
  ──────────────────────────────────────────────────────────────── */
  const mobileToggle  = document.getElementById('filters-mobile-toggle');
  const filtersPanel  = document.getElementById('filters-panel');

  mobileToggle.addEventListener('click', () => {
    const isHidden = filtersPanel.classList.toggle('filters--mobile-hidden');
    mobileToggle.setAttribute('aria-expanded', !isHidden);
    mobileToggle.textContent = '';
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('aria-hidden', 'true');
    svg.innerHTML = '<line x1="4" y1="6" x2="20" y2="6"/><line x1="8" y1="12" x2="16" y2="12"/><line x1="11" y1="18" x2="13" y2="18"/>';
    svg.style.cssText = 'width:18px;height:18px;stroke:currentColor;fill:none;stroke-width:2;flex-shrink:0';
    mobileToggle.appendChild(svg);
    mobileToggle.appendChild(document.createTextNode(isHidden ? 'Filtrar productos' : 'Ocultar filtros'));
  });

  /* ────────────────────────────────────────────────────────────────
     5. BOTÓN MOSTRAR MÁS — Barra de progreso dinámica
  ──────────────────────────────────────────────────────────────── */
  (function () {
    const btn         = document.getElementById('btn-load-more');
    const fill        = document.getElementById('progress-fill');
    const shownLabel  = document.getElementById('shown-count');
    const total       = 700;
    const pageSize    = 20;
    let shown         = 20;

    function setProgress(value) {
      const pct = Math.min((value / total) * 100, 100);
      fill.style.width = pct + '%';
      fill.closest('[role="progressbar"]').setAttribute('aria-valuenow', value);
    }

    // Inicializar barra en estado correcto
    setProgress(shown);

    btn.addEventListener('click', () => {
      if (btn.classList.contains('btn-load-more--loading')) return;

      // Estado de carga
      btn.classList.add('btn-load-more--loading');
      btn.querySelector('.btn-load-more__text').textContent = 'Cargando…';

      // Simular carga (800ms)
      setTimeout(() => {
        shown = Math.min(shown + pageSize, total);
        shownLabel.textContent = shown;
        setProgress(shown);

        btn.classList.remove('btn-load-more--loading');
        btn.querySelector('.btn-load-more__text').textContent = 'MOSTRAR MÁS';

        // Si ya se cargó todo, ocultar botón
        if (shown >= total) {
          btn.textContent = '✓ Todos los productos cargados';
          btn.disabled = true;
          btn.style.opacity = '.5';
          btn.style.cursor = 'default';
        }
      }, 800);
    });
  })();

  /* ────────────────────────────────────────────────────────────────
     7. CART DRAWER + FLUJO DE COTIZACIÓN WHATSAPP
  ──────────────────────────────────────────────────────────────── */
  (function () {

    /* ── Número WhatsApp destino (sin + ni espacios) ── */
    const WA_NUMBER = '59168729729';

    /* ── Referencias DOM ── */
    const drawer        = document.getElementById('cart-drawer');
    const overlay       = document.getElementById('drawer-overlay');
    const closeBtn      = document.getElementById('cart-close');
    const countBadge    = document.getElementById('cart-count');
    const emptyEl       = document.getElementById('cart-empty');
    const itemsList     = document.getElementById('cart-items-list');
    const footerEl      = document.getElementById('cart-footer');
    const subtotalEl    = document.getElementById('cart-subtotal');
    const totalEl       = document.getElementById('cart-total');
    const toast         = document.getElementById('cart-toast');
    const checkoutBtn   = document.getElementById('btn-checkout');

    /* Quote panel */
    const quotePanel    = document.getElementById('quote-panel');
    const quoteBack     = document.getElementById('quote-back');
    const quoteSummary  = document.getElementById('quote-summary-items');
    const whatsappBtn   = document.getElementById('btn-whatsapp');

    /* Form fields */
    const fName  = document.getElementById('qf-name');
    const fEmail = document.getElementById('qf-email');
    const fPhone = document.getElementById('qf-phone');
    const fRole  = document.getElementById('qf-role');

    /* Save modal */
    const saveOverlay = document.getElementById('save-modal-overlay');
    const saveConfirm = document.getElementById('save-modal-confirm');
    const saveText    = document.getElementById('save-modal-text');

    /* ── Estado ── */
    let cartItems  = [];
    let toastTimer = null;
    let pendingWaUrl = '';

    /* ════════════════════════════════════════════════════════════════
       DRAWER: abrir / cerrar
    ════════════════════════════════════════════════════════════════ */
    function openDrawer() {
      drawer.classList.add('cart-drawer--open');
      overlay.classList.add('drawer-overlay--visible');
      drawer.setAttribute('aria-hidden', 'false');
      document.body.style.overflow = 'hidden';
      closeBtn.focus();
    }

    function closeDrawer() {
      closeQuotePanel();   // asegurar que el form también se cierre
      drawer.classList.remove('cart-drawer--open');
      overlay.classList.remove('drawer-overlay--visible');
      drawer.setAttribute('aria-hidden', 'true');
      document.body.style.overflow = '';
    }

    overlay.addEventListener('click', closeDrawer);
    closeBtn.addEventListener('click', closeDrawer);
    document.addEventListener('keydown', e => {
      if (e.key !== 'Escape') return;
      if (quotePanel.classList.contains('quote-panel--open')) { closeQuotePanel(); return; }
      if (drawer.classList.contains('cart-drawer--open')) closeDrawer();
    });

    /* ════════════════════════════════════════════════════════════════
       QUOTE PANEL: abrir / cerrar
    ════════════════════════════════════════════════════════════════ */
    function openQuotePanel() {
      renderQuoteSummary();
      quotePanel.classList.add('quote-panel--open');
      fName.focus();
    }

    function closeQuotePanel() {
      quotePanel.classList.remove('quote-panel--open');
      clearErrors();
    }

    quoteBack.addEventListener('click', closeQuotePanel);
    checkoutBtn.addEventListener('click', openQuotePanel);

    /* ════════════════════════════════════════════════════════════════
       UTILIDADES
    ════════════════════════════════════════════════════════════════ */
    function formatPrice(n) { return '$' + n.toLocaleString('es-CL'); }
    function parsePrice(s)  { return parseInt((s || '0').replace(/\D/g,''), 10) || 0; }

    function recalcTotals() {
      const sub = cartItems.reduce((a, i) => a + i.price * i.qty, 0);
      subtotalEl.textContent = formatPrice(sub);
      totalEl.textContent    = formatPrice(sub);
    }

    function showToast(msg) {
      toast.textContent = msg;
      toast.classList.add('cart-toast--show');
      clearTimeout(toastTimer);
      toastTimer = setTimeout(() => toast.classList.remove('cart-toast--show'), 2400);
    }

    /* ════════════════════════════════════════════════════════════════
       RENDER CARRITO
    ════════════════════════════════════════════════════════════════ */
    function renderItems() {
      itemsList.innerHTML = '';

      if (cartItems.length === 0) {
        emptyEl.style.display  = 'flex';
        footerEl.style.display = 'none';
        countBadge.textContent = '0';
        /* Header badge */
        const hBadge = document.getElementById('cart-header-badge');
        if (hBadge) { hBadge.textContent = '0'; hBadge.classList.remove('cart-header-badge--visible'); }
        return;
      }

      emptyEl.style.display  = 'none';
      footerEl.style.display = 'block';
      const totalQty = cartItems.reduce((a, i) => a + i.qty, 0);
      countBadge.textContent = totalQty;
      /* Header badge */
      const hBadge = document.getElementById('cart-header-badge');
      if (hBadge) {
        hBadge.textContent = totalQty;
        hBadge.classList.toggle('cart-header-badge--visible', totalQty > 0);
      }

      cartItems.forEach((item, idx) => {
        const div = document.createElement('div');
        div.className = 'cart-item';
        div.innerHTML = `
          <div class="cart-item__img-wrap">
            <img class="cart-item__img" src="${item.img}" alt="${item.name}" loading="lazy"/>
          </div>
          <div class="cart-item__info">
            <span class="cart-item__brand">${item.brand}</span>
            <p class="cart-item__name">${item.name}</p>
            <div class="cart-item__qty">
              <button class="cart-item__qty-btn" data-action="dec" data-idx="${idx}" aria-label="Restar">−</button>
              <span class="cart-item__qty-val">${item.qty}</span>
              <button class="cart-item__qty-btn" data-action="inc" data-idx="${idx}" aria-label="Sumar">+</button>
            </div>
          </div>
          <div class="cart-item__right">
            <span class="cart-item__price">${formatPrice(item.price * item.qty)}</span>
            <button class="cart-item__remove" data-idx="${idx}" aria-label="Eliminar ${item.name}">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <polyline points="3 6 5 6 21 6"/>
                <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                <path d="M10 11v6M14 11v6M9 6V4h6v2"/>
              </svg>
            </button>
          </div>`;
        itemsList.appendChild(div);
      });
      recalcTotals();
    }

    /* Delegación en lista */
    itemsList.addEventListener('click', e => {
      const btn = e.target.closest('[data-action],[data-idx]');
      if (!btn) return;
      const idx = parseInt(btn.dataset.idx, 10);
      if (btn.dataset.action === 'inc') {
        cartItems[idx].qty = Math.min(cartItems[idx].qty + 1, 99);
      } else if (btn.dataset.action === 'dec') {
        cartItems[idx].qty--;
        if (cartItems[idx].qty <= 0) cartItems.splice(idx, 1);
      } else if (btn.classList.contains('cart-item__remove')) {
        cartItems.splice(idx, 1);
      }
      renderItems();
    });

    /* Agregar desde tarjeta */
    function addFromCard(card) {
      const brand  = card.querySelector('.product-card__brand')?.textContent.trim()  || 'Marca';
      const name   = card.querySelector('.product-card__name')?.textContent.trim()   || 'Producto';
      const priceT = card.querySelector('.product-card__price')?.textContent.trim()  || '$0';
      const imgSrc = card.querySelector('.product-card__img')?.getAttribute('src')   || '';
      const price  = parsePrice(priceT);
      const existing = cartItems.find(i => i.name === name && i.brand === brand);
      if (existing) { existing.qty = Math.min(existing.qty + 1, 99); }
      else { cartItems.push({ brand, name, price, img: imgSrc, qty: 1 }); }
      renderItems();
      openDrawer();
      showToast(`✓ "${name.substring(0, 30)}…" agregado`);
    }

    /* Exponer función para que el modal de detalle pueda agregar al carrito */
    window.addProductToCart = function(p) {
      const IMG_BASE_CART = 'https://raw.githubusercontent.com/jonasconstrumega-dot/doctor_web/main/img.github/';
      const existing = cartItems.find(i => i.name === p.nombre && i.brand === p.marca);
      if (existing) { existing.qty = Math.min(existing.qty + 1, 99); }
      else { cartItems.push({ brand: p.marca, name: p.nombre, price: 0, img: IMG_BASE_CART + p.imagen, qty: 1 }); }
      renderItems();
      openDrawer();
      showToast('✓ "' + p.nombre.substring(0, 30) + '…" agregado');
    };

    /* Header cart icon → abrir drawer */
    const headerCartBtn = document.getElementById('header-cart-btn');
    if (headerCartBtn) headerCartBtn.addEventListener('click', openDrawer);

    document.getElementById('products-grid').addEventListener('click', e => {
      const btn = e.target.closest('.product-card__btn');
      if (btn) addFromCard(btn.closest('.product-card'));
    });

    /* ════════════════════════════════════════════════════════════════
       RENDER RESUMEN EN EL FORMULARIO
    ════════════════════════════════════════════════════════════════ */
    function renderQuoteSummary() {
      quoteSummary.innerHTML = '';
      cartItems.forEach(item => {
        const row = document.createElement('div');
        row.className = 'quote-summary__item';
        row.innerHTML = `
          <span class="quote-summary__item-name">${item.brand} · ${item.name.substring(0,40)}${item.name.length>40?'…':''}</span>
          <span class="quote-summary__item-detail">×${item.qty} · ${formatPrice(item.price * item.qty)}</span>`;
        quoteSummary.appendChild(row);
      });
    }

    /* ════════════════════════════════════════════════════════════════
       VALIDACIÓN DEL FORMULARIO
    ════════════════════════════════════════════════════════════════ */
    function setError(field, errEl, show) {
      field.classList.toggle('input--error', show);
      errEl.classList.toggle('quote-field__error--show', show);
    }

    function clearErrors() {
      [[fName, 'err-name'],[fEmail,'err-email'],[fPhone,'err-phone'],[fRole,'err-role']]
        .forEach(([f, id]) => setError(f, document.getElementById(id), false));
    }

    function validateForm() {
      let ok = true;
      const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      const phoneRe = /^[\d\s\+\-\(\)]{6,}$/;

      if (!fName.value.trim())              { setError(fName,  document.getElementById('err-name'),  true); ok = false; }
      else                                  { setError(fName,  document.getElementById('err-name'),  false); }

      if (!emailRe.test(fEmail.value.trim())){ setError(fEmail, document.getElementById('err-email'), true); ok = false; }
      else                                  { setError(fEmail, document.getElementById('err-email'), false); }

      if (!phoneRe.test(fPhone.value.trim())){ setError(fPhone, document.getElementById('err-phone'), true); ok = false; }
      else                                  { setError(fPhone, document.getElementById('err-phone'), false); }

      if (!fRole.value)                     { setError(fRole,  document.getElementById('err-role'),  true); ok = false; }
      else                                  { setError(fRole,  document.getElementById('err-role'),  false); }

      return ok;
    }

    /* ════════════════════════════════════════════════════════════════
       ENVÍO: simular DB → generar URL WhatsApp → modal
    ════════════════════════════════════════════════════════════════ */
    whatsappBtn.addEventListener('click', () => {
      if (!validateForm()) return;

      /* 1. Capturar datos del formulario */
      const clientData = {
        nombre : fName.value.trim(),
        email  : fEmail.value.trim(),
        celular: fPhone.value.trim(),
        cargo  : fRole.value,
      };

      /* 2. Capturar datos del carrito */
      const productLines = cartItems.map(i =>
        `• ${i.brand} – ${i.name} (Cant: ${i.qty}, Precio unit: ${formatPrice(i.price)})`
      ).join('\n');

      const totalAmount = cartItems.reduce((a, i) => a + i.price * i.qty, 0);

      /* ── Simulación de guardado en base de datos ── */
      const dbRecord = {
        timestamp : new Date().toISOString(),
        cliente   : clientData,
        productos : cartItems.map(i => ({
          marca    : i.brand,
          nombre   : i.name,
          cantidad : i.qty,
          precio   : i.price,
          subtotal : i.price * i.qty,
        })),
        total     : totalAmount,
      };

      console.log('%c✅ Datos guardados con éxito en la Base de Datos', 'color:#22c55e;font-weight:bold;font-size:14px');
      console.table(dbRecord.cliente);
      console.log('Productos:', dbRecord.productos);
      console.log('Total:', formatPrice(totalAmount));

      /* 3. Construir mensaje WhatsApp */
      const waMessage =
`Hola, mi nombre es *${clientData.nombre}*, soy *${clientData.cargo}*.

Me gustaría cotizar los siguientes productos:

${productLines}

*Total estimado:* ${formatPrice(totalAmount)}

📧 Correo: ${clientData.email}
📱 Celular: ${clientData.celular}

Quedo a la espera de su respuesta. ¡Gracias!`;

      pendingWaUrl = `https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(waMessage)}`;

      /* 4. Mostrar modal de confirmación */
      saveText.innerHTML = `
        Tu solicitud fue registrada.<br>
        <strong>${clientData.nombre}</strong>, serás redirigido a WhatsApp para completar la cotización.`;
      saveOverlay.classList.add('save-modal-overlay--show');
      saveConfirm.focus();
    });

    /* Al confirmar en el modal → abrir WhatsApp */
    saveConfirm.addEventListener('click', () => {
      saveOverlay.classList.remove('save-modal-overlay--show');
      window.open(pendingWaUrl, '_blank', 'noopener');
      /* Limpiar todo */
      cartItems = [];
      renderItems();
      closeQuotePanel();
      closeDrawer();
      fName.value = ''; fEmail.value = ''; fPhone.value = ''; fRole.value = '';
    });

    /* Cerrar modal con Escape */
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && saveOverlay.classList.contains('save-modal-overlay--show'))
        saveOverlay.classList.remove('save-modal-overlay--show');
    });

    /* Render inicial */
    renderItems();

  })();



  /* ────────────────────────────────────────────────────────────────
     9. MODAL DE DETALLE DE PRODUCTO
        Clic en tarjeta (fuera del btn AGREGAR) → abre el modal.
        Lee campos pdf y video del objeto PRODUCTS para generar
        los botones multimedia dinámicamente.
  ──────────────────────────────────────────────────────────────── */
  (function () {
    const PDF_BASE = 'https://raw.githubusercontent.com/jonasconstrumega-dot/doctor_web/main/pdf/pdf.github/';
    const IMG_BASE = 'https://raw.githubusercontent.com/jonasconstrumega-dot/doctor_web/main/img.github/';

    const overlay   = document.getElementById('pmodal-overlay');
    const box       = document.getElementById('pmodal-box');
    const closeBtn  = document.getElementById('pmodal-close');
    const imgEl     = document.getElementById('pmodal-img');
    const brandEl   = document.getElementById('pmodal-brand');
    const codeEl    = document.getElementById('pmodal-code');
    const subcatEl  = document.getElementById('pmodal-subcat');
    const nameEl    = document.getElementById('pmodal-name');
    const catEl     = document.getElementById('pmodal-cat');
    const resEl     = document.getElementById('pmodal-resources');
    const addBtn    = document.getElementById('pmodal-add-btn');

    let currentProduct = null;   /* producto actualmente en el modal */

    /* ── Abrir modal con los datos de un producto ── */
    function openModal(p) {
      currentProduct = p;

      /* Rellenar datos básicos */
      imgEl.src     = IMG_BASE + p.imagen;
      imgEl.alt     = p.nombre;
      imgEl.onerror = () => { imgEl.src = 'https://placehold.co/600x450/f0f4f8/1a2e4a?text=' + encodeURIComponent(p.marca); };
      brandEl.textContent  = p.marca.toUpperCase();
      codeEl.textContent   = p.codigo;
      subcatEl.textContent = p.subcategoria;
      nameEl.textContent   = p.nombre;
      catEl.textContent    = p.categoria;

      /* ── Generar botones multimedia ── */
      resEl.innerHTML = '';

      const btns = [];

      /*
       * ─────────────────────────────────────────────────────────────
       *  DICCIONARIO Sheet → GitHub
       *
       *  El Google Sheet guarda los nombres de archivo tal como fueron
       *  escritos por el equipo (con espacios, mayúsculas, guiones bajos).
       *  En GitHub los archivos viven con nombres normalizados en minúsculas
       *  y con guiones.  Como los dos esquemas de nombres son incompatibles,
       *  este mapa de traducción los conecta de forma explícita y segura.
       *
       *  Clave  → valor exacto de la celda del Sheet, en minúsculas
       *            (la comparación es insensible a mayúsculas; ver resolveFilename)
       *  Valor  → nombre real del archivo en pdf/pdf.github/ de GitHub
       *
       *  Para agregar un nuevo PDF en el futuro, añade una línea más aquí.
       * ─────────────────────────────────────────────────────────────
       */
      const PDF_NAME_MAP = {
        /* ── Isolant — fichas técnicas ── */
        'ficha tecnica_supertba.pdf'         : 'catalogo-supertba.pdf',
        'ficha tecnica_multicapa.pdf'        : 'catalogo-multicapa.pdf',
        'ficha tecnica_cedronet.pdf'         : 'catalogo-cedronet.pdf',
        'ficha tecnica_themoblock.pdf'       : 'catalogo-themoblock.pdf',
        'ficha tecnica_atacama.pdf'          : 'catalogo-atacama.pdf',
        'ficha tecnica_isolantacustico.pdf'  : 'catalogo-isolantacustico.pdf',

        /* ── Agrega aquí futuras traducciones de otras marcas ── */
        /* 'nombre en sheet.pdf' : 'nombre-en-github.pdf', */
      };

      /*
       *  resolveFilename(rawName)
       *  ─────────────────────────
       *  1. Busca rawName en PDF_NAME_MAP (insensible a mayúsculas).
       *  2. Si hay coincidencia exacta → devuelve el nombre correcto de GitHub.
       *  3. Si no → aplica normalización genérica (minúsculas, espacios→guion)
       *     útil para PDFs cuyo nombre del Sheet ya coincide con GitHub,
       *     como "catalogo-isolant.pdf".
       */
      function resolveFilename(rawName) {
        const key = rawName.trim().toLowerCase();
        return PDF_NAME_MAP[key] || key.replace(/\s+/g, '-');
      }

      /*
       *  pdfUrl(rawName)
       *  ───────────────
       *  Convierte el nombre crudo del Sheet en una URL de Google Docs
       *  Viewer apuntando al archivo correcto en raw.githubusercontent.com.
       *  Cache-buster incluido para forzar recarga si el PDF fue actualizado.
       */
      function pdfUrl(rawName) {
        const filename = resolveFilename(rawName);
        return 'https://docs.google.com/viewer?url='
          + PDF_BASE + filename
          + '?v=' + Date.now()
          + '&embedded=true';
      }

      /* ── BOTÓN 1 — Catálogo General de la Empresa ──────────────
         Campo "Pdf" del Sheet.
         Ej: catalogo-isolant.pdf                                   */
      if (p.pdf && p.pdf.trim()) {
        btns.push({
          url  : pdfUrl(p.pdf),
          label: '📄 Ver Catálogo General',
          cls  : 'pmodal__btn--pdf',
        });
      }

      /* ── BOTÓN 2 — Ficha Técnica del Producto ──────────────────
         Campo "Pdf-Especiales" del Sheet.
         Ej: catalogo-supertba.pdf, catalogo-multicapa.pdf, etc.
         Se renderiza SIEMPRE que el campo exista, de forma totalmente
         independiente del botón anterior.                           */
      if (p.pdfEspecial && p.pdfEspecial.trim()) {
        btns.push({
          url  : pdfUrl(p.pdfEspecial),
          label: '📋 Ver Ficha Técnica del Producto',
          cls  : 'pmodal__btn--especial',
        });
      }

      /* ── BOTÓN 3 — Catálogo de Fábrica (Maygas / Hidro 3) ──────
         Generado automáticamente por marca cuando aplica.          */
      const ml = (p.marca || '').toLowerCase();
      if (ml.includes('maygas') || ml.includes('hidro')) {
        const fabricaFile = ml.includes('maygas') ? 'fabrica-maygas.pdf' : 'fabrica-hidro3.pdf';
        btns.push({
          url  : pdfUrl(fabricaFile),
          label: '🏭 Ver Catálogo de Fábrica',
          cls  : 'pmodal__btn--manual',
        });
      }

      /* ── BOTÓN 4 — Video explicativo ───────────────────────────
         URL directa (YouTube, Drive, etc.) — sin pasar por Viewer. */
      if (p.video && p.video.trim()) {
        btns.push({
          url  : p.video.trim(),
          label: '▶️ Ver Video Explicativo / Demostración',
          cls  : 'pmodal__btn--video',
        });
      }

      if (btns.length > 0) {
        const label = document.createElement('p');
        label.className = 'pmodal__resources-label';
        label.textContent = 'Documentación y recursos';
        resEl.appendChild(label);

        btns.forEach(function(b) {
          const a = document.createElement('a');
          a.href      = b.url;
          a.className = 'pmodal__btn ' + b.cls;
          a.target    = '_blank';
          a.rel       = 'noopener noreferrer';
          /* Los primeros 2 caracteres del label son el emoji → van al span ícono */
          a.innerHTML = '<span class="pmodal__btn-icon" aria-hidden="true">'
                      + b.label.substring(0, 2)
                      + '</span>'
                      + b.label.substring(2).trim();
          resEl.appendChild(a);
        });
      }

      /* Mostrar */
      overlay.classList.add('pmodal-overlay--open');
      document.body.style.overflow = 'hidden';
      closeBtn.focus();
    }

    /* ── Cerrar modal ── */
    function closeModal() {
      overlay.classList.remove('pmodal-overlay--open');
      document.body.style.overflow = '';
      currentProduct = null;
    }

    closeBtn.addEventListener('click', closeModal);
    overlay.addEventListener('click', function(e) {
      if (!box.contains(e.target)) closeModal();
    });
    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape' && overlay.classList.contains('pmodal-overlay--open')) closeModal();
    });

    /* ── Botón AGREGAR dentro del modal ── */
    addBtn.addEventListener('click', function() {
      if (!currentProduct) return;
      /* Reutilizar la misma lógica que los botones AGREGAR del grid */
      if (window.addProductToCart) {
        window.addProductToCart(currentProduct);
        closeModal();
      }
    });

    /* ── Delegación de clic en el grid de productos ──
       Usa event delegation sobre el contenedor padre (existe desde el HTML inicial),
       por lo que funciona con tarjetas generadas asincrónicamente.
       window._CATALOG_PRODUCTS se llena en initCatalog() antes de renderGrid(). */
    const grid = document.getElementById('products-grid');
    grid.addEventListener('click', function(e) {
      if (e.target.closest('.product-card__btn')) return;   /* ignorar btn AGREGAR */

      const card = e.target.closest('.product-card');
      if (!card) return;

      const codigo = card.dataset.codigo;
      if (!codigo) return;

      const catalog = window._CATALOG_PRODUCTS || [];
      if (catalog.length === 0) return;   /* datos aún no cargados */

      const p = catalog.find(function(x) { return x.codigo === codigo; });
      if (p) openModal(p);
    });

  })();

  
  /* ────────────────────────────────────────────────────────────────
     10. AUTO-FILTRO POR PARÁMETROS DE URL
         Lee los parámetros al cargar la página y aplica el filtro
         correspondiente en el catálogo sin intervención del usuario.

         Parámetros soportados (insensibles a mayúsculas):
           ?marca=volcan
           ?categoria=agua
           ?subcategoria=termotanques&categoria=calefaccion
           ?subcategoria=termotanques            (busca la categoría automáticamente)

         Ejemplos de URL desde construmega-home.html:
           tienda.html?marca=volcan
           tienda.html?categoria=gas
           tienda.html?subcategoria=piso+radiante&categoria=calefaccion
  ──────────────────────────────────────────────────────────────── */
  (function () {

    /**
     * Compara dos strings ignorando mayúsculas/minúsculas,
     * tildes y espacios extra — permite que el param de URL
     * sea "Piso Radiante", "piso radiante" o "piso+radiante"
     * y coincida con el valor exacto del Sheet.
     */
    function normalize(s) {
      return (s || '')
        .toLowerCase()
        .normalize('NFD').replace(/[̀-ͯ]/g, '') // quitar tildes
        .trim();
    }

    function findExact(arr, val) {
      var nv = normalize(val);
      return arr.find(function (p) { return normalize(p) === nv; });
    }

    function applyUrlFilters() {
      var api    = window.catalogAPI;
      if (!api) return;

      var params = new URLSearchParams(window.location.search);
      var pMarca = (params.get('marca')        || '').trim();
      var pCat   = (params.get('categoria')    || '').trim();
      var pSub   = (params.get('subcategoria') || '').trim();

      /* Sin ningún parámetro relevante → no hacer nada */
      if (!pMarca && !pCat && !pSub) return;

      var catalog = window._CATALOG_PRODUCTS || [];

      if (pSub) {
        /* Buscar nombre exacto de subcategoría en los datos */
        var allSubs  = catalog.map(function(p){ return p.subcategoria; });
        var realSub  = findExact(allSubs, pSub);

        /* Determinar la categoría: del parámetro URL o inferida */
        var realCat  = '';
        if (pCat) {
          var allCats = catalog.map(function(p){ return p.categoria; });
          realCat = findExact(allCats, pCat) || pCat;
        }
        if (!realCat && realSub) {
          var ref = catalog.find(function(p){ return p.subcategoria === realSub; });
          if (ref) realCat = ref.categoria;
        }

        if (realSub && realCat) {
          api.filterBySubcat(realSub, realCat);
        } else if (realCat) {
          api.filterByCategory(realCat);
        }

      } else if (pCat) {
        var allCats2 = catalog.map(function(p){ return p.categoria; });
        var realCat2 = findExact(allCats2, pCat) || pCat;
        api.filterByCategory(realCat2);

      } else if (pMarca) {
        var allMarcas = catalog.map(function(p){ return p.marca; });
        var realMarca = findExact(allMarcas, pMarca) || pMarca;
        api.filterByMarca(realMarca);
      }

      /* Scroll suave al catálogo para que el resultado sea visible */
      setTimeout(function () {
        var el = document.getElementById('catalog');
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 350);
    }

    /* Si los datos del CSV ya están en memoria, aplicar de inmediato.
       Si no, esperar el evento 'catalogReady' que dispara initCatalog(). */
    if (window._CATALOG_PRODUCTS && window._CATALOG_PRODUCTS.length > 0) {
      applyUrlFilters();
    } else {
      window.addEventListener('catalogReady', applyUrlFilters, { once: true });
    }

  })();

}); // end DOMContentLoaded