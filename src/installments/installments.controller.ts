import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { InstallmentsService } from './installments.service';
import { CreateLoanDto } from './dto/create-loan.dto';
import { UpdateLoanDto } from './dto/update-loan.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('api/installments')
export class InstallmentsController {
  constructor(private readonly installmentsService: InstallmentsService) {}

  @Get()
  async getOverview(@Req() req: any) {
    return this.installmentsService.getOverview(req.user.userId);
  }

  @Post()
  async create(@Req() req: any, @Body() dto: CreateLoanDto) {
    return this.installmentsService.create(req.user.userId, dto);
  }

  @Patch(':id')
  async update(
    @Req() req: any,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateLoanDto,
  ) {
    return this.installmentsService.update(req.user.userId, id, dto);
  }

  @Post(':id/pay')
  async payNext(@Req() req: any, @Param('id', ParseIntPipe) id: number) {
    return this.installmentsService.payNextInstallment(req.user.userId, id);
  }

  @Delete(':id')
  async remove(@Req() req: any, @Param('id', ParseIntPipe) id: number) {
    return this.installmentsService.remove(req.user.userId, id);
  }
}
