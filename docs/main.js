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
    const { getAuth } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js');
    const { getFirestore, doc, getDoc, collection, query, where, getDocs } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');
    
    const firebase = await initFirebase();
    const auth = getAuth(firebase.app);
    const db = getFirestore(firebase.app);
    
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
  
  // Fallback to static manifest.json
  try {
    const res = await fetch('manifest.json');
    const data = await res.json();
    state.manifest = data;
    console.log('Loaded static manifest');
  } catch (error) {
    console.error('Error loading manifest:', error);
    state.manifest = [];
  }
  
  try {
    state.lastSelected = JSON.parse(localStorage.getItem('lastSelected') || 'null');
  } catch (_) {
    state.lastSelected = null;
  }
}

function updateUserMenu(currentUser, viewingUsername) {
  const userMenu = document.getElementById('user-menu');
  if (!userMenu) return;
  
  if (currentUser) {
    if (viewingUsername && viewingUsername !== currentUser.displayName) {
      userMenu.innerHTML = `
        <span style="font-size: 12px; color: #666; margin-right: 12px;">Viewing ${viewingUsername}'s closet</span>
        <a href="index.html">My Closet</a>
        <a href="upload.html">Upload</a>
        <a href="#" onclick="logout()">Logout</a>
      `;
    } else {
      userMenu.innerHTML = `
        <span style="font-size: 12px; color: #666; margin-right: 12px;">${currentUser.email}</span>
        <a href="upload.html">Upload</a>
        <a href="#" onclick="logout()">Logout</a>
      `;
    }
  } else {
    if (viewingUsername) {
      userMenu.innerHTML = `
        <span style="font-size: 12px; color: #666; margin-right: 12px;">${viewingUsername}'s closet</span>
        <a href="auth.html">Login</a>
      `;
    } else {
      userMenu.innerHTML = `<a href="auth.html">Login</a>`;
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
    outerwear: m.filter((x) => x.category === 'outerwear'),
    bottom: m.filter((x) => x.category === 'bottom'),
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
    top_base: sel.top_base || pools.top_base[0] || null,
    top_overshirt: sel.top_overshirt || pools.top_overshirt[0] || null,
    outerwear: state.includeJacket ? (sel.outerwear || pools.outerwear[0] || null) : null,
    bottom: sel.bottom || pools.bottom[0] || null,
    shoes: sel.shoes || pools.shoes[0] || null,
  };
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
  const load = (src) => new Promise((res, rej) => {
    const img = new Image();
    img.onload = () => res(img);
    img.onerror = rej;
    img.src = src;
  });
  const images = {
    top_base: await load(sel.top_base.file),
    top_overshirt: await load(sel.top_overshirt.file),
    outerwear: sel.outerwear ? await load(sel.outerwear.file) : null,
    bottom: await load(sel.bottom.file),
    shoes: await load(sel.shoes.file),
  };
  return images;
}

async function loadEDCImages(pairing) {
  if (!pairing || !pairing.items) return [];
  const load = (src) => new Promise((res, rej) => {
    const img = new Image();
    img.onload = () => res(img);
    img.onerror = (e) => { console.warn('Failed to load EDC image:', src, e); res(null); };
    img.src = src;
  });
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
    
    // Position EDC square in bottom right corner
    const edcSquareX = W - edcSquareSize - 20 * DPR;
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
    
    // Draw arrows for EDC swapping (similar to outfit items)
    const midY = Math.floor(edcSquareY + edcSquareSize / 2);
    const padSide = Math.max(8 * DPR, Math.round(edcSquareSize * 0.08));
    const fontPx = Math.max(8 * DPR, Math.round(edcSquareSize * 0.04));
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
    let leftX = edcSquareX - padSide - Math.ceil(leftW / 2);
    let rightX = edcSquareX + edcSquareSize + padSide + Math.ceil(rightW / 2);
    leftX = Math.max(leftW / 2, leftX);
    rightX = Math.min(W - rightW / 2, rightX);
    ctx.fillText(leftText, leftX, midY);
    ctx.fillText(rightText, rightX, midY);
    ctx.restore();
    const hitH = Math.ceil(fontPx * 3);
    const hitWL = Math.max(leftW * 3, fontPx * 3);
    const hitWR = Math.max(rightW * 3, fontPx * 3);
    state.arrowHitboxes.push({rect: {x: Math.floor(leftX - hitWL / 2), y: Math.floor(midY - hitH / 2), w: hitWL, h: hitH}, category: 'edc', dir: -1});
    state.arrowHitboxes.push({rect: {x: Math.floor(rightX - hitWR / 2), y: Math.floor(midY - hitH / 2), w: hitWR, h: hitH}, category: 'edc', dir: +1});
  }
  
  ctx.restore();
  state.lastCells = cells;
}

