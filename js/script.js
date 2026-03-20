const PIPS = {
  1: [[50,50]],
  2: [[28,28],[72,72]],
  3: [[28,28],[50,50],[72,72]],
  4: [[28,28],[72,28],[28,72],[72,72]],
  5: [[28,28],[72,28],[50,50],[28,72],[72,72]],
  6: [[28,22],[72,22],[28,50],[72,50],[28,78],[72,78]]
};
const PIP_R = 8.5;

function renderPips(id, val) {
  const g = document.getElementById(id);
  if (!g) return;
  g.innerHTML = (PIPS[val] || []).map(([cx,cy]) =>
    `<circle cx="${cx}" cy="${cy}" r="${PIP_R}" fill="#1a1a1a"/>`
  ).join('');
}

function oddsPayoutRatio(pt) {
  if (pt === 4 || pt === 10) return [2, 1];
  if (pt === 5 || pt === 9)  return [3, 2];
  if (pt === 6 || pt === 8)  return [6, 5];
  return [1, 1];
}

function oddsWin(oddsBet, pt) {
  const [n, d] = oddsPayoutRatio(pt);
  return Math.round(oddsBet * n / d);
}

const STARTING_BANK  = 200;
const PASS_BET       = 10;
const ODDS_BET       = 20;

let bank, netPL, rounds, wins, losses;
let phase, point, oddsActive, oddsBet;
let isRolling, awaitingOddsDecision;
let scenarioPlaying;
let logEntries;

function initState() {
  bank                 = STARTING_BANK;
  netPL                = 0;
  rounds               = 0;
  wins                 = 0;
  losses               = 0;
  phase                = 'come-out';
  point                = null;
  oddsActive           = false;
  oddsBet              = 0;
  isRolling            = false;
  awaitingOddsDecision = false;
  scenarioPlaying      = false;
  logEntries           = [];
}

function $(id) { return document.getElementById(id); }

function updateBankUI() {
  $('bank-stack').textContent = '$' + bank;
  $('bank-stack').className = 'bank-value' + (bank > STARTING_BANK ? ' positive' : bank < STARTING_BANK ? ' negative' : '');

  const plText = (netPL >= 0 ? '+' : '') + '$' + netPL;
  $('bank-pl').textContent = plText;
  $('bank-pl').className = 'bank-value' + (netPL > 0 ? ' positive' : netPL < 0 ? ' negative' : ' neutral');

  $('bank-rounds').textContent = rounds;
  $('bank-rounds').className = 'bank-value neutral';
  $('bank-wl').textContent = wins + ' / ' + losses;
  $('bank-wl').className = 'bank-value neutral';
}

function setStatus(text, color) {
  const el = $('sim-status');
  el.textContent = text;
  el.style.color = color || 'var(--gold)';
}

function setResult(text) {
  $('sim-result').textContent = text;
}

function setPhase(text) {
  $('sim-phase').textContent = text;
}

function setRollEnabled(on) {
  $('roll-btn').disabled = !on || scenarioPlaying;
}

function showOddsPrompt(pt) {
  const [n, d] = oddsPayoutRatio(pt);
  $('odds-title').textContent = 'Point is ' + pt + ' -- Take Free Odds?';
  $('odds-desc').textContent =
    'Bet $' + ODDS_BET + ' at true odds (' + n + ':' + d + '). ' +
    'If you hit ' + pt + ', your odds bet pays $' + oddsWin(ODDS_BET, pt) + '. ' +
    'Zero house edge -- this is the best bet on the table.';
  $('odds-prompt').classList.add('visible');
}

function hideOddsPrompt() {
  $('odds-prompt').classList.remove('visible');
}

function renderActiveBets() {
  const container = $('active-bets');
  let html = '';
  if (phase === 'point' || phase === 'come-out') {
    if (phase === 'point') {
      html += '<span class="bet-chip pass">Pass Line $' + PASS_BET + '</span>';
      if (oddsActive) {
        html += '<span class="bet-chip odds">Free Odds $' + oddsBet + '</span>';
      }
    }
  }
  container.innerHTML = html;
}

function addLogEntry(desc, amount, type) {
  logEntries.unshift({ desc, amount, type });
  const log = $('session-log');
  if (logEntries.length === 1) {
    log.innerHTML = '';
  }
  log.innerHTML = logEntries.slice(0, 20).map(e => {
    const amtClass = e.type === 'win' ? 'win' : e.type === 'lose' ? 'lose' : 'neutral';
    const amtText  = e.type === 'win' ? '+$' + e.amount : e.type === 'lose' ? '-$' + e.amount : e.amount;
    return `<div class="log-entry">
      <span class="log-desc">${e.desc}</span>
      <span class="log-amount ${amtClass}">${amtText}</span>
    </div>`;
  }).join('');
}

function rollDie() { return Math.floor(Math.random() * 6) + 1; }

