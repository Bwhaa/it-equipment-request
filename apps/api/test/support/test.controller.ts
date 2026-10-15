import { Body, ConflictException, Controller, Get, NotFoundException, Post, Query } from '@nestjs/common';
import { Transform } from 'class-transformer';
import { IsInt, IsString, Length, Max, Min } from 'class-validator';
import { Public } from '../../src/auth/decorators/public.decorator';
import { PaginationQueryDto } from '../../src/common/pagination';
import { trim } from '../../src/common/transforms';

class ValidateDto {
  @IsInt()
  @Min(1)
  @Max(100)
  quantity!: number;

  @IsString()
  @Transform(trim)
  @Length(5, 500)
  reason!: string;
}

/** TEST-ONLY controller: registered via createTestApp({ controllers }), never in AppModule. */
// @Public(): these routes exercise the common layer, not auth (auth e2e uses AuthTestController).
@Public()
@Controller('__test')
export class TestController {
  @Post('validate')
  validate(@Body() dto: ValidateDto): ValidateDto {
    return dto;
  }

  @Get('page')
  page(@Query() query: PaginationQueryDto): Record<string, unknown> {
    return {
      page: query.page,
      limit: query.limit,
      search: query.search,
      types: { page: typeof query.page, limit: typeof query.limit, search: typeof query.search },
    };
  }

  @Get('conflict')
  conflict(): never {
    throw new ConflictException({ code: 'INVALID_STATUS', message: 'x' });
  }

  @Get('conflict-nocode')
  conflictNoCode(): never {
    throw new ConflictException('plain');
  }

  @Get('boom')
  boom(): never {
    throw new Error('boom secret detail');
  }

  @Get('mismatch')
  mismatch(): never {
    throw new NotFoundException({ code: 'INSUFFICIENT_STOCK', message: 'y' });
  }
}
