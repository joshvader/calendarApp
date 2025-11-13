import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

export const runtime = 'nodejs';

const patchSchema = z.object({
  title: z.string().min(1).optional(),
  start: z.union([z.string(), z.date()]).transform((v) => (v ? new Date(v as any) : undefined)).optional(),
  end: z.union([z.string(), z.date()]).transform((v) => (v ? new Date(v as any) : undefined)).optional(),
  allDay: z.boolean().optional(),
  description: z.string().nullable().optional(),
  location: z.string().nullable().optional(),
  color: z.string().nullable().optional(),
}).refine((data) => {
  if (data.start && data.end) return data.end > data.start;
  return true;
}, { message: 'end must be greater than start', path: ['end'] });

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const event = await prisma.event.findUnique({ where: { id } });
    if (!event) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json(event);
  } catch {
    return NextResponse.json({ error: 'Failed to fetch event' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const json = await req.json();
    const body = patchSchema.parse(json);
    const updated = await prisma.event.update({
      where: { id },
      data: {
        title: body.title,
        start: body.start,
        end: body.end,
        allDay: body.allDay,
        description: body.description,
        location: body.location,
        color: body.color,
      },
    });
    return NextResponse.json(updated);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation failed', details: err.flatten() }, { status: 400 });
    }
    return NextResponse.json({ error: 'Failed to update event' }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await prisma.event.delete({ where: { id } });
    return new NextResponse(null, { status: 204 });
  } catch {
    return NextResponse.json({ error: 'Failed to delete event' }, { status: 500 });
  }
}