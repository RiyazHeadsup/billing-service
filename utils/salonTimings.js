// Same as api-gateway-consul/utils/salonTimings.js — keep the two in sync.
// Opening hours for a Unit, resolved in the salon's own time zone.
//
// Each weekday uses its weeklyTimings entry if there is one, else the unit's
// openingTime/closingTime. A date listed in holidays is closed.

const TIME_ZONE = process.env.SALON_TIMEZONE || 'Asia/Kolkata';
const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const toMinutes = (hhmm) => {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm || '');
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
};

// { date: 'YYYY-MM-DD', day: 0-6, minutes } for `at` in the salon's time zone
const localNow = (at = new Date()) => {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-GB', {
    timeZone: TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23', weekday: 'short'
  }).formatToParts(at).map(p => [p.type, p.value]));
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    day: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(parts.weekday),
    minutes: Number(parts.hour) * 60 + Number(parts.minute)
  };
};

// Seven entries, Sunday first: { day, dayName, open, close, closed }
const weekTimings = (unit) => DAY_NAMES.map((dayName, day) => {
  const entry = (unit.weeklyTimings || []).find(t => t.day === day);
  if (entry?.closed) return { day, dayName, open: null, close: null, closed: true };
  return {
    day,
    dayName,
    open: entry?.open || unit.openingTime || '10:00',
    close: entry?.close || unit.closingTime || '21:00',
    closed: false
  };
});

const isHoliday = (unit, date) => (unit.holidays || []).some(h => h.date === date);

const todayStatus = (unit, at = new Date()) => {
  const now = localNow(at);
  const today = weekTimings(unit)[now.day];
  if (today.closed || isHoliday(unit, now.date)) {
    return { today: { ...today, open: null, close: null, closed: true }, isOpenNow: false };
  }
  const open = toMinutes(today.open);
  const close = toMinutes(today.close);
  return { today, isOpenNow: open !== null && close !== null && now.minutes >= open && now.minutes < close };
};

const upcomingHolidays = (unit, at = new Date()) => {
  const { date } = localNow(at);
  return (unit.holidays || []).filter(h => h.date >= date).sort((a, b) => a.date.localeCompare(b.date));
};

module.exports = { TIME_ZONE, localNow, weekTimings, isHoliday, todayStatus, upcomingHolidays, toMinutes };
