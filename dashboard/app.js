// Token Radar's plain dashboard. It reads window.RADAR (written beside dashboard/ by main.ts) and
// renders the ranked board, a filterable table, a per-protocol detail drawer with the model's own
// inputs and the protocol's farm plan. No network: every byte it shows is in data.js.
(function () {
  'use strict';

  var DATA = window.RADAR;
  if (!DATA) return;
  var app = document.getElementById('board');
  var state = { q: '', category: 'all', tab: 'pre-token', sort: 'implied', dir: -1, selected: null };

  var usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
  function fmtUsd(n) {
    if (n === null || n === undefined || !isFinite(n)) return 'n/a';
    if (Math.abs(n) >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B';
    if (Math.abs(n) >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M';
    if (Math.abs(n) >= 1e3) return '$' + Math.round(n / 1e3) + 'K';
    return usd.format(n);
  }
  function fmtPct(n) {
    if (n === null || n === undefined || !isFinite(n)) return 'n/a';
    return (n > 0 ? '+' : '') + n.toFixed(2) + '%';
  }
  function fmtAge(days) {
    if (days === null || days === undefined) return 'unknown';
    if (days >= 365) return (days / 365).toFixed(1) + 'y';
    return Math.max(0, Math.round(days)) + 'd';
  }
  // The model in one function: the page recomputes a row from the snapshot figures and checks the
  // number board.json carries, so the page's code and the board's data are visibly the same arithmetic.
  function impliedOf(row, model) {
    // The board publishes its four multipliers per row, and the implied value is computed from those
    // published inputs; the page repeats that exact arithmetic, so the two always agree.
    var growth = Math.min(model.growth_cap, Math.max(model.growth_floor, row.change_7d === null || row.change_7d === undefined ? 0 : row.change_7d));
    var growthMult = row.growth_multiplier === null || row.growth_multiplier === undefined ? 1 + (growth / 100) * model.growth_weight : row.growth_multiplier;
    var age = row.age_days === null || row.age_days === undefined ? model.unknown_age_days : row.age_days;
    var maturity = row.maturity_multiplier === null || row.maturity_multiplier === undefined ? model.maturity_floor + (Math.min(Math.max(age, 0), model.maturity_days) / model.maturity_days) * model.maturity_range : row.maturity_multiplier;
    var reach = row.reach_multiplier === null || row.reach_multiplier === undefined ? 1 : row.reach_multiplier;
    var standing = row.standing_multiplier === null || row.standing_multiplier === undefined ? 1 : row.standing_multiplier;
    var base = row.base_multiple === null || row.base_multiple === undefined ? model.base_multiple : row.base_multiple;
    return Math.max(1, Math.round(row.tvl_usd * base * growthMult * maturity * reach * standing));
  }

  function el(tag, attrs) {
    var node = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        if (k === 'class') node.className = attrs[k];
        else if (k === 'text') node.textContent = attrs[k];
        else if (k === 'html') node.innerHTML = attrs[k];
        else if (k.slice(0, 2) === 'on') node.addEventListener(k.slice(2), attrs[k]);
        else if (attrs[k] !== null && attrs[k] !== undefined) node.setAttribute(k, attrs[k]);
      });
    }
    for (var i = 2; i < arguments.length; i++) {
      var child = arguments[i];
      if (child === null || child === undefined) continue;
      if (Array.isArray(child)) child.forEach(function (c) { if (c) node.appendChild(c); });
      else if (typeof child === 'string') node.appendChild(document.createTextNode(child));
      else node.appendChild(child);
    }
    return node;
  }

  // The farm plan is the same derivation main.ts writes to board.json: category, chains, TVL and age
  // decide the action, the capital, the hold and every cost and time. No name is special-cased.
  function chainOf(p) { return p.chains && p.chains.length > 0 ? p.chains[0] : 'its main chain'; }
  function capitalFor(p) {
    if (p.tvl_usd >= 5e9) return 250;
    if (p.tvl_usd >= 1e9) return 150;
    if (p.tvl_usd >= 1e8) return 100;
    return 50;
  }
  function holdDaysFor(age) {
    if (age === null || age === undefined) return 30;
    if (age < 180) return 60;
    if (age < 365) return 45;
    return 30;
  }
  function actionFor(p, capital, chain) {
    var c = (p.category || '').toLowerCase();
    var name = p.name;
    if (c.indexOf('lend') >= 0 || c.indexOf('cdp') >= 0 || c.indexOf('collateral') >= 0) return 'Supply $' + capital + ' of USDC to ' + name + ' on ' + chain + ' and keep the position open.';
    if (c.indexOf('dex') >= 0 || c.indexOf('yield') >= 0 || c.indexOf('leveraged farm') >= 0) return 'Provide $' + capital + ' of liquidity to ' + name + "'s main pool on " + chain + ' and keep the position open.';
    if (c.indexOf('bridge') >= 0) return 'Bridge $' + capital + ' of USDC to ' + chain + ' through ' + name + ' and use the bridged funds in its app.';
    if (c.indexOf('staking') >= 0 || c.indexOf('restak') >= 0) return "Stake $" + capital + " of the chain's staking asset through " + name + ' and keep the receipt.';
    if (c.indexOf('perpetual') >= 0 || c.indexOf('derivative') >= 0 || c.indexOf('options') >= 0) return 'Deposit $' + capital + ' of USDC as margin on ' + name + ' and open one small hedge.';
    if (c.indexOf('prediction') >= 0) return 'Fund $' + capital + ' and place one market position on ' + name + '.';
    if (c.indexOf('curator') >= 0 || c.indexOf('allocator') >= 0) return 'Deposit $' + capital + ' into a ' + name + ' vault on ' + chain + ' and keep the shares.';
    if (c.indexOf('stable') >= 0) return 'Mint or deposit $' + capital + ' of the stable asset through ' + name + ' on ' + chain + '.';
    if (c.indexOf('rwa') >= 0) return "Mint $" + capital + " of the protocol's yield asset on " + chain + ' and hold it.';
    if (c.indexOf('insurance') >= 0) return 'Buy $' + capital + ' of cover from ' + name + ' on ' + chain + ' and keep the policy.';
    if (c.indexOf('nft') >= 0 || c.indexOf('gaming') >= 0) return "Buy one floor asset in " + name + "'s market on " + chain + ' and hold it in the farm wallet.';
    if (c.indexOf('launchpad') >= 0) return 'Commit $' + capital + ' to one open sale on ' + name + ' and keep the allocation record.';
    if (c.indexOf('oracle') >= 0 || c.indexOf('index') >= 0) return 'Deposit $' + capital + ' into ' + name + "'s main product on " + chain + ' and keep the position open.';
    return 'Deposit $' + capital + ' of USDC into ' + name + ' on ' + chain + ' and keep the position open.';
  }
  function gasNote(chain) {
    var c = chain.toLowerCase();
    if (c === 'ethereum') return 'Ethereum mainnet gas runs $5-15 in busy hours, so batch actions into one visit';
    if (['arbitrum', 'optimism', 'base', 'zksync era', 'linea', 'scroll', 'mantle', 'blast', 'mode'].indexOf(c) >= 0) return chain + ' is a low-fee network, about $0.10-1 per transaction';
    if (c === 'solana') return 'Solana fees are under $0.05 per transaction';
    if (['bsc', 'polygon', 'avalanche', 'fantom', 'gnosis', 'celo'].indexOf(c) >= 0) return chain + ' fees are low, usually under $1 per transaction';
    return 'keep about $5 of the ' + chain + ' gas token ready for fees';
  }
  function secondActionFor(p) {
    var c = (p.category || '').toLowerCase();
    var name = p.name;
    if (c.indexOf('lend') >= 0 || c.indexOf('cdp') >= 0) return 'Borrow a small amount against the supplied position on ' + name + ', then repay it a week later.';
    if (c.indexOf('dex') >= 0) return "Make two swaps through " + name + "'s own interface, a week apart, instead of only holding liquidity.";
    if (c.indexOf('bridge') >= 0) return 'Bridge a second, smaller amount back the other way through ' + name + ' so both directions are on record.';
    if (c.indexOf('staking') >= 0 || c.indexOf('restak') >= 0) return 'Claim and re-stake the rewards on ' + name + ' once, so the wallet shows a compounding action.';
    if (c.indexOf('curator') >= 0 || c.indexOf('allocator') >= 0 || c.indexOf('yield') >= 0) return 'Move a small part of the position into a second ' + name + ' vault so the wallet holds two products.';
    return 'Use one more feature of ' + name + ' than the deposit itself, such as a vote, a claim page visit with a signature, or a second product.';
  }
  function stepText(step) {
    var s = step.text + ' Cost: ' + step.cost + '. Time: ' + step.time + '.';
    if (s.length > 600) s = s.slice(0, 596) + '...';
    if (s.length < 20) s = s + " Hold the position and check the protocol's own page.";
    return s;
  }
  function pctText(change) { return (change >= 0 ? '+' : '') + change.toFixed(1) + '%'; }
  function categoryCtx(p) {
    var key = p.category || '';
    var peers = DATA.rows.filter(function (r) { return (r.category || '') === key; });
    var sorted = peers.slice().sort(function (a, b) { return b.tvl_usd - a.tvl_usd || (a.slug < b.slug ? -1 : 1); });
    var rank = 1;
    sorted.forEach(function (r, i) { if (r.slug === p.slug) rank = i + 1; });
    return { rank: rank, size: sorted.length };
  }
  function signalStep(p, capital) {
    var change = p.change_7d;
    if (change !== null && change !== undefined && change >= 5) {
      return { text: "Move while the week is warm: " + p.name + "'s TVL grew " + pctText(change) + ' in seven days, so open the position early in the week rather than after the crowd.', cost: 'no extra capital; the same position, opened sooner', time: '10 minutes, this week' };
    }
    if (change !== null && change !== undefined && change <= -15) {
      return { text: "Stage the entry: " + p.name + "'s TVL fell " + pctText(change) + ' this week, so split the $' + capital + ' into two buys a few days apart instead of one.', cost: 'the same $' + capital + ', in two buys', time: '15 minutes, twice this week' };
    }
    if (change !== null && change !== undefined) {
      return { text: "Enter at a normal pace: " + p.name + "'s TVL moved " + pctText(change) + ' this week, neither a rush nor a fire sale, so the standard weekly rhythm applies.', cost: 'no extra capital; the same position', time: '10 minutes, this week' };
    }
    return { text: 'Enter at a normal pace: the snapshot records no seven-day change for ' + p.name + ', so the standard weekly rhythm applies.', cost: 'no extra capital; the same position', time: '10 minutes, this week' };
  }
  function breadthStep(p) {
    if (p.chains && p.chains.length >= 3) {
      return { text: "Split the position across " + p.name + "'s chains: keep the main share on " + p.chains[0] + ', and place a smaller share on ' + p.chains[1] + ' and on ' + p.chains[2] + ', so the wallet is active wherever the protocol is.', cost: 'about $3 of gas per extra chain, once', time: '20 minutes, in the first week' };
    }
    return { text: secondActionFor(p), cost: 'about $2 of gas, once', time: '10 minutes, in the second week' };
  }
  function standingStep(p, ctx) {
    if (ctx.rank === 1 && ctx.size > 1) {
      return { text: p.name + ' holds the largest TVL of the ' + ctx.size + ' ' + (p.category || 'its category') + ' protocols on this board, so keep the position documented from day one: category leaders are where a retroactive allocation usually looks first.', cost: 'no fee to check, and never pay to claim', time: '10 minutes' };
    }
    return { text: "Before you withdraw, open the protocol's own points or rewards page and claim only from the link it publishes.", cost: 'no fee to check, and never pay to claim', time: '10 minutes' };
  }
  function farmSteps(p) {
    var chain = chainOf(p);
    var capital = capitalFor(p);
    var hold = holdDaysFor(p.age_days);
    var ctx = categoryCtx(p);
    var holdText = p.age_days !== null && p.age_days !== undefined && p.age_days >= 1000
      ? 'Hold the position for at least ' + hold + ' days so the activity is counted in more than one snapshot; ' + p.name + ' has run ' + p.age_days + ' days without a token, and long histories are what retroactive snapshots reward.'
      : 'Hold the position for at least ' + hold + ' days so the activity is counted in more than one snapshot.';
    return [
      { text: 'Use a fresh wallet that holds only the funds you plan to farm, and keep its seed phrase offline.', cost: 'under $3 of gas for the first transaction', time: '5 minutes' },
      { text: actionFor(p, capital, chain), cost: '$' + capital + ' of capital; ' + gasNote(chain), time: '15 minutes to set up' },
      signalStep(p, capital),
      { text: 'Make one qualifying action each week, such as a deposit, a borrow, a swap or a vote.', cost: 'about $2 of gas a week', time: '10 minutes a week' },
      breadthStep(p),
      { text: holdText, cost: 'the $' + capital + ' stays in the position', time: hold + ' days' },
      standingStep(p, ctx),
      { text: 'Write the wallet, the dates and every transaction in a farm log so you can repeat the position or unwind it.', cost: 'nothing but the log', time: '5 minutes' }
    ].map(stepText);
  }

  function readHash() {
    var hash = window.location.hash.replace(/^#/, '');
    if (!hash) return;
    var params = new URLSearchParams(hash);
    if (params.get('q')) state.q = params.get('q');
    if (params.get('p')) state.selected = params.get('p');
    if (params.get('category')) state.category = params.get('category');
  }
  function writeHash() {
    var params = new URLSearchParams();
    if (state.q) params.set('q', state.q);
    if (state.category !== 'all') params.set('category', state.category);
    if (state.selected) params.set('p', state.selected);
    var next = params.toString();
    if (next) window.history.replaceState(null, '', '#' + next);
    else window.history.replaceState(null, '', window.location.pathname + window.location.search);
  }

  function rows() {
    var q = state.q.trim().toLowerCase();
    return DATA.rows.filter(function (r) {
      if (state.category !== 'all' && r.category !== state.category) return false;
      if (!q) return true;
      var hay = [r.name, r.slug, r.category, (r.chains || []).join(' ')].join(' ').toLowerCase();
      return hay.indexOf(q) >= 0;
    });
  }
  function sortedRows(list) {
    var key = state.sort;
    return list.slice().sort(function (a, b) {
      var av, bv;
      if (key === 'name') { av = a.name.toLowerCase(); bv = b.name.toLowerCase(); }
      else if (key === 'tvl') { av = a.tvl_usd; bv = b.tvl_usd; }
      else if (key === 'growth') { av = a.change_7d === null ? -Infinity : a.change_7d; bv = b.change_7d === null ? -Infinity : b.change_7d; }
      else if (key === 'age') { av = a.age_days === null ? Infinity : a.age_days; bv = b.age_days === null ? Infinity : b.age_days; }
      else { av = a.implied_value_usd; bv = b.implied_value_usd; }
      if (av < bv) return -state.dir;
      if (av > bv) return state.dir;
      return a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0;
    });
  }

  function header() {
    return el('header', { class: 'top' },
      el('div', { class: 'brand' }, el('span', { class: 'mark' }), el('span', { class: 'brand-name', text: 'Token Radar' })),
      el('div', { class: 'top-meta' },
        el('span', { text: 'Snapshot ' + DATA.as_of }),
        el('span', { text: 'DefiLlama protocol index' }),
        el('span', { text: DATA.model_version + ' model' })
      )
    );
  }

  function lede() {
    return el('section', { class: 'lede' },
      el('div', null,
        el('h1', { text: DATA.watchlist_size + ' watchlist protocols, ranked by implied value' }),
        el('p', { text: 'The watchlist is the floor: every protocol with at least $' + Math.round(DATA.floor_usd / 1e6) + 'M of TVL and no token on record. The early radar adds ' + DATA.early_size + ' pre-token protocols below that floor. Each row is priced from the snapshot alone: its TVL, its seven-day growth, how long it has run with no token, how many chains it already reaches, and where it stands inside its own category. Implied value is a model, not a promise.' })
      ),
      el('div', { class: 'facts' },
        el('div', { class: 'fact' }, el('span', { text: 'Watchlist covered' }), el('b', { text: DATA.watchlist_size + ' / ' + DATA.watchlist_size })),
        el('div', { class: 'fact' }, el('span', { text: 'Pre-token rows scored' }), el('b', { text: String(DATA.board_size) })),
        el('div', { class: 'fact' }, el('span', { text: 'Early rows below the floor' }), el('b', { text: String(DATA.early_size) })),
        el('div', { class: 'fact' }, el('span', { text: 'Live-token protocols set aside' }), el('b', { text: String(DATA.live_size) }))
      )
    );
  }

  function controls() {
    var categories = Array.from(new Set(DATA.rows.map(function (r) { return r.category || 'Other'; }))).sort();
    var search = el('input', { type: 'search', id: 'q', placeholder: 'Search name, category or chain', value: state.q, 'aria-label': 'Search the board' });
    search.addEventListener('input', function () { state.q = search.value; writeHash(); render(); });
    var select = el('select', { id: 'category', 'aria-label': 'Filter by category' },
      el('option', { value: 'all', text: 'All categories' }),
      categories.map(function (c) { return el('option', { value: c, text: c, selected: c === state.category ? 'selected' : null }); })
    );
    select.addEventListener('change', function () { state.category = select.value; writeHash(); render(); });
    var pre = el('button', { type: 'button', 'aria-pressed': state.tab === 'pre-token' ? 'true' : 'false', text: 'Pre-token', onclick: function () { state.tab = 'pre-token'; render(); } });
    var live = el('button', { type: 'button', 'aria-pressed': state.tab === 'live' ? 'true' : 'false', text: 'Live token', onclick: function () { state.tab = 'live'; render(); } });
    return el('div', { class: 'controls' },
      el('div', { class: 'field' }, el('label', { for: 'q', text: 'Search' }), search),
      el('div', { class: 'field' }, el('label', { for: 'category', text: 'Category' }), select),
      el('div', { class: 'field' }, el('span', { class: 'sub', text: 'Token status' }), el('div', { class: 'tabs' }, pre, live)),
      el('span', { class: 'count', text: state.tab === 'pre-token' ? rows().length + ' rows shown' : DATA.live.length + ' live-token protocols' })
    );
  }

  function sortHeader(key, label) {
    return el('th', { scope: 'col' },
      el('button', { type: 'button', onclick: function () { if (state.sort === key) state.dir = -state.dir; else { state.sort = key; state.dir = -1; } render(); } },
        label,
        state.sort === key ? el('span', { 'aria-hidden': 'true', text: state.dir < 0 ? ' v' : ' ^' }) : null
      )
    );
  }

  function boardTable() {
    var list = sortedRows(rows());
    if (list.length === 0) {
      return el('div', { class: 'panel' }, el('div', { class: 'empty' },
        el('h2', { text: 'No protocol matches that filter' }),
        el('p', { text: 'Clear the search or pick another category to see the board again.' }),
        el('button', { class: 'button primary', type: 'button', text: 'Clear filters', onclick: function () { state.q = ''; state.category = 'all'; writeHash(); render(); } })
      ));
    }
    var max = list[0].implied_value_usd || 1;
    var tbody = el('tbody');
    list.forEach(function (r) {
      var growth = r.change_7d === null ? 'n/a' : fmtPct(r.change_7d);
      var growthClass = r.change_7d === null ? '' : r.change_7d >= 0 ? 'pos' : 'neg';
      var tr = el('tr', {
        'data-selected': state.selected === r.slug ? 'true' : 'false',
        tabindex: '0',
        onclick: function () { openDetail(r.slug); },
        onkeydown: function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openDetail(r.slug); } }
      },
        el('td', { class: 'num', text: String(r.rank) }),
        el('td', null, el('div', { class: 'name' },
          el('b', { text: r.name }),
          el('span', { class: 'sub', text: (r.category || 'Other') + ' on ' + (r.chains && r.chains.length ? r.chains.slice(0, 2).join(', ') : 'an unnamed chain') })
        )),
        el('td', { class: 'num', text: fmtUsd(r.tvl_usd) }),
        el('td', { class: 'num ' + growthClass, text: growth }),
        el('td', { class: 'num', text: fmtAge(r.age_days) }),
        el('td', null, el('div', { class: 'implied' },
          el('div', { class: 'bar', 'aria-hidden': 'true' }, el('i', { style: 'width:' + Math.max(3, Math.round((r.implied_value_usd / max) * 100)) + '%' })),
          el('span', { class: 'num', text: fmtUsd(r.implied_value_usd) })
        )),
        el('td', null, el('span', { class: 'status', text: 'no token' }))
      );
      tbody.appendChild(tr);
    });
    return el('div', { class: 'panel' },
      el('div', { class: 'table-wrap' },
        el('table', null,
          el('caption', { class: 'sub', text: 'Pre-token protocols, strongest implied value first. Select a row for its model and farm plan.' }),
          el('thead', null, el('tr', null,
            sortHeader('implied', 'Rank'),
            sortHeader('name', 'Protocol'),
            sortHeader('tvl', 'TVL'),
            sortHeader('growth', '7d'),
            sortHeader('age', 'Age'),
            sortHeader('implied', 'Implied value'),
            el('th', { scope: 'col', text: 'Token' })
          )),
          tbody
        )
      )
    );
  }

  function liveTable() {
    var tbody = el('tbody');
    DATA.live.forEach(function (r) {
      tbody.appendChild(el('tr', null,
        el('td', { class: 'num', text: 'live' }),
        el('td', null, el('div', { class: 'name' }, el('b', { text: r.name }), el('span', { class: 'sub', text: (r.category || 'Other') + ' on ' + (r.chains && r.chains.length ? r.chains.slice(0, 2).join(', ') : 'an unnamed chain') }))),
        el('td', { class: 'num', text: fmtUsd(r.tvl_usd) }),
        el('td', { class: 'num ' + (r.change_7d !== null && r.change_7d >= 0 ? 'pos' : 'neg'), text: fmtPct(r.change_7d) }),
        el('td', { class: 'num', text: fmtUsd(r.mcap_usd) }),
        el('td', null, el('span', { class: 'status', text: 'already trades' }))
      ));
    });
    return el('div', { class: 'panel' },
      el('div', { class: 'table-wrap' },
        el('table', null,
          el('caption', { class: 'sub', text: 'Token live: these protocols already trade, so their market cap is a fact, not a model. They are set aside from the pre-token ranking.' }),
          el('thead', null, el('tr', null, el('th', { scope: 'col', text: 'Status' }), el('th', { scope: 'col', text: 'Protocol' }), el('th', { scope: 'col', text: 'TVL' }), el('th', { scope: 'col', text: '7d' }), el('th', { scope: 'col', text: 'Market cap' }), el('th', { scope: 'col', text: 'Token' }))),
          tbody
        )
      )
    );
  }

  function modelPanel() {
    var m = DATA.model;
    return el('section', { class: 'panel model' },
      el('h2', { text: 'How implied value is computed' }),
      el('p', { class: 'sub', text: 'Every row is scored by one function of the snapshot figures. No protocol name is special-cased, and no row is hand-picked.' }),
      el('div', { class: 'formula' },
        'implied = round( tvl_usd x category multiple x (1 + clamp(change_7d, ' + m.growth_floor + ', ' + m.growth_cap + ') / 100 x ' + m.growth_weight + ') x (' + m.maturity_floor + ' + min(age_days, ' + m.maturity_days + ') / ' + m.maturity_days + ' x ' + m.maturity_range + ') x (1 + ' + m.reach_per_chain + ' x min(chains - 1, ' + m.reach_max_extra + ')) x (' + m.standing_floor + ' + ' + m.standing_range + ' x category TVL percentile) )'
      ),
      el('p', { class: 'sub', text: 'The category multiple is calibrated per category from the snapshot itself: the anchor ' + m.base_multiple + ' moves by the square root of the category\'s median age and median TVL against the whole pre-token population\'s, clamped so no category leaves the ' + m.calib_floor + ' to ' + m.calib_cap + ' band. Older, larger categories price above the anchor; young, small ones below it. Each row\'s detail view shows the exact multiple it was scored with.' }),
      el('p', { class: 'sub', text: 'TVL and seven-day growth come from the snapshot. Age is the time since the protocol was first listed, the best record of how long it has run with no token; an unlisted age uses ' + m.unknown_age_days + ' days. Reach prices distribution: each extra chain a protocol already runs on adds a surface a token launch can be priced on. Standing prices category leadership: a protocol is measured against the TVL of its own category, not the whole index. The early radar is every pre-token protocol below the watchlist floor, by TVL, and the live-token protocols are set aside with their market caps shown.' })
    );
  }

  function briefPanel() {
    var lines = DATA.briefing;
    if (!lines || !lines.length) return null;
    return el('section', { class: 'panel brief', 'aria-label': 'Radar brief' },
      el('h2', { text: 'The brief' }),
      el('ul', { class: 'brief-list' }, lines.map(function (line) {
        return el('li', { text: line });
      }))
    );
  }

  function insightsPanel() {
    var ins = DATA.insights;
    if (!ins) return null;
    var t = ins.totals;
    var section = el('section', { class: 'panel model' },
      el('h2', { text: 'The landscape around the board' }),
      el('p', { class: 'sub', text: 'The snapshot holds ' + t.pre_token_protocols + ' pre-token protocols with ' + fmtUsd(t.pre_token_tvl_usd) + ' of TVL between them. The board ranks ' + DATA.board_size + ' of them; their implied values add to ' + fmtUsd(t.board_implied_usd) + ' across ' + t.categories_covered + ' categories and ' + t.chains_covered + ' chains.' })
    );
    var tbody = el('tbody');
    ins.categories.slice(0, 10).forEach(function (c) {
      tbody.appendChild(el('tr', { class: 'flat' },
        el('td', null, el('b', { text: c.category })),
        el('td', { class: 'num', text: String(c.protocols) }),
        el('td', { class: 'num', text: String(c.board_rows) }),
        el('td', { class: 'num', text: fmtUsd(c.tvl_usd) }),
        el('td', { class: 'num', text: c.mean_growth_pct === null ? 'n/a' : fmtPct(c.mean_growth_pct) }),
        el('td', { class: 'num', text: String(c.base_multiple) }),
        el('td', { class: 'num', text: fmtUsd(c.implied_usd) }),
        el('td', { text: c.leader_name })
      ));
    });
    section.appendChild(el('div', { class: 'table-wrap' },
      el('table', null,
        el('caption', { class: 'sub', text: 'Where the pre-token value concentrates: the ten categories with the most implied value on the board.' }),
        el('thead', null, el('tr', null,
          el('th', { scope: 'col', text: 'Category' }),
          el('th', { scope: 'col', text: 'Protocols' }),
          el('th', { scope: 'col', text: 'On board' }),
          el('th', { scope: 'col', text: 'TVL' }),
          el('th', { scope: 'col', text: 'Mean 7d' }),
          el('th', { scope: 'col', text: 'Multiple' }),
          el('th', { scope: 'col', text: 'Implied' }),
          el('th', { scope: 'col', text: 'Leader' })
        )),
        tbody
      )
    ));
    var momentum = el('div', { class: 'insight-col' },
      el('h3', { text: 'Fastest movers this week' }),
      el('ol', { class: 'plain-list' }, ins.momentum.map(function (m) {
        return el('li', null,
          el('b', { text: m.name }),
          el('span', { class: 'num pos', text: ' ' + fmtPct(m.change_7d) }),
          el('span', { class: 'sub', text: ' on ' + fmtUsd(m.tvl_usd) + ' TVL' })
        );
      }))
    );
    var waiting = el('div', { class: 'insight-col' },
      el('h3', { text: 'Longest without a token (watchlist)' }),
      el('ol', { class: 'plain-list' }, ins.longest_waiting.map(function (w) {
        return el('li', null,
          el('b', { text: w.name }),
          el('span', { class: 'num', text: ' ' + fmtAge(w.age_days) }),
          el('span', { class: 'sub', text: ' with ' + fmtUsd(w.tvl_usd) + ' TVL' })
        );
      }))
    );
    section.appendChild(el('div', { class: 'insight-grid' }, momentum, waiting));
    section.appendChild(el('p', { class: 'sub', text: 'Deepest footprints: ' + ins.chains.map(function (c) { return c.chain + ' (' + c.board_rows + ' board rows, ' + fmtUsd(c.tvl_usd) + ')'; }).join(' · ') + '.' }));
    return section;
  }

  var dialog = el('dialog', { class: 'detail', id: 'detail', 'aria-labelledby': 'detail-title' });
  dialog.addEventListener('close', function () { state.selected = null; writeHash(); });

  function openDetail(slug) {
    var row = DATA.rows.filter(function (r) { return r.slug === slug; })[0];
    if (!row) return;
    state.selected = slug;
    writeHash();
    dialog.textContent = '';
    var steps = farmSteps(row);
    dialog.appendChild(el('div', { class: 'detail-head' },
      el('div', null,
        el('span', { class: 'brand-name', text: 'Rank ' + row.rank + ' of ' + DATA.board_size }),
        el('h2', { id: 'detail-title', text: row.name }),
        el('p', { class: 'sub', text: (row.category || 'Other') + ' on ' + (row.chains && row.chains.length ? row.chains.join(', ') : 'an unnamed chain') })
      ),
      el('button', { class: 'close', type: 'button', 'aria-label': 'Close details', text: 'Close', onclick: function () { dialog.close(); } })
    ));
    dialog.appendChild(el('section', { class: 'detail-section' },
      el('h3', { text: 'Implied value' }),
      el('div', { class: 'equation' },
        el('div', null, el('span', { text: 'TVL' }), el('b', { class: 'num', text: fmtUsd(row.tvl_usd) })),
        el('div', null, el('span', { text: 'Category multiple' }), el('b', { class: 'num', text: String(row.base_multiple) })),
        el('div', null, el('span', { text: 'Seven-day growth' }), el('b', { class: 'num', text: fmtPct(row.change_7d) })),
        el('div', null, el('span', { text: 'Age with no token' }), el('b', { class: 'num', text: fmtAge(row.age_days) })),
        el('div', null, el('span', { text: 'Growth multiplier' }), el('b', { class: 'num', text: String(row.growth_multiplier) })),
        el('div', null, el('span', { text: 'Maturity multiplier' }), el('b', { class: 'num', text: String(row.maturity_multiplier) })),
        el('div', null, el('span', { text: 'Reach multiplier' }), el('b', { class: 'num', text: String(row.reach_multiplier) })),
        el('div', null, el('span', { text: 'Standing multiplier' }), el('b', { class: 'num', text: String(row.standing_multiplier) })),
        el('div', null, el('span', { text: 'Implied value' }), el('b', { class: 'num', text: fmtUsd(row.implied_value_usd) }))
      ),
      el('p', { class: 'sub', text: 'Model ' + DATA.model_version + ': the same function scores every protocol. The page recomputes this row as ' + fmtUsd(impliedOf(row, DATA.model)) + (impliedOf(row, DATA.model) === row.implied_value_usd ? ', the same number board.json carries.' : ', which differs from the board: the data would be stale.') + ' This is an estimate, not a price.' })
    ));
    dialog.appendChild(el('section', { class: 'detail-section' },
      el('h3', { text: 'Farm plan' }),
      el('ol', { class: 'steps' }, steps.map(function (s) {
        var at = s.indexOf(' Cost: ');
        var action = at >= 0 ? s.slice(0, at) : s;
        var tail = at >= 0 ? s.slice(at + 1) : '';
        return el('li', null, el('b', { text: action }), el('span', { class: 'cost', text: tail }));
      }))
    ));
    if (typeof dialog.showModal === 'function') {
      if (!dialog.open) dialog.showModal();
    } else {
      dialog.setAttribute('open', '');
    }
  }

  function render() {
    app.textContent = '';
    var shell = el('div', { class: 'shell' });
    shell.appendChild(header());
    shell.appendChild(lede());
    shell.appendChild(controls());
    if (state.tab === 'pre-token') { var brief = briefPanel(); if (brief) shell.appendChild(brief); }
    shell.appendChild(state.tab === 'pre-token' ? boardTable() : liveTable());
    if (state.tab === 'pre-token') shell.appendChild(modelPanel());
    if (state.tab === 'pre-token') { var ins = insightsPanel(); if (ins) shell.appendChild(ins); }
    app.appendChild(shell);
    app.setAttribute('aria-busy', 'false');
    if (!dialog.isConnected) app.appendChild(dialog);
    if (state.selected) openDetail(state.selected);
  }

  readHash();
  render();
  window.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && dialog.open) dialog.close();
  });
})();
