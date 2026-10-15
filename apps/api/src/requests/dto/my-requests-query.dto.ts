import { RequestStatus } from '@prisma/client';
import { IsEnum, IsOptional } from 'class-validator';
import { PageQueryDto } from '../../common/pagination';

/** No `search`: forbidNonWhitelisted turns it into a 400 on /requests/me. */
export class MyRequestsQueryDto extends PageQueryDto {
  @IsOptional()
  @IsEnum(RequestStatus)
  status?: RequestStatus;
}
