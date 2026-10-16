import { EquipmentStatus } from '@prisma/client';
import { Transform } from 'class-transformer';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { PaginationQueryDto } from '../../common/pagination';
import { trim } from '../../common/transforms';

export class EquipmentQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsString()
  @Transform(trim)
  @MaxLength(60)
  category?: string;

  @IsOptional()
  @IsEnum(EquipmentStatus)
  status?: EquipmentStatus;
}
