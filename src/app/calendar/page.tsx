'use client';

import { useCallback, useState, useEffect } from 'react';
import { Calendar, dateFnsLocalizer, Views, type Event as RBCEvent } from 'react-big-calendar';
import { format, parse, startOfWeek, getDay, startOfMonth, endOfMonth } from 'date-fns';
import { es } from 'date-fns/locale';

type ApiEvent = {
  id: string;
  title: string;
  start: string; // ISO string desde API
  end: string;   // ISO string desde API
  allDay?: boolean;
  color?: string | null;
};

const locales = { es };

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek, // usa la función de date-fns directamente
  getDay,
  locales,
});

export default function CalendarPage() {
  const [events, setEvents] = useState<RBCEvent[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [range, setRange] = useState<{ start: Date; end: Date } | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [editEvent, setEditEvent] = useState<RBCEvent | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editStart, setEditStart] = useState('');
  const [editEnd, setEditEnd] = useState('');
  const [editColor, setEditColor] = useState<string | undefined>(undefined);
  const [toast, setToast] = useState<string | null>(null);

  const loadEvents = useCallback(async (start: Date, end: Date) => {
    try {
      const res = await fetch(`/api/events?start=${encodeURIComponent(start.toISOString())}&end=${encodeURIComponent(end.toISOString())}`, {
        cache: 'no-cache',
      });
      if (!res.ok) {
        setEvents([]);
        return;
      }
      const data = (await res.json()) as unknown;
      if (!Array.isArray(data)) {
        setEvents([]);
        return;
      }
      setEvents(
        data.map((e: ApiEvent) => ({
          id: e.id,
          title: e.title,
          start: new Date(e.start),
          end: new Date(e.end),
          allDay: e.allDay,
          color: e.color ?? undefined,
        } as unknown as RBCEvent)),
      );
    } catch {
      setEvents([]);
    }
  }, []);

  // Carga inicial del mes actual para que se vean las citas sin interacción
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    const now = new Date();
    const start = startOfMonth(now);
    const end = endOfMonth(now);
    void loadEvents(start, end);
  }, [loadEvents]);

  const onRangeChange = useCallback((range: Date[] | { start: Date; end: Date }) => {
    if (Array.isArray(range)) {
      const start = range[0];
      const end = range[range.length - 1];
      loadEvents(start, end);
    } else {
      loadEvents(range.start, range.end);
    }
  }, [loadEvents]);

  const onSelectSlot = useCallback(({ start, end }: { start: Date; end: Date }) => {
    setRange({ start, end });
    setNewTitle('');
    setCreateOpen(true);
  }, []);

  const toLocalInput = (d: Date) => {
    const pad = (n: number) => String(n).padStart(2, '0');
    const y = d.getFullYear();
    const m = pad(d.getMonth() + 1);
    const day = pad(d.getDate());
    const h = pad(d.getHours());
    const min = pad(d.getMinutes());
    return `${y}-${m}-${day}T${h}:${min}`;
  };

  const onSelectEvent = useCallback((event: RBCEvent) => {
    setEditEvent(event);
    setEditTitle(String(event.title ?? ''));
    setEditStart(toLocalInput(new Date(event.start as Date)));
    setEditEnd(toLocalInput(new Date(event.end as Date)));
    setEditColor((event as any).color as string | undefined);
    setEditOpen(true);
  }, []);

  const handleCreate = useCallback(async () => {
    if (!range || !newTitle.trim()) {
      setCreateOpen(false);
      return;
    }
    const res = await fetch('/api/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: newTitle.trim(),
        start: range.start.toISOString(),
        end: range.end.toISOString(),
        allDay: false,
      }),
    });
    if (res.ok) {
      await loadEvents(range.start, range.end);
    }
    setCreateOpen(false);
  }, [newTitle, range, loadEvents]);

  const handleUpdate = useCallback(async () => {
    if (!editEvent) {
      setEditOpen(false);
      return;
    }
    const id = String((editEvent as any).id);
    const body: any = {
      title: editTitle.trim(),
      start: new Date(editStart).toISOString(),
      end: new Date(editEnd).toISOString(),
      color: editColor ?? null,
    };
    const res = await fetch(`/api/events/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (res.ok) {
      setToast('Cita actualizada');
      const approxStart = new Date(body.start);
      const approxEnd = new Date(body.end);
      await loadEvents(approxStart, approxEnd);
    } else {
      setToast('No se pudo actualizar');
    }
    setEditOpen(false);
    setTimeout(() => setToast(null), 2500);
  }, [editEvent, editTitle, editStart, editEnd, editColor, loadEvents]);

  const handleDelete = useCallback(async () => {
    if (!editEvent) {
      setEditOpen(false);
      return;
    }
    const id = String((editEvent as any).id);
    const res = await fetch(`/api/events/${encodeURIComponent(id)}`, { method: 'DELETE' });
    if (res.ok) {
      setToast('Cita eliminada');
      const approxStart = new Date();
      const approxEnd = new Date();
      approxStart.setMonth(approxStart.getMonth() - 1);
      approxEnd.setMonth(approxEnd.getMonth() + 1);
      await loadEvents(approxStart, approxEnd);
    } else {
      setToast('No se pudo eliminar');
    }
    setEditOpen(false);
    setTimeout(() => setToast(null), 2500);
  }, [editEvent, loadEvents]);

  return (
    <div style={{ padding: 16 }}>
      <h1 style={{ fontSize: 24, marginBottom: 12 }}>Calendario</h1>
      <Calendar
        localizer={localizer}
        culture="es"
        events={events}
        startAccessor="start"
        endAccessor="end"
        selectable
        onSelectSlot={onSelectSlot}
        onSelectEvent={onSelectEvent}
        onRangeChange={onRangeChange}
        views={[Views.MONTH, Views.WEEK, Views.DAY, Views.AGENDA]}
        defaultView={Views.MONTH}
        popup
        style={{ height: 'calc(100vh - 140px)' }}
        messages={{
          today: 'Hoy',
          previous: 'Atrás',
          next: 'Siguiente',
          month: 'Mes',
          week: 'Semana',
          day: 'Día',
          agenda: 'Agenda',
          showMore: (total) => `+${total} más`,
        }}
        eventPropGetter={(event) => {
          const color = (event as any).color as string | undefined;
          return {
            style: {
              backgroundColor: color || '#2563eb',
              color: '#fff',
              borderRadius: 6,
              border: 'none',
            },
          };
        }}
      />
      {createOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
          <div style={{ background: '#fff', borderRadius: 8, padding: 16, width: 360, boxShadow: '0 10px 30px rgba(0,0,0,0.2)' }}>
            <h2 style={{ fontSize: 18, marginBottom: 12, color: '#000' }}>Nueva cita</h2>
            <input
              autoFocus
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="Título"
              style={{ width: '100%', padding: 8, border: '1px solid #ddd', borderRadius: 6, marginBottom: 12, color: '#000' }}
            />
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => setCreateOpen(false)} style={{ padding: '8px 12px', borderRadius: 6, background: '#c00', color: '#fff' }}>Cancelar</button>
              <button onClick={handleCreate} style={{ padding: '8px 12px', borderRadius: 6, background: '#111', color: '#fff' }}>Crear</button>
            </div>
          </div>
        </div>
      )}
      {editOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
          <div style={{ background: '#fff', borderRadius: 8, padding: 16, width: 420, boxShadow: '0 10px 30px rgba(0,0,0,0.2)' }}>
            <h2 style={{ fontSize: 18, marginBottom: 12, color: '#000' }}>Editar cita</h2>
            <label style={{ display: 'block', fontSize: 12, marginBottom: 6 }}>Título</label>
            <input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} style={{ width: '100%', padding: 8, border: '1px solid #ddd', borderRadius: 6, marginBottom: 12, color: '#000' }} />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, marginBottom: 6 }}>Inicio</label>
                <input type="datetime-local" value={editStart} onChange={(e) => setEditStart(e.target.value)} style={{ width: '100%', padding: 8, border: '1px solid #ddd', borderRadius: 6, marginBottom: 12, color: '#000' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, marginBottom: 6 }}>Fin</label>
                <input type="datetime-local" value={editEnd} onChange={(e) => setEditEnd(e.target.value)} style={{ width: '100%', padding: 8, border: '1px solid #ddd', borderRadius: 6, marginBottom: 12, color: '#000' }} />
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <label style={{ fontSize: 12 }}>Color</label>
              <input type="color" value={editColor || '#2563eb'} onChange={(e) => setEditColor(e.target.value)} />
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'space-between' }}>
              <button onClick={handleDelete} style={{ padding: '8px 12px', borderRadius: 6, background: '#c00', color: '#fff' }}>Eliminar</button>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => setEditOpen(false)} style={{ padding: '8px 12px', borderRadius: 6, background: '#c00', color: '#fff' }}>Cancelar</button>
                <button onClick={handleUpdate} style={{ padding: '8px 12px', borderRadius: 6, background: '#111', color: '#fff' }}>Guardar</button>
              </div>
            </div>
          </div>
        </div>
      )}
      {toast && (
        <div style={{ position: 'fixed', right: 16, bottom: 16, background: '#111', color: '#fff', padding: '10px 12px', borderRadius: 8, boxShadow: '0 6px 20px rgba(0,0,0,0.2)', zIndex: 60 }}>
          {toast}
        </div>
      )}
    </div>
  );
}
