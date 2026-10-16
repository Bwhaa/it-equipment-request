import { PartialType } from '@nestjs/mapped-types';
import { IsInt, Max, Min } from 'class-validator';
import { CreateEquipmentDto } from './create-equipment.dto';

/** Largest value of the 32-bit `version` column. */
const MAX_INT32 = 2147483647;

export class UpdateEquipmentDto extends PartialType(CreateEquipmentDto) {
  @IsInt()
  @Min(1)
  @Max(MAX_INT32)
  version!: number;
}
