import type { Paginated } from '@app/shared';
import { Transform, Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { trim } from './transforms';

export class PaginationQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 10;

  @IsOptional()
  @IsString()
  @Transform(trim)
  @MaxLength(100)
  search?: string;
}

export function toSkipTake(dto: Pick<PaginationQueryDto, 'page' | 'limit'>): { skip: number; take: number } {
  return { skip: (dto.page - 1) * dto.limit, take: dto.limit };
}

export function buildPaginated<T>(data: T[], total: number, page: number, limit: number): Paginated<T> {
  return { data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
}
