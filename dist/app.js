const config = window.SITE_CONFIG || {};
const state = { catalog: { categories: [], products: [] }, category: 'all', search: '', sort: 'featured', cart: loadCart() };
const $ = (selector) => document.querySelector(selector);
const grid = $('#product-grid');
const tabs = $('#category-tabs');
const drawer = $('#cart-drawer');
const checkoutModal = $('#checkout-modal');
let toastTimer;

function loadCart() {
  try { return JSON.parse(localStorage.getItem('minee-craft-cart') || '{}'); } catch { return {}; }
}
function saveCart() {
  try { localStorage.setItem('minee-craft-cart', JSON.stringify(state.cart)); } catch { showToast('Your browser could not save the bag between visits.'); }
}
function escapeHtml(value = '') {
  return String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
}
function categoryName(id) {
  return state.catalog.categories.find((category) => category.id === id)?.name || 'Handmade';
}
function filteredProducts() {
  const term = state.search.trim().toLowerCase();
  const products = state.catalog.products.filter((product) => {
    const matchesCategory = state.category === 'all' || product.category === state.category;
    const haystack = `${product.name} ${product.description || ''} ${categoryName(product.category)}`.toLowerCase();
    return matchesCategory && (!term || haystack.includes(term));
  });
  if (state.sort === 'name') products.sort((a, b) => a.name.localeCompare(b.name));
  if (state.sort === 'featured') products.sort((a, b) => Number(Boolean(b.featured)) - Number(Boolean(a.featured)));
  return products;
}
function renderTabs() {
  const categories = [{ id: 'all', name: 'Everything' }, ...state.catalog.categories];
  tabs.innerHTML = categories.map((category) => `<button class="category-tab${state.category === category.id ? ' active' : ''}" type="button" data-category="${escapeHtml(category.id)}" aria-pressed="${state.category === category.id}">${escapeHtml(category.name)}</button>`).join('');
}
function renderProducts() {
  const products = filteredProducts();
  grid.innerHTML = products.map((product, index) => `<article class="product-card" style="animation-delay:${Math.min(index % 8, 7) * 35}ms"><div class="product-image-wrap"><img src="/${escapeHtml(product.image)}" alt="${escapeHtml(product.name)}" loading="lazy">${product.featured ? '<span class="product-label">Studio favourite</span>' : ''}<button class="quick-add" type="button" data-add="${escapeHtml(product.id)}" aria-label="Add ${escapeHtml(product.name)} to bag">+</button></div><div class="product-info"><div><p class="product-category">${escapeHtml(categoryName(product.category))}</p><h3 class="product-title">${escapeHtml(product.name)}</h3></div></div></article>`).join('');
  $('#result-count').textContent = `${products.length} ${products.length === 1 ? 'handmade find' : 'handmade finds'}`;
  $('#empty-state').hidden = products.length > 0;
  grid.hidden = products.length === 0;
}
function cartEntries() {
  return Object.entries(state.cart).map(([id, entry]) => {
    const product = state.catalog.products.find((item) => item.id === id);
    return product ? { ...product, quantity: Math.max(1, Number(entry.quantity) || 1), note: entry.note || '' } : null;
  }).filter(Boolean);
}
function cartCount() {
  return cartEntries().reduce((sum, item) => sum + item.quantity, 0);
}
function renderCart() {
  const items = cartEntries();
  const count = cartCount();
  $('#cart-count').textContent = count;
  $('#cart-count').setAttribute('aria-label', `${count} items in bag`);
  $('#drawer-item-count').textContent = count ? `(${count})` : '';
  $('#cart-empty').style.display = items.length ? 'none' : 'flex';
  $('#drawer-footer').style.display = items.length ? 'block' : 'none';
  $('#cart-items').innerHTML = items.map((item) => `<div class="cart-line"><img src="/${escapeHtml(item.image)}" alt="" loading="lazy"><div class="cart-line-main"><h3 class="cart-line-title">${escapeHtml(item.name)}</h3><input class="cart-line-note" type="text" maxlength="140" data-note="${escapeHtml(item.id)}" value="${escapeHtml(item.note)}" placeholder="Colour or customisation note"></div><div class="cart-line-side"><div><div class="quantity-control"><button type="button" data-quantity="${escapeHtml(item.id)}" data-delta="-1" aria-label="Decrease quantity">−</button><span>${item.quantity}</span><button type="button" data-quantity="${escapeHtml(item.id)}" data-delta="1" aria-label="Increase quantity">+</button></div><button class="cart-remove" type="button" data-remove="${escapeHtml(item.id)}">Remove</button></div></div></div>`).join('');
  $('#delivery-note').textContent = config.deliveryNote || 'Delivery charges and payment details will be confirmed on WhatsApp.';
  $('#checkout-summary-count').textContent = `${count} ${count === 1 ? 'item' : 'items'} · delivery confirmed on WhatsApp`;
}
function showToast(message) {
  const toast = $('#toast');
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 2300);
}
function addToCart(id) {
  const existing = state.cart[id];
  state.cart[id] = { quantity: (existing?.quantity || 0) + 1, note: existing?.note || '' };
  saveCart();
  renderCart();
  showToast('Added to your bag');
}
function setDrawer(open) {
  drawer.classList.toggle('open', open);
  drawer.setAttribute('aria-hidden', String(!open));
  $('#drawer-backdrop').hidden = !open;
  document.body.classList.toggle('no-scroll', open || checkoutModal.classList.contains('open'));
  if (open) $('#cart-close').focus();
}
function setCheckout(open) {
  checkoutModal.classList.toggle('open', open);
  checkoutModal.setAttribute('aria-hidden', String(!open));
  $('#checkout-backdrop').hidden = !open;
  document.body.classList.toggle('no-scroll', open || drawer.classList.contains('open'));
  if (open) checkoutModal.querySelector('input[name="name"]').focus();
}
function submitOrder(event) {
  event.preventDefault();
  const items = cartEntries();
  if (!items.length) return showToast('Add a craft to your bag first.');
  const number = String(config.whatsappNumber || '').replace(/\D/g, '');
  if (number.length < 8) return showToast('The shop WhatsApp number is not configured yet.');
  const form = new FormData(event.currentTarget);
  const date = event.currentTarget.querySelector('input[name="date"]').value;
  const orderLines = items.map((item) => {
    const options = [`${item.name} × ${item.quantity}`];
    if (item.note.trim()) options.push(`  Note: ${item.note.trim()}`);
    return options.join('\n');
  });
  const message = [
    `Hello ${config.storeName || "Minee's Crafts"}! I'd like to place an order:`,
    '',
    ...orderLines,
    '',
    '',
    'DELIVERY DETAILS',
    `Name: ${form.get('name').trim()}`,
    `Phone: ${form.get('phone').trim()}`,
    `Address: ${form.get('address').trim()}`,
    date ? `Preferred delivery date: ${date}` : '',
    form.get('deliveryNote')?.trim() ? `Delivery note: ${form.get('deliveryNote').trim()}` : ''
  ].filter(Boolean).join('\n');
  const whatsappUrl = `https://wa.me/${number}?text=${encodeURIComponent(message)}`;
  window.open(whatsappUrl, '_blank', 'noopener,noreferrer');
  setCheckout(false);
  showToast('Your order is ready in WhatsApp. Tap send to confirm!');
}
async function init() {
  try {
    const response = await fetch('/catalog.json');
    if (!response.ok) throw new Error('Catalog could not be loaded');
    state.catalog = await response.json();
  } catch (error) {
    console.error(error);
    grid.innerHTML = '<p class="load-error">The collection could not be loaded. Please refresh the page.</p>';
    return;
  }
  renderTabs();
  renderProducts();
  renderCart();
  $('#sort-select').querySelectorAll('option[value^="price-"]').forEach((option) => option.remove());
  $('.subtotal-row').remove();
  $('#checkout-summary-total').remove();
  const featured = state.catalog.products.find((product) => product.id === 'wooden-maple-leaf') || state.catalog.products.find((product) => product.featured) || state.catalog.products[0];
  const second = state.catalog.products.find((product) => product.id === 'candle-peony') || state.catalog.products.find((product) => product.category === 'candles');
  if (featured) $('#hero-image').src = `/${featured.image}`;
  if (second) $('#hero-image-small').src = `/${second.image}`;
  const studio = state.catalog.products.find((product) => product.id === 'wooden-lotus-mandala-star') || state.catalog.products.find((product) => product.category === 'wooden-holders');
  if (studio) $('#studio-image').src = `/${studio.image}`;
  $('#year').textContent = new Date().getFullYear();
}

