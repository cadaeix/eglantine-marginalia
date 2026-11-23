// Gregorian dates read in the French Republican calendar. Twelve months of thirty days are followed by five
// complementary days, six in a sextile year.
//
// The year begins as the decree of 4 frimaire an II (article III) has it: "Chaque année commence à minuit,
// avec le jour où tombe l'équinoxe vrai d'automne pour l'Observatoire de Paris." 1 vendémiaire is the day on
// which the September equinox falls by the true solar clock at the Paris Observatory, and a year is sextile
// when the next equinox falls 366 days later. This gives the new years the Republic kept, years III, VII and
// XI sextile and year XII opening on 24 September 1803, and it keeps to the seasons ever after.

/** A Republican date: a month and day, or a complementary day, which belongs to no month. */
export type RepublicanDate =
  | { readonly year: number; readonly month: number; readonly day: number; readonly complementary: false }
  | { readonly year: number; readonly month: null; readonly day: number; readonly complementary: true };

const DAY_MS = 86_400_000;
const UNIX_EPOCH_JD = 2_440_587.5;
const DEG = Math.PI / 180;
const GREGORIAN_MONTH_LENGTHS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
/** The equinox polynomial of Meeus's Table 27.B holds for the years 1000 to 3000. */
const LAST_EQUINOX_YEAR = 3000;
/** The Paris Observatory's meridian, 2° 20′ 14.025″ east, keeps time 9 min 20.935 s ahead of Greenwich. */
const PARIS_MERIDIAN_MS = 560_935;

/** Meeus, Astronomical Algorithms, 2nd ed., Table 27.C: each term's A, B in degrees and C in degrees a century. */
const PERIODIC_TERMS: readonly (readonly [number, number, number])[] = [
  [485, 324.96, 1934.136], [203, 337.23, 32964.467], [199, 342.08, 20.186], [182, 27.85, 445267.112],
  [156, 73.14, 45036.886], [136, 171.52, 22518.443], [77, 222.54, 65928.934], [74, 296.72, 3034.906],
  [70, 243.58, 9037.513], [58, 119.81, 33718.147], [52, 297.17, 150.678], [50, 21.02, 2281.226],
  [45, 247.54, 29929.562], [44, 325.15, 31555.956], [29, 60.93, 4443.417], [18, 155.12, 67555.328],
  [17, 288.79, 4562.452], [16, 198.04, 62894.029], [14, 199.76, 31436.921], [12, 95.39, 14577.848],
  [12, 287.11, 31931.756], [12, 320.81, 34777.259], [9, 227.73, 1222.114], [8, 15.45, 16859.074],
];

/**
 * The instant of the September equinox as a Julian Ephemeris Day, in dynamical time, after Meeus's chapter 27:
 * the mean instant of Table 27.B, corrected by the 24 periodic terms of Table 27.C.
 */
function septemberEquinoxJDE(year: number): number {
  const y = (year - 2000) / 1000;
  const jde0 = 2_451_810.21715 + 365_242.01767 * y - 0.11575 * y ** 2 + 0.00337 * y ** 3 + 0.00078 * y ** 4;
  const t = (jde0 - 2_451_545) / 36_525;
  const w = (35_999.373 * t - 2.47) * DEG;
  const deltaLambda = 1 + 0.0334 * Math.cos(w) + 0.0007 * Math.cos(2 * w);
  let s = 0;
  for (const [a, b, c] of PERIODIC_TERMS) s += a * Math.cos((b + c * t) * DEG);
  return jde0 + 0.00001 * s / deltaLambda;
}

/**
 * ΔT, dynamical time less universal time, in seconds, from the Espenak–Meeus polynomials published on NASA's
 * eclipse site ("Polynomial expressions for Delta T"), for the decimal year `y`. The calendar needs only the
 * branches from 1700 on.
 */
function deltaT(y: number): number {
  if (y < 1800) { const t = y - 1700; return 8.83 + 0.1603 * t - 0.0059285 * t ** 2 + 0.00013336 * t ** 3 - t ** 4 / 1_174_000; }
  if (y < 1860) {
    const t = y - 1800;
    return 13.72 - 0.332447 * t + 0.0068612 * t ** 2 + 0.0041116 * t ** 3 - 0.00037436 * t ** 4
      + 0.0000121272 * t ** 5 - 0.0000001699 * t ** 6 + 0.000000000875 * t ** 7;
  }
  if (y < 1900) { const t = y - 1860; return 7.62 + 0.5737 * t - 0.251754 * t ** 2 + 0.01680668 * t ** 3 - 0.0004473624 * t ** 4 + t ** 5 / 233_174; }
  if (y < 1920) { const t = y - 1900; return -2.79 + 1.494119 * t - 0.0598939 * t ** 2 + 0.0061966 * t ** 3 - 0.000197 * t ** 4; }
  if (y < 1941) { const t = y - 1920; return 21.2 + 0.84493 * t - 0.0761 * t ** 2 + 0.0020936 * t ** 3; }
  if (y < 1961) { const t = y - 1950; return 29.07 + 0.407 * t - t ** 2 / 233 + t ** 3 / 2547; }
  if (y < 1986) { const t = y - 1975; return 45.45 + 1.067 * t - t ** 2 / 260 - t ** 3 / 718; }
  if (y < 2005) {
    const t = y - 2000;
    return 63.86 + 0.3345 * t - 0.060374 * t ** 2 + 0.0017275 * t ** 3 + 0.000651814 * t ** 4 + 0.00002373599 * t ** 5;
  }
  if (y < 2050) { const t = y - 2000; return 62.92 + 0.32217 * t + 0.005589 * t ** 2; }
  const u = (y - 1820) / 100;
  return y < 2150 ? -20 + 32 * u ** 2 - 0.5628 * (2150 - y) : -20 + 32 * u ** 2;
}

