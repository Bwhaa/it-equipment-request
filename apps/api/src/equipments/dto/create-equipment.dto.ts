import { EquipmentStatus } from '@prisma/client';
import { Transform } from 'class-transformer';
import { IsEnum, IsInt, IsString, Length, Max, Min, ValidateIf } from 'class-validator';
import { trim } from '../../common/transforms';

export class CreateEquipmentDto {
  @IsString()
  @Transform(trim)
  @Length(1, 120)
  name!: string;

  @IsString()
  @Transform(trim)
  @Length(1, 60)
  category!: string;

  @IsInt()
  @Min(0)
  @Max(100000)
  stockQuantity!: number;

  // No default here (UpdateEquipmentDto copies initializers); the default is @default(ACTIVE) in Prisma.
  // ValidateIf instead of IsOptional so that an explicit `null` is rejected with 400, not passed to Prisma.
  @ValidateIf((_object, value) => value !== undefined)
  @IsEnum(EquipmentStatus)
  status?: EquipmentStatus;
}