function rollDice() {
  if (isRolling || awaitingOddsDecision) return;
  if (bank < PASS_BET && phase === 'come-out') {
    setStatus('OUT OF CHIPS!', 'var(--red-bright)');
    setResult('You have run out of money. Hit Reset to play again.');
    setRollEnabled(false);
    return;
  }

  isRolling = true;
  setRollEnabled(false);

  const d1 = rollDie(), d2 = rollDie(), total = d1 + d2;

  const w1 = $('die1-wrap'), w2 = $('die2-wrap');
  w1.classList.remove('rolling'); w2.classList.remove('rolling');
  void w1.offsetWidth;
  w1.classList.add('rolling'); w2.classList.add('rolling');

  let ticks = 0;
  const ticker = setInterval(() => {
    renderPips('pips1', rollDie());
    renderPips('pips2', rollDie());
    if (++ticks >= 4) clearInterval(ticker);
  }, 80);

  setTimeout(() => {
    renderPips('pips1', d1);
    renderPips('pips2', d2);
    resolveRoll(total);
    isRolling = false;
  }, 450);
}

function resolveRoll(total) {
  if (phase === 'come-out') {
    bank -= PASS_BET;
    rounds++;

    if (total === 7 || total === 11) {
      const payout = PASS_BET * 2;
      bank += payout;
      netPL += PASS_BET;
      wins++;
      setStatus(total + '  --  NATURAL!', 'var(--green-bright)');
      setResult('7 or 11: Pass Line wins $' + PASS_BET + '! New come-out roll.');
      addLogEntry('Come-out ' + total + ' -- Natural', PASS_BET, 'win');
      updateBankUI();
      setRollEnabled(true);

    } else if ([2,3,12].includes(total)) {
      netPL -= PASS_BET;
      losses++;
      setStatus(total + '  --  CRAPS', 'var(--red-bright)');
      setResult('2, 3, or 12: Pass Line loses $' + PASS_BET + '. New come-out.');
      addLogEntry('Come-out ' + total + ' -- Craps', PASS_BET, 'lose');
      updateBankUI();
      if (bank < PASS_BET) {
        setResult('Not enough to continue. Hit Reset to play again.');
        setRollEnabled(false);
      } else {
        setRollEnabled(true);
      }

    } else {
      point = total;
      phase = 'point';
      setStatus(total + '  --  POINT IS ' + total, 'var(--gold)');
      setResult('Point is ' + total + '. Take Free Odds or skip and roll.');
      setPhase('Point Phase -- Point is ' + total);
      addLogEntry('Come-out ' + total + ' -- Point set at ' + total, '--', 'neutral');
      updateBankUI();
      renderActiveBets();

      if (bank >= ODDS_BET) {
        awaitingOddsDecision = true;
        showOddsPrompt(point);
      } else {
        setRollEnabled(true);
      }
    }

  } else {
    if (total === point) {
      const passWin    = PASS_BET;
      const oddsWinAmt = oddsActive ? oddsWin(oddsBet, point) : 0;
      const totalPayout = PASS_BET + passWin + (oddsActive ? oddsBet + oddsWinAmt : 0);
      bank += totalPayout;
      netPL += passWin + oddsWinAmt;
      wins++;

      let desc = 'Made the point ' + total + '! Pass Line +$' + passWin;
      if (oddsActive) desc += ', Odds +$' + oddsWinAmt;
      desc += '.';

      setStatus(total + '  --  MADE THE POINT!', 'var(--green-bright)');
      setResult(desc + ' Back to come-out.');
      addLogEntry(
        'Point phase ' + total + ' -- Made it!' + (oddsActive ? ' (with odds)' : ''),
        passWin + oddsWinAmt,
        'win'
      );
      endRound();

    } else if (total === 7) {
      const totalLost = PASS_BET + (oddsActive ? oddsBet : 0);
      netPL -= totalLost;
      losses++;

      let desc = 'Seven out -- Pass Line lost $' + PASS_BET;
      if (oddsActive) desc += ' + Odds $' + oddsBet;
      desc += '.';

      setStatus('7  --  SEVEN OUT', 'var(--red-bright)');
      setResult(desc + ' New shooter.');
      addLogEntry(
        'Point phase 7 -- Seven out' + (oddsActive ? ' (lost odds too)' : ''),
        totalLost,
        'lose'
      );
      endRound();

    } else {
      setStatus(total + '  --  No action', 'rgba(245,240,232,0.45)');
      setResult('Not the point (' + point + ') and not a 7. Keep rolling...');
      addLogEntry('Point phase ' + total + ' -- No action', '--', 'neutral');
      updateBankUI();
      setRollEnabled(true);
    }
  }

  renderActiveBets();
}

function endRound() {
  oddsActive = false;
  oddsBet    = 0;
  phase      = 'come-out';
  point      = null;
  setPhase('Phase: Come-Out Roll');
  updateBankUI();
  renderActiveBets();

  if (bank < PASS_BET) {
    setResult('Not enough chips to continue. Hit Reset to play again.');
    setRollEnabled(false);
  } else {
    setRollEnabled(true);
  }
}

