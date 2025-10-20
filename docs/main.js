const DPR = Math.max(1, Math.floor(window.devicePixelRatio || 1));

const state = {
  manifest: [],
  includeJacket: false,
  includeEDC: false,
  seed: 0,
  lastSelected: null, // persisted across actions
  currentStyle: 'casual',
  currentPools: null,
  edcPairings: [],
  currentEDC: null,
  aiGenerator: null,
};

// Deterministic PRNG (Mulberry32) seeded per action
function mulberry32(a) {
  return function () {
    let t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pickDeterministic(arr, rng) {
  if (!arr || arr.length === 0) return null;
  const idx = Math.floor(rng() * arr.length);
  return arr[idx];
}

function pickNoRepeat(arr, rng, lastId) {
  if (!arr || arr.length === 0) return null;
  if (arr.length === 1) return arr[0];
  // Try to pick different from lastId
  for (let i = 0; i < Math.min(arr.length, 8); i++) {
    const cand = pickDeterministic(arr, rng);
    if (!lastId || cand.id !== lastId) return cand;
  }
  // fallback: first different
  for (const it of arr) if (it.id !== lastId) return it;
  return arr[0];
}

async function loadManifest() {
  // Try to load from Firebase first
  try {
    const { initFirebase } = await import('./firebase-config.js');
    const { getAuth, onAuthStateChanged } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js');
    const { getFirestore, doc, getDoc } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');
    
    const firebase = await initFirebase();
    const auth = getAuth(firebase.app);
    const db = getFirestore(firebase.app);
    
    // Wait for auth state to be ready
    await new Promise(resolve => {
      const unsubscribe = onAuthStateChanged(auth, () => {
        unsubscribe();
        resolve();
      });
    });
    
    // Check if viewing specific user's closet
    const urlParams = new URLSearchParams(window.location.search);
    const username = urlParams.get('user');
    
    let items = null;
    let displayUsername = null;
    
    if (username) {
      // Load specific user's closet
      const usernameDoc = await getDoc(doc(db, 'usernames', username.toLowerCase()));
      if (usernameDoc.exists()) {
        const uid = usernameDoc.data().uid;
        const userDoc = await getDoc(doc(db, 'users', uid));
        if (userDoc.exists()) {
          items = userDoc.data().items || [];
          displayUsername = username;
        }
      }
    } else if (auth.currentUser) {
      // Load logged-in user's closet
      const userDoc = await getDoc(doc(db, 'users', auth.currentUser.uid));
      if (userDoc.exists()) {
        items = userDoc.data().items || [];
        displayUsername = auth.currentUser.displayName;
      }
    }
    
    if (items && items.length > 0) {
      state.manifest = items;
      console.log(`Loaded ${items.length} items from ${displayUsername}'s closet`);
      
      // Update user menu
      updateUserMenu(auth.currentUser, displayUsername);
      
      try {
        state.lastSelected = JSON.parse(localStorage.getItem('lastSelected') || 'null');
      } catch (_) {
        state.lastSelected = null;
      }
      return;
    }
    
    // Update user menu even if no items
    updateUserMenu(auth.currentUser, displayUsername);
  } catch (error) {
    console.log('Firebase not configured or error loading user data:', error.message);
  }
  
  // No items found - prompt user to create their closet
  console.log('No closet found - user needs to upload items');
  state.manifest = [];
  
  try {
    state.lastSelected = JSON.parse(localStorage.getItem('lastSelected') || 'null');
  } catch (_) {
    state.lastSelected = null;
  }
}

function updateUserMenu(currentUser, viewingUsername) {
  const menuUser = document.getElementById('menu-user');
  if (!menuUser) return;
  
  if (currentUser) {
    const displayName = currentUser.displayName || currentUser.email.split('@')[0];
    menuUser.textContent = `@${displayName}`;
  } else {
    if (viewingUsername) {
      menuUser.textContent = `@${viewingUsername} (guest)`;
    } else {
      menuUser.textContent = `[login]`;
    }
  }
}

window.logout = async function() {
  try {
    const { initFirebase } = await import('./firebase-config.js');
    const { getAuth, signOut } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js');
    const firebase = await initFirebase();
    const auth = getAuth(firebase.app);
    await signOut(auth);
    window.location.href = 'auth.html';
  } catch (error) {
    console.error('Logout error:', error);
  }
};

async function loadEDCPairings() {
  try {
    const res = await fetch('edc-pairings.json');
    const data = await res.json();
    state.edcPairings = data;
    console.log('EDC pairings loaded:', data.length, 'pairings');
  } catch (err) {
    console.error('EDC pairings not found:', err);
    state.edcPairings = [];
  }
}

function categorize() {
  const m = state.manifest;
  const tokens = (name) => name.toLowerCase().split(/[^a-z0-9]+/g).filter(Boolean);
  const isCrewneckBase = (item) => {
    const t = tokens(item.name);
    return t.includes('crewneck') || t.includes('crew');
  };
  const isTeeLikeBase = (item) => {
    const t = tokens(item.name);
    return t.includes('tee') || t.includes('tshirt') || t.includes('polo') || t.includes('henley') || t.includes('tank') || t.includes('wide');
  };
  const top_bases = m.filter((x) => x.category === 'top' && x.topLayer === 'base');
  const byCat = {
    top_base_tee: top_bases.filter((x) => isTeeLikeBase(x) && !isCrewneckBase(x)),
    top_base_crewneck: top_bases.filter((x) => isCrewneckBase(x)),
    top_overshirt: m.filter((x) => x.category === 'top' && x.topLayer === 'overshirt'),
    outerwear: m.filter((x) => x.category === 'outerwear' || x.category === 'jacket'),
    bottom: m.filter((x) => x.category === 'bottom' || x.category === 'pants'),
    shoes: m.filter((x) => x.category === 'shoes'),
  };
  return byCat;
}

const LOUD_COLORS = new Set(['red', 'yellow', 'purple', 'orange']);

function isDenim(colors) {
  if (!colors) return false;
  if (Array.isArray(colors)) return colors.includes('denim');
  if (colors instanceof Set) return colors.has('denim');
  return false;
}

function stylesFor(item) {
  const s = item.styleHints || [];
  return new Set(s);
}

function colorsFor(item) {
  return new Set(item.colorHints || []);
}

function intersects(a, b) {
  for (const x of a) if (b.has(x)) return true;
  return false;
}

function violatesColorBlacklist(palette) {
  const has = (c) => palette.has(c);
  if (has('navy') && has('black')) return true;
  if (has('blue') && has('black')) return true;
  return false;
}

function loudCount(palette) {
  let n = 0;
  for (const c of palette) if (LOUD_COLORS.has(c)) n++;
  return n;
}

function chooseTargetStyle(pools) {
  const candidates = ['formal', 'casual', 'street', 'sport'];
  for (const style of candidates) {
    const any = (arr) => arr.some((x) => (x.styleHints || []).includes(style) || (x.styleHints || []).length === 0);
    const okOvershirt = any(pools.top_base_tee) && any(pools.top_overshirt);
    const okCrewneckPair = any(pools.top_base_tee) && any(pools.top_base_crewneck);
    const okCommon = any(pools.bottom) && any(pools.shoes) && (!state.includeJacket || any(pools.outerwear));
    if ((okOvershirt || okCrewneckPair) && okCommon) return style;
  }
  // fallback: none matches all – prefer casual, then street, then sport, then formal
  return 'casual';
}

function filterByStyle(pools, style) {
  const f = (arr) => arr.filter((x) => (x.styleHints || []).includes(style) || (x.styleHints || []).length === 0);
  const out = {
    top_base_tee: f(pools.top_base_tee),
    top_base_crewneck: f(pools.top_base_crewneck),
    top_overshirt: f(pools.top_overshirt),
    outerwear: f(pools.outerwear),
    bottom: f(pools.bottom),
    shoes: f(pools.shoes),
  };
  // If too restrictive, relax per category
  for (const k of Object.keys(out)) if (out[k].length === 0) out[k] = pools[k];
  return out;
}

function isStyleConflict(a, b) {
  // Shoes are universally usable: do not enforce style conflict rules against shoes
  if (a?.category === 'shoes' || b?.category === 'shoes') return false;
  const A = stylesFor(a), B = stylesFor(b);
  const hasFormal = A.has('formal') || B.has('formal');
  const hasStreet = A.has('street') || B.has('street');
  const hasSport = A.has('sport') || B.has('sport');
  if (hasFormal && hasSport) return true;
  if (hasFormal && hasStreet) return true;
  return false;
}

function validCombo(sel) {
  const items = Object.values(sel).filter(Boolean);
  // one shoes enforced by construction
  // color blacklist
  const palette = new Set();
  for (const it of items) for (const c of it.colorHints || []) palette.add(c);
  if (violatesColorBlacklist(palette)) return false;
  if (loudCount(palette) > 1) return false;
  // denim-on-denim top vs bottom
  const topIsDenim = isDenim(new Set([...(sel.top_base?.colorHints||[]), ...(sel.top_overshirt?.colorHints||[])]));
  const bottomIsDenim = isDenim(sel.bottom?.colorHints || []);
  if (topIsDenim && bottomIsDenim) return false;
  // style conflicts between any pair
  for (let i = 0; i < items.length; i++)
    for (let j = i + 1; j < items.length; j++)
      if (isStyleConflict(items[i], items[j])) return false;
  return true;
}

function chooseEDCPairing(sel, rng) {
  if (!state.edcPairings || state.edcPairings.length === 0) return null;
  
  // Collect style and color hints from outfit
  const outfitStyles = new Set();
  const outfitColors = new Set();
  const items = Object.values(sel).filter(Boolean);
  for (const it of items) {
    for (const s of it.styleHints || []) outfitStyles.add(s);
    for (const c of it.colorHints || []) outfitColors.add(c);
  }
  
  // Score each EDC pairing based on compatibility
  const scored = state.edcPairings.map(pairing => {
    let score = 0;
    // Style match
    for (const style of pairing.styleHints || []) {
      if (outfitStyles.has(style)) score += 10;
    }
    // Color match
    for (const color of pairing.colorHints || []) {
      if (outfitColors.has(color)) score += 5;
    }
    // Fallback: any pairing gets at least 1 point
    if (score === 0) score = 1;
    return { pairing, score };
  });
  
  // Sort by score descending
  scored.sort((a, b) => b.score - a.score);
  
  // Pick from top 3 candidates deterministically
  const topCandidates = scored.slice(0, Math.min(3, scored.length));
  const idx = Math.floor(rng() * topCandidates.length);
  return topCandidates[idx].pairing;
}

function generateOutfit(pools, rng) {
  // Build incrementally, enforcing conflicts as we go, with no-repeat
  const last = state.lastSelected || {};
  const sel = {};
  const palette = new Set();
  const seenStyles = new Set();

  function acceptableWithCurrent(candidate) {
    // style compatibility vs selected items
    for (const k of Object.keys(sel)) {
      if (sel[k] && isStyleConflict(sel[k], candidate)) return false;
    }
    // color blacklist + loud + denim
    const nextPalette = new Set(palette);
    for (const c of candidate.colorHints || []) nextPalette.add(c);
    if (violatesColorBlacklist(nextPalette)) return false;
    if (loudCount(nextPalette) > 1) return false;
    // denim-on-denim top vs bottom
    const next = Object.assign({}, sel);
    // temp assign candidate
    if (candidate.category === 'top') {
      if (candidate.topLayer === 'base') next.top_base = candidate; else next.top_overshirt = candidate;
    } else next[candidate.category] = candidate;
    const topIsDenimLocal = isDenim(new Set([...(next.top_base?.colorHints||[]), ...(next.top_overshirt?.colorHints||[])]));
    const bottomIsDenimLocal = isDenim(next.bottom?.colorHints || []);
    if (topIsDenimLocal && bottomIsDenimLocal) return false;
    return true;
  }

  function choose(categoryKey, arr, topLayerKey) {
    let candidates = arr.slice();
    // Prefer target style if present
    if (targetStyle) {
      const styled = candidates.filter((x) => (x.styleHints || []).includes(targetStyle) || (x.styleHints || []).length === 0);
      if (styled.length) candidates = styled;
    }
    // Remove items that would cause style conflicts with already selected items
    candidates = candidates.filter(acceptableWithCurrent);
    let choice;
    if (topLayerKey) {
      choice = pickNoRepeat(candidates, rng, last[`top_${topLayerKey}`]?.id);
      if (!choice) choice = pickNoRepeat(arr, rng, last[`top_${topLayerKey}`]?.id);
      sel[`top_${topLayerKey}`] = choice || null;
    } else {
      choice = pickNoRepeat(candidates, rng, last[categoryKey]?.id);
      if (!choice) choice = pickNoRepeat(arr, rng, last[categoryKey]?.id);
      sel[categoryKey] = choice || null;
    }
    if (choice) {
      for (const c of choice.colorHints || []) palette.add(c);
      for (const s of choice.styleHints || []) seenStyles.add(s);
    }
  }

  const targetStyle = chooseTargetStyle(pools);
  // Always: left tee-like base, right overshirt/midlayer (includes shirts, hoodies, crewnecks)
  choose('top_base', pools.top_base_tee, 'base');
  choose('top_overshirt', pools.top_overshirt, 'overshirt');
  choose('bottom', pools.bottom);
  choose('shoes', pools.shoes);
  if (state.includeJacket) choose('outerwear', pools.outerwear);

  // Validate; if invalid, attempt several full reselections
  for (let attempt = 0; attempt < 8; attempt++) {
    if (sel.top_base && sel.top_overshirt && sel.bottom && sel.shoes && (!state.includeJacket || sel.outerwear)) {
      if (validCombo(sel)) return sel;
    }
    // full reselection to escape color/style traps
    // advance RNG deterministically
    rng(); rng();
    const reseedSel = {};
    // reset helpers
    for (const k of Object.keys(sel)) delete sel[k];
    palette.clear(); seenStyles.clear();
    // pick again
    choose('top_base', pools.top_base_tee, 'base');
    choose('top_overshirt', pools.top_overshirt, 'overshirt');
    choose('bottom', pools.bottom);
    choose('shoes', pools.shoes);
    if (state.includeJacket) choose('outerwear', pools.outerwear);
  }

  // Fallback: ensure at least one per category without violating main rules
  const fallback = {
    top_base: sel.top_base || pools.top_base_tee?.[0] || pools.top_base?.[0] || null,
    top_overshirt: sel.top_overshirt || pools.top_overshirt?.[0] || null,
    outerwear: state.includeJacket ? (sel.outerwear || pools.outerwear?.[0] || null) : null,
    bottom: sel.bottom || pools.bottom?.[0] || null,
    shoes: sel.shoes || pools.shoes?.[0] || null,
  };
  
  console.log('Generated outfit (before validation):', {
    top_base: fallback.top_base?.name || 'null',
    top_overshirt: fallback.top_overshirt?.name || 'null',
    outerwear: fallback.outerwear?.name || 'null',
    bottom: fallback.bottom?.name || 'null',
    shoes: fallback.shoes?.name || 'null'
  });
  
  if (validCombo(fallback)) return fallback;
  // Last resort: drop outerwear
  fallback.outerwear = null;
  return fallback;
}

function layoutSquares(W, H, includeJacket) {
  // Uniform square cells so visuals look consistent; add a bit more breathing room
  const GAP_Y = 14 * DPR;
  const GAP_X = 150 * DPR;
  const rows = includeJacket ? 4 : 3;
  const maxCols = 2; // top row has two cells

  // Compute square side S to fit both horizontally and vertically
  const S_horiz = Math.floor((W - GAP_X * (maxCols - 1)) / maxCols);
  const S_vert = Math.floor((H - GAP_Y * (rows - 1)) / rows);
  // Slightly reduce size to avoid any visual crowding
  const S = Math.max(1, Math.floor(Math.min(S_horiz, S_vert) * 0.84));

  const totalHeight = rows * S + GAP_Y * (rows - 1);
  let y = Math.floor((H - totalHeight) / 2);

  const cells = [];
  // Row 1: two cells
  {
    const rowWidth = 2 * S + GAP_X;
    let x = Math.floor((W - rowWidth) / 2);
    cells.push({ x, y, s: S, category: 'top_base' });
    x += S + GAP_X;
    cells.push({ x, y, s: S, category: 'top_overshirt' });
    y += S + GAP_Y;
  }
  // Row 2: optional outerwear
  if (includeJacket) {
    const x = Math.floor((W - S) / 2);
    cells.push({ x, y, s: S, category: 'outerwear' });
    y += S + GAP_Y;
  }
  // Row 3: bottom
  {
    const x = Math.floor((W - S) / 2);
    cells.push({ x, y, s: S, category: 'bottom' });
    y += S + GAP_Y;
  }
  // Row 4: shoes
  {
    const x = Math.floor((W - S) / 2);
    cells.push({ x, y, s: S, category: 'shoes' });
  }
  return cells;
}

async function loadImages(sel) {
  const load = async (src) => {
    return new Promise((res, rej) => {
      const img = new Image();
      img.onload = () => res(img);
      img.onerror = () => {
        console.error('Failed to load image:', src);
        rej(new Error(`Failed to load: ${src}`));
      };
      img.src = src;
    });
  };
  
  console.log('Loading images for outfit:', {
    top_base: sel.top_base?.file || 'null',
    top_overshirt: sel.top_overshirt?.file || 'null',
    outerwear: sel.outerwear?.file || 'null',
    bottom: sel.bottom?.file || 'null',
    shoes: sel.shoes?.file || 'null'
  });
  
  const images = {
    top_base: sel.top_base ? await load(sel.top_base.file) : null,
    top_overshirt: sel.top_overshirt ? await load(sel.top_overshirt.file) : null,
    outerwear: sel.outerwear ? await load(sel.outerwear.file) : null,
    bottom: sel.bottom ? await load(sel.bottom.file) : null,
    shoes: sel.shoes ? await load(sel.shoes.file) : null,
  };
  return images;
}

async function loadEDCImages(pairing) {
  if (!pairing || !pairing.items) return [];
  const load = async (src) => {
    try {
      return new Promise((res, rej) => {
        const img = new Image();
        img.onload = () => res(img);
        img.onerror = () => {
          console.warn('Failed to load EDC image:', src);
          rej(new Error(`Failed to load: ${src}`));
        };
        img.src = src;
      });
    } catch (error) {
      console.warn('Failed to load EDC image:', src, error);
      return null;
    }
  };
  const images = [];
  for (const item of pairing.items) {
    const img = await load(item.file);
    if (img) {
      images.push({ img, item });
    }
  }
  return images;
}

function draw(sel, canvas) {
  const ctx = canvas.getContext('2d');
  const cssW = canvas.clientWidth;
  const cssH = canvas.clientHeight;
  const W = Math.max(1, Math.floor(cssW * DPR));
  const H = Math.max(1, Math.floor(cssH * DPR));
  if (canvas.width !== W || canvas.height !== H) {
    canvas.width = W; canvas.height = H;
  }
  ctx.save();
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, W, H);
  const cells = layoutSquares(W, H, !!sel.outerwear);
  state.arrowHitboxes = [];
  function imgForCategory(cat) {
    if (cat === 'top_base') return sel.images.top_base;
    if (cat === 'top_overshirt') return sel.images.top_overshirt;
    if (cat === 'outerwear') return sel.images.outerwear;
    if (cat === 'bottom') return sel.images.bottom;
    if (cat === 'shoes') return sel.images.shoes;
    return null;
  }
  for (const c of cells) {
    const img = imgForCategory(c.category);
    if (!img) {
      console.warn(`Missing image for category: ${c.category}`);
      // Draw empty box to show something is missing
      ctx.save();
      ctx.strokeStyle = '#ddd';
      ctx.lineWidth = 2;
      ctx.strokeRect(c.x, c.y, c.s, c.s);
      ctx.fillStyle = '#f5f5f5';
      ctx.fillRect(c.x, c.y, c.s, c.s);
      ctx.fillStyle = '#999';
      ctx.font = `${Math.round(c.s * 0.08)}px monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`[no ${c.category}]`, c.x + c.s/2, c.y + c.s/2);
      ctx.restore();
      continue;
    }
    const iw = img.naturalWidth;
    const ih = img.naturalHeight;
    const scale = Math.min(c.s / iw, c.s / ih);
    const dw = Math.floor(iw * scale);
    const dh = Math.floor(ih * scale);
    const dx = Math.floor(c.x + (c.s - dw) / 2);
    const dy = Math.floor(c.y + (c.s - dh) / 2);
    ctx.drawImage(img, dx, dy, dw, dh);

    // Draw ultra-minimal side arrows (“<” and “>”) OUTSIDE the square
    const midY = Math.floor(c.y + c.s / 2);
    const padSide = Math.max(8 * DPR, Math.round(c.s * 0.12));
    const fontPx = Math.max(8 * DPR, Math.round(c.s * 0.05));
    ctx.save();
    ctx.font = `${fontPx}px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace`;
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#000';
    ctx.globalAlpha = 0.35;
    const leftText = '<';
    const rightText = '>';
    const leftW = Math.ceil(ctx.measureText(leftText).width);
    const rightW = Math.ceil(ctx.measureText(rightText).width);
    let leftX = c.x - padSide - Math.ceil(leftW / 2);
    let rightX = c.x + c.s + padSide + Math.ceil(rightW / 2);
    // Clamp inside canvas
    leftX = Math.max(leftW / 2, leftX);
    rightX = Math.min(W - rightW / 2, rightX);
    ctx.fillText(leftText, leftX, midY);
    ctx.fillText(rightText, rightX, midY);
    ctx.restore();
    const hitH = Math.ceil(fontPx * 3);
    const hitWL = Math.max(leftW * 3, fontPx * 3);
    const hitWR = Math.max(rightW * 3, fontPx * 3);
    state.arrowHitboxes.push({rect: {x: Math.floor(leftX - hitWL / 2), y: Math.floor(midY - hitH / 2), w: hitWL, h: hitH}, category: c.category, dir: -1});
    state.arrowHitboxes.push({rect: {x: Math.floor(rightX - hitWR / 2), y: Math.floor(midY - hitH / 2), w: hitWR, h: hitH}, category: c.category, dir: +1});
  }
  
  // Draw EDC items if enabled - IN A SQUARE IN BOTTOM RIGHT CORNER
  if (state.includeEDC && sel.edcImages && sel.edcImages.length > 0) {
    console.log('Drawing EDC items:', sel.edcImages.length);
    const S = cells.length > 0 ? cells[0].s : 100;
    const edcSquareSize = Math.floor(S * 0.85); // EDC square size
    
    // Position EDC square MORE to the right (less padding)
    const edcSquareX = W - edcSquareSize - 10 * DPR;
    const edcSquareY = H - edcSquareSize - 20 * DPR;
    
    // Store EDC square position for click detection
    state.edcSquare = { x: edcSquareX, y: edcSquareY, s: edcSquareSize };
    
    // Layout EDC items within the square as a grid
    const padding = 8 * DPR;
    const availableSize = edcSquareSize - padding * 2;
    const itemSize = Math.floor(availableSize / 2.5); // Fit 2-3 items per row
    const spacing = 6 * DPR;
    
    let offsetX = 0;
    let offsetY = 0;
    
    for (const { img, item } of sel.edcImages) {
      // Skip bag-item (they're inside bags)
      if (item.position === 'bag-item') continue;
      
      const iw = img.naturalWidth;
      const ih = img.naturalHeight;
      const scale = Math.min(itemSize / iw, itemSize / ih);
      const dw = Math.floor(iw * scale);
      const dh = Math.floor(ih * scale);
      
      // If item would go beyond square width, move to next row
      if (offsetX + dw > availableSize) {
        offsetX = 0;
        offsetY += itemSize + spacing;
      }
      
      const edcX = edcSquareX + padding + offsetX + Math.floor((itemSize - dw) / 2);
      const edcY = edcSquareY + padding + offsetY + Math.floor((itemSize - dh) / 2);
      
      // Draw with full opacity
      ctx.save();
      ctx.globalAlpha = 0.95;
      ctx.drawImage(img, edcX, edcY, dw, dh);
      ctx.restore();
      
      offsetX += itemSize + spacing;
    }
    
    // Draw arrows for EDC swapping - CLOSER to the square
    const midY = Math.floor(edcSquareY + edcSquareSize / 2);
    const padSide = Math.max(6 * DPR, Math.round(edcSquareSize * 0.05)); // Closer arrows
    const fontPx = Math.max(10 * DPR, Math.round(edcSquareSize * 0.06)); // Bigger arrows
    ctx.save();
    ctx.font = `${fontPx}px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace`;
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#000';
    ctx.globalAlpha = 0.4; // More visible
    const leftText = '<';
    const rightText = '>';
    const leftW = Math.ceil(ctx.measureText(leftText).width);
    const rightW = Math.ceil(ctx.measureText(rightText).width);
    let leftX = edcSquareX - padSide - Math.ceil(leftW / 2);
    let rightX = edcSquareX + edcSquareSize + padSide + Math.ceil(rightW / 2);
    // Ensure arrows are visible (don't clip them)
    leftX = Math.max(leftW, leftX);
    rightX = Math.min(W - rightW - 4 * DPR, rightX); // Keep right arrow fully visible
    ctx.fillText(leftText, leftX, midY);
    ctx.fillText(rightText, rightX, midY);
    ctx.restore();
    const hitH = Math.ceil(fontPx * 4);
    const hitWL = Math.max(leftW * 4, fontPx * 4);
    const hitWR = Math.max(rightW * 4, fontPx * 4);
    state.arrowHitboxes.push({rect: {x: Math.floor(leftX - hitWL / 2), y: Math.floor(midY - hitH / 2), w: hitWL, h: hitH}, category: 'edc', dir: -1});
    state.arrowHitboxes.push({rect: {x: Math.floor(rightX - hitWR / 2), y: Math.floor(midY - hitH / 2), w: hitWR, h: hitH}, category: 'edc', dir: +1});
  }
  
  ctx.restore();
  state.lastCells = cells;
}

async function regenerate(kind) {
  const emptyState = document.getElementById('empty-state');
  const canvas = document.getElementById('c');
  
  // Check if there are any items
  if (!state.manifest || state.manifest.length === 0) {
    console.log('No items in closet - showing empty state');
    
    // Check if we're viewing someone else's closet
    const urlParams = new URLSearchParams(window.location.search);
    const viewingUsername = urlParams.get('user');
    
    if (emptyState) {
      if (viewingUsername) {
        emptyState.innerHTML = `
          <p>${viewingUsername}'s closet is empty</p>
          <a href="index.html">[go to my closet]</a>
        `;
      } else {
        emptyState.innerHTML = `
          <p>your closet is empty</p>
          <a href="upload.html">[upload clothes]</a>
        `;
      }
      emptyState.classList.remove('hidden');
    }
    if (canvas) canvas.style.display = 'none';
    return;
  }
  
  // Hide empty state and show canvas if we have items
  if (emptyState) emptyState.classList.add('hidden');
  if (canvas) canvas.style.display = 'block';
  
  console.log(`Regenerating outfit (${kind}) with ${state.manifest.length} items`);
  
  let sel;
  
  // Initialize variables
  let style = state.currentStyle || 'casual';
  let pools = state.currentPools || {};
  
  // If only toggling EDC or Jacket, keep the existing outfit
  if ((kind === 'edc' || kind === 'jacket') && currentSel) {
    console.log(`Keeping existing outfit, only toggling ${kind}`);
    sel = currentSel;
    
    // Generate RNG for EDC pairing
    const rng = mulberry32(state.seed);
    
    // Update EDC if needed
    if (kind === 'edc') {
      if (state.includeEDC) {
        console.log('EDC is enabled, choosing pairing...');
        const edcPairing = chooseEDCPairing(sel, rng);
        console.log('Selected EDC pairing:', edcPairing?.name || 'none');
        if (edcPairing) {
          const edcImages = await loadEDCImages(edcPairing);
          console.log('Loaded EDC images:', edcImages.length);
          sel.edcImages = edcImages;
          state.currentEDC = edcPairing;
        }
      } else {
        // Remove EDC
        sel.edcImages = null;
        state.currentEDC = null;
      }
    }
    
    // Jacket toggling is automatic via state.includeJacket
    
  } else {
    // Generate new outfit
    state.seed = (state.seed + (kind === 'remix' ? 1 : 17)) >>> 0;
    const rng = mulberry32(state.seed);
    const poolsAll = categorize();
    style = chooseTargetStyle(poolsAll);
    pools = filterByStyle(poolsAll, style);
    console.log('Pools:', { tops: pools.top_base_tee?.length, overshirts: pools.top_overshirt?.length, pants: pools.bottom?.length, shoes: pools.shoes?.length });
    sel = generateOutfit(pools, rng);
    console.log('Selected outfit:', sel);
    const images = await loadImages(sel);
    sel.images = images;
    console.log('Images loaded:', Object.keys(images));
    
    // Load EDC if enabled
    if (state.includeEDC) {
      console.log('EDC is enabled, choosing pairing...');
      const edcPairing = chooseEDCPairing(sel, rng);
      console.log('Selected EDC pairing:', edcPairing?.name || 'none');
      if (edcPairing) {
        const edcImages = await loadEDCImages(edcPairing);
        console.log('Loaded EDC images:', edcImages.length);
        sel.edcImages = edcImages;
        state.currentEDC = edcPairing;
      }
    }
  }
  
  draw(sel, document.getElementById('c'));
  currentSel = sel;
  // persist last selection ids to rotate next time
  const last = {
    top_base: sel.top_base, top_overshirt: sel.top_overshirt,
    outerwear: sel.outerwear, bottom: sel.bottom, shoes: sel.shoes
  };
  state.lastSelected = last;
  try { localStorage.setItem('lastSelected', JSON.stringify(last)); } catch (_) {}
  state.currentStyle = style;
  state.currentPools = pools;
  return sel;
}

let currentSel = null;

// AI Outfit Functions
async function initializeAI() {
  try {
    // Wait for CONFIG to be loaded
    if (!window.CONFIG) {
      console.error('CONFIG not loaded! Waiting...');
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    console.log('window.CONFIG exists:', !!window.CONFIG);
    console.log('API Key from CONFIG:', window.CONFIG?.OPENAI_API_KEY ? 'PRESENT' : 'MISSING');
    console.log('Model from CONFIG:', window.CONFIG?.OPENAI_MODEL);
    console.log('FULL CONFIG:', window.CONFIG);
    
    // PASS THE API KEY TO THE CONSTRUCTOR!
    state.aiGenerator = new AIOutfitGenerator();
    console.log('INIZIALIZZANDO AI CON LA KEY:', window.CONFIG?.OPENAI_API_KEY ? 'CHIAVE PRESENTE' : 'CHIAVE MANCANTE!!!');
    
    await state.aiGenerator.initialize();
    console.log('AI Outfit Generator initialized');
  } catch (error) {
    console.error('Failed to initialize AI:', error);
    // Show error to user
    const status = document.getElementById('ai-status');
    if (status) {
      status.textContent = `AI Error: ${error.message}`;
      status.classList.remove('hidden');
    }
  }
}

async function showAIModal() {
  const modal = document.getElementById('ai-modal');
  const prompt = document.getElementById('ai-prompt');
  const generateBtn = document.getElementById('ai-generate');
  const status = document.getElementById('ai-status');
  
  if (!state.aiGenerator) {
    await initializeAI();
  }
  
  modal.classList.remove('hidden');
  prompt.value = '';
  generateBtn.disabled = true;
  status.classList.add('hidden');
  
  // Focus on input
  setTimeout(() => prompt.focus(), 100);
}

function hideAIModal() {
  const modal = document.getElementById('ai-modal');
  modal.classList.add('hidden');
}

async function generateAIOutfit() {
  const prompt = document.getElementById('ai-prompt');
  const generateBtn = document.getElementById('ai-generate');
  const status = document.getElementById('ai-status');
  
  if (!prompt.value.trim()) return;
  
  generateBtn.disabled = true;
  status.textContent = 'Generating outfit...';
  status.classList.remove('hidden');
  
  try {
    console.log('Generating AI outfit for:', prompt.value);
    console.log('Available items in manifest:', state.manifest);
    console.log('Manifest items count:', Array.isArray(state.manifest) ? state.manifest.length : (state.manifest?.items?.length || 0));
    console.log('STO INVIANDO QUESTO ALLA AI:', state.manifest);
    console.log('PRIMO ITEM STRUTTURA:', state.manifest[0]);
    
    const recommendation = await state.aiGenerator.generateOutfit(prompt.value, state.manifest);
    console.log('AI recommendation:', recommendation);
    
    // Apply the recommendation
    const outfit = await state.aiGenerator.applyOutfitRecommendation(recommendation, state.manifest);
    
    console.log('AI generated outfit:', outfit);
    
    // Update current selection
    currentSel = outfit;
    
    // Load images for the AI outfit
    await loadImages(outfit);
    
    // Draw the new outfit
    draw(currentSel, document.getElementById('c'));
    
    // Update state
    state.lastSelected = {
      top_base: outfit.top_base,
      top_overshirt: outfit.top_overshirt,
      outerwear: outfit.outerwear,
      bottom: outfit.bottom,
      shoes: outfit.shoes
    };
    
    // Persist selection
    try {
      localStorage.setItem('lastSelected', JSON.stringify(state.lastSelected));
    } catch (_) {}
    
    // Hide modal
    hideAIModal();
    
    // Show success message briefly
    status.textContent = `Generated: ${recommendation.reasoning}`;
    setTimeout(() => {
      status.classList.add('hidden');
    }, 3000);
    
  } catch (error) {
    console.error('AI generation failed:', error);
    status.textContent = `Error: ${error.message}`;
    generateBtn.disabled = false;
  }
}

function hookup() {
  const canvas = document.getElementById('c');
  const jacket = document.getElementById('jacket');
  const edc = document.getElementById('edc');
  const remix = document.getElementById('remix');
  const save = document.getElementById('save');
  const aiOutfit = document.getElementById('ai-outfit');
  
  // Menu toggles
  const menuToggle = document.getElementById('menu-toggle');
  const menuDropdown = document.getElementById('menu-dropdown');
  const menuLogout = document.getElementById('menu-logout');
  const optionsToggle = document.getElementById('options-toggle');
  const optionsDropdown = document.getElementById('options-dropdown');

  function updateJacketLabel() {
    jacket.textContent = `J: ${state.includeJacket ? 'ON' : 'OFF'}`;
  }

  function updateEDCLabel() {
    edc.textContent = `EDC: ${state.includeEDC ? 'ON' : 'OFF'}`;
  }

  function toggleJacket() {
    console.log('Toggling jacket:', !state.includeJacket);
    state.includeJacket = !state.includeJacket; 
    updateJacketLabel(); 
    regenerate('jacket');
  }
  
  function toggleEDC() {
    console.log('Toggling EDC:', !state.includeEDC);
    state.includeEDC = !state.includeEDC; 
    updateEDCLabel(); 
    regenerate('edc');
  }

  function doRemix() {
    regenerate('remix');
  }

  function renderToCanvas(targetWidth, targetHeight, sel) {
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = targetWidth;
    tempCanvas.height = targetHeight;
    
    const ctx = tempCanvas.getContext('2d');
    // Light beige background for editorial look
    ctx.fillStyle = '#f8f8f6';
    ctx.fillRect(0, 0, targetWidth, targetHeight);
    
    // Calculate base size for items
    const baseSize = Math.min(targetWidth, targetHeight) * 0.35;
    const padding = 60;
    
    // Define flat-lay positions for each item category
    const positions = [];
    
    // Jacket (if present) - top left, larger
    if (sel.images.outerwear) {
      positions.push({
        img: sel.images.outerwear,
        x: padding + baseSize * 0.1,
        y: padding,
        scale: 1.3
      });
    }
    
    // Top overshirt/midlayer - center-left, slightly overlapping
    if (sel.images.top_overshirt) {
      positions.push({
        img: sel.images.top_overshirt,
        x: sel.images.outerwear ? padding + baseSize * 0.8 : padding + baseSize * 0.3,
        y: sel.images.outerwear ? padding + baseSize * 0.4 : padding + baseSize * 0.2,
        scale: 1.1
      });
    }
    
    // Base tee - center, slightly lower
    if (sel.images.top_base) {
      positions.push({
        img: sel.images.top_base,
        x: targetWidth / 2 - baseSize * 0.4,
        y: sel.images.top_overshirt ? padding + baseSize * 0.6 : padding + baseSize * 0.4,
        scale: 0.9
      });
    }
    
    // Pants - center-bottom, partially overlapping top
    if (sel.images.bottom) {
      positions.push({
        img: sel.images.bottom,
        x: targetWidth / 2 - baseSize * 0.5,
        y: targetHeight - baseSize * 1.6 - padding,
        scale: 1.2
      });
    }
    
    // Shoes - bottom right
    if (sel.images.shoes) {
      positions.push({
        img: sel.images.shoes,
        x: targetWidth - baseSize - padding,
        y: targetHeight - baseSize * 0.8 - padding,
        scale: 0.85
      });
    }
    
    // Draw all clothing items
    for (const pos of positions) {
      if (!pos.img) continue;
      
      const iw = pos.img.naturalWidth;
      const ih = pos.img.naturalHeight;
      const targetSize = baseSize * pos.scale;
      const scale = Math.min(targetSize / iw, targetSize / ih);
      const dw = Math.floor(iw * scale);
      const dh = Math.floor(ih * scale);
      
      ctx.save();
      ctx.shadowColor = 'rgba(0, 0, 0, 0.08)';
      ctx.shadowBlur = 15;
      ctx.shadowOffsetX = 5;
      ctx.shadowOffsetY = 5;
      ctx.drawImage(pos.img, Math.floor(pos.x), Math.floor(pos.y), dw, dh);
      ctx.restore();
    }
    
    // Draw EDC items in top-right corner
    if (state.includeEDC && sel.edcImages && sel.edcImages.length > 0) {
      const edcSize = baseSize * 0.25;
      const edcStartX = targetWidth - edcSize * 1.8 - padding;
      const edcStartY = padding + 20;
      const edcSpacing = edcSize * 0.25;
      
      let edcX = 0;
      let edcY = 0;
      
      for (const { img, item } of sel.edcImages) {
        if (item.position === 'bag-item') continue;
        
        const iw = img.naturalWidth;
        const ih = img.naturalHeight;
        const scale = Math.min(edcSize / iw, edcSize / ih);
        const dw = Math.floor(iw * scale);
        const dh = Math.floor(ih * scale);
        
        // Wrap to next row if needed
        if (edcX > 0 && edcX + dw > edcSize * 2) {
          edcX = 0;
          edcY += edcSize + edcSpacing;
        }
        
        const finalX = edcStartX + edcX;
        const finalY = edcStartY + edcY;
        
        ctx.save();
        ctx.shadowColor = 'rgba(0, 0, 0, 0.06)';
        ctx.shadowBlur = 8;
        ctx.shadowOffsetX = 2;
        ctx.shadowOffsetY = 2;
        ctx.drawImage(img, Math.floor(finalX), Math.floor(finalY), dw, dh);
        ctx.restore();
        
        edcX += dw + edcSpacing;
      }
    }
    
    return tempCanvas;
  }
  
  function doSave() {
    if (!currentSel) {
      console.error('No outfit selected!');
      alert('No outfit to save! Please wait for the outfit to load.');
      return;
    }
    
    console.log('Saving outfit...', currentSel);
    const targetWidth = 1080;
    const targetHeight = 1920;
    
    try {
      const tempCanvas = renderToCanvas(targetWidth, targetHeight, currentSel);
      
      const link = document.createElement('a');
      link.download = `outfit-${Date.now()}.png`;
      link.href = tempCanvas.toDataURL('image/png');
      link.click();
      console.log('Outfit saved!');
    } catch (error) {
      console.error('Error saving outfit:', error);
      alert('Error saving outfit: ' + error.message);
    }
  }

  jacket.addEventListener('click', toggleJacket);
  edc.addEventListener('click', toggleEDC);
  remix.addEventListener('click', doRemix);
  save.addEventListener('click', doSave);
  aiOutfit.addEventListener('click', showAIModal);
  
  // Menu toggles
  menuToggle.addEventListener('click', (e) => {
    e.stopPropagation();
    menuDropdown.classList.toggle('open');
    optionsDropdown.classList.remove('open');
  });
  
  optionsToggle.addEventListener('click', (e) => {
    e.stopPropagation();
    optionsDropdown.classList.toggle('open');
    menuDropdown.classList.remove('open');
  });
  
  menuLogout.addEventListener('click', () => {
    window.logout();
  });
  
  // AI Modal event listeners
  const aiModal = document.getElementById('ai-modal');
  const aiModalClose = document.getElementById('ai-modal-close');
  const aiPrompt = document.getElementById('ai-prompt');
  const aiGenerate = document.getElementById('ai-generate');
  const aiExamples = document.querySelectorAll('.ai-example');
  
  aiModalClose.addEventListener('click', hideAIModal);
  aiModal.addEventListener('click', (e) => {
    if (e.target === aiModal) hideAIModal();
  });
  
  aiPrompt.addEventListener('input', () => {
    aiGenerate.disabled = !aiPrompt.value.trim();
  });
  
  aiPrompt.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && !aiGenerate.disabled) {
      generateAIOutfit();
    }
  });
  
  aiGenerate.addEventListener('click', generateAIOutfit);
  
  aiExamples.forEach(example => {
    example.addEventListener('click', () => {
      aiPrompt.value = example.dataset.prompt;
      aiGenerate.disabled = false;
      aiPrompt.focus();
    });
  });
  
  // Close dropdowns when clicking outside
  document.addEventListener('click', () => {
    menuDropdown.classList.remove('open');
    optionsDropdown.classList.remove('open');
  });

  window.addEventListener('resize', () => { if (currentSel) draw(currentSel, canvas); });
  
  // Click to handle arrow interactions
  canvas.addEventListener('click', async (e) => {
    const rect = canvas.getBoundingClientRect();
    const x = Math.floor((e.clientX - rect.left) * DPR);
    const y = Math.floor((e.clientY - rect.top) * DPR);
    
    // On mobile, check if click is on left or right half of an item cell or EDC square
    const isMobile = window.innerWidth <= 768;
    if (isMobile) {
      // Check EDC square first
      if (state.edcSquare && state.includeEDC) {
        const edc = state.edcSquare;
        if (x >= edc.x && x <= edc.x + edc.s && y >= edc.y && y <= edc.y + edc.s) {
          const centerX = edc.x + edc.s / 2;
          const dir = x < centerX ? -1 : 1;
          await cycleCategory('edc', dir);
          return;
        }
      }
      
      // Check outfit cells
      if (state.lastCells) {
        for (const c of state.lastCells) {
          // Check if click is within cell bounds
          if (x >= c.x && x <= c.x + c.s && y >= c.y && y <= c.y + c.s) {
            const cellCenterX = c.x + c.s / 2;
            const dir = x < cellCenterX ? -1 : 1;
            await cycleCategory(c.category, dir);
            return;
          }
        }
      }
    }
    
    // Desktop: use arrow hitboxes
    const hit = (state.arrowHitboxes || []).find(h => x >= h.rect.x && x <= h.rect.x + h.rect.w && y >= h.rect.y && y <= h.rect.y + h.rect.h);
    if (!hit || !currentSel) return;
    await cycleCategory(hit.category, hit.dir);
  });
  updateJacketLabel();
  updateEDCLabel();
}

(async function init() {
  await loadManifest();
  await loadEDCPairings();
  hookup();
  await regenerate('create');
})();

// Image cache for quick swapping
const imageCache = new Map();
async function loadImageCached(src) {
  if (imageCache.has(src)) return imageCache.get(src);
  
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      imageCache.set(src, img);
      resolve(img);
    };
    img.onerror = () => {
      console.error('Failed to load cached image:', src);
      reject(new Error(`Failed to load: ${src}`));
    };
    img.src = src;
  });
}

async function cycleCategory(category, dir) {
  // Handle EDC cycling separately
  if (category === 'edc') {
    if (!state.edcPairings || state.edcPairings.length === 0) return;
    
    const currentId = state.currentEDC?.id;
    let idx = Math.max(0, state.edcPairings.findIndex(x => x.id === currentId));
    
    // Cycle through EDC pairings
    idx = (idx + dir + state.edcPairings.length) % state.edcPairings.length;
    const newPairing = state.edcPairings[idx];
    
    // Load new EDC images
    const edcImages = await loadEDCImages(newPairing);
    currentSel.edcImages = edcImages;
    state.currentEDC = newPairing;
    
    draw(currentSel, document.getElementById('c'));
    return;
  }
  
  // Handle outfit item cycling
  const pools = state.currentPools || categorize();
  const sel = {...currentSel};
  const arrays = {
    top_base: pools.top_base_tee,
    top_overshirt: pools.top_overshirt,
    outerwear: pools.outerwear,
    bottom: pools.bottom,
    shoes: pools.shoes,
  };
  const arr = arrays[category] || [];
  if (!arr.length) return;
  const currentId = sel[category]?.id;
  let idx = Math.max(0, arr.findIndex(x => x.id === currentId));
  
  // Try all items in the array (infinite cycle)
  let attempts = 0;
  while (attempts < arr.length * 2) {
    idx = (idx + dir + arr.length) % arr.length;
    const candidate = arr[idx];
    const nextSel = {...sel, [category]: candidate};
    if (validCombo(nextSel)) {
      sel[category] = candidate;
      // Load only the changed image
      const img = await loadImageCached(candidate.file);
      sel.images = {...sel.images};
      if (category === 'top_base') sel.images.top_base = img;
      if (category === 'top_overshirt') sel.images.top_overshirt = img;
      if (category === 'outerwear') sel.images.outerwear = img;
      if (category === 'bottom') sel.images.bottom = img;
      if (category === 'shoes') sel.images.shoes = img;
      currentSel = sel;
      draw(sel, document.getElementById('c'));
      // persist
      const last = {
        top_base: sel.top_base, top_overshirt: sel.top_overshirt,
        outerwear: sel.outerwear, bottom: sel.bottom, shoes: sel.shoes
      };
      state.lastSelected = last;
      try { localStorage.setItem('lastSelected', JSON.stringify(last)); } catch (_) {}
      return;
    }
    attempts++;
  }
}


