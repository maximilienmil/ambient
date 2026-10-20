import ICAL from 'ical.js';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';

// Embedded VTIMEZONE definitions are registered before any dates are converted.
// Floating times require an explicit import timezone; they are never assumed UTC.
export function parseIcs(text, { from = '2025-01-01T00:00:00Z', to = '2027-01-01T00:00:00Z', source = 'calendar', timezone = null } = {}) {
  const root = new ICAL.Component(ICAL.parse(text));
  for (const zone of root.getAllSubcomponents('vtimezone')) ICAL.TimezoneService.register(zone);
  const components = root.getAllSubcomponents('vevent');
  const exceptions = components.filter(c => c.hasProperty('recurrence-id')).map(c => new ICAL.Event(c));
  const events = []; let skippedFloating = 0;
  const low = Date.parse(from), high = Date.parse(to);
  const instant = time => {
    if (!time.isDate && time.zone.tzid === 'floating') {
      if (!timezone || !ICAL.TimezoneService.has(timezone)) return null;
      time = time.clone(); time.zone = ICAL.TimezoneService.get(timezone);
    }
    return time.toJSDate().getTime();
  };
  for (const comp of components.filter(c => !c.hasProperty('recurrence-id'))) {
    const event = new ICAL.Event(comp);
    if (!event.startDate) continue;
    for (const exception of exceptions.filter(e => e.uid === event.uid)) event.relateException(exception);
    const iterator = event.iterator(); let iterations = 0;
    while (iterations++ < 100000) {
      const occurrence = iterator.next(); if (!occurrence) break;
      const detail = event.getOccurrenceDetails(occurrence);
      const start = instant(detail.startDate), end = instant(detail.endDate);
      if (start === null || end === null) { skippedFloating++; break; }
      if (start >= high) break;
      if (end <= low) continue;
      const actual = detail.item.component;
      const status = String(actual.getFirstPropertyValue('status') || '').toLowerCase();
      if (status === 'cancelled') continue;
      const created = actual.getFirstPropertyValue('created');
      events.push({
        id: createHash('sha256').update(`${source}:${event.uid}:${occurrence.toString()}`).digest('hex'),
        uid: event.uid, source, start: new Date(start).toISOString(), end: new Date(end).toISOString(),
        summary: detail.item.summary || '', location: detail.item.location || '',
        createdAt: created ? created.toJSDate().toISOString() : null,
        allDay: detail.startDate.isDate, status,
        transparency: String(actual.getFirstPropertyValue('transp') || 'opaque').toLowerCase(),
      });
      if (!event.isRecurring()) break;
    }
    if (iterations >= 100000) throw new Error('Calendar recurrence exceeds the safe expansion limit.');
  }
  return { events, skippedFloating, sourceEvents: components.length };
}

export async function loadCalendars(directory, options = {}) {
  let files; try { files = (await readdir(directory)).filter(n => n.endsWith('.ics')).sort(); }
  catch (e) { if (e.code === 'ENOENT') return { events: [], files: 0, sourceEvents: 0, skippedFloating: 0 }; throw e; }
  const result = { events: [], files: files.length, sourceEvents: 0, skippedFloating: 0 };
  for (const file of files) {
    const parsed = parseIcs(await readFile(path.join(directory, file), 'utf8'), { ...options, source: file });
    result.events.push(...parsed.events); result.sourceEvents += parsed.sourceEvents; result.skippedFloating += parsed.skippedFloating;
  }
  result.events.sort((a,b) => a.start.localeCompare(b.start));
  return result;
}
