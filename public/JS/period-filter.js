(function () {
  'use strict';

  var STORAGE_KEY = 'hesabino:period';
  var VALID_PERIODS = ['today', 'week', 'month', 'year'];
  var DEFAULT_PERIOD = 'month';
  var EVENT_NAME = 'hesabino:period-change';

  var LABELS = {
    today: 'امروز',
    week: 'این هفته',
    month: 'این ماه',
    year: 'امسال',
  };

  function getPeriod() {
    try {
      var stored = localStorage.getItem(STORAGE_KEY);
      if (VALID_PERIODS.indexOf(stored) !== -1) return stored;
    } catch (e) {  }
    return DEFAULT_PERIOD;
  }

  function setPeriod(period, options) {
    if (VALID_PERIODS.indexOf(period) === -1) return;
    try { localStorage.setItem(STORAGE_KEY, period); } catch (e) {  }

    var select = document.getElementById('global-period-select');
    if (select && select.value !== period) select.value = period;

    if (!options || options.silent !== true) {
      document.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: { period: period } }));
    }
  }

  function toEnglishDigits(str) {
    var persian = '۰۱۲۳۴۵۶۷۸۹';
    var arabic = '٠١٢٣٤٥٦٧٨٩';
    return String(str || '')
      .replace(/[۰-۹]/g, function (d) { return String(persian.indexOf(d)); })
      .replace(/[٠-٩]/g, function (d) { return String(arabic.indexOf(d)); });
  }

  function parseParts(dateStr) {
    var normalized = toEnglishDigits(dateStr).trim();
    var match = normalized.match(/^(\d{3,4})[/-](\d{1,2})[/-](\d{1,2})/);
    if (!match) return null;
    return { y: Number(match[1]), m: Number(match[2]), d: Number(match[3]) };
  }

  function matchesPeriod(dateStr, period) {
    var parts = parseParts(dateStr);
    if (!parts || typeof persianDate !== 'function') return true;

    try {
      var target = new persianDate([parts.y, parts.m, parts.d]);
      var today = new persianDate();

      if (period === 'today') {
        return target.year() === today.year() && target.month() === today.month() && target.date() === today.date();
      }
      if (period === 'year') {
        return target.year() === today.year();
      }
      if (period === 'week') {
        var diffDays = today.diff(target, 'day');
        return diffDays >= 0 && diffDays <= 6;
      }
      return target.year() === today.year() && target.month() === today.month();
    } catch (e) {
      return true;
    }
  }

  function init() {
    var select = document.getElementById('global-period-select');
    var current = getPeriod();
    if (select) {
      select.value = current;
      select.addEventListener('change', function () {
        setPeriod(select.value);
      });
    }
  }

  window.HesabinoPeriod = {
    EVENT_NAME: EVENT_NAME,
    LABELS: LABELS,
    get: getPeriod,
    set: setPeriod,
    matches: matchesPeriod,
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
