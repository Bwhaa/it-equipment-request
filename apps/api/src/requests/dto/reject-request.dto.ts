import { Transform } from 'class-transformer';
import { IsString, Length } from 'class-validator';
import { trim } from '../../common/transforms';

export class RejectRequestDto {
  @IsString()
  @Transform(trim)
  @Length(5, 500)
  rejectReason!: string;
}
