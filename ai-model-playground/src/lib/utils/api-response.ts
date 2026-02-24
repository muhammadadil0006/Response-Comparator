import { NextResponse } from 'next/server';
import { HttpStatus } from '@/types/enums';

export function successResponse<T>(data: T, status: number = HttpStatus.OK) {
  return NextResponse.json(data, { status });
}

export function errorResponse(message: string, status: number = HttpStatus.BAD_REQUEST) {
  return NextResponse.json({ error: message }, { status });
}

export function createdResponse<T>(data: T) {
  return NextResponse.json(data, { status: HttpStatus.CREATED });
}
