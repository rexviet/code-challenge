import { Response } from 'express';
import { ApiResponse, PaginatedData, ValidationError } from '../types/response.types';

export function sendSuccess<T>(
  res: Response,
  message: string,
  data?: T,
  statusCode = 200,
): void {
  const body: ApiResponse<T> = { success: true, message, data };
  res.status(statusCode).json(body);
}

export function sendError(
  res: Response,
  message: string,
  statusCode = 400,
  errors?: ValidationError[],
): void {
  const body: ApiResponse = { success: false, message, errors };
  res.status(statusCode).json(body);
}

export function sendPaginated<T>(
  res: Response,
  message: string,
  paginated: PaginatedData<T>,
): void {
  const body: ApiResponse<PaginatedData<T>> = { success: true, message, data: paginated };
  res.status(200).json(body);
}
