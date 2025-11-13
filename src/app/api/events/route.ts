import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
export const runtime = 'nodejs';

const createSchema = z.object({
  title: z.string().min(1),
  start: z.union([z.string(), z.date()]).transform((v) => new Date(v as any)),
  end: z.union([z.string(), z.date()]).transform((v) => new Date(v as any)),
  allDay: z.boolean().optional(),
  description: z.string().nullable().optional(),
  location: z.string().nullable().optional(),
  color: z.string().nullable().optional(),
}).refine((v) => v.end > v.start, { message: 'end must be greater than start', path: ['end'] });

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const startStr = searchParams.get('start');
    const endStr = searchParams.get('end');

    let events;
    if (startStr && endStr) {
      const start = new Date(startStr);
      const end = new Date(endStr);
      events = await prisma.event.findMany({
        where: {
          AND: [{ start: { lt: end } }, { end: { gt: start } }],
        },
        orderBy: { start: 'asc' },
      });
    } else {
      events = await prisma.event.findMany({ orderBy: { start: 'asc' } });
    }

    return NextResponse.json(events);
  } catch {
    return NextResponse.json({ error: 'Failed to fetch events' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const json = await req.json();
    const body = createSchema.parse(json);
    const created = await prisma.event.create({
      data: {
        title: body.title,
        start: body.start,
        end: body.end,
        allDay: !!body.allDay,
        description: body.description ?? null,
        location: body.location ?? null,
        color: body.color ?? null,
      },
    });

    return NextResponse.json(created, { status: 201 });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation failed', details: err.flatten() }, { status: 400 });
    }
    return NextResponse.json({ error: 'Failed to create event' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

    const body = await req.json();

    const updated = await prisma.event.update({
      where: { id },
      data: {
        title: body.title,
        start: body.start ? new Date(body.start) : undefined,
        end: body.end ? new Date(body.end) : undefined,
        allDay: body.allDay,
        description: body.description,
        location: body.location,
        color: body.color,
      },
    });

    return NextResponse.json(updated);
  } catch {
    return NextResponse.json({ error: 'Failed to update event' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

    await prisma.event.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'Failed to delete event' }, { status: 500 });
  }
}