/**
 * The equation of time, true solar time less mean, in milliseconds: Smart's formula as Meeus gives it in
 * equation 28.3, with the Sun's mean longitude and anomaly and the Earth's eccentricity of chapter 25 and the
 * mean obliquity of equation 22.2. `t` counts Julian centuries from J2000.0.
 */
function equationOfTimeMs(t: number): number {
  const l0 = (280.46646 + 36_000.76983 * t + 0.0003032 * t ** 2) * DEG;
  const m = (357.52911 + 35_999.05029 * t - 0.0001537 * t ** 2) * DEG;
  const e = 0.016708634 - 0.000042037 * t - 0.0000001267 * t ** 2;
  const epsilon = (23 + 26 / 60 + (21.448 - 46.815 * t - 0.00059 * t ** 2 + 0.001813 * t ** 3) / 3600) * DEG;
  const y = Math.tan(epsilon / 2) ** 2;
  const radians = y * Math.sin(2 * l0) - 2 * e * Math.sin(m) + 4 * e * y * Math.sin(m) * Math.cos(2 * l0)
    - 0.5 * y ** 2 * Math.sin(4 * l0) - 1.25 * e ** 2 * Math.sin(2 * m);
  return radians / (2 * Math.PI) * DAY_MS;
}

const newYears = new Map<number, number>();

/**
 * The day, counted from 1 January 1970, of the 1 vendémiaire that falls in Gregorian `year`: the day the
 * September equinox falls on by the Paris Observatory's true solar clock.
 */
function newYearDay(year: number): number {
  let day = newYears.get(year);
  if (day === undefined) {
    if (year > LAST_EQUINOX_YEAR) throw new RangeError(`the calendar's equinoxes are reckoned only to ${LAST_EQUINOX_YEAR}: ${year}`);
    const jde = septemberEquinoxJDE(year);
    const ut = (jde - UNIX_EPOCH_JD) * DAY_MS - deltaT(year + 8.5 / 12) * 1000;
    day = Math.floor((ut + PARIS_MERIDIAN_MS + equationOfTimeMs((jde - 2_451_545) / 36_525)) / DAY_MS);
    newYears.set(year, day);
  }
  return day;
}

/**
 * The Republican date of a Gregorian calendar date written `YYYY-MM-DD`. The date is read as written,
 * whatever the process's time zone. Invalid dates, dates before 22 September 1792 and dates after 3000, past
 * the reckoned equinoxes, raise a RangeError.
 */
export function republicanDate(localDate: string): RepublicanDate {
  const parts = localDate.length === 10 ? /^(\d{4})-(\d{2})-(\d{2})$/u.exec(localDate) : null;
  if (!parts) throw new RangeError(`expected a date written YYYY-MM-DD: ${localDate}`);
  const year = Number(parts[1]), month = Number(parts[2]), day = Number(parts[3]);
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const monthLength = month === 2 && leap ? 29 : GREGORIAN_MONTH_LENGTHS[month - 1];
  if (year < 1 || monthLength === undefined || day < 1 || day > monthLength) throw new RangeError(`not a Gregorian date: ${localDate}`);
  if (localDate < "1792-09-22") throw new RangeError(`the Republican calendar begins on 22 September 1792: ${localDate}`);

  const dayNumber = Date.UTC(year, month - 1, day) / DAY_MS;
  const startYear = dayNumber < newYearDay(year) ? year - 1 : year;
  const dayOfYear = dayNumber - newYearDay(startYear);
  const republicanYear = startYear - 1791;
  if (dayOfYear < 360) return { year: republicanYear, month: Math.floor(dayOfYear / 30) + 1, day: dayOfYear % 30 + 1, complementary: false };
  // Every date here comes before the next 1 vendémiaire, so a sixth complementary day comes only in a sextile year.
  return { year: republicanYear, month: null, day: dayOfYear - 359, complementary: true };
}

/** The calendar date `YYYY-MM-DD` in an IANA time zone at an instant. */
export function localDate(at: Date | number, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(at);
}

const ROMAN: readonly (readonly [number, string])[] = [[1000, "M"], [900, "CM"], [500, "D"], [400, "CD"], [100, "C"], [90, "XC"],
  [50, "L"], [40, "XL"], [10, "X"], [9, "IX"], [5, "V"], [4, "IV"], [1, "I"]];

/** A year in Roman numerals, as the Republic numbered its years. */
export function roman(year: number): string {
  let out = "";
  for (const [value, symbol] of ROMAN) while (year >= value) { out += symbol; year -= value; }
  return out;
}
