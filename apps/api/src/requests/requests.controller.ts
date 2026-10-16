import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import type { EquipmentRequest, Paginated, RequestDetail } from '@app/shared';
import type { AuthUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { CreateRequestDto } from './dto/create-request.dto';
import { ListRequestsQueryDto } from './dto/list-requests-query.dto';
import { MyRequestsQueryDto } from './dto/my-requests-query.dto';
import { RejectRequestDto } from './dto/reject-request.dto';
import { RequestsService } from './requests.service';

@Controller('requests')
export class RequestsController {
  constructor(private readonly requestsService: RequestsService) {}

  @Post()
  @Roles('EMPLOYEE')
  create(@Body() dto: CreateRequestDto, @CurrentUser() user: AuthUser): Promise<EquipmentRequest> {
    return this.requestsService.create(dto, user);
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
