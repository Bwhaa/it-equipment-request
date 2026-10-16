import { RequestStatus } from '@prisma/client';
import { IsEnum, IsIn, IsOptional } from 'class-validator';
import { PaginationQueryDto } from '../../common/pagination';

export const REQUEST_SORTS = ['createdAt:desc', 'createdAt:asc'] as const;
export type RequestSort = (typeof REQUEST_SORTS)[number];

export class ListRequestsQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsEnum(RequestStatus)
  status?: RequestStatus;

  @IsOptional()
  @IsIn(REQUEST_SORTS)
  sort: RequestSort = 'createdAt:desc';
}