async function regenerate(kind) {
  // Deterministic seed per action
  state.seed = (state.seed + (kind === 'remix' ? 1 : 17)) >>> 0;
  const rng = mulberry32(state.seed);
  const poolsAll = categorize();
  const style = chooseTargetStyle(poolsAll);
  const pools = filterByStyle(poolsAll, style);
  const sel = generateOutfit(pools, rng);
  const images = await loadImages(sel);
  sel.images = images;
  
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
  } else {
    sel.edcImages = [];
    state.currentEDC = null;
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

function hookup() {
  const canvas = document.getElementById('c');
  const create = document.getElementById('create');
  const jacket = document.getElementById('jacket');
  const edc = document.getElementById('edc');
  const remix = document.getElementById('remix');
  const download = document.getElementById('download');
  const save15 = document.getElementById('save15');
  
  // Mobile buttons
  const jacketMobile = document.getElementById('jacket-mobile');
  const edcMobile = document.getElementById('edc-mobile');
  const remixMobile = document.getElementById('remix-mobile');
  const saveMobile = document.getElementById('save-mobile');

  function updateJacketLabel() {
    jacket.textContent = `Jacket: ${state.includeJacket ? 'ON' : 'OFF'}`;
    if (jacketMobile) {
      jacketMobile.textContent = `J: ${state.includeJacket ? 'ON' : 'OFF'}`;
    }
  }
  
  function updateEDCLabel() {
    edc.textContent = `EDC: ${state.includeEDC ? 'ON' : 'OFF'}`;
    if (edcMobile) {
      edcMobile.textContent = `EDC: ${state.includeEDC ? 'ON' : 'OFF'}`;
    }
  }

  function toggleJacket(e) {
    e.preventDefault(); 
    state.includeJacket = !state.includeJacket; 
    updateJacketLabel(); 
    regenerate('jacket');
  }
  
  function toggleEDC(e) {
    e.preventDefault(); 
    state.includeEDC = !state.includeEDC; 
    updateEDCLabel(); 
    regenerate('edc');
  }

  function doRemix(e) {
    e.preventDefault(); 
    regenerate('remix');
  }

  function renderToCanvas(targetWidth, targetHeight, sel) {
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = targetWidth;
    tempCanvas.height = targetHeight;
    
    const ctx = tempCanvas.getContext('2d');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, targetWidth, targetHeight);
    
    const cells = layoutSquares(targetWidth, targetHeight, !!sel.outerwear);
    const S = cells[0]?.s || 100;
    
    // Draw outfit items
    for (const c of cells) {
      const img = sel.images[c.category] || (c.category === 'top_base' ? sel.images.top_base : 
                   c.category === 'top_overshirt' ? sel.images.top_overshirt : null);
      if (!img) continue;
      const iw = img.naturalWidth;
      const ih = img.naturalHeight;
      const scale = Math.min(c.s / iw, c.s / ih);
      const dw = Math.floor(iw * scale);
      const dh = Math.floor(ih * scale);
      const dx = Math.floor(c.x + (c.s - dw) / 2);
      const dy = Math.floor(c.y + (c.s - dh) / 2);
      ctx.drawImage(img, dx, dy, dw, dh);
    }
    
    // Draw EDC items if enabled - IN A SQUARE IN BOTTOM RIGHT CORNER
    if (state.includeEDC && sel.edcImages && sel.edcImages.length > 0) {
      const edcSquareSize = Math.floor(S * 0.85);
      
      const edcSquareX = targetWidth - edcSquareSize - 20;
      const edcSquareY = targetHeight - edcSquareSize - 20;
      
      const padding = 8;
      const availableSize = edcSquareSize - padding * 2;
      const itemSize = Math.floor(availableSize / 2.5);
      const spacing = 6;
      
      let offsetX = 0;
      let offsetY = 0;
      
      for (const { img, item } of sel.edcImages) {
        if (item.position === 'bag-item') continue;
        
        const iw = img.naturalWidth;
        const ih = img.naturalHeight;
        const scale = Math.min(itemSize / iw, itemSize / ih);
        const dw = Math.floor(iw * scale);
        const dh = Math.floor(ih * scale);
        
        if (offsetX + dw > availableSize) {
          offsetX = 0;
          offsetY += itemSize + spacing;
        }
        
        const edcX = edcSquareX + padding + offsetX + Math.floor((itemSize - dw) / 2);
        const edcY = edcSquareY + padding + offsetY + Math.floor((itemSize - dh) / 2);
        
        ctx.save();
        ctx.globalAlpha = 0.95;
        ctx.drawImage(img, edcX, edcY, dw, dh);
        ctx.restore();
        
        offsetX += itemSize + spacing;
      }
    }
    
    return tempCanvas;
  }
  
  function doSave(e) {
    e.preventDefault();
    const targetWidth = 1080;
    const targetHeight = 1920;
    const tempCanvas = renderToCanvas(targetWidth, targetHeight, currentSel);
    
    const link = document.createElement('a');
    link.download = 'outfit.png';
    link.href = tempCanvas.toDataURL('image/png');
    link.click();
  }

  create.addEventListener('click', (e) => { e.preventDefault(); state.seed = 0; regenerate('create'); });
  jacket.addEventListener('click', toggleJacket);
  edc.addEventListener('click', toggleEDC);
  remix.addEventListener('click', doRemix);
  download.addEventListener('click', doSave);

  // Mobile event listeners
  if (jacketMobile) jacketMobile.addEventListener('click', toggleJacket);
  if (edcMobile) edcMobile.addEventListener('click', toggleEDC);
  if (remixMobile) remixMobile.addEventListener('click', doRemix);
  if (saveMobile) saveMobile.addEventListener('click', doSave);

  save15.addEventListener('click', async (e) => {
    e.preventDefault();
    // Generate and download 15 deterministic outfits that pass constraints
    const startSeed = state.seed;
    const targetWidth = 1080;
    const targetHeight = 1920;
    
    for (let i = 0; i < 15; i++) {
      await regenerate('remix');
      const tempCanvas = renderToCanvas(targetWidth, targetHeight, currentSel);
      
      const link = document.createElement('a');
      link.download = `outfit-${String(i+1).padStart(2,'0')}.png`;
      link.href = tempCanvas.toDataURL('image/png');
      link.click();
    }
    // restore seed base if desired
    state.seed = startSeed;
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
function loadImageCached(src) {
  return new Promise((resolve, reject) => {
    if (imageCache.has(src)) return resolve(imageCache.get(src));
    const img = new Image();
    img.onload = () => { imageCache.set(src, img); resolve(img); };
    img.onerror = reject;
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


