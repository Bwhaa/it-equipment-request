import { Body, Controller, Get, Headers, Param, ParseUUIDPipe, Patch, Post, Query, Res } from '@nestjs/common';
import type { EquipmentRequest, Paginated, RequestDetail } from '@app/shared';
import type { Response } from 'express';
import type { AuthUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { CreateRequestDto } from './dto/create-request.dto';
import { ListRequestsQueryDto } from './dto/list-requests-query.dto';
import { MyRequestsQueryDto } from './dto/my-requests-query.dto';
import { RejectRequestDto } from './dto/reject-request.dto';
import { RequestsService } from './requests.service';

const idempotencyKeyPipe = new ParseUUIDPipe({ optional: true });

@Controller('requests')
export class RequestsController {
  constructor(private readonly requestsService: RequestsService) {}

  @Post()
  @Roles('EMPLOYEE')
  async create(
    @Body() dto: CreateRequestDto,
    @CurrentUser() user: AuthUser,
    @Headers('idempotency-key') idempotencyKeyHeader: string | undefined,
    @Res({ passthrough: true }) res: Response,
  ): Promise<EquipmentRequest> {
    // @Headers() takes no pipes in Nest 11, so the pipe runs here; a missing header stays undefined.
    const validated: unknown =
      idempotencyKeyHeader === undefined ? undefined : await idempotencyKeyPipe.transform(idempotencyKeyHeader, { type: 'custom' });
    const idempotencyKey = typeof validated === 'string' ? validated : undefined;
    const { request, replayed } = await this.requestsService.create(dto, user, idempotencyKey);
    if (replayed) {
      res.status(200);
      res.setHeader('Idempotent-Replayed', 'true');
    }
    return request;
  }

  // Must stay above ':id' so "me" is never captured as an id.
  @Get('me')
  @Roles('EMPLOYEE')
  listMine(@Query() query: MyRequestsQueryDto, @CurrentUser() user: AuthUser): Promise<Paginated<EquipmentRequest>> {
    return this.requestsService.listMine(query, user);
  }

  @Get()
  @Roles('ADMIN')
  listAll(@Query() query: ListRequestsQueryDto): Promise<Paginated<EquipmentRequest>> {
    return this.requestsService.listAll(query);
  }

  @Get(':id')
  @Roles('EMPLOYEE', 'ADMIN')
  findOne(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser): Promise<RequestDetail> {
    return this.requestsService.findOne(id, user);
  }

  @Patch(':id/approve')
  @Roles('ADMIN')
  approve(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser): Promise<EquipmentRequest> {
    return this.requestsService.approve(id, user);
  }

  @Patch(':id/reject')
  @Roles('ADMIN')
  reject(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RejectRequestDto,
    @CurrentUser() user: AuthUser,
  ): Promise<EquipmentRequest> {
    return this.requestsService.reject(id, dto, user);
  }
}