function takeOdds() {
  if (!awaitingOddsDecision) return;
  awaitingOddsDecision = false;
  hideOddsPrompt();

  bank      -= ODDS_BET;
  oddsBet    = ODDS_BET;
  oddsActive = true;

  const [n, d] = oddsPayoutRatio(point);
  setResult('Free Odds taken: $' + ODDS_BET + ' at ' + n + ':' + d + '. Roll to see if point ' + point + ' hits before a 7!');
  updateBankUI();
  renderActiveBets();
  setRollEnabled(true);
}

function skipOdds() {
  if (!awaitingOddsDecision) return;
  awaitingOddsDecision = false;
  hideOddsPrompt();
  setResult('Odds skipped. Roll to hit ' + point + ' before a 7!');
  setRollEnabled(true);
}

const SCENARIOS = {
  hot: {
    label: 'Hot Shooter',
    rolls: [7, 11, 6, 4, 8, 6, 5, 9, 5, 7, 8, 5, 8],
    autoOdds: true
  },
  cold: {
    label: 'Cold Table',
    rolls: [12, 2, 8, 7, 3, 6, 7, 2, 9, 7],
    autoOdds: true
  }
};

function splitDice(total) {
  const d1 = Math.max(1, Math.min(6, Math.round(total / 2)));
  const d2 = total - d1;
  if (d2 >= 1 && d2 <= 6) return [d1, d2];
  for (let i = 1; i <= 6; i++) {
    if (total - i >= 1 && total - i <= 6) return [i, total - i];
  }
  return [1, 1];
}

function setScenariosEnabled(on) {
  ['sc-hot', 'sc-cold'].forEach(id => {
    const el = $(id);
    if (el) el.disabled = !on;
  });
}

function playScenario(key) {
  if (scenarioPlaying) return;
  const sc = SCENARIOS[key];
  if (!sc) return;

  resetGame();
  scenarioPlaying = true;
  setScenariosEnabled(false);
  setRollEnabled(false);
  setPhase('\u25b6 Watching: ' + sc.label);
  setStatus('Auto-playing scenario\u2026', 'var(--gold)');
  setResult('Pass Line + Free Odds every round. Watch what happens to the bankroll!');

  let idx = 0;

  function step() {
    if (!scenarioPlaying) return;

    if (awaitingOddsDecision) {
      setTimeout(() => {
        if (sc.autoOdds && bank >= ODDS_BET) {
          takeOdds();
        } else {
          skipOdds();
        }
        setTimeout(step, 1000);
      }, 700);
      return;
    }

    if (idx >= sc.rolls.length) {
      scenarioPlaying = false;
      setScenariosEnabled(true);
      setRollEnabled(true);
      setPhase('Phase: Come-Out Roll');
      setStatus('Scenario done! Hit Roll to play yourself.', 'var(--gold)');
      return;
    }

    const total = sc.rolls[idx++];
    const [d1, d2] = splitDice(total);

    const w1 = $('die1-wrap'), w2 = $('die2-wrap');
    w1.classList.remove('rolling'); w2.classList.remove('rolling');
    void w1.offsetWidth;
    w1.classList.add('rolling'); w2.classList.add('rolling');

    let ticks = 0;
    const ticker = setInterval(() => {
      renderPips('pips1', rollDie());
      renderPips('pips2', rollDie());
      if (++ticks >= 4) clearInterval(ticker);
    }, 80);

    setTimeout(() => {
      renderPips('pips1', d1);
      renderPips('pips2', d2);
      resolveRoll(total);
      setTimeout(step, 1600);
    }, 450);
  }

  setTimeout(step, 800);
}

function resetGame() {
  scenarioPlaying = false;
  setScenariosEnabled(true);
  initState();
  hideOddsPrompt();
  setStatus('Ready to Play', 'var(--gold)');
  setResult('Each round costs $10 on the Pass Line. Tap Roll to begin!');
  setPhase('Phase: Come-Out Roll');
  renderPips('pips1', 1);
  renderPips('pips2', 2);
  updateBankUI();
  renderActiveBets();
  $('session-log').innerHTML = '<div class="log-empty">Your session log will appear here.</div>';
  setRollEnabled(true);
}

function showTab(id, btn) {
  document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
  document.querySelectorAll('.tab-btn').forEach(el => {
    el.classList.remove('active');
    el.setAttribute('aria-selected', 'false');
  });
  document.getElementById('tab-' + id).classList.add('active');
  btn.classList.add('active');
  btn.setAttribute('aria-selected', 'true');
}

initState();
renderPips('pips1', 1);
renderPips('pips2', 2);
updateBankUI();

function toggleAccordion(btn) {
  const body = btn.nextElementSibling;
  const isOpen = btn.classList.contains('open');
  document.querySelectorAll('.accordion-btn.open').forEach(b => {
    b.classList.remove('open');
    b.setAttribute('aria-expanded', 'false');
    b.nextElementSibling.classList.remove('open');
  });
  if (!isOpen) {
    btn.classList.add('open');
    btn.setAttribute('aria-expanded', 'true');
    body.classList.add('open');
  }
}