tabs.addEventListener('click', (event) => {
  const button = event.target.closest('[data-category]');
  if (!button) return;
  state.category = button.dataset.category;
  renderTabs();
  renderProducts();
});
$('#search-input').addEventListener('input', (event) => { state.search = event.target.value; renderProducts(); });
$('#sort-select').addEventListener('change', (event) => { state.sort = event.target.value; renderProducts(); });
grid.addEventListener('click', (event) => { const button = event.target.closest('[data-add]'); if (button) addToCart(button.dataset.add); });
$('#clear-filters').addEventListener('click', () => { state.category = 'all'; state.search = ''; $('#search-input').value = ''; renderTabs(); renderProducts(); });
$('#cart-open').addEventListener('click', () => setDrawer(true));
$('#cart-close').addEventListener('click', () => setDrawer(false));
$('#drawer-backdrop').addEventListener('click', () => setDrawer(false));
$('#continue-shopping').addEventListener('click', () => setDrawer(false));
$('#cart-items').addEventListener('click', (event) => {
  const quantityButton = event.target.closest('[data-quantity]');
  const removeButton = event.target.closest('[data-remove]');
  if (quantityButton) {
    const id = quantityButton.dataset.quantity;
    const quantity = (state.cart[id]?.quantity || 1) + Number(quantityButton.dataset.delta);
    if (quantity < 1) delete state.cart[id]; else state.cart[id].quantity = quantity;
    saveCart(); renderCart();
  }
  if (removeButton) { delete state.cart[removeButton.dataset.remove]; saveCart(); renderCart(); }
});
$('#cart-items').addEventListener('input', (event) => {
  const input = event.target.closest('[data-note]');
  if (!input || !state.cart[input.dataset.note]) return;
  state.cart[input.dataset.note].note = input.value;
  saveCart();
});
$('#cart-clear').addEventListener('click', () => { state.cart = {}; saveCart(); renderCart(); });
$('#checkout-open').addEventListener('click', () => {
  if (!cartEntries().length) return showToast('Add a craft to your bag first.');
  setCheckout(true);
});
$('#checkout-close').addEventListener('click', () => setCheckout(false));
$('#checkout-backdrop').addEventListener('click', () => setCheckout(false));
$('#checkout-form').addEventListener('submit', submitOrder);
document.addEventListener('keydown', (event) => {
  if (event.key !== 'Escape') return;
  if (checkoutModal.classList.contains('open')) setCheckout(false);
  else if (drawer.classList.contains('open')) setDrawer(false);
});
await init();
