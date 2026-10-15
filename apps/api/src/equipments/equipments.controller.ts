import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import type { Equipment, Paginated } from '@app/shared';
import type { AuthUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { CreateEquipmentDto } from './dto/create-equipment.dto';
import { EquipmentQueryDto } from './dto/equipment-query.dto';
import { UpdateEquipmentDto } from './dto/update-equipment.dto';
import { EquipmentsService } from './equipments.service';

@Controller('equipments')
export class EquipmentsController {
  constructor(private readonly equipmentsService: EquipmentsService) {}

  @Get()
  @Roles('EMPLOYEE', 'ADMIN')
  list(@Query() query: EquipmentQueryDto, @CurrentUser() user: AuthUser): Promise<Paginated<Equipment>> {
    return this.equipmentsService.list(query, user);
  }

  // Must stay above ':id' so "categories" is never captured as an id.
  @Get('categories')
  @Roles('EMPLOYEE', 'ADMIN')
  categories(@CurrentUser() user: AuthUser): Promise<string[]> {
    return this.equipmentsService.categories(user);
  }

  @Get(':id')
  @Roles('EMPLOYEE', 'ADMIN')
  findOne(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser): Promise<Equipment> {
    return this.equipmentsService.findOne(id, user);
  }

  @Post()
  @Roles('ADMIN')
  create(@Body() dto: CreateEquipmentDto): Promise<Equipment> {
    return this.equipmentsService.create(dto);
  }

  @Patch(':id')
  @Roles('ADMIN')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateEquipmentDto): Promise<Equipment> {
    return this.equipmentsService.update(id, dto);
  }
}
