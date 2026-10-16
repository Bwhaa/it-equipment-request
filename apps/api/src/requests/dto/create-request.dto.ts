import { Transform } from 'class-transformer';
import { IsInt, IsString, IsUUID, Length, Max, Min } from 'class-validator';
import { trim } from '../../common/transforms';

export class CreateRequestDto {
  @IsUUID()
  equipmentId!: string;

  @IsInt()
  @Min(1)
  @Max(100)
  quantity!: number;

  @IsString()
  @Transform(trim)
  @Length(5, 500)
  reason!: string;
}